from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.message import Message
from app import db, socketio
from bson import ObjectId
from datetime import datetime
from app.models.channel import Channel
from flask import current_app

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
        
        # Update reply counts for each message
        for message in messages:
            # Count actual replies
            reply_count = db.messages.count_documents({
                'parent_id': message._id
            })
            
            # Update message if count is different
            if reply_count != message.reply_count:
                db.messages.update_one(
                    {'_id': message._id},
                    {'$set': {'reply_count': reply_count}}
                )
                message.reply_count = reply_count
        
        return jsonify([msg.to_response_dict() for msg in messages])
        
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@bp.route('/channel/<channel_id>', methods=['POST'])
@jwt_required()
def send_message(channel_id):
    """Send a message to a channel"""
    try:
        print("\n=== New Message Request ===")
        print(f"Channel ID: {channel_id}")
        print(f"Content-Type: {request.content_type}")
        print(f"Files: {list(request.files.keys()) if request.files else 'No files'}")
        print(f"Form Data: {list(request.form.keys()) if request.form else 'No form data'}")
        
        # Convert string ID to ObjectId
        try:
            channel_id_obj = ObjectId(channel_id)
            print(f"Valid ObjectId: {channel_id_obj}")
        except Exception as e:
            print(f"Invalid channel ID format: {channel_id}, error: {str(e)}")
            return jsonify({'error': f'Invalid channel ID format: {str(e)}'}), 400
        
        # Get user ID and verify token
        try:
            user_id = ObjectId(get_jwt_identity())
            print(f"Authenticated User ID: {user_id}")
        except Exception as e:
            print(f"Authentication error: {str(e)}")
            return jsonify({'error': 'Invalid authentication token'}), 401
        
        # Check if channel exists and user is a member
        channel = db.channels.find_one({
            '_id': channel_id_obj,
            'members': user_id
        })
        
        if not channel:
            print(f"Channel access error: Channel not found or user {user_id} not a member of channel {channel_id}")
            return jsonify({'error': 'Channel not found or you are not a member'}), 404
        
        print(f"Channel access verified: {channel.get('name', 'unnamed')}")
        
        # Handle file upload
        if 'file' in request.files:
            file = request.files['file']
            content = request.form.get('content', '')
            
            print("\n=== File Upload Details ===")
            print(f"Filename: {file.filename}")
            print(f"Content Type: {file.content_type}")
            print(f"MIME Type: {file.mimetype}")
            
            if not file or not file.filename:
                print("Error: Missing file or filename")
                return jsonify({'error': 'No file provided'}), 400
            
            # Upload file
            from app.models.file import File
            try:
                # Read file content and get size
                file_content = file.read()
                file_size = len(file_content)
                
                print(f"File size: {file_size} bytes")
                
                if file_size == 0:
                    print("Error: Empty file")
                    return jsonify({'error': 'Empty file provided'}), 400
                
                if file_size > 16 * 1024 * 1024:  # 16MB limit
                    print("Error: File too large")
                    return jsonify({'error': 'File size exceeds 16MB limit'}), 400
                
                # Determine file type based on extension
                file_type = 'document'  # default
                if file.filename.lower().endswith(('.jpg', '.jpeg', '.png', '.gif')):
                    file_type = 'image'
                elif file.filename.lower().endswith(('.py', '.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.css')):
                    file_type = 'code'
                elif file.filename.lower().endswith(('.zip', '.rar', '.7z', '.tar', '.gz')):
                    file_type = 'archive'
                
                file_obj = File.create(
                    filename=file.filename,
                    content_type=file.content_type or file.mimetype,
                    size=file_size,
                    uploader_id=user_id,
                    file_type=file_type
                )
                
                # Save the file
                file_obj.save_file(file_content)
                print(f"File saved successfully with ID: {file_obj._id}")
                
                # Create message with file attachment
                message = Message.create(
                    channel_id=channel_id_obj,
                    sender_id=user_id,
                    content=content,
                    message_type='file',
                    file_id=file_obj._id
                )
                
                print(f"Message created with ID: {message._id}")
                
                # Add file metadata to message response
                message_data = message.to_response_dict()
                message_data['file'] = file_obj.to_response_dict()
                
                # Emit message to channel subscribers
                socketio.emit('new_message', message_data, room=str(channel_id))
                
                return jsonify(message_data), 201
                
            except ValueError as e:
                print(f"File processing error: {str(e)}")
                return jsonify({'error': f'Error processing file: {str(e)}'}), 400
            except Exception as e:
                print(f"Unexpected file processing error: {str(e)}")
                return jsonify({'error': 'Failed to process file upload'}), 500
                
        else:
            # Handle regular text message
            try:
                data = request.get_json()
                print("\n=== Text Message Details ===")
                print(f"Message Data: {data}")
                
                if not data or 'content' not in data:
                    print("Error: Missing message content")
                    return jsonify({'error': 'Message content is required'}), 400
                
                # Create message
                message = Message.create(
                    channel_id=channel_id_obj,
                    sender_id=user_id,
                    content=data['content'],
                    message_type=data.get('type', 'text')
                )
                
                print(f"Message created with ID: {message._id}")
                
                # Emit message to channel subscribers
                message_data = message.to_response_dict()
                socketio.emit('new_message', message_data, room=str(channel_id))
                
                return jsonify(message_data), 201
                
            except Exception as e:
                print(f"Text message processing error: {str(e)}")
                return jsonify({'error': f'Error processing text message: {str(e)}'}), 400
            
    except Exception as e:
        print(f"Unexpected error in send_message: {str(e)}")
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
        
        # Convert message to response format
        message_data = updated_message.to_response_dict()
        
        # Emit update to channel room
        socketio.emit('message_updated', message_data, room=str(updated_message.channel_id))
        
        # If this is a reply, also emit to thread room
        if message.get('parent_id'):
            thread_room = f'thread_{str(message["parent_id"])}'
            socketio.emit('message_updated', message_data, room=thread_room)
        
        # Also emit to the message's own thread room if it has replies
        thread_room = f'thread_{message_id}'
        socketio.emit('message_updated', message_data, room=thread_room)
        
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

@bp.route('/<message_id>/replies', methods=['GET'], endpoint='get_replies')
@jwt_required()
def get_message_replies(message_id):
    """Get all replies for a message"""
    try:
        # Validate message_id
        if not ObjectId.is_valid(message_id):
            return jsonify({'error': 'Invalid message ID'}), 400

        # Get the parent message
        parent_message = db.messages.find_one({'_id': ObjectId(message_id)})
        if not parent_message:
            return jsonify({'error': 'Message not found'}), 404

        # Get replies
        replies = list(db.messages.find(
            {'parent_id': ObjectId(message_id)},
            sort=[('created_at', 1)]
        ))
        
        # Update the parent message's reply count to match actual count
        actual_count = len(replies)
        db.messages.update_one(
            {'_id': ObjectId(message_id)},
            {'$set': {'reply_count': actual_count}}
        )
        
        # Get the updated parent message
        updated_parent = db.messages.find_one({'_id': ObjectId(message_id)})
        
        # Convert to response format
        replies_data = [Message.from_dict(reply).to_response_dict() for reply in replies]
        
        # Emit the updated reply count to all clients
        socketio.emit('message_updated', Message.from_dict(updated_parent).to_response_dict(), 
                     room=str(parent_message['channel_id']))
        
        return jsonify(replies_data), 200

    except Exception as e:
        current_app.logger.error(f"Error getting message replies: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@bp.route('/<message_id>/reply', methods=['POST'], endpoint='create_reply')
@jwt_required()
def create_message_reply(message_id):
    """Create a reply to a message"""
    try:
        # Get current user ID
        current_user_id = get_jwt_identity()
        
        # Validate message_id
        if not ObjectId.is_valid(message_id):
            return jsonify({'error': 'Invalid message ID'}), 400

        # Get the parent message
        parent_message = db.messages.find_one({'_id': ObjectId(message_id)})
        if not parent_message:
            return jsonify({'error': 'Parent message not found'}), 404

        # Get request data
        data = request.get_json()
        if not data or 'content' not in data:
            return jsonify({'error': 'Message content is required'}), 400

        # Create the reply
        reply = Message.create(
            channel_id=parent_message['channel_id'],
            sender_id=ObjectId(current_user_id),
            content=data['content'],
            parent_id=ObjectId(message_id)
        )

        # Convert to response format
        reply_data = reply.to_response_dict()

        # Emit socket event for real-time updates
        # Emit to thread-specific room
        thread_room = f'thread_{message_id}'
        socketio.emit('new_reply', {
            'message_id': message_id,
            'reply': reply_data,
            'parent_id': message_id
        }, room=thread_room)

        # Also emit to channel room for any other UI updates
        socketio.emit('new_reply', {
            'message_id': message_id,
            'reply': reply_data,
            'parent_id': message_id
        }, room=str(parent_message['channel_id']))

        return jsonify(reply_data), 201

    except Exception as e:
        current_app.logger.error(f"Error creating message reply: {str(e)}")
        return jsonify({'error': str(e)}), 500 