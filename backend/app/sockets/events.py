from flask_socketio import emit, join_room, leave_room
from flask import session, request
from flask_jwt_extended import decode_token
from app import socketio, db
from app.models.user import User
from app.models.message import Message
from app.models.channel import Channel
from datetime import datetime
from bson import ObjectId

@socketio.on('connect')
def handle_connect(auth):
    """Handle client connection"""
    try:
        # Get auth token from query string or headers
        if not auth or not isinstance(auth, dict) or 'token' not in auth:
            return False
            
        # Verify JWT token
        token = auth['token']
        decoded = decode_token(token)
        user_id = decoded['sub']
        
        # Store user_id in session
        session['user_id'] = user_id
        
        # Join user's room for direct messages
        join_room(str(user_id))
        
        # Join all user's channel rooms
        channels = Channel.get_user_channels(user_id)
        for channel in channels:
            join_room(str(channel._id))
        
        return True
    except Exception as e:
        print(f"Connection error: {str(e)}")
        return False

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    if 'user_id' in session:
        user_id = session['user_id']
        
        # Leave user's room
        leave_room(str(user_id))
        
        # Leave all channel rooms
        channels = Channel.get_user_channels(user_id)
        for channel in channels:
            leave_room(str(channel._id))

@socketio.on('join_channel')
def handle_join_channel(data):
    """Join a channel room"""
    try:
        channel_id = data.get('channel_id')
        if not channel_id:
            return
            
        # Join the channel room
        join_room(channel_id)
        
        # Emit user joined event to channel
        user_id = session.get('user_id')
        if user_id:
            user = User.get_by_id(user_id)
            if user:
                emit('user_joined', {
                    'user': user.to_response_dict(),
                    'channel_id': channel_id
                }, room=channel_id)
                
    except Exception as e:
        print(f"Join channel error: {str(e)}")

@socketio.on('leave_channel')
def handle_leave_channel(data):
    """Leave a channel room"""
    try:
        channel_id = data.get('channel_id')
        if not channel_id:
            return
            
        # Leave the channel room
        leave_room(channel_id)
        
        # Emit user left event to channel
        user_id = session.get('user_id')
        if user_id:
            user = User.get_by_id(user_id)
            if user:
                emit('user_left', {
                    'user': user.to_response_dict(),
                    'channel_id': channel_id
                }, room=channel_id)
                
    except Exception as e:
        print(f"Leave channel error: {str(e)}")

@socketio.on('typing')
def handle_typing(data):
    """Handle typing indicator"""
    try:
        channel_id = data.get('channel_id')
        if not channel_id:
            return
            
        user_id = session.get('user_id')
        if user_id:
            user = User.get_by_id(user_id)
            if user:
                emit('user_typing', {
                    'user': user.to_response_dict(),
                    'channel_id': channel_id
                }, room=channel_id)
                
    except Exception as e:
        print(f"Typing indicator error: {str(e)}")

@socketio.on('stop_typing')
def handle_stop_typing(data):
    """Handle stop typing indicator"""
    try:
        channel_id = data.get('channel_id')
        if not channel_id:
            return
            
        user_id = session.get('user_id')
        if user_id:
            user = User.get_by_id(user_id)
            if user:
                emit('user_stop_typing', {
                    'user': user.to_response_dict(),
                    'channel_id': channel_id
                }, room=channel_id)
                
    except Exception as e:
        print(f"Stop typing indicator error: {str(e)}")

@socketio.on('new_message')
def handle_new_message(data):
    """Handle new message in channel"""
    try:
        channel_id = data.get('channel_id')
        content = data.get('content')
        message_type = data.get('message_type', 'text')
        
        if not channel_id or not content:
            return
            
        user_id = session.get('user_id')
        if not user_id:
            return
            
        # Create new message
        message = Message.create(
            channel_id=ObjectId(channel_id),
            sender_id=ObjectId(user_id),
            content=content,
            message_type=message_type
        )
        
        # Update channel's last_message_at
        channel = Channel.get_by_id(channel_id)
        if channel:
            channel.update({'last_message_at': datetime.utcnow()})
        
        # Emit message to channel room
        emit('message_created', message.to_response_dict(), room=channel_id)
        
    except Exception as e:
        print(f"New message error: {str(e)}")

@socketio.on('message_delivered')
def handle_message_delivered(data):
    """Handle message delivery status"""
    try:
        message_id = data.get('message_id')
        if not message_id:
            return
            
        user_id = session.get('user_id')
        if not user_id:
            return
            
        # Mark message as delivered
        message = Message.mark_delivered(message_id, user_id)
        if message:
            emit('message_delivery_updated', message.to_response_dict(), room=str(message.channel_id))
            
    except Exception as e:
        print(f"Message delivery error: {str(e)}")

@socketio.on('message_read')
def handle_message_read(data):
    """Handle message read status"""
    try:
        message_id = data.get('message_id')
        if not message_id:
            return
            
        user_id = session.get('user_id')
        if not user_id:
            return
            
        # Mark message as read
        message = Message.mark_read(message_id, user_id)
        if message:
            emit('message_read_updated', message.to_response_dict(), room=str(message.channel_id))
            
    except Exception as e:
        print(f"Message read error: {str(e)}")

@socketio.on('error')
def handle_error(error):
    """Handle socket errors"""
    print(f"Socket error: {str(error)}") 