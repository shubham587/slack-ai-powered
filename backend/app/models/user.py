from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin
from app import db
from datetime import datetime
from bson import ObjectId

class User(UserMixin):
    def __init__(self, username, email, password=None, _id=None):
        self._id = _id or ObjectId()
        self.username = username
        self.email = email
        self.password_hash = generate_password_hash(password, method='pbkdf2:sha256') if password else None
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
        self.is_active = True
        self.tier = 'free'  # Default tier for rate limiting

    def get_id(self):
        return str(self._id)

    @property
    def is_authenticated(self):
        return True

    @property
    def is_anonymous(self):
        return False

    @staticmethod
    def create(username, email, password):
        if db.users.find_one({'$or': [{'username': username}, {'email': email}]}):
            return None
        
        user = User(username, email, password)
        result = db.users.insert_one(user.to_dict())
        user._id = result.inserted_id
        return user

    @staticmethod
    def get_by_id(user_id):
        """Get user by ID with better error handling"""
        try:
            if not user_id:
                print("No user ID provided")
                return None
                
            if isinstance(user_id, str):
                try:
                    user_id = ObjectId(user_id)
                except Exception as e:
                    print(f"Error converting user ID to ObjectId: {str(e)}")
                    return None
                    
            user_data = db.users.find_one({'_id': user_id})
            if user_data:
                return User.from_dict(user_data)
            else:
                print(f"No user found with ID: {user_id}")
                return None
                
        except Exception as e:
            print(f"Error in get_by_id: {str(e)}")
            return None

    @staticmethod
    def get_by_email(email):
        user_data = db.users.find_one({'email': email})
        if user_data:
            return User.from_dict(user_data)
        return None

    @staticmethod
    def get_by_username(username):
        user_data = db.users.find_one({'username': username})
        if user_data:
            return User.from_dict(user_data)
        return None

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            '_id': self._id,
            'username': self.username,
            'email': self.email,
            'password_hash': self.password_hash,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'is_active': self.is_active,
            'tier': self.tier
        }

    @staticmethod
    def from_dict(data):
        user = User(
            username=data['username'],
            email=data['email'],
            _id=data['_id']
        )
        user.password_hash = data['password_hash']
        user.created_at = data['created_at']
        user.updated_at = data['updated_at']
        user.is_active = data.get('is_active', True)
        user.tier = data.get('tier', 'free')
        return user

    def update(self, data):
        updates = {}
        if 'username' in data:
            updates['username'] = data['username']
        if 'email' in data:
            updates['email'] = data['email']
        if 'password' in data:
            updates['password_hash'] = generate_password_hash(data['password'], method='pbkdf2:sha256')
        if 'tier' in data:
            updates['tier'] = data['tier']
        if 'is_active' in data:
            updates['is_active'] = data['is_active']
        
        if updates:
            updates['updated_at'] = datetime.utcnow()
            db.users.update_one({'_id': self._id}, {'$set': updates})
            for key, value in updates.items():
                setattr(self, key, value)

    def to_response_dict(self):
        return {
            'id': str(self._id),
            'username': self.username,
            'email': self.email,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'tier': self.tier,
            'is_active': self.is_active
        } 