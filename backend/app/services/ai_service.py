from typing import Literal, Optional, List, Dict, Union
import openai
from openai import OpenAI
import os
from dotenv import load_dotenv
import traceback
import asyncio
from openai.types.chat import ChatCompletion
import json

# Load environment variables
load_dotenv()

class AIService:
    def __init__(self):
        self.api_key = os.getenv('OPENAI_API_KEY')
        if not self.api_key:
            raise ValueError("OpenAI API key not found in environment variables")
        
        print(f"Initializing OpenAI client with API key: {self.api_key[:4]}...")
        self.client = OpenAI(api_key=self.api_key)
        
        # Validate API key on initialization
        try:
            # Make a minimal API call to validate the key
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": "test"}],
                max_tokens=1
            )
            print("OpenAI API key validated successfully")
        except Exception as e:
            print(f"Error validating OpenAI API key: {str(e)}")
            raise ValueError(f"Invalid OpenAI API key: {str(e)}")
        
        # Default models
        self.models = {
            '3.5': 'gpt-3.5-turbo',
            '4': 'gpt-4-turbo-preview'
        }
        
        # Cost tracking per model (cost per 1K tokens)
        self.costs = {
            'gpt-3.5-turbo': {'input': 0.0005, 'output': 0.0015},
            'gpt-4-turbo-preview': {'input': 0.01, 'output': 0.03}
        }
        
        # Initialize usage tracking
        self.usage_stats = {model: {'total_tokens': 0, 'total_cost': 0} for model in self.models.values()}

    def _get_model(self, model_version: Literal['3.5', '4']) -> str:
        """Get the full model name based on version"""
        return self.models.get(model_version, self.models['3.5'])

    def _track_usage(self, model: str, usage: dict) -> None:
        """Track token usage and cost for the specified model"""
        if model not in self.usage_stats:
            return
            
        prompt_tokens = usage.get('prompt_tokens', 0)
        completion_tokens = usage.get('completion_tokens', 0)
        
        # Calculate cost
        input_cost = (prompt_tokens / 1000) * self.costs[model]['input']
        output_cost = (completion_tokens / 1000) * self.costs[model]['output']
        total_cost = input_cost + output_cost
        
        # Update stats
        self.usage_stats[model]['total_tokens'] += prompt_tokens + completion_tokens
        self.usage_stats[model]['total_cost'] += total_cost

    def generate_response(
        self,
        prompt: str,
        model_version: Literal['3.5', '4'] = '3.5',
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        system_prompt: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None
    ) -> tuple[str, dict]:
        """
        Generate a response using the specified OpenAI model
        Returns: (response_text, usage_stats)
        """
        try:
            print(f"Generating response with model version: {model_version}")
            model = self._get_model(model_version)
            print(f"Using model: {model}")
            
            # Build messages array
            messages = []
            if system_prompt:
                messages.append({
                    "role": "system", 
                    "content": system_prompt + "\n\nIMPORTANT: Provide ONLY the improved message. Do not add any explanations, questions, or prefixes. Do not ask for more context. If you need more context, just improve what is provided."
                })
                
            # Add conversation history if provided
            if conversation_history:
                messages.extend(conversation_history)
                
            # Add the current prompt
            messages.append({"role": "user", "content": prompt})
            
            print(f"Sending request to OpenAI with {len(messages)} messages")
            
            try:
                response: ChatCompletion = self.client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens
                )
                
                print("Successfully received response from OpenAI")
                
                # Extract response text
                response_text = response.choices[0].message.content
                
                # Convert usage to dict for tracking
                usage_dict = {
                    'prompt_tokens': response.usage.prompt_tokens,
                    'completion_tokens': response.usage.completion_tokens,
                    'total_tokens': response.usage.total_tokens
                }
                
                # Track usage
                self._track_usage(model, usage_dict)
                
                return response_text, self.usage_stats[model]
                
            except Exception as e:
                print(f"Error in OpenAI API call: {str(e)}")
                print("Full traceback:")
                print(traceback.format_exc())
                # Log the full request details
                print(f"Request details:")
                print(f"Model: {model}")
                print(f"Temperature: {temperature}")
                print(f"Max tokens: {max_tokens}")
                print(f"Number of messages: {len(messages)}")
                raise
                
        except Exception as e:
            print(f"Error in generate_response: {str(e)}")
            print("Full traceback:")
            print(traceback.format_exc())
            raise

    def get_usage_stats(self) -> dict:
        """Get current usage statistics for all models"""
        return self.usage_stats

    def analyze_message(self, message: str) -> dict:
        """
        Analyze the tone and impact of a message
        Returns a dict with tone, impact, reasoning, and suggested improvements
        """
        try:
            if not message or not isinstance(message, str):
                raise ValueError("Message must be a non-empty string")

            system_prompt = """You are an expert at analyzing message tone and impact in workplace communication.
Your task is to analyze the given message and provide helpful feedback.

Analyze for:
1. Overall tone (choose exactly one: aggressive/weak/neutral/confusing)
2. Impact level (choose exactly one: high/medium/low)
3. Brief but specific reasoning for your analysis
4. List of helpful ways to improve the message

Format your response as a JSON object with these exact keys:
{
    "tone": "...",
    "impact": "...",
    "reasoning": "...",
    "improvements": [
        "Your message sounds uncertain. Make it more confident by being direct about what you want.",
        "Add a specific timeline or deadline to create urgency.",
        "Use active voice to make your request clearer."
    ]
}

Guidelines:
- For tone: 
  - aggressive = confrontational, demanding, or forceful language
  - weak = uncertain, overly apologetic, or lacking confidence
  - neutral = balanced, professional, and appropriate
  - confusing = unclear, poorly structured, or hard to understand

- For impact:
  - high = Message will:
    * Create immediate action or urgent response
    * Significantly influence decisions or behavior
    * Command attention due to clarity and importance
    * Drive meaningful discussion or change
  
  - medium = Message will:
    * Get noticed and considered
    * Lead to eventual action or response
    * Have moderate influence on decisions
    * Generate some discussion or feedback
  
  - low = Message:
    * Lacks urgency or clear call to action
    * May be overlooked due to vagueness
    * Has minimal influence on decisions/outcomes
    * Needs more substance or clarity to be effective

- For improvements:
  * Point out specific issues in the message that need improvement
  * Explain why these issues matter
  * Give clear direction on how to fix them
  * Make suggestions easy to understand and implement
  * Focus on actionable changes the user can make

Example Analysis:
Input: "i guess maybe we could try to finish this if possible?"
{
    "tone": "weak",
    "impact": "low",
    "reasoning": "Uses uncertain language ('i guess', 'maybe', 'could') and lacks confidence",
    "improvements": [
        "Remove uncertain words like 'guess', 'maybe', and 'if possible' to sound more confident.",
        "Specify what 'this' refers to - be clear about the exact task or project.",
        "Add a specific deadline to create urgency and show importance."
    ]
}

Example Analysis:
Input: "you need to send this report immediately!!!"
{
    "tone": "aggressive",
    "impact": "medium",
    "reasoning": "Uses demanding language and multiple exclamation marks, which can come across as forceful",
    "improvements": [
        "Soften the demand by explaining why the report is urgent.",
        "Remove multiple exclamation marks to maintain professionalism.",
        "Add 'please' and provide a specific deadline instead of 'immediately'."
    ]
}"""

            # Use GPT-4 for more accurate analysis
            response, _ = self.generate_response(
                prompt=message,
                model_version='4',  # Use GPT-4 for better analysis
                temperature=0.3,    # Lower temperature for more consistent analysis
                system_prompt=system_prompt
            )

            # Parse the response as a dictionary
            try:
                analysis = json.loads(response)
                
                # Validate required keys
                required_keys = ['tone', 'impact', 'reasoning', 'improvements']
                if not all(key in analysis for key in required_keys):
                    raise ValueError("Missing required keys in analysis response")
                
                # Validate tone values
                valid_tones = {'aggressive', 'weak', 'neutral', 'confusing'}
                if analysis['tone'].lower() not in valid_tones:
                    raise ValueError(f"Invalid tone value: {analysis['tone']}")
                
                # Validate impact values
                valid_impacts = {'high', 'medium', 'low'}
                if analysis['impact'].lower() not in valid_impacts:
                    raise ValueError(f"Invalid impact value: {analysis['impact']}")
                
                # Ensure improvements is a list
                if not isinstance(analysis['improvements'], list):
                    raise ValueError("Improvements must be a list")
                
                # Ensure reasoning is a string
                if not isinstance(analysis['reasoning'], str):
                    raise ValueError("Reasoning must be a string")
                
                return analysis
                
            except json.JSONDecodeError:
                print(f"Error parsing AI response as JSON: {response}")
                raise ValueError("Invalid analysis response format")

        except Exception as e:
            print(f"Error in analyze_message: {str(e)}")
            print("Full traceback:")
            print(traceback.format_exc())
            raise

    def clean_ai_response(self, response: str) -> str:
        """Clean AI response by removing common introductory phrases"""
        # List of common phrases to remove
        phrases_to_remove = [
            "here is a revised message:",
            "here's a revised message:",
            "here is my revised version:",
            "here's my revised version:",
            "revised message:",
            "revised version:",
            "here's a suggestion:",
            "here is a suggestion:",
            "here's an alternative reply suggestion:",
            "here's a reply suggestion:",
            "here is a reply suggestion:",
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
            "here is a response:",
            "here's a reply:",
            "here is a reply:",
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
            "here's what you could say:",
            "you could write:",
            "try this:",
            "how about:",
            "consider this:",
            "suggested version:",
            "improved version:",
            "better version:",
            "here's a better way to say it:",
            "here's how you could rephrase it:",
            "here's a clearer way to say this:",
            "this might be better:",
            "this would be more effective:",
            "a more professional version would be:",
            "to make it more clear:",
            "to improve the tone:",
            "to be more professional:",
            "here's a more professional version:",
            "here's a more direct version:",
            "message suggestion:",
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
            # Remove the phrase and any following whitespace, quotes, or punctuation
            cleaned = response[phrase_end:].lstrip(" ,.!:;-\"'")
            # Capitalize the first letter if it's not already
            if cleaned and cleaned[0].islower():
                cleaned = cleaned[0].upper() + cleaned[1:]
            return cleaned
        
        # Remove any leading/trailing quotes if present
        response = response.strip('"\'')
        
        return response 

    def generate_meeting_notes(
        self,
        messages: List[dict],
        channel_name: str,
        thread_title: Optional[str] = None,
        model_version: Literal['3.5', '4'] = '4'
    ) -> dict:
        """
        Generate structured meeting notes from a list of messages
        Returns a dictionary with title and sections for the notes
        """
        try:
            # Format messages for the prompt
            formatted_messages = []
            for msg in messages:
                # Get timestamp - it's already in ISO format from serialization
                timestamp = msg.get('created_at', '')
                formatted_messages.append(f"{msg.get('username', 'Unknown')}: ({timestamp})\n{msg.get('content', '')}\n")
            
            messages_text = "\n".join(formatted_messages)
            
            system_prompt = """You are an expert meeting notes generator.
Your task is to analyze the conversation and create clear, structured meeting notes.

Guidelines:
1. Create a concise but descriptive title
2. Organize content into relevant sections
3. Extract key points, decisions, and action items
4. Maintain professional language
5. Focus on important information
6. Use bullet points for clarity
7. Include timestamps for key decisions

Output Format (JSON):
{
    "title": "Meeting Title",
    "sections": [
        {
            "title": "Summary",
            "content": ["Key point 1", "Key point 2"]
        },
        {
            "title": "Decisions Made",
            "content": ["Decision 1 (at 2:30 PM)", "Decision 2 (at 2:45 PM)"]
        },
        {
            "title": "Action Items",
            "content": ["Action 1 - Assigned to X", "Action 2 - Assigned to Y"]
        },
        {
            "title": "Discussion Points",
            "content": ["Discussion topic 1", "Discussion topic 2"]
        }
    ]
}"""

            context = f"""This is a conversation from the channel: {channel_name}"""
            if thread_title:
                context += f"\nThread Topic: {thread_title}"
            
            prompt = f"""{context}

Please analyze this conversation and generate structured meeting notes:

{messages_text}"""

            # Generate notes using specified model
            response, usage = self.generate_response(
                prompt=prompt,
                model_version=model_version,
                temperature=0.7,
                system_prompt=system_prompt
            )

            # Parse the response as JSON
            try:
                notes = json.loads(response)
                
                # Validate required structure
                if not isinstance(notes, dict):
                    raise ValueError("Response must be a dictionary")
                if "title" not in notes:
                    raise ValueError("Missing 'title' in response")
                if "sections" not in notes:
                    raise ValueError("Missing 'sections' in response")
                if not isinstance(notes["sections"], list):
                    raise ValueError("'sections' must be a list")
                
                return notes
                
            except json.JSONDecodeError:
                raise ValueError("Invalid JSON response from AI model")

        except Exception as e:
            print(f"Error in generate_meeting_notes: {str(e)}")
            print("Full traceback:")
            print(traceback.format_exc())
            raise 