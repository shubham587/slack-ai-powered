from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from app import db
from bson import ObjectId
from datetime import timedelta
import logging

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

@auth_bp.route('/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        
        # Validate required fields
        if not all(k in data for k in ('username', 'password', 'email')):
            return jsonify({'error': 'Missing required fields'}), 400
            
        # Check if username already exists
        if db.users.find_one({'username': data['username']}):
            return jsonify({'error': 'Username already exists'}), 409
            
        # Check if email already exists
        if db.users.find_one({'email': data['email']}):
            return jsonify({'error': 'Email already exists'}), 409
            
        # Create user document
        user = {
            '_id': ObjectId(),
            'username': data['username'],
            'email': data['email'],
            'password': generate_password_hash(data['password'], method='pbkdf2:sha256'),
            'display_name': data.get('display_name', data['username']),
            'avatar_url': data.get('avatar_url', None)
        }
        
        # Insert user into database
        db.users.insert_one(user)
        
        # Create access token
        access_token = create_access_token(
            identity=str(user['_id']),
            expires_delta=timedelta(days=1)
        )
        
        return jsonify({
            'token': access_token,
            'user': {
                'id': str(user['_id']),
                'username': user['username'],
                'email': user['email'],
                'display_name': user['display_name'],
                'avatar_url': user['avatar_url']
            }
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        
        # Validate required fields
        if not all(k in data for k in ('username', 'password')):
            return jsonify({'error': 'Missing required fields'}), 400
            
        # Find user by username
        user = db.users.find_one({'username': data['username']})
        if not user or not check_password_hash(user['password'], data['password']):
            return jsonify({'error': 'Invalid username or password'}), 401
            
        # Create access token
        access_token = create_access_token(
            identity=str(user['_id']),
            expires_delta=timedelta(days=1)
        )
        
        return jsonify({
            'token': access_token,
            'user': {
                'id': str(user['_id']),
                'username': user['username'],
                'email': user['email'],
                'display_name': user.get('display_name', user['username']),
                'avatar_url': user.get('avatar_url')
            }
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    try:
        user_id = ObjectId(get_jwt_identity())
        user = db.users.find_one({'_id': user_id})
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
            
        return jsonify({
            'id': str(user['_id']),
            'username': user['username'],
            'email': user['email'],
            'display_name': user.get('display_name', user['username']),
            'avatar_url': user.get('avatar_url')
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@auth_bp.route('/me', methods=['PUT'])
@jwt_required()
def update_current_user():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()

        # Validate required fields
        required_fields = ['username', 'email']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400

        # Check if username is already taken by another user
        existing_user = db.users.find_one({
            'username': data['username'],
            '_id': {'$ne': ObjectId(user_id)}
        })
        if existing_user:
            return jsonify({'error': 'Username already taken'}), 400

        # Update user profile
        update_data = {
            'username': data['username'],
            'email': data['email'],
            'display_name': data.get('display_name', ''),
            'avatar_url': data.get('avatar_url', '')
        }

        result = db.users.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': update_data}
        )

        if result.modified_count == 0:
            return jsonify({'error': 'User not found'}), 404

        # Get updated user data
        updated_user = db.users.find_one({'_id': ObjectId(user_id)})
        return jsonify({
            'user': {
                'id': str(updated_user['_id']),
                'username': updated_user['username'],
                'email': updated_user['email'],
                'display_name': updated_user.get('display_name', ''),
                'avatar_url': updated_user.get('avatar_url', ''),
                'settings': updated_user.get('settings', {})
            }
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/verify', methods=['GET'])
@jwt_required()
def verify():
    try:
        # Get user ID from JWT token
        user_id = get_jwt_identity()
        
        # Find user by ID
        user = db.users.find_one({'_id': ObjectId(user_id)})
        if not user:
            return jsonify({'error': 'User not found'}), 404
            
        return jsonify({
            'user': {
                'id': str(user['_id']),
                'username': user['username'],
                'email': user['email'],
                'display_name': user.get('display_name', ''),
                'avatar_url': user.get('avatar_url', ''),
                'settings': user.get('settings', {
                    'theme': 'dark',
                    'notifications': True,
                    'soundEnabled': True,
                    'desktopNotifications': True,
                    'messagePreview': True,
                    'timezone': 'UTC'
                })
            }
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/settings', methods=['PUT'])
@jwt_required()
def update_settings():
    try:
        user_id = get_jwt_identity()
        settings = request.get_json()

        # Validate settings
        required_fields = ['theme', 'notifications', 'soundEnabled', 'desktopNotifications', 'messagePreview', 'timezone']
        for field in required_fields:
            if field not in settings:
                return jsonify({'error': f'Missing required field: {field}'}), 400

        # Update user settings
        result = db.users.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': {'settings': settings}}
        )

        if result.modified_count == 0:
            return jsonify({'error': 'User not found'}), 404

        return jsonify({'settings': settings}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/test-user', methods=['POST'])
def create_test_user():
    """Create a test user for development"""
    try:
        data = request.get_json()
        username = data.get('username', 'testuser')
        email = data.get('email', 'test@example.com')
        password = data.get('password', 'testpass123')
        
        # Check if user already exists
        if db.users.find_one({'username': username}) or db.users.find_one({'email': email}):
            return jsonify({'error': 'User already exists'}), 400
            
        # Create user
        user = {
            '_id': ObjectId(),
            'username': username,
            'email': email,
            'password': generate_password_hash(password, method='pbkdf2:sha256'),
            'display_name': username,
            'avatar_url': None
        }
        
        # Insert user into database
        db.users.insert_one(user)
        
        # Generate token
        token = create_access_token(identity=str(user['_id']))
        
        return jsonify({
            'token': token,
            'user': {
                'id': str(user['_id']),
                'username': user['username'],
                'email': user['email'],
                'display_name': user['display_name'],
                'avatar_url': user['avatar_url']
            }
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/debug', methods=['GET'])
def debug():
    """Debug endpoint to check MongoDB connection"""
    try:
        # Test MongoDB connection
        users = list(db.users.find())
        channels = list(db.channels.find())
        
        return jsonify({
            'status': 'ok',
            'user_count': len(users),
            'channel_count': len(channels),
            'users': [
                {
                    'id': str(user['_id']),
                    'username': user['username'],
                    'email': user['email']
                } for user in users
            ],
            'channels': [
                {
                    'id': str(channel['_id']),
                    'name': channel['name'],
                    'is_direct': channel.get('is_direct', False)
                } for channel in channels
            ]
        }), 200
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500 