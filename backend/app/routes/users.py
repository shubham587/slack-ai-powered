from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.user import User
from app import db
from bson import ObjectId

users_bp = Blueprint('users', __name__, url_prefix='/api/users')

@users_bp.route('/search', methods=['GET'])
@jwt_required()
def search_users():
    """Search users by username or email"""
    try:
        query = request.args.get('q', '').strip()
        if not query:
            return jsonify([])
            
        # Search users by username or email
        users = list(db.users.find({
            '$or': [
                {'username': {'$regex': query, '$options': 'i'}},
                {'email': {'$regex': query, '$options': 'i'}}
            ]
        }))
        
        # Convert to response format
        return jsonify([{
            'id': str(user['_id']),
            'username': user['username'],
            'email': user['email'],
            'avatar_url': user.get('avatar_url'),
            'display_name': user.get('display_name', user['username'])
        } for user in users])
        
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@users_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """Get current user's profile"""
    try:
        user_id = get_jwt_identity()
        user = User.get_by_id(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
            
        return jsonify(user.to_response_dict())
        
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@users_bp.route('/me', methods=['PUT'])
@jwt_required()
def update_current_user():
    """Update current user's profile"""
    try:
        user_id = get_jwt_identity()
        user = User.get_by_id(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
            
        data = request.get_json()
        user.update(data)
        
        return jsonify(user.to_response_dict())
        
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@users_bp.route('/<user_id>', methods=['GET'])
@jwt_required()
def get_user(user_id):
    """Get user profile by ID"""
    try:
        user = User.get_by_id(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
            
        return jsonify(user.to_response_dict())
        
    except Exception as e:
        return jsonify({'error': str(e)}), 400 