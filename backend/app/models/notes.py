from datetime import datetime
from bson import ObjectId
from typing import List, Optional
from pydantic import BaseModel

class NotesSection(BaseModel):
    """Model for a section in meeting notes"""
    title: str
    content: List[str]
    
class Notes(BaseModel):
    """Model for meeting notes"""
    id: Optional[str] = None
    title: str
    channel_id: str
    thread_id: Optional[str] = None  # If notes are for a specific thread
    creator_id: str
    sections: List[NotesSection]
    created_at: datetime = datetime.utcnow()
    updated_at: datetime = datetime.utcnow()
    version: int = 1
    is_draft: bool = True
    
    def to_dict(self):
        return {
            '_id': ObjectId(self.id) if self.id else ObjectId(),
            'title': self.title,
            'channel_id': self.channel_id,
            'thread_id': self.thread_id,
            'creator_id': self.creator_id,
            'sections': [
                {
                    'title': section.title,
                    'content': section.content
                }
                for section in self.sections
            ],
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'version': self.version,
            'is_draft': self.is_draft
        } 