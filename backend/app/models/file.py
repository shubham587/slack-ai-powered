from datetime import datetime
import os
from bson import ObjectId
from app import db
from app.config import UPLOAD_FOLDER, ALLOWED_EXTENSIONS

class File:
    def __init__(self, filename, content_type, size, uploader_id, file_type='document', _id=None):
        self._id = _id or ObjectId()
        self.filename = filename
        self.content_type = content_type
        self.size = size
        self.uploader_id = uploader_id
        self.file_type = file_type
        self.created_at = datetime.utcnow()
        self.storage_path = os.path.join(UPLOAD_FOLDER, str(self._id), filename)

    @staticmethod
    def is_allowed_file(filename, file_type='document'):
        """Check if file extension is allowed"""
        if '.' not in filename:
            return False
        ext = filename.rsplit('.', 1)[1].lower()
        return ext in ALLOWED_EXTENSIONS.get(file_type, set())

    @staticmethod
    def create(filename, content_type, size, uploader_id, file_type='document'):
        """Create a new file record"""
        if not File.is_allowed_file(filename, file_type):
            raise ValueError(f"File type not allowed. Allowed types: {ALLOWED_EXTENSIONS[file_type]}")

        file = File(filename, content_type, size, uploader_id, file_type)
        
        # Create upload directory if it doesn't exist
        os.makedirs(os.path.dirname(file.storage_path), exist_ok=True)
        
        # Insert file metadata into database
        result = db.files.insert_one(file.to_dict())
        file._id = result.inserted_id
        return file

    @staticmethod
    def get_by_id(file_id):
        """Get file by ID"""
        file_data = db.files.find_one({'_id': ObjectId(file_id)})
        if file_data:
            return File.from_dict(file_data)
        return None

    @staticmethod
    def get_channel_files(channel_id, limit=50, skip=0):
        """Get files shared in a channel"""
        files = list(db.files.find(
            {'channel_id': ObjectId(channel_id)},
            sort=[('created_at', -1)],
            skip=skip,
            limit=limit
        ))
        return [File.from_dict(f) for f in files]

    @staticmethod
    def from_dict(data):
        """Create File instance from dictionary"""
        return File(
            filename=data['filename'],
            content_type=data['content_type'],
            size=data['size'],
            uploader_id=data['uploader_id'],
            file_type=data['file_type'],
            _id=data['_id']
        )

    def to_dict(self):
        """Convert File instance to dictionary"""
        return {
            '_id': self._id,
            'filename': self.filename,
            'content_type': self.content_type,
            'size': self.size,
            'uploader_id': self.uploader_id,
            'file_type': self.file_type,
            'created_at': self.created_at
        }

    def to_response_dict(self):
        """Convert File instance to API response dictionary"""
        return {
            'id': str(self._id),
            'filename': self.filename,
            'content_type': self.content_type,
            'size': self.size,
            'uploader_id': str(self.uploader_id),
            'file_type': self.file_type,
            'created_at': self.created_at.isoformat(),
            'download_url': f'/api/files/{str(self._id)}/download'
        }

    def save_file(self, file_data):
        """Save file to disk"""
        try:
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
            
            # Write file
            with open(self.storage_path, 'wb') as f:
                f.write(file_data)
        except Exception as e:
            # Clean up file record if save fails
            db.files.delete_one({'_id': self._id})
            raise e

    def delete_file(self):
        """Delete file from disk and database"""
        try:
            # Delete from disk
            if os.path.exists(self.storage_path):
                os.remove(self.storage_path)
                
            # Clean up empty directory
            dir_path = os.path.dirname(self.storage_path)
            if os.path.exists(dir_path) and not os.listdir(dir_path):
                os.rmdir(dir_path)
                
            # Delete from database
            db.files.delete_one({'_id': self._id})
            
        except Exception as e:
            raise e 