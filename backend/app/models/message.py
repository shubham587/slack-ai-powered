from datetime import datetime
from bson import ObjectId
from app import db
from app.models.file import File
from pydantic import BaseModel
from typing import List, Optional

class MessageAnalysis(BaseModel):
    """Model for message tone and impact analysis"""
    tone: str  # aggressive/weak/neutral/confusing
    impact: str  # high/medium/low
    improvements: List[str]
    reasoning: str

class Message(BaseModel):
    """Model for chat messages"""
    id: str
    content: str
    sender_id: str
    channel_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    reply_count: Optional[int] = 0
    parent_id: Optional[str] = None
    file: Optional[dict] = None
    is_direct: Optional[bool] = False
    analysis: Optional[MessageAnalysis] = None  # Add analysis field to messages
    message_type: Optional[str] = 'text'
    delivery_status: Optional[dict] = None
    file_id: Optional[str] = None

    def __init__(self, **data):
        # Initialize delivery_status before calling super().__init__
        delivery_status = data.get('delivery_status', {
            'sent': True,
            'delivered': False,
            'read': False,
            'delivered_to': [],
            'read_by': [],
            'sent_at': data.get('created_at') or datetime.utcnow(),
            'delivered_at': None,
            'read_at': None
        })
        data['delivery_status'] = delivery_status
        
        super().__init__(**data)
        self._id = data.get('_id') or ObjectId()
        self.created_at = data.get('created_at') or datetime.utcnow()
        self.updated_at = data.get('updated_at') or datetime.utcnow()
        self.reply_count = data.get('reply_count', 0)
        self.message_type = data.get('message_type', 'text')

    @staticmethod
    def create(channel_id, sender_id, content, message_type='text', file_id=None, parent_id=None):
        """Create a new message"""
        now = datetime.utcnow()
        message_data = {
            'id': str(ObjectId()),  # Generate a new ID
            'channel_id': str(channel_id) if isinstance(channel_id, ObjectId) else channel_id,
            'sender_id': str(sender_id) if isinstance(sender_id, ObjectId) else sender_id,
            'content': content,
            'message_type': message_type,
            'file_id': str(file_id) if file_id and isinstance(file_id, ObjectId) else file_id,
            'parent_id': str(parent_id) if parent_id and isinstance(parent_id, ObjectId) else parent_id,
            'reply_count': 0,
            'created_at': now,
            'updated_at': now,
            'delivery_status': {
                'sent': True,
                'delivered': False,
                'read': False,
                'delivered_to': [],
                'read_by': [],
                'sent_at': now,
                'delivered_at': None,
                'read_at': None
            }
        }
        
        # Create Message instance
        message = Message(**message_data)
        
        # Store the original ObjectIds for database operations
        message._id = ObjectId(message_data['id'])
        message._channel_id = channel_id if isinstance(channel_id, ObjectId) else ObjectId(channel_id)
        message._sender_id = sender_id if isinstance(sender_id, ObjectId) else ObjectId(sender_id)
        
        # Insert into database using ObjectIds
        db_data = {
            '_id': message._id,
            'channel_id': message._channel_id,
            'sender_id': message._sender_id,
            'content': content,
            'message_type': message_type,
            'file_id': file_id if isinstance(file_id, ObjectId) else ObjectId(file_id) if file_id else None,
            'parent_id': parent_id if isinstance(parent_id, ObjectId) else ObjectId(parent_id) if parent_id else None,
            'reply_count': 0,
            'created_at': now,
            'updated_at': now,
            'delivery_status': message_data['delivery_status']
        }
        
        db.messages.insert_one(db_data)
        
        # If this is a reply, update parent's reply count
        if parent_id:
            parent_id_obj = parent_id if isinstance(parent_id, ObjectId) else ObjectId(parent_id)
            reply_count = db.messages.count_documents({'parent_id': parent_id_obj})
            db.messages.update_one(
                {'_id': parent_id_obj},
                {'$set': {'reply_count': reply_count}}
            )
        
        return message

    @staticmethod
    def get_replies(message_id, limit=50):
        """Get replies for a message"""
        # Get all replies
        replies = list(db.messages.find(
            {'parent_id': ObjectId(message_id)},
            sort=[('created_at', 1)],
            limit=limit
        ))
        
        # Update parent message with accurate reply count
        actual_count = db.messages.count_documents({
            'parent_id': ObjectId(message_id)
        })
        
        db.messages.update_one(
            {'_id': ObjectId(message_id)},
            {'$set': {'reply_count': actual_count}}
        )
        
        return [Message.from_dict(reply) for reply in replies]

    @staticmethod
    def get_channel_messages(channel_id, limit=50, before=None):
        """Get messages for a channel with pagination"""
        query = {
            'channel_id': channel_id,
            'parent_id': None  # Only get main messages, not replies
        }
        if before:
            query['created_at'] = {'$lt': before}
            
        messages = list(db.messages.find(
            query,
            sort=[('created_at', -1)],
            limit=limit
        ))
        return [Message.from_dict(msg) for msg in messages]

    @staticmethod
    def mark_delivered(message_id, user_id):
        """Mark message as delivered to a user"""
        message = db.messages.find_one({'_id': ObjectId(message_id)})
        if not message:
            return None
            
        # Update delivery status if not already delivered
        if str(user_id) not in message.get('delivery_status', {}).get('delivered_to', []):
            db.messages.update_one(
                {'_id': ObjectId(message_id)},
                {
                    '$set': {
                        'delivery_status.delivered': True,
                        'delivery_status.delivered_at': datetime.utcnow()
                    },
                    '$addToSet': {
                        'delivery_status.delivered_to': str(user_id)
                    }
                }
            )
        return Message.from_dict(db.messages.find_one({'_id': ObjectId(message_id)}))

    @staticmethod
    def mark_read(message_id, user_id):
        """Mark message as read by a user"""
        message = db.messages.find_one({'_id': ObjectId(message_id)})
        if not message:
            return None
            
        # Update read status if not already read
        if str(user_id) not in message.get('delivery_status', {}).get('read_by', []):
            db.messages.update_one(
                {'_id': ObjectId(message_id)},
                {
                    '$set': {
                        'delivery_status.read': True,
                        'delivery_status.read_at': datetime.utcnow()
                    },
                    '$addToSet': {
                        'delivery_status.read_by': str(user_id)
                    }
                }
            )
        return Message.from_dict(db.messages.find_one({'_id': ObjectId(message_id)}))

    @staticmethod
    def from_dict(data):
        # Convert ObjectId fields to strings
        file_id = str(data['file_id']) if data.get('file_id') and isinstance(data['file_id'], ObjectId) else data.get('file_id')
        file = data.get('file')
        if isinstance(file, ObjectId):
            file = {'id': str(file)}
        
        message = Message(
            id=str(data['_id']),
            content=data['content'],
            sender_id=str(data['sender_id']) if isinstance(data['sender_id'], ObjectId) else data['sender_id'],
            channel_id=str(data['channel_id']) if isinstance(data['channel_id'], ObjectId) else data['channel_id'],
            created_at=data['created_at'],
            updated_at=data.get('updated_at'),
            reply_count=data.get('reply_count', 0),
            parent_id=str(data['parent_id']) if data.get('parent_id') else None,
            file=file,
            file_id=file_id,
            is_direct=data.get('is_direct', False),
            analysis=data.get('analysis'),
            message_type=data.get('message_type', 'text'),
            delivery_status=data.get('delivery_status', {
                'sent': True,
                'delivered': False,
                'read': False,
                'delivered_to': [],
                'read_by': [],
                'sent_at': data['created_at'],
                'delivered_at': None,
                'read_at': None
            })
        )
        message._id = data['_id']
        return message

    def to_dict(self):
        return {
            '_id': self._id,
            'channel_id': self.channel_id,
            'sender_id': self.sender_id,
            'content': self.content,
            'message_type': self.message_type,
            'file_id': self.file_id,
            'parent_id': self.parent_id,
            'reply_count': self.reply_count,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'delivery_status': self.delivery_status,
            'is_direct': self.is_direct,
            'analysis': self.analysis
        }

    def to_response_dict(self):
        # Get the sender's username
        try:
            # Convert sender_id to ObjectId if it's a string
            sender_id = ObjectId(self.sender_id) if isinstance(self.sender_id, str) else self.sender_id
            sender = db.users.find_one({'_id': sender_id})
            username = sender['username'] if sender else 'Unknown User'
            display_name = sender.get('display_name', username) if sender else username
        except Exception as e:
            print(f"Error finding sender: {str(e)}")
            username = 'Unknown User'
            display_name = username
        
        response = {
            'id': str(self._id),
            'channel_id': str(self.channel_id),
            'sender_id': str(self.sender_id),
            'username': username,
            'display_name': display_name,
            'content': self.content,
            'message_type': self.message_type,
            'parent_id': str(self.parent_id) if self.parent_id else None,
            'reply_count': self.reply_count,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'delivery_status': {
                'sent': self.delivery_status['sent'],
                'delivered': self.delivery_status['delivered'],
                'read': self.delivery_status['read'],
                'delivered_to': self.delivery_status['delivered_to'],
                'read_by': self.delivery_status['read_by'],
                'sent_at': self.delivery_status['sent_at'].isoformat(),
                'delivered_at': self.delivery_status['delivered_at'].isoformat() if self.delivery_status['delivered_at'] else None,
                'read_at': self.delivery_status['read_at'].isoformat() if self.delivery_status['read_at'] else None
            }
        }
        
        # Add file information if this is a file message
        if self.file_id:
            file_obj = File.get_by_id(self.file_id)
            if file_obj:
                response['file'] = file_obj.to_response_dict()
                
        return response 