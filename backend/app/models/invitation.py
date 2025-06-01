from datetime import datetime
from bson import ObjectId
from app import db
from app.models.channel import Channel

class Invitation:
    def __init__(self, channel_id, inviter_id, invitee_id, status='pending', _id=None):
        self._id = _id or ObjectId()
        self.channel_id = channel_id
        self.inviter_id = inviter_id
        self.invitee_id = invitee_id
        self.status = status  # pending, accepted, rejected
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    @staticmethod
    def create(channel_id, inviter_id, invitee_id):
        """Create a new channel invitation"""
        invitation = Invitation(
            channel_id=ObjectId(channel_id),
            inviter_id=ObjectId(inviter_id),
            invitee_id=ObjectId(invitee_id)
        )
        result = db.invitations.insert_one(invitation.to_dict())
        invitation._id = result.inserted_id
        return invitation

    @staticmethod
    def get_by_id(invitation_id):
        """Get invitation by ID"""
        invitation_data = db.invitations.find_one({'_id': ObjectId(invitation_id)})
        return Invitation.from_dict(invitation_data) if invitation_data else None

    @staticmethod
    def get_pending_for_user(user_id):
        """Get all pending invitations for a user"""
        invitations = list(db.invitations.find({
            'invitee_id': ObjectId(user_id),
            'status': 'pending'
        }))
        return [Invitation.from_dict(inv) for inv in invitations]

    def accept(self):
        """Accept the invitation"""
        self.status = 'accepted'
        self.updated_at = datetime.utcnow()
        db.invitations.update_one(
            {'_id': self._id},
            {'$set': {'status': 'accepted', 'updated_at': self.updated_at}}
        )

    def reject(self):
        """Reject the invitation"""
        self.status = 'rejected'
        self.updated_at = datetime.utcnow()
        db.invitations.update_one(
            {'_id': self._id},
            {'$set': {'status': 'rejected', 'updated_at': self.updated_at}}
        )

    def to_dict(self):
        """Convert invitation to dictionary"""
        return {
            '_id': self._id,
            'channel_id': self.channel_id,
            'inviter_id': self.inviter_id,
            'invitee_id': self.invitee_id,
            'status': self.status,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }

    @staticmethod
    def from_dict(data):
        """Create invitation from dictionary"""
        invitation = Invitation(
            channel_id=data['channel_id'],
            inviter_id=data['inviter_id'],
            invitee_id=data['invitee_id'],
            status=data['status'],
            _id=data['_id']
        )
        invitation.created_at = data['created_at']
        invitation.updated_at = data['updated_at']
        return invitation

    def to_response_dict(self):
        """Convert invitation to dictionary for API response"""
        channel = Channel.get_by_id(self.channel_id)
        return {
            'id': str(self._id),
            'channel_id': str(self.channel_id),
            'channel_name': channel.name if channel else 'Unknown Channel',
            'inviter_id': str(self.inviter_id),
            'invitee_id': str(self.invitee_id),
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None
        } 