from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional, Dict
from ..services.ai_service import AIService
from ..models.message import Message, MessageAnalysis
from ..models.notes import Notes, NotesSection
from ..dependencies import get_current_user, get_ai_service
from ..models.user import User
import json

router = APIRouter(prefix="/api/ai", tags=["ai"])

# Add CORS middleware to the router
router.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@router.options("/generate-notes")
async def generate_notes_options():
    """Handle preflight request for generate-notes endpoint"""
    return {}

@router.post("/analyze-message")
async def analyze_message(
    message: str,
    channel_type: Optional[str] = None,
    background_tasks: BackgroundTasks = None,
    ai_service: AIService = Depends(get_ai_service),
    current_user: User = Depends(get_current_user)
) -> MessageAnalysis:
    """
    Analyze message tone and impact in real-time.
    Returns tone classification and impact score.
    """
    try:
        # Create system prompt for tone analysis
        system_prompt = """You are an expert communication analyst. Your task is to analyze messages for:
        1. Tone (aggressive, weak, neutral, confusing)
        2. Impact level (high, medium, low)
        3. Potential improvements
        
        Provide analysis in a structured format with clear reasoning."""

        # Create analysis prompt
        analysis_prompt = f"""Analyze this message for a {channel_type if channel_type else 'general'} channel:
        "{message}"
        
        Provide analysis in JSON format with:
        - tone: The message tone (aggressive/weak/neutral/confusing)
        - impact: Impact level (high/medium/low)
        - improvements: List of specific suggestions
        - reasoning: Brief explanation of analysis
        """

        # Get analysis from GPT-4 (more accurate for analysis)
        response_text, _ = ai_service.generate_response(
            prompt=analysis_prompt,
            model_version='4',  # Use GPT-4 for better analysis
            temperature=0.3,    # Lower temperature for more consistent analysis
            system_prompt=system_prompt
        )

        # Parse response into MessageAnalysis model
        # Note: Response will be in JSON format as requested in the prompt
        analysis_dict = json.loads(response_text)
        
        return MessageAnalysis(
            tone=analysis_dict["tone"],
            impact=analysis_dict["impact"],
            improvements=analysis_dict["improvements"],
            reasoning=analysis_dict["reasoning"]
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to analyze message: {str(e)}"
        )

@router.post("/generate-notes")
async def generate_notes(
    channel_id: str,
    thread_id: Optional[str] = None,
    background_tasks: BackgroundTasks = None,
    ai_service: AIService = Depends(get_ai_service),
    current_user: User = Depends(get_current_user)
) -> Notes:
    """
    Generate meeting notes from a channel or thread conversation.
    Returns structured notes with sections.
    """
    try:
        # Get channel info
        channel = await get_channel(channel_id)
        if not channel:
            raise HTTPException(status_code=404, detail="Channel not found")
            
        # Get messages
        if thread_id:
            # Get thread messages
            messages = await get_thread_messages(thread_id)
            parent_message = await get_message(thread_id)
            if not parent_message:
                raise HTTPException(status_code=404, detail="Thread not found")
            thread_title = parent_message.content
        else:
            # Get channel messages
            messages = await get_channel_messages(channel_id)
            thread_title = None
            
        if not messages:
            raise HTTPException(
                status_code=400,
                detail="No messages found to generate notes from"
            )

        # Generate notes using AI service
        notes_data = ai_service.generate_meeting_notes(
            messages=messages,
            channel_name=channel.name,
            thread_title=thread_title
        )
        
        # Create Notes object
        notes = Notes(
            title=notes_data["title"],
            channel_id=channel_id,
            thread_id=thread_id,
            creator_id=current_user.id,
            sections=[
                NotesSection(
                    title=section["title"],
                    content=section["content"]
                )
                for section in notes_data["sections"]
            ]
        )
        
        # Save notes to database
        await save_notes(notes)
        
        return notes

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate notes: {str(e)}"
        ) 