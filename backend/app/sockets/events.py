from flask_socketio import emit, join_room, leave_room, disconnect
from flask import session, request
from flask_jwt_extended import decode_token
from app import socketio, db
from app.models.user import User
from app.models.message import Message
from app.models.channel import Channel
from datetime import datetime
from bson import ObjectId

@socketio.on('connect')
def handle_connect():
    """Handle socket connection with authentication"""
    try:
        # Get token from auth data
        auth = request.args.get('auth')
        if not auth:
            auth_header = request.headers.get('Authorization')
            if auth_header and auth_header.startswith('Bearer '):
                auth = auth_header.split(' ')[1]
            else:
                auth = request.headers.get('auth')

        if not auth:
            print("No auth token provided")
            return disconnect()

        # Verify token
        try:
            decoded_token = decode_token(auth)
            user_id = decoded_token['sub']
            
            # Store user_id in session
            session['user_id'] = user_id
            
            print(f"Socket authenticated for user: {user_id}")
            
            # Join user's personal room
            join_room(str(user_id))
            
        except Exception as e:
            print(f"Token verification failed: {str(e)}")
            return disconnect()

    except Exception as e:
        print(f"Connection error: {str(e)}")
        return disconnect()

    print("Client connected and authenticated")

@socketio.on('disconnect')
def handle_disconnect():
    print("Client disconnected")

@socketio.on('join')
def on_join(data):
    """Handle joining a room (channel)"""
    try:
        if 'channel' in data:
            channel_id = str(data['channel'])
            print(f"Client joining channel: {channel_id}")
            
            # Get user ID from session
            user_id = session.get('user_id')
            if not user_id:
                print("No user_id in session")
                return
                
            # Join both channel room and user's personal room
            join_room(channel_id)
            join_room(str(user_id))
            
            print(f"User {user_id} joined channel {channel_id}")
            emit('user_joined', {
                'user_id': str(user_id),
                'channel': channel_id
            }, room=channel_id)
    except Exception as e:
        print(f"Error in on_join: {str(e)}")

@socketio.on('leave')
def on_leave(data):
    """Handle leaving a room (channel)"""
    try:
        if 'channel' in data:
            channel_id = str(data['channel'])
            print(f"Client leaving channel: {channel_id}")
            
            # Get user ID from session
            user_id = session.get('user_id')
            if not user_id:
                print("No user_id in session")
                return
                
            # Leave the channel room but stay in personal room
            leave_room(channel_id)
            
            print(f"User {user_id} left channel {channel_id}")
            emit('user_left', {
                'user_id': str(user_id),
                'channel': channel_id
            }, room=channel_id)
    except Exception as e:
        print(f"Error in on_leave: {str(e)}")

@socketio.on('join_user_room')
def on_join_user_room(data):
    """Handle joining a user's personal room"""
    try:
        if 'user_id' in data:
            user_id = str(data['user_id'])
            print(f"User {user_id} joining their personal room")
            join_room(user_id)
            emit('user_room_joined', {'user_id': user_id}, room=user_id)
    except Exception as e:
        print(f"Error in on_join_user_room: {str(e)}")

@socketio.on('typing')
def handle_typing(data):
    """Handle typing notifications"""
    try:
        if 'channel' in data:
            channel_id = str(data['channel'])
            emit('user_typing', data, room=channel_id)
    except Exception as e:
        print(f"Error in handle_typing: {str(e)}")

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

@socketio.on('join_thread')
def on_join_thread(data):
    """Join a thread room"""
    try:
        thread_id = data.get('thread_id')
        if thread_id:
            thread_room = f'thread_{thread_id}'
            join_room(thread_room)
            print(f"User joined thread room: {thread_room}")
    except Exception as e:
        print(f"Error joining thread room: {e}")

@socketio.on('leave_thread')
def on_leave_thread(data):
    """Leave a thread room"""
    try:
        thread_id = data.get('thread_id')
        if thread_id:
            thread_room = f'thread_{thread_id}'
            leave_room(thread_room)
            print(f"User left thread room: {thread_room}")
    except Exception as e:
        print(f"Error leaving thread room: {e}")

@socketio.on('new_reply')
def handle_new_reply(data):
    """Handle new reply event"""
    try:
        message_id = data.get('message_id')
        reply = data.get('reply')
        if message_id and reply:
            # Get the thread room and channel room
            thread_room = f'thread_{message_id}'
            channel_id = reply.get('channel_id')
            
            # Emit to both rooms
            emit('new_reply', data, room=thread_room)
            if channel_id:
                emit('reply_count_update', {
                    'message_id': message_id,
                    'reply_count': reply.get('reply_count', 0)
                }, room=str(channel_id))
                
                # Also emit the full reply data to the channel
                emit('new_reply', data, room=str(channel_id))
    except Exception as e:
        print(f"Error handling new reply: {e}") 