from typing import Literal, Optional, List, Dict, Union
import openai
from openai import OpenAI
import os
from dotenv import load_dotenv
import traceback
import asyncio
from openai.types.chat import ChatCompletion

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
                messages.append({"role": "system", "content": system_prompt})
                
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