from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from datetime import datetime
from ..models.notes import Notes, NotesSection
from .. import db

notes_bp = Blueprint('notes', __name__)

@notes_bp.route('/<note_id>', methods=['PUT'])
@jwt_required()
def update_note(note_id):
    """Update a note"""
    try:
        # Get current user ID
        current_user_id = get_jwt_identity()
        
        # Get the note
        try:
            note = db.notes.find_one({'_id': ObjectId(note_id)})
        except Exception as e:
            return jsonify({
                'status': 'error',
                'message': 'Invalid note ID format'
            }), 400
            
        if not note:
            return jsonify({
                'status': 'error',
                'message': 'Note not found'
            }), 404
            
        # Check if user is the creator
        if note['creator_id'] != current_user_id:
            return jsonify({
                'status': 'error',
                'message': 'Not authorized to update this note'
            }), 403
            
        # Get update data
        data = request.get_json()
        if not data:
            return jsonify({
                'status': 'error',
                'message': 'No update data provided'
            }), 400
            
        # Validate required fields
        required_fields = ['title', 'sections']
        if not all(field in data for field in required_fields):
            return jsonify({
                'status': 'error',
                'message': 'Missing required fields'
            }), 400
            
        # Update note
        update_data = {
            'title': data['title'],
            'sections': data['sections'],
            'updated_at': datetime.utcnow(),
            'version': note.get('version', 1) + 1
        }
        
        result = db.notes.update_one(
            {'_id': ObjectId(note_id)},
            {'$set': update_data}
        )
        
        if result.modified_count == 0:
            return jsonify({
                'status': 'error',
                'message': 'Failed to update note'
            }), 500
            
        # Get updated note
        updated_note = db.notes.find_one({'_id': ObjectId(note_id)})
        
        # Prepare response
        response_data = {
            'id': str(updated_note['_id']),
            'title': updated_note['title'],
            'channel_id': updated_note['channel_id'],
            'thread_id': updated_note.get('thread_id'),
            'creator_id': updated_note['creator_id'],
            'sections': updated_note['sections'],
            'created_at': updated_note['created_at'].isoformat(),
            'updated_at': updated_note['updated_at'].isoformat(),
            'version': updated_note['version'],
            'is_draft': updated_note.get('is_draft', True)
        }
        
        return jsonify({
            'status': 'success',
            'data': response_data
        })
        
    except Exception as e:
        print(f"Error in update_note: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500 