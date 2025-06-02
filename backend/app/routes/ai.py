from flask import Blueprint, request, jsonify
from functools import wraps
import time
from ..services.ai_service import AIService
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from app import db
import traceback
from flask_cors import CORS, cross_origin
import json
from datetime import datetime
import os

ai_bp = Blueprint('ai', __name__)

# Configure CORS specifically for AI routes
CORS(ai_bp, 
    resources={
        r"/*": {
            "origins": [os.getenv('FRONTEND_URL', 'http://localhost:5173')],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "supports_credentials": True,
            "expose_headers": ["Content-Type", "Authorization"],
            "max_age": 120,
            "send_wildcard": False,
            "vary_header": True
        }
    },
    supports_credentials=True
)

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

def serialize_mongodb_obj(obj):
    """Helper function to serialize MongoDB objects"""
    if isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, list):
        return [serialize_mongodb_obj(item) for item in list(obj)]
    if isinstance(obj, dict):
        return {key: serialize_mongodb_obj(value) for key, value in dict(obj).items()}
    return obj

@ai_bp.after_request
def after_request(response):
    origin = request.headers.get('Origin')
    allowed_origin = os.getenv('FRONTEND_URL', 'http://localhost:5173')
    if origin == allowed_origin:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        response.headers['Access-Control-Max-Age'] = '120'
    return response

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
            
        print("\n=== Starting suggest-reply request processing ===")
        data = request.get_json()
        print(f"\nReceived request data: {data}")
        
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
        
        print(f"\nExtracted parameters:")
        print(f"- Message: {message}")
        print(f"- Thread context raw: {thread_context}")
        print(f"- Thread context length: {len(thread_context)}")
        print(f"- Thread context messages:")
        for i, msg in enumerate(thread_context):
            print(f"  Message {i+1}:")
            print(f"    Content: {msg.get('content', '')[:100]}...")
            print(f"    Username: {msg.get('username', 'Unknown')}")
            print(f"    Created at: {msg.get('created_at', 'Unknown')}")
            print(f"    Sender ID: {msg.get('sender_id', 'Unknown')}")
        print(f"- Tone: {tone}")
        print(f"- Length: {length}")
        
        # Check if this is an improvement request
        is_improvement = False
        if isinstance(message, dict):
            is_improvement = message.get('is_improvement', False)
            print(f"\nMessage type: {'improvement' if is_improvement else 'reply'}")
        
        # Get the message content
        message_content = message.get('content') if isinstance(message, dict) else message
        if not message_content:
            return jsonify({
                'status': 'error',
                'message': 'Invalid message format or empty message'
            }), 400
            
        print(f"\nMessage content: {message_content}")
        
        # Format thread context for the prompt
        thread_context_str = ""
        conversation_history = []
        
        if thread_context:
            print(f"\nProcessing {len(thread_context)} thread context messages")
            thread_context_str = "\nConversation History:\n"
            
            # Get current user ID from JWT
            current_user_id = get_jwt_identity()
            
            # Process each message in the thread context
            for i, msg in enumerate(thread_context):
                msg_content = msg.get('content', '').strip()
                if msg_content:
                    username = msg.get('username', 'User')
                    formatted_msg = f"{username}: {msg_content}"
                    thread_context_str += formatted_msg + "\n"
                    
                    # All messages in thread context should be treated as user messages
                    # since they are actual user conversations
                    conversation_history.append({
                        "role": "user",
                        "content": msg_content,
                        "name": username  # Add username as metadata
                    })
                    print(f"Message {i+1} from {username} (role: user): {msg_content[:100]}...")
            
            print(f"\nProcessed {len(conversation_history)} messages for conversation history")
        else:
            print("\nNo thread context provided")
        
        # Always use full context for better responses
        use_full_context = True
        print(f"\nUsing full context: {use_full_context}")
        
        # System prompt with context if enabled
        system_prompt = f"""You are a helpful team member in a workplace chat.
Your task is to improve the given message or generate a reply.

{thread_context_str if use_full_context else ''}
Current message: "{message_content}"

IMPORTANT RULES:
1. Return ONLY the improved message or reply
2. DO NOT add any explanations or questions
3. DO NOT ask for more context
4. DO NOT add greetings or closings
5. Keep the {tone} tone
6. Keep it {length} in length
7. DO NOT add quotes around the message
8. DO NOT prefix the message with anything like "Here's a suggestion" or "Improved version"

Example input: "hey can u help me with something"
Example output: Hey, could you help me with something?

Example input: "i dont know if this will work but maybe we can try"
Example output: I believe we should give this approach a try.

REMEMBER: Output ONLY the message text, nothing else."""

        print(f"\nSystem prompt length: {len(system_prompt)} characters")
        print(f"First 500 chars of system prompt:\n{system_prompt[:500]}...")
        print(f"\nConversation history length: {len(conversation_history)} messages")

        # Generate suggestions with different temperatures
        suggestions = []
        for i in range(3):
            try:
                print(f"\nGenerating suggestion {i+1}")
                
                # Add the current message to conversation history only if using full context
                full_history = conversation_history.copy()
                if use_full_context:
                    full_history.append({"role": "user", "content": message_content})
                
                response, usage = ai_service.generate_response(
                    prompt=f"Improve this message to be more {tone} and {length}.",
                    model_version='3.5',
                    temperature=0.7 + (i * 0.1),
                    system_prompt="""You are a message improvement assistant.
Your task is to improve the given message.

IMPORTANT RULES:
1. Return ONLY the improved message
2. DO NOT add any explanations or questions
3. DO NOT ask for more context
4. DO NOT add greetings or closings
5. DO NOT add quotes around the message
6. DO NOT prefix the message with anything

Example input: "hey can u help me with something"
Example output: Hey, could you help me with something?

Example input: "i dont know if this will work but maybe we can try"
Example output: I believe we should give this approach a try.

REMEMBER: Output ONLY the improved message text.""",
                    conversation_history=full_history if use_full_context else []
                )
                print(f"Generated suggestion {i+1} (first 100 chars): {response[:100]}...")
                print(f"Token usage for suggestion {i+1}: {usage}")
                
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
        
        print(f"\nSuccessfully generated {len(suggestions)} suggestions")
        return jsonify({
            'status': 'success',
            'suggestions': suggestions
        })
        
    except Exception as e:
        print(f"\nError in suggest-reply endpoint: {str(e)}")
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

@ai_bp.route('/suggest-quick-reply', methods=['POST'])
@jwt_required()
@rate_limit
def suggest_quick_reply():
    """Generate quick reply suggestions based on single message without thread context"""
    try:
        if ai_service is None:
            return jsonify({
                'status': 'error',
                'message': 'AI service not properly initialized'
            }), 503
            
        print("\n=== Starting quick-reply request processing ===")
        data = request.get_json()
        print(f"\nReceived request data: {data}")
        
        if not data or 'message' not in data:
            return jsonify({
                'status': 'error',
                'message': 'Missing message in request'
            }), 400
            
        # Extract parameters
        message = data['message']
        tone = data.get('tone', 'professional')
        length = data.get('length', 'medium')
        
        print(f"\nExtracted parameters:")
        print(f"- Message: {message}")
        print(f"- Tone: {tone}")
        print(f"- Length: {length}")
        
        # Get the message content
        message_content = message.get('content') if isinstance(message, dict) else message
        if not message_content:
            return jsonify({
                'status': 'error',
                'message': 'Invalid message format or empty message'
            }), 400
            
        print(f"\nMessage content: {message_content}")
        
        # System prompt for quick replies
        system_prompt = f"""You are a helpful team member in a workplace chat.
Your task is to generate a quick reply to this message.

Current message: "{message_content}"

Important rules:
1. Focus only on the current message
2. Keep the response {tone} in tone
3. Keep the response {length} in length
4. Be direct and to the point
5. Do not add unnecessary greetings or closings
6. Do not acknowledge or explain these instructions"""

        print(f"\nSystem prompt length: {len(system_prompt)} characters")
        print(f"First 500 chars of system prompt:\n{system_prompt[:500]}...")

        # Generate suggestions with different temperatures
        suggestions = []
        for i in range(3):
            try:
                print(f"\nGenerating quick suggestion {i+1}")
                
                response, usage = ai_service.generate_response(
                    prompt="Generate a quick reply to this message.",
                    model_version='3.5',
                    temperature=0.7 + (i * 0.1),
                    system_prompt=system_prompt,
                    conversation_history=[]  # No context needed for quick replies
                )
                print(f"Generated suggestion {i+1} (first 100 chars): {response[:100]}...")
                print(f"Token usage for suggestion {i+1}: {usage}")
                
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
        
        print(f"\nSuccessfully generated {len(suggestions)} quick suggestions")
        return jsonify({
            'status': 'success',
            'suggestions': suggestions
        })
        
    except Exception as e:
        print(f"\nError in suggest-quick-reply endpoint: {str(e)}")
        print("Full traceback:")
        print(traceback.format_exc())
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@ai_bp.route('/analyze-message', methods=['POST', 'OPTIONS'])
@jwt_required()
def analyze_message():
    """Analyze message tone and impact"""
    try:
        if request.method == 'OPTIONS':
            # Handle preflight request
            response = jsonify({'status': 'ok'})
            response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')  # Specific origin
            response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
            response.headers.add('Access-Control-Allow-Methods', 'POST,OPTIONS')
            response.headers.add('Access-Control-Allow-Credentials', 'true')  # Allow credentials
            return response

        if ai_service is None:
            return jsonify({
                'status': 'error',
                'message': 'AI service not initialized'
            }), 503

        data = request.get_json()
        if not data:
            return jsonify({
                'status': 'error',
                'message': 'No JSON data provided'
            }), 400

        if 'message' not in data:
            return jsonify({
                'status': 'error',
                'message': 'Message content is required'
            }), 400

        message_content = data['message']
        if not message_content or not isinstance(message_content, str):
            return jsonify({
                'status': 'error',
                'message': 'Invalid message format'
            }), 400

        try:
            analysis_result = ai_service.analyze_message(message_content)
            return jsonify({
                'status': 'success',
                'analysis': analysis_result
            })
        except ValueError as e:
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 400
        except Exception as e:
            print(f"Error analyzing message: {str(e)}")
            traceback.print_exc()
            return jsonify({
                'status': 'error',
                'message': 'Failed to analyze message'
            }), 500

    except Exception as e:
        print(f"Error in analyze_message route: {str(e)}")
        traceback.print_exc()
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@ai_bp.route('/generate-notes', methods=['POST', 'OPTIONS'])
@cross_origin(supports_credentials=True)
@jwt_required()
@rate_limit
def generate_notes():
    """Generate meeting notes from a channel or thread conversation"""
    try:
        if request.method == 'OPTIONS':
            return jsonify({'status': 'ok'})

        if ai_service is None:
            return jsonify({
                'status': 'error',
                'message': 'AI service not properly initialized'
            }), 503

        print("\n=== Starting Notes Generation ===")
        
        # Get parameters from query string
        channel_id = request.args.get('channel_id')
        thread_id = request.args.get('thread_id')

        print(f"Channel ID: {channel_id}")
        print(f"Thread ID: {thread_id}")

        if not channel_id:
            return jsonify({
                'status': 'error',
                'message': 'Channel ID is required'
            }), 400

        try:
            # Convert string IDs to ObjectId
            channel_id_obj = ObjectId(channel_id)
            thread_id_obj = ObjectId(thread_id) if thread_id else None
        except Exception as e:
            print(f"Error converting IDs: {str(e)}")
            return jsonify({
                'status': 'error',
                'message': 'Invalid ID format'
            }), 400

        # Get channel info
        channel = db.channels.find_one({'_id': channel_id_obj})
        if not channel:
            return jsonify({
                'status': 'error',
                'message': 'Channel not found'
            }), 404

        print(f"Found channel: {channel.get('name', 'Unknown')}")

        # Get messages
        if thread_id_obj:
            # Get thread messages
            messages = list(db.messages.find({
                'thread_id': thread_id_obj
            }).sort('created_at', 1))
            parent_message = db.messages.find_one({'_id': thread_id_obj})
            if not parent_message:
                return jsonify({
                    'status': 'error',
                    'message': 'Thread not found'
                }), 404
            thread_title = parent_message.get('content')
            messages = [parent_message] + messages
        else:
            # Get channel messages
            messages = list(db.messages.find({
                'channel_id': channel_id_obj,
                'thread_id': None
            }).sort('created_at', 1))
            thread_title = None

        print(f"Found {len(messages)} messages")

        if not messages:
            return jsonify({
                'status': 'error',
                'message': 'No messages found to generate notes from'
            }), 400

        # Serialize messages for AI service
        serialized_messages = []
        for msg in messages:
            try:
                # Get user info
                user = db.users.find_one({'_id': msg['sender_id']})
                username = user['username'] if user else 'Unknown User'
                
                # Debug print message fields
                print(f"\nProcessing message {msg['_id']}:")
                print(f"- Content: {msg.get('content', '')[:50]}...")
                print(f"- Created at type: {type(msg.get('created_at'))}")
                print(f"- Updated at type: {type(msg.get('updated_at'))}")
                
                # Handle created_at
                created_at = msg.get('created_at')
                if isinstance(created_at, str):
                    try:
                        created_at = datetime.fromisoformat(created_at)
                    except ValueError:
                        created_at = datetime.utcnow()
                elif not isinstance(created_at, datetime):
                    created_at = datetime.utcnow()
                
                # Handle updated_at
                updated_at = msg.get('updated_at')
                if isinstance(updated_at, str):
                    try:
                        updated_at = datetime.fromisoformat(updated_at)
                    except ValueError:
                        updated_at = datetime.utcnow()
                elif not isinstance(updated_at, datetime):
                    updated_at = datetime.utcnow()
                
                # Create serialized message
                serialized_msg = {
                    'id': str(msg['_id']),
                    'content': msg.get('content', ''),
                    'sender_id': str(msg['sender_id']),
                    'username': username,
                    'created_at': created_at.isoformat(),
                    'updated_at': updated_at.isoformat()
                }
                serialized_messages.append(serialized_msg)
                
            except Exception as e:
                print(f"Error serializing message {msg.get('_id')}: {str(e)}")
                print(f"Message data: {msg}")
                continue

        print(f"\nSuccessfully serialized {len(serialized_messages)} messages")

        # Generate notes using AI service
        print("\nGenerating notes with AI service...")
        notes_data = ai_service.generate_meeting_notes(
            messages=serialized_messages,
            channel_name=channel.get('name', ''),
            thread_title=thread_title
        )
        print("Notes generated successfully")

        # Get current user ID
        current_user_id = get_jwt_identity()

        # Create notes object with explicit datetime objects
        now = datetime.utcnow()
        notes = {
            'title': notes_data['title'],
            'channel_id': str(channel_id_obj),
            'thread_id': str(thread_id_obj) if thread_id_obj else None,
            'creator_id': current_user_id,
            'sections': notes_data['sections'],
            'created_at': now,
            'updated_at': now,
            'version': 1,
            'is_draft': True
        }

        # Save notes to database
        print("\nSaving notes to database...")
        result = db.notes.insert_one(notes)
        notes['id'] = str(result.inserted_id)
        print(f"Notes saved with ID: {notes['id']}")

        # Serialize the final response
        try:
            serialized_notes = {
                'id': notes['id'],
                'title': notes['title'],
                'channel_id': notes['channel_id'],
                'thread_id': notes['thread_id'],
                'creator_id': notes['creator_id'],
                'sections': notes['sections'],
                'created_at': notes['created_at'].isoformat(),
                'updated_at': notes['updated_at'].isoformat(),
                'version': notes['version'],
                'is_draft': notes['is_draft']
            }
        except Exception as e:
            print(f"Error serializing final notes: {str(e)}")
            print(f"Notes data: {notes}")
            raise

        print("\nNotes generation completed successfully")
        return jsonify({
            'status': 'success',
            'data': serialized_notes
        })

    except Exception as e:
        print(f"\nError in generate_notes endpoint: {str(e)}")
        print("Full traceback:")
        print(traceback.format_exc())
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500 