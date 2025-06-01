from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.channel import Channel
from app.models.user import User
from app import db, socketio
from bson import ObjectId
from datetime import datetime

channels_bp = Blueprint('channels', __name__, url_prefix='/api/channels')

@channels_bp.route('', methods=['GET'])
@jwt_required()
def get_channels():
    """Get all channels the current user is a member of"""
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'error': 'Invalid user ID'}), 400
            
        try:
            user_id = ObjectId(user_id)
        except Exception:
            return jsonify({'error': 'Invalid user ID format'}), 400
            
        try:
            channels = Channel.get_user_channels(user_id)
            response_data = []
            for channel in channels:
                try:
                    response_data.append(channel.to_response_dict())
                except Exception as e:
                    print(f"Error converting channel {channel._id} to response: {str(e)}")
                    continue
            return jsonify(response_data)
        except Exception as e:
            print(f"Error in get_channels: {str(e)}")
            return jsonify({'error': f'Error fetching channels: {str(e)}'}), 500
            
    except Exception as e:
        print(f"Outer error in get_channels: {str(e)}")
        return jsonify({'error': str(e)}), 500

@channels_bp.route('', methods=['POST'])
@jwt_required()
def create_channel():
    """Create a new channel"""
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data or 'name' not in data:
            return jsonify({'error': 'Channel name is required'}), 400
            
        try:
            user_id = ObjectId(get_jwt_identity())
        except Exception:
            return jsonify({'error': 'Invalid user ID'}), 400
        
        # Convert member IDs to ObjectId
        members = []
        if 'members' in data:
            try:
                members = [ObjectId(m) for m in data['members']]
            except Exception:
                return jsonify({'error': 'Invalid member ID format'}), 400
        
        # Ensure creator is in members
        if user_id not in members:
            members.append(user_id)
        
        # Create channel
        try:
            channel = Channel.create(
                name=data['name'],
                created_by=user_id,
                description=data.get('description', ''),
                is_private=data.get('is_private', False),
                members=members
            )
            
            # Emit socket event for new channel
            response_data = channel.to_response_dict()
            socketio.emit('channel_created', response_data, room=str(user_id))
            
            return jsonify(response_data), 201
        except Exception as e:
            print(f"Error creating channel: {str(e)}")
            return jsonify({'error': f'Error creating channel: {str(e)}'}), 500
            
    except Exception as e:
        print(f"Outer error in create_channel: {str(e)}")
        return jsonify({'error': str(e)}), 500

@channels_bp.route('/<channel_id>', methods=['GET'])
@jwt_required()
def get_channel(channel_id):
    """Get channel details"""
    try:
        channel = Channel.get_by_id(channel_id)
        if not channel:
            return jsonify({'error': 'Channel not found'}), 404
            
        # Check if user is a member
        user_id = ObjectId(get_jwt_identity())
        if user_id not in channel.members and not channel.is_direct:
            return jsonify({'error': 'Not authorized to view this channel'}), 403
            
        return jsonify(channel.to_response_dict())
        
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@channels_bp.route('/<channel_id>', methods=['PUT'])
@jwt_required()
def update_channel(channel_id):
    """Update channel details"""
    try:
        data = request.get_json()
        channel = Channel.get_by_id(channel_id)
        
        if not channel:
            return jsonify({'error': 'Channel not found'}), 404
            
        # Check if user is the creator or has permissions
        user_id = ObjectId(get_jwt_identity())
        if channel.created_by != user_id:
            return jsonify({'error': 'Not authorized to update this channel'}), 403
            
        channel.update(data)
        
        # Emit socket event for channel update
        socketio.emit('channel_updated', channel.to_response_dict(), room=channel_id)
        
        return jsonify(channel.to_response_dict())
        
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@channels_bp.route('/<channel_id>/members', methods=['POST'])
@jwt_required()
def add_member(channel_id):
    """Add a member to the channel"""
    try:
        data = request.get_json()
        if not data or 'user_id' not in data:
            return jsonify({'error': 'User ID is required'}), 400
            
        channel = Channel.get_by_id(channel_id)
        if not channel:
            return jsonify({'error': 'Channel not found'}), 404
            
        # Check if user has permission to add members
        current_user_id = ObjectId(get_jwt_identity())
        if current_user_id not in channel.members:
            return jsonify({'error': 'Not authorized to add members'}), 403
            
        # Add member
        new_member_id = ObjectId(data['user_id'])
        channel.add_member(new_member_id)
        
        # Emit socket event for member added
        socketio.emit('member_added', {
            'channel_id': str(channel._id),
            'user_id': str(new_member_id)
        }, room=channel_id)
        
        return jsonify(channel.to_response_dict())
        
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@channels_bp.route('/<channel_id>/members/<user_id>', methods=['DELETE'])
@jwt_required()
def remove_member(channel_id, user_id):
    """Remove a member from the channel"""
    try:
        channel = Channel.get_by_id(channel_id)
        if not channel:
            return jsonify({'error': 'Channel not found'}), 404
            
        # Check if user has permission to remove members
        current_user_id = ObjectId(get_jwt_identity())
        if current_user_id not in channel.members:
            return jsonify({'error': 'Not authorized to remove members'}), 403
            
        # Remove member
        member_id = ObjectId(user_id)
        channel.remove_member(member_id)
        
        # Emit socket event for member removed
        socketio.emit('member_removed', {
            'channel_id': str(channel._id),
            'user_id': user_id
        }, room=channel_id)
        
        return jsonify(channel.to_response_dict())
        
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@channels_bp.route('/dm/<user_id>', methods=['POST'])
@jwt_required()
def create_direct_message(user_id):
    """Create or get a direct message channel with another user"""
    try:
        current_user_id = get_jwt_identity()
        target_user_id = user_id
        
        # Get or create DM channel
        channel = Channel.get_direct_message(current_user_id, target_user_id)
        
        # Emit socket event for new DM channel
        socketio.emit('dm_channel_created', channel.to_response_dict(), room=str(current_user_id))
        socketio.emit('dm_channel_created', channel.to_response_dict(), room=str(target_user_id))
        
        return jsonify(channel.to_response_dict()), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@channels_bp.route('/<channel_id>/pin/<message_id>', methods=['POST'])
@jwt_required()
def pin_message(channel_id, message_id):
    """Pin a message in the channel"""
    try:
        channel = Channel.get_by_id(channel_id)
        if not channel:
            return jsonify({'error': 'Channel not found'}), 404
            
        # Check if user is a member
        user_id = ObjectId(get_jwt_identity())
        if user_id not in channel.members:
            return jsonify({'error': 'Not authorized to pin messages'}), 403
            
        channel.pin_message(ObjectId(message_id))
        
        # Emit socket event for pinned message
        socketio.emit('message_pinned', {
            'channel_id': str(channel._id),
            'message_id': message_id
        }, room=channel_id)
        
        return jsonify(channel.to_response_dict())
        
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@channels_bp.route('/<channel_id>/unpin/<message_id>', methods=['POST'])
@jwt_required()
def unpin_message(channel_id, message_id):
    """Unpin a message from the channel"""
    try:
        channel = Channel.get_by_id(channel_id)
        if not channel:
            return jsonify({'error': 'Channel not found'}), 404
            
        # Check if user is a member
        user_id = ObjectId(get_jwt_identity())
        if user_id not in channel.members:
            return jsonify({'error': 'Not authorized to unpin messages'}), 403
            
        channel.unpin_message(ObjectId(message_id))
        
        # Emit socket event for unpinned message
        socketio.emit('message_unpinned', {
            'channel_id': str(channel._id),
            'message_id': message_id
        }, room=channel_id)
        
        return jsonify(channel.to_response_dict())
        
    except Exception as e:
        return jsonify({'error': str(e)}), 400 