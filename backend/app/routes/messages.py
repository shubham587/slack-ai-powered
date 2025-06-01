from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.message import Message
from app import db, socketio
from bson import ObjectId
from datetime import datetime
from app.models.channel import Channel

bp = Blueprint('messages', __name__, url_prefix='/api/messages')

@bp.route('/channel/<channel_id>', methods=['GET'])
@jwt_required()
def get_channel_messages(channel_id):
    """Get messages for a channel"""
    try:
        # Convert string ID to ObjectId
        channel_id = ObjectId(channel_id)
        
        # Get pagination parameters
        before = request.args.get('before')
        limit = int(request.args.get('limit', 50))
        
        # Get messages
        messages = Message.get_channel_messages(
            channel_id=channel_id,
            limit=limit,
            before=before
        )
        
        return jsonify([msg.to_response_dict() for msg in messages])
        
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@bp.route('/channel/<channel_id>', methods=['POST'])
@jwt_required()
def send_message(channel_id):
    """Send a message to a channel"""
    try:
        data = request.get_json()
        if not data or 'content' not in data:
            return jsonify({'error': 'Message content is required'}), 400
            
        # Convert string ID to ObjectId
        try:
            channel_id = ObjectId(channel_id)
        except:
            return jsonify({'error': 'Invalid channel ID format'}), 400
            
        # Check if channel exists and user is a member
        user_id = ObjectId(get_jwt_identity())
        channel = db.channels.find_one({
            '_id': channel_id,
            'members': user_id
        })
        
        if not channel:
            return jsonify({'error': 'Channel not found or you are not a member'}), 404
            
        # Create message
        message = Message.create(
            channel_id=channel_id,
            sender_id=user_id,
            content=data['content'],
            message_type=data.get('type', 'text')
        )
        
        # Emit message to channel subscribers
        message_data = message.to_response_dict()
        socketio.emit('new_message', message_data, room=str(channel_id))
        
        return jsonify(message_data), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@bp.route('/search', methods=['GET'])
@jwt_required()
def search_messages():
    """Search messages across channels"""
    try:
        # Get search parameters
        query = request.args.get('q', '').strip()
        channel_id = request.args.get('channel_id')
        before = request.args.get('before')
        after = request.args.get('after')
        limit = int(request.args.get('limit', 50))
        
        if not query:
            return jsonify({'error': 'Search query is required'}), 400
            
        # Build search filter
        search_filter = {
            '$or': [
                {'content': {'$regex': query, '$options': 'i'}},  # Case-insensitive content search
                {'message_type': {'$regex': query, '$options': 'i'}}  # Search by message type
            ]
        }
        
        # Add channel filter if specified
        if channel_id:
            search_filter['channel_id'] = ObjectId(channel_id)
            
        # Add date filters
        if before or after:
            date_filter = {}
            if before:
                date_filter['$lt'] = datetime.fromisoformat(before)
            if after:
                date_filter['$gt'] = datetime.fromisoformat(after)
            if date_filter:
                search_filter['created_at'] = date_filter
        
        # Execute search
        messages = list(db.messages.find(
            search_filter,
            sort=[('created_at', -1)],
            limit=limit
        ))
        
        # Convert to Message objects
        results = [Message.from_dict(msg).to_response_dict() for msg in messages]
        
        return jsonify(results), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/<message_id>', methods=['PUT'])
@jwt_required()
def update_message(message_id):
    """Update a message"""
    try:
        data = request.get_json()
        if not data or 'content' not in data:
            return jsonify({'error': 'Message content is required'}), 400
            
        # Get message
        message = db.messages.find_one({'_id': ObjectId(message_id)})
        if not message:
            return jsonify({'error': 'Message not found'}), 404
            
        # Check if user is the sender
        if str(message['sender_id']) != get_jwt_identity():
            return jsonify({'error': 'Unauthorized'}), 403
            
        # Update message
        db.messages.update_one(
            {'_id': ObjectId(message_id)},
            {
                '$set': {
                    'content': data['content'],
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        # Get updated message
        updated_message = Message.from_dict(
            db.messages.find_one({'_id': ObjectId(message_id)})
        )
        
        # Emit update to channel
        message_data = updated_message.to_response_dict()
        socketio.emit('message_updated', message_data, room=str(updated_message.channel_id))
        
        return jsonify(message_data), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/<message_id>', methods=['DELETE'])
@jwt_required()
def delete_message(message_id):
    """Delete a message"""
    try:
        # Get message
        message = db.messages.find_one({'_id': ObjectId(message_id)})
        if not message:
            return jsonify({'error': 'Message not found'}), 404
            
        # Check if user is the sender
        if str(message['sender_id']) != get_jwt_identity():
            return jsonify({'error': 'Unauthorized'}), 403
            
        # Delete message
        db.messages.delete_one({'_id': ObjectId(message_id)})
        
        # Emit deletion to channel
        socketio.emit('message_deleted', {
            'message_id': message_id,
            'channel_id': str(message['channel_id'])
        }, room=str(message['channel_id']))
        
        return jsonify({'message': 'Message deleted successfully'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/<message_id>/react', methods=['POST'])
@jwt_required()
def react_to_message(message_id):
    """Add a reaction to a message"""
    data = request.get_json()
    if not data or 'reaction' not in data:
        return jsonify({'error': 'Reaction is required'}), 400
        
    username = get_jwt_identity()
    reaction = data['reaction']
    
    # Update message reactions
    result = db.messages.update_one(
        {'_id': message_id},
        {'$addToSet': {f'reactions.{reaction}': username}}
    )
    
    if result.matched_count == 0:
        return jsonify({'error': 'Message not found'}), 404
        
    return jsonify({'message': 'Reaction added successfully'})

@bp.route('/direct/<user_id>', methods=['GET'])
@jwt_required()
def get_direct_messages(user_id):
    """Get direct messages between current user and specified user"""
    try:
        current_user_id = get_jwt_identity()
        target_user_id = user_id
        
        # Get or create DM channel using Channel model
        channel = Channel.get_direct_message(current_user_id, target_user_id)
        
        # Get messages for this channel
        messages = list(db.messages.find(
            {'channel_id': channel._id},
            sort=[('created_at', 1)]
        ))
        
        return jsonify({
            'channel_id': str(channel._id),
            'messages': [Message.from_dict(msg).to_response_dict() for msg in messages]
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@bp.route('/recent-chats', methods=['GET'])
@jwt_required()
def get_recent_chats():
    """Get list of recent direct message conversations"""
    try:
        current_user_id = ObjectId(get_jwt_identity())
        
        # Find all DM channels for current user
        dm_channels = list(db.channels.find({
            'is_direct': True,
            'members': current_user_id
        }))
        
        recent_chats = []
        for channel in dm_channels:
            # Get the other user in the DM
            other_user_id = next(m for m in channel['members'] if m != current_user_id)
            other_user = db.users.find_one({'_id': other_user_id})
            
            # Get most recent message
            last_message = db.messages.find_one(
                {'channel_id': channel['_id']},
                sort=[('created_at', -1)]
            )
            
            if other_user:
                recent_chats.append({
                    'user': {
                        'id': str(other_user['_id']),
                        'username': other_user['username'],
                        'display_name': other_user.get('display_name', other_user['username']),
                        'avatar_url': other_user.get('avatar_url')
                    },
                    'last_message': Message.from_dict(last_message).to_response_dict() if last_message else None
                })
        
        return jsonify(recent_chats)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@bp.route('/direct/<user_id>', methods=['POST'])
@jwt_required()
def send_direct_message(user_id):
    """Send a direct message to a user"""
    try:
        data = request.get_json()
        if not data or 'content' not in data:
            return jsonify({'error': 'Message content is required'}), 400
            
        current_user_id = get_jwt_identity()
        target_user_id = user_id
        
        # Get or create DM channel using Channel model
        channel = Channel.get_direct_message(current_user_id, target_user_id)
        
        # Create message
        message = Message.create(
            channel_id=channel._id,
            sender_id=ObjectId(current_user_id),
            content=data['content'],
            message_type='text'
        )
        
        # Emit message to both users
        message_data = message.to_response_dict()
        for member_id in channel.members:
            socketio.emit('new_message', message_data, room=str(member_id))
        
        return jsonify(message_data), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 400 