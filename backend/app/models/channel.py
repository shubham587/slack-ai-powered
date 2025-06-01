from datetime import datetime
from bson import ObjectId
from app import db

class Channel:
    def __init__(self, name, created_by=None, description='', is_private=False, is_direct=False, members=None, _id=None):
        self._id = _id or ObjectId()
        self.name = name
        self.description = description
        self.created_by = created_by if created_by else None
        self.is_private = is_private
        self.is_direct = is_direct
        self.members = members or ([] if created_by is None else [created_by])
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
        self.last_message_at = None
        self.topic = ''
        self.pinned_messages = []

    @staticmethod
    def create(name, created_by, description='', is_private=False, is_direct=False, members=None):
        """Create a new channel"""
        channel = Channel(
            name=name,
            created_by=created_by,
            description=description,
            is_private=is_private,
            is_direct=is_direct,
            members=members
        )
        
        result = db.channels.insert_one(channel.to_dict())
        channel._id = result.inserted_id
        return channel

    @staticmethod
    def get_by_id(channel_id):
        """Get channel by ID"""
        channel_data = db.channels.find_one({'_id': ObjectId(channel_id)})
        if channel_data:
            return Channel.from_dict(channel_data)
        return None

    @staticmethod
    def get_user_channels(user_id):
        """Get all channels for a user"""
        try:
            channels_data = list(db.channels.find({
                'members': ObjectId(user_id)
            }))
            
            channels = []
            for channel_data in channels_data:
                try:
                    # Ensure created_by is properly handled
                    if 'created_by' not in channel_data:
                        channel_data['created_by'] = None
                    channels.append(Channel.from_dict(channel_data))
                except Exception as e:
                    print(f"Error converting channel {channel_data.get('_id')}: {str(e)}")
                    continue
            return channels
        except Exception as e:
            print(f"Error fetching channels: {str(e)}")
            return []

    @staticmethod
    def get_direct_message(user1_id, user2_id):
        """Get or create a direct message channel between two users"""
        try:
            member_ids = sorted([ObjectId(user1_id), ObjectId(user2_id)])
            
            # Try to find existing DM channel
            channel = db.channels.find_one({
                'is_direct': True,
                'members': {'$all': member_ids}
            })
            
            if channel:
                return Channel.from_dict(channel)
            
            # Get user information for channel name
            user1 = db.users.find_one({'_id': member_ids[0]})
            user2 = db.users.find_one({'_id': member_ids[1]})
            
            if not user1 or not user2:
                raise ValueError('One or both users not found')
            
            # Create channel name from display names or usernames
            user1_name = user1.get('display_name', user1['username'])
            user2_name = user2.get('display_name', user2['username'])
            channel_name = f"DM: {user1_name} & {user2_name}"
                
            # Create new DM channel
            return Channel.create(
                name=channel_name,
                created_by=member_ids[0],
                is_direct=True,
                is_private=True,
                members=member_ids
            )
        except Exception as e:
            print(f"Error creating DM channel: {str(e)}")
            raise

    def add_member(self, user_id):
        """Add a member to the channel"""
        if ObjectId(user_id) not in self.members:
            db.channels.update_one(
                {'_id': self._id},
                {
                    '$push': {'members': ObjectId(user_id)},
                    '$set': {'updated_at': datetime.utcnow()}
                }
            )
            self.members.append(ObjectId(user_id))

    def remove_member(self, user_id):
        """Remove a member from the channel"""
        if ObjectId(user_id) in self.members:
            db.channels.update_one(
                {'_id': self._id},
                {
                    '$pull': {'members': ObjectId(user_id)},
                    '$set': {'updated_at': datetime.utcnow()}
                }
            )
            self.members.remove(ObjectId(user_id))

    def update(self, data):
        """Update channel details"""
        updates = {}
        if 'name' in data:
            updates['name'] = data['name']
        if 'description' in data:
            updates['description'] = data['description']
        if 'topic' in data:
            updates['topic'] = data['topic']
        if 'is_private' in data:
            updates['is_private'] = data['is_private']
            
        if updates:
            updates['updated_at'] = datetime.utcnow()
            db.channels.update_one({'_id': self._id}, {'$set': updates})
            for key, value in updates.items():
                setattr(self, key, value)

    def pin_message(self, message_id):
        """Pin a message in the channel"""
        if message_id not in self.pinned_messages:
            db.channels.update_one(
                {'_id': self._id},
                {'$push': {'pinned_messages': message_id}}
            )
            self.pinned_messages.append(message_id)

    def unpin_message(self, message_id):
        """Unpin a message from the channel"""
        if message_id in self.pinned_messages:
            db.channels.update_one(
                {'_id': self._id},
                {'$pull': {'pinned_messages': message_id}}
            )
            self.pinned_messages.remove(message_id)

    @staticmethod
    def from_dict(data):
        """Create Channel instance from dictionary"""
        try:
            # Handle potentially missing or invalid created_by
            created_by = data.get('created_by')
            if created_by:
                try:
                    created_by = ObjectId(created_by)
                except:
                    created_by = None
                    
            # Convert member IDs to ObjectId
            members = []
            for member_id in data.get('members', []):
                try:
                    members.append(ObjectId(member_id))
                except:
                    continue

            channel = Channel(
                name=data['name'],
                created_by=created_by,
                description=data.get('description', ''),
                is_private=data.get('is_private', False),
                is_direct=data.get('is_direct', False),
                members=members,
                _id=data['_id']
            )
            
            # Handle datetime fields
            channel.created_at = data.get('created_at', datetime.utcnow())
            channel.updated_at = data.get('updated_at', datetime.utcnow())
            channel.last_message_at = data.get('last_message_at')
            
            # Set other fields
            channel.topic = data.get('topic', '')
            channel.pinned_messages = data.get('pinned_messages', [])
            return channel
        except Exception as e:
            print(f"Error creating channel from dict: {str(e)}")
            raise

    def to_dict(self):
        """Convert Channel instance to dictionary"""
        return {
            '_id': self._id,
            'name': self.name,
            'description': self.description,
            'created_by': self.created_by,
            'is_private': self.is_private,
            'is_direct': self.is_direct,
            'members': self.members,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'last_message_at': self.last_message_at,
            'topic': self.topic,
            'pinned_messages': self.pinned_messages
        }

    def to_response_dict(self):
        """Convert Channel instance to API response dictionary"""
        # Get member details
        member_details = []
        for member_id in self.members:
            member = db.users.find_one({'_id': member_id})
            if member:
                member_details.append({
                    'id': str(member['_id']),
                    'username': member['username'],
                    'display_name': member.get('display_name', member['username']),
                    'avatar_url': member.get('avatar_url')
                })

        return {
            'id': str(self._id),
            'name': self.name,
            'description': self.description,
            'created_by': str(self.created_by) if self.created_by else None,
            'is_private': self.is_private,
            'is_direct': self.is_direct,
            'members': member_details,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'last_message_at': self.last_message_at.isoformat() if self.last_message_at else None,
            'topic': self.topic,
            'pinned_messages': [str(msg_id) for msg_id in self.pinned_messages]
        } 