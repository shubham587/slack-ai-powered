from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from app.models.invitation import Invitation
from app.models.channel import Channel
from app import socketio
from flask_socketio import join_room, leave_room
from app import db

invitations_bp = Blueprint('invitations', __name__)

@socketio.on('join_user_room')
def on_join_user_room(data):
    """Join a user's personal room for notifications"""
    try:
        user_id = data.get('user_id')
        if user_id:
            join_room(str(user_id))
            print(f"User {user_id} joined their personal room")
    except Exception as e:
        print(f"Error joining user room: {e}")

@invitations_bp.route('', methods=['POST'])
@jwt_required()
def create_invitation():
    """Create a new channel invitation"""
    try:
        data = request.get_json()
        print(f"\n=== Creating Invitation ===")
        print(f"Request data: {data}")
        
        if not data or 'channel_id' not in data or 'invitee_id' not in data:
            print("Missing required fields")
            return jsonify({'error': 'Missing required fields'}), 400
            
        inviter_id = get_jwt_identity()
        print(f"Inviter ID: {inviter_id}")
        
        channel = Channel.get_by_id(data['channel_id'])
        print(f"Channel found: {channel.to_dict() if channel else None}")
        
        if not channel:
            return jsonify({'error': 'Channel not found'}), 404
            
        # Check if inviter has permission to invite
        print(f"Checking permissions - Channel creator: {channel.created_by}, Members: {channel.members}")
        if str(channel.created_by) != inviter_id and not any(str(m) == inviter_id for m in channel.members):
            print(f"Permission denied for inviter {inviter_id}")
            return jsonify({'error': 'No permission to invite to this channel'}), 403
            
        # Check if invitee is already a member
        invitee_id = data['invitee_id']
        print(f"Checking if invitee {invitee_id} is already a member")
        if any(str(m) == invitee_id for m in channel.members):
            print(f"Invitee {invitee_id} is already a member")
            return jsonify({'error': 'User is already a member of this channel'}), 400
            
        # Check if invitation already exists
        print(f"Checking for existing invitation - Channel: {data['channel_id']}, Invitee: {invitee_id}")
        existing_invitation = db.invitations.find_one({
            'channel_id': ObjectId(data['channel_id']),
            'invitee_id': ObjectId(invitee_id),
            'status': 'pending'
        })
        if existing_invitation:
            print(f"Found existing invitation: {existing_invitation}")
            print(f"Channel ID comparison: {data['channel_id']} vs {existing_invitation['channel_id']}")
            print(f"Invitee ID comparison: {invitee_id} vs {existing_invitation['invitee_id']}")
            return jsonify({'error': 'Invitation already exists'}), 400
            
        # Get inviter and invitee details
        inviter = db.users.find_one({'_id': ObjectId(inviter_id)})
        invitee = db.users.find_one({'_id': ObjectId(invitee_id)})
        print(f"Inviter found: {inviter is not None}, Invitee found: {invitee is not None}")
        
        if not inviter or not invitee:
            return jsonify({'error': 'Invalid user'}), 404
            
        # Create invitation
        invitation = Invitation.create(
            channel_id=data['channel_id'],
            inviter_id=inviter_id,
            invitee_id=invitee_id
        )
        print(f"Created invitation: {invitation.to_dict()}")
        
        response_data = invitation.to_response_dict()
        # Add additional information for the notification
        response_data.update({
            'inviter_username': inviter['username'],
            'invitee_username': invitee['username'],
            'channel_name': channel.name
        })
        print(f"Response data: {response_data}")
        
        # Emit socket event ONLY to the invitee
        invitee_room = str(invitee_id)
        print(f"Emitting new_invitation to room: {invitee_room}")
        socketio.emit('new_invitation', response_data, room=invitee_room)
        print("Socket event emitted successfully")
        
        return jsonify(response_data), 201
        
    except Exception as e:
        print(f"Error creating invitation: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 400

@invitations_bp.route('/pending', methods=['GET'])
@jwt_required()
def get_pending_invitations():
    """Get all pending invitations for the current user"""
    try:
        user_id = get_jwt_identity()
        invitations = Invitation.get_pending_for_user(user_id)
        response_data = [inv.to_response_dict() for inv in invitations]
        print(f"Fetched pending invitations for user {user_id}: {response_data}")
        return jsonify(response_data), 200
    except Exception as e:
        print(f"Error fetching pending invitations: {e}")
        return jsonify({'error': str(e)}), 400

@invitations_bp.route('/<invitation_id>/accept', methods=['POST'])
@jwt_required()
def accept_invitation(invitation_id):
    """Accept a channel invitation"""
    try:
        user_id = get_jwt_identity()
        invitation = Invitation.get_by_id(invitation_id)
        
        if not invitation:
            return jsonify({'error': 'Invitation not found'}), 404
            
        if str(invitation.invitee_id) != user_id:
            return jsonify({'error': 'Not authorized to accept this invitation'}), 403
            
        channel = Channel.get_by_id(invitation.channel_id)
        if not channel:
            return jsonify({'error': 'Channel not found'}), 404
            
        # Add user to channel members
        channel.add_member(user_id)
            
        # Mark invitation as accepted
        invitation.accept()
        
        # Emit socket events
        socketio.emit('invitation_accepted', invitation.to_response_dict(), room=str(invitation.inviter_id))
        socketio.emit('channel_member_added', {
            'channel_id': str(channel._id),
            'user_id': user_id
        }, room=str(channel._id))
        
        # Also emit to all channel members
        for member_id in channel.members:
            socketio.emit('channel_updated', channel.to_response_dict(), room=str(member_id))
        
        return jsonify(invitation.to_response_dict()), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@invitations_bp.route('/<invitation_id>/reject', methods=['POST'])
@jwt_required()
def reject_invitation(invitation_id):
    """Reject a channel invitation"""
    try:
        user_id = get_jwt_identity()
        invitation = Invitation.get_by_id(invitation_id)
        
        if not invitation:
            return jsonify({'error': 'Invitation not found'}), 404
            
        if str(invitation.invitee_id) != user_id:
            return jsonify({'error': 'Not authorized to reject this invitation'}), 403
            
        invitation.reject()
        
        # Emit socket event
        socketio.emit('invitation_rejected', invitation.to_response_dict(), room=str(invitation.inviter_id))
        
        return jsonify(invitation.to_response_dict()), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@invitations_bp.route('/channel/<channel_id>/pending', methods=['GET'])
@jwt_required()
def get_channel_pending_invitations(channel_id):
    """Get all pending invitations for a specific channel"""
    try:
        # Verify the channel exists
        channel = Channel.get_by_id(channel_id)
        if not channel:
            return jsonify({'error': 'Channel not found'}), 404
            
        # Get pending invitations for this channel
        invitations = list(db.invitations.find({
            'channel_id': ObjectId(channel_id),
            'status': 'pending'
        }))
        
        # Convert to response format
        response_data = []
        for inv in invitations:
            invitation = Invitation.from_dict(inv)
            response_data.append(invitation.to_response_dict())
            
        return jsonify(response_data), 200
    except Exception as e:
        print(f"Error fetching channel pending invitations: {e}")
        return jsonify({'error': str(e)}), 400 