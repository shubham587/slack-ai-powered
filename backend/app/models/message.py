from datetime import datetime
from bson import ObjectId
from app import db

class Message:
    def __init__(self, channel_id, sender_id, content, message_type='text', _id=None):
        self._id = _id or ObjectId()
        self.channel_id = channel_id
        self.sender_id = sender_id
        self.content = content
        self.message_type = message_type  # text, image, file, etc.
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
    def create(channel_id, sender_id, content, message_type='text'):
        message = Message(channel_id, sender_id, content, message_type)
        result = db.messages.insert_one(message.to_dict())
        message._id = result.inserted_id
        return message

    @staticmethod
    def get_channel_messages(channel_id, limit=50, before=None):
        """Get messages for a channel with pagination"""
        query = {'channel_id': channel_id}
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
            _id=data['_id']
        )
        message.created_at = data['created_at']
        message.updated_at = data['updated_at']
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
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'delivery_status': self.delivery_status
        }

    def to_response_dict(self):
        # Get the sender's username
        sender = db.users.find_one({'_id': self.sender_id})
        username = sender['username'] if sender else 'Unknown User'
        
        return {
            'id': str(self._id),
            'channel_id': str(self.channel_id),
            'sender_id': str(self.sender_id),
            'username': username,
            'content': self.content,
            'message_type': self.message_type,
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