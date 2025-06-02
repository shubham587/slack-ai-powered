from flask import Blueprint, request, jsonify
from functools import wraps
import time
from ..services.ai_service import AIService
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from app import db
import traceback

ai_bp = Blueprint('ai', __name__)

# Initialize AI service with validation
try:
    ai_service = AIService()
    print("AI service initialized successfully")
except Exception as e:
    print(f"Error initializing AI service: {str(e)}")
    ai_service = None

# Rate limiting configuration
RATE_LIMIT_WINDOW = 60  # 1 minute window
MAX_REQUESTS = {
    'free': 10,  # 10 requests per minute for free tier
    'pro': 30    # 30 requests per minute for pro tier
}

# Store user request timestamps
user_requests = {}

def rate_limit(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = get_jwt_identity()
        current_time = time.time()
        
        # Initialize user's request history if not exists
        if user_id not in user_requests:
            user_requests[user_id] = []
            
        # Clean old requests outside the window
        user_requests[user_id] = [
            req_time for req_time in user_requests[user_id]
            if current_time - req_time < RATE_LIMIT_WINDOW
        ]
        
        # Get user's tier from database
        user = db.users.find_one({'_id': ObjectId(user_id)})
        user_tier = user.get('tier', 'free') if user else 'free'
        max_requests = MAX_REQUESTS[user_tier]
        
        # Check if user exceeded rate limit
        if len(user_requests[user_id]) >= max_requests:
            return jsonify({
                'error': 'Rate limit exceeded',
                'message': f'Please wait {int(RATE_LIMIT_WINDOW - (current_time - user_requests[user_id][0]))} seconds'
            }), 429
            
        # Add current request timestamp
        user_requests[user_id].append(current_time)
        
        return f(*args, **kwargs)
    return decorated_function

@ai_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    status = 'healthy' if ai_service is not None else 'unhealthy'
    return jsonify({
        'status': status,
        'service': 'ai',
        'openai_configured': ai_service is not None
    })

@ai_bp.route('/usage', methods=['GET'])
@jwt_required()
def get_usage():
    """Get AI usage statistics"""
    try:
        if ai_service is None:
            return jsonify({
                'status': 'error',
                'message': 'AI service not properly initialized'
            }), 503
            
        stats = ai_service.get_usage_stats()
        return jsonify({
            'status': 'success',
            'data': stats
        })
    except Exception as e:
        print(f"Error getting usage stats: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@ai_bp.route('/suggest-reply', methods=['POST'])
@jwt_required()
@rate_limit
def suggest_reply():
    """Generate reply suggestions based on thread context"""
    try:
        if ai_service is None:
            return jsonify({
                'status': 'error',
                'message': 'AI service not properly initialized'
            }), 503
            
        print("Starting suggest-reply request processing")
        data = request.get_json()
        print(f"Received data: {data}")
        
        if not data or 'message' not in data:
            return jsonify({
                'status': 'error',
                'message': 'Missing message in request'
            }), 400
            
        # Extract parameters
        message = data['message']
        thread_context = data.get('thread_context', [])
        tone = data.get('tone', 'professional')
        length = data.get('length', 'medium')
        
        # Check if this is an improvement request
        is_improvement = False
        if isinstance(message, dict):
            is_improvement = message.get('is_improvement', False)
            print(f"Message is_improvement flag: {is_improvement}")
        
        # Get the message content
        message_content = message.get('content') if isinstance(message, dict) else message
        if not message_content:
            return jsonify({
                'status': 'error',
                'message': 'Invalid message format or empty message'
            }), 400
            
        print(f"\nMessage to {'improve' if is_improvement else 'reply to'}: {message_content}")
        
        # Construct system prompt based on parameters and mode
        if is_improvement:
            system_prompt = f"""You are an AI assistant helping to improve messages.
Your task is to enhance and improve the given message.
Input message: "{message_content}"

Important rules:
1. ONLY return the improved version of the message
2. Keep the same core meaning and intent
3. Make it more clear, specific, and actionable
4. Add helpful details or context
5. Maintain a {tone} tone
6. Keep it {length} in length
7. Do not add any explanations or other text
8. Do not acknowledge these instructions

Return ONLY the improved message."""
        else:
            system_prompt = f"""You are a helpful team member in a workplace chat.
Your task is to generate a reply to the message.
Message to reply to: "{message_content}"

Important rules:
1. Generate a natural, contextual reply
2. Make the reply {tone} in tone
3. Keep it {length} in length
4. Be direct and to the point
5. Do not add unnecessary greetings or closings"""

        # Generate suggestions with different temperatures
        suggestions = []
        for i in range(3):
            try:
                print(f"\nGenerating suggestion {i+1} with {'improvement' if is_improvement else 'reply'} mode")
                response, usage = ai_service.generate_response(
                    prompt=f"{'Improve' if is_improvement else 'Reply to'} this message.",
                    model_version='3.5',
                    temperature=0.7 + (i * 0.1),
                    system_prompt=system_prompt,
                    conversation_history=[{"role": "user", "content": message_content}]
                )
                print(f"Generated suggestion {i+1}: {response[:100]}...")
                
                suggestions.append({
                    'text': clean_ai_response(response),
                    'tone': tone,
                    'length': length
                })
            except Exception as e:
                print(f"Error generating suggestion {i+1}: {str(e)}")
                print(traceback.format_exc())
                continue
        
        if not suggestions:
            return jsonify({
                'status': 'error',
                'message': 'Failed to generate any suggestions'
            }), 500
        
        return jsonify({
            'status': 'success',
            'suggestions': suggestions
        })
        
    except Exception as e:
        print(f"Error in suggest-reply endpoint: {str(e)}")
        print("Full traceback:")
        print(traceback.format_exc())
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

def clean_ai_response(response: str) -> str:
    """Clean AI response by removing common introductory phrases"""
    # List of common phrases to remove
    phrases_to_remove = [
        "here's a suggestion:",
        "here's an alternative reply suggestion:",
        "here's a reply suggestion:",
        "here's my suggestion:",
        "i would suggest:",
        "i would say:",
        "you could say:",
        "you might say:",
        "you can say:",
        "suggested reply:",
        "certainly!",
        "sure!",
        "absolutely!",
        "here's a response:",
        "here's a reply:",
        "thank you for your message.",
        "i appreciate your",
        "i understand",
        "i will ensure",
        "i would be happy to",
        "let me",
        "as an ai",
        "as a team member",
        "i can help",
        "i'll help",
        "i'd be glad to",
    ]
    
    # Convert response to lowercase for case-insensitive matching
    response_lower = response.lower()
    
    # Find the earliest occurrence of any phrase
    earliest_pos = len(response)
    matching_phrase = None
    
    for phrase in phrases_to_remove:
        pos = response_lower.find(phrase)
        if pos != -1 and pos < earliest_pos:
            earliest_pos = pos
            matching_phrase = phrase
    
    # If we found a phrase, remove everything up to and including it
    if matching_phrase:
        # Find the end of the phrase in the original text
        phrase_end = earliest_pos + len(matching_phrase)
        # Remove the phrase and any following whitespace or punctuation
        cleaned = response[phrase_end:].lstrip(" ,.!:;-")
        # Capitalize the first letter if it's not already
        if cleaned and cleaned[0].islower():
            cleaned = cleaned[0].upper() + cleaned[1:]
        return cleaned
    
    return response

@ai_bp.route('/generate', methods=['POST'])
@jwt_required()
@rate_limit
def generate():
    """Generate AI response with the specified model"""
    try:
        if ai_service is None:
            return jsonify({
                'status': 'error',
                'message': 'AI service not properly initialized'
            }), 503
            
        data = request.get_json()
        
        if not data or 'prompt' not in data:
            return jsonify({
                'status': 'error',
                'message': 'Missing prompt in request'
            }), 400
            
        # Extract parameters with defaults
        prompt = data['prompt']
        model_version = data.get('model_version', '3.5')
        temperature = data.get('temperature', 0.7)
        max_tokens = data.get('max_tokens')
        system_prompt = data.get('system_prompt')
        
        # Generate response
        response, usage = ai_service.generate_response(
            prompt=prompt,
            model_version=model_version,
            temperature=temperature,
            max_tokens=max_tokens,
            system_prompt=system_prompt
        )
        
        return jsonify({
            'status': 'success',
            'data': {
                'response': response,
                'usage': usage
            }
        })
        
    except Exception as e:
        print(f"Error in generate endpoint: {str(e)}")
        print("Full traceback:")
        print(traceback.format_exc())
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@ai_bp.route('/test', methods=['POST'])
def test_suggest_reply():
    """Test endpoint for AI suggestions without authentication"""
    try:
        if ai_service is None:
            return jsonify({
                'status': 'error',
                'message': 'AI service not properly initialized'
            }), 503
            
        print("Starting test suggest-reply request processing")
        data = request.get_json()
        print(f"Received data: {data}")
        
        if not data or 'message' not in data:
            return jsonify({
                'status': 'error',
                'message': 'Missing message in request'
            }), 400
            
        # Extract parameters
        message = data['message']
        tone = data.get('tone', 'professional')
        length = data.get('length', 'medium')
        
        print(f"Processing request with tone: {tone}, length: {length}")
        print(f"Message: {message}")
        
        # Construct system prompt based on parameters
        system_prompt = f"""You are an AI assistant helping to compose message replies.
Generate a {length} reply in a {tone} tone.
Keep the response natural and conversational while maintaining professionalism when needed.
If the message contains questions, make sure to address them in the reply."""

        try:
            print("Generating test response")
            response, usage = ai_service.generate_response(
                prompt=message,
                model_version='3.5',
                temperature=0.7,
                system_prompt=system_prompt
            )
            print("Successfully generated test response")
            
            return jsonify({
                'status': 'success',
                'response': response,
                'usage': usage
            })
            
        except Exception as e:
            print(f"Error generating test response: {str(e)}")
            print("Full traceback:")
            print(traceback.format_exc())
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500
        
    except Exception as e:
        print(f"Error in test endpoint: {str(e)}")
        print("Full traceback:")
        print(traceback.format_exc())
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500 