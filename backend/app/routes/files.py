from flask import Blueprint, request, jsonify, send_file, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from app.models.file import File
from app.models.message import Message
from app import db
from bson import ObjectId
import os

bp = Blueprint('files', __name__, url_prefix='/api/files')

@bp.route('/upload', methods=['POST'])
@jwt_required()
def upload_file():
    """Upload a file"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
            
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
            
        # Get additional metadata
        channel_id = request.form.get('channel_id')
        file_type = request.form.get('file_type', 'document')
        
        if not channel_id:
            return jsonify({'error': 'Channel ID is required'}), 400
            
        # Secure the filename
        filename = secure_filename(file.filename)
        
        # Create file record
        file_obj = File.create(
            filename=filename,
            content_type=file.content_type,
            size=file.content_length,
            uploader_id=ObjectId(get_jwt_identity()),
            file_type=file_type
        )
        
        # Save file to disk
        file_obj.save_file(file.read())
        
        # Create a message for the file
        message = Message.create(
            channel_id=ObjectId(channel_id),
            sender_id=ObjectId(get_jwt_identity()),
            content=file_obj.to_response_dict(),
            message_type='file'
        )
        
        # Return file metadata
        return jsonify(file_obj.to_response_dict()), 201
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/<file_id>/download', methods=['GET'])
@jwt_required()
def download_file(file_id):
    """Download a file"""
    try:
        file_obj = File.get_by_id(file_id)
        if not file_obj:
            return jsonify({'error': 'File not found'}), 404
            
        return send_file(
            file_obj.storage_path,
            mimetype=file_obj.content_type,
            as_attachment=True,
            download_name=file_obj.filename
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/<file_id>', methods=['DELETE'])
@jwt_required()
def delete_file(file_id):
    """Delete a file"""
    try:
        file_obj = File.get_by_id(file_id)
        if not file_obj:
            return jsonify({'error': 'File not found'}), 404
            
        # Check if user is the uploader
        if str(file_obj.uploader_id) != get_jwt_identity():
            return jsonify({'error': 'Unauthorized'}), 403
            
        # Delete file
        file_obj.delete_file()
        
        return jsonify({'message': 'File deleted successfully'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/channel/<channel_id>', methods=['GET'])
@jwt_required()
def get_channel_files(channel_id):
    """Get files shared in a channel"""
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 50))
        skip = (page - 1) * limit
        
        files = File.get_channel_files(channel_id, limit=limit, skip=skip)
        
        return jsonify([f.to_response_dict() for f in files]), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500 