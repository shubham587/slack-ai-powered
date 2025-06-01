from datetime import datetime
from bson import ObjectId
from app import db
from app.models.file import File

class Message:
    def __init__(self, channel_id, sender_id, content, message_type='text', file_id=None, parent_id=None, _id=None):
        self._id = _id or ObjectId()
        self.channel_id = channel_id
        self.sender_id = sender_id
        self.content = content
        self.message_type = message_type  # text, file
        self.file_id = file_id
        self.parent_id = parent_id  # For thread replies
        self.reply_count = 0  # Count of replies in thread
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
        self.delivery_status = {
            'sent': True,
            'delivered': False,
            'read': False,
            'delivered_to': [],
            'read_by': [],
            'sent_at': datetime.utcnow(),
            'delivered_at': None,
            'read_at': None
        }

    @staticmethod
    def create(channel_id, sender_id, content, message_type='text', file_id=None, parent_id=None):
        message = Message(channel_id, sender_id, content, message_type, file_id, parent_id)
        result = db.messages.insert_one(message.to_dict())
        message._id = result.inserted_id
        
        # If this is a reply, increment the parent message's reply count
        if parent_id:
            # Get actual reply count
            reply_count = db.messages.count_documents({
                'parent_id': ObjectId(parent_id)
            })
            
            # Update parent with accurate count
            db.messages.update_one(
                {'_id': ObjectId(parent_id)},
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
        message = Message(
            channel_id=data['channel_id'],
            sender_id=data['sender_id'],
            content=data['content'],
            message_type=data['message_type'],
            file_id=data.get('file_id'),
            parent_id=data.get('parent_id'),
            _id=data['_id']
        )
        message.created_at = data['created_at']
        message.updated_at = data['updated_at']
        message.reply_count = data.get('reply_count', 0)
        message.delivery_status = data.get('delivery_status', {
            'sent': True,
            'delivered': False,
            'read': False,
            'delivered_to': [],
            'read_by': [],
            'sent_at': data['created_at'],
            'delivered_at': None,
            'read_at': None
        })
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
            'delivery_status': self.delivery_status
        }

    def to_response_dict(self):
        # Get the sender's username
        sender = db.users.find_one({'_id': self.sender_id})
        username = sender['username'] if sender else 'Unknown User'
        
        response = {
            'id': str(self._id),
            'channel_id': str(self.channel_id),
            'sender_id': str(self.sender_id),
            'username': username,
            'content': self.content,
            'message_type': self.message_type,
            'parent_id': str(self.parent_id) if self.parent_id else None,
            'reply_count': self.reply_count,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
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