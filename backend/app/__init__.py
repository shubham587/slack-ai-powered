from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_socketio import SocketIO
from pymongo import MongoClient
from dotenv import load_dotenv
import os
import logging

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)

# Initialize Flask-SocketIO with CORS support
socketio = SocketIO(cors_allowed_origins=["http://localhost:5173", "http://localhost:5174"])

# Initialize MongoDB
client = MongoClient(os.getenv('MONGODB_URI', 'mongodb://localhost:27017/'))
db = client.slack_db

def create_app(test_config=None):
    app = Flask(__name__)
    
    # Configure app
    app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'your-secret-key')
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
    app.url_map.strict_slashes = False  # Allow URLs with or without trailing slashes
    
    # Configure CORS
    CORS(app, 
         resources={
             r"/api/*": {
                 "origins": ["http://localhost:5173", "http://localhost:5174"],
                 "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                 "allow_headers": ["Content-Type", "Authorization"],
                 "expose_headers": ["Content-Type", "Authorization"],
                 "supports_credentials": True,
                 "send_wildcard": False,
                 "max_age": 86400
             }
         })
    
    # Initialize JWT
    JWTManager(app)
    
    # Initialize socketio with app
    socketio.init_app(app, async_mode='eventlet')
    
    # Import blueprints
    from app.routes.auth import auth_bp
    from app.routes.channels import channels_bp
    from app.routes.messages import bp as messages_bp
    from app.routes.files import bp as files_bp
    from app.routes.users import users_bp
    from app.routes.invitations import invitations_bp
    
    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(channels_bp, url_prefix='/api/channels')
    app.register_blueprint(messages_bp, url_prefix='/api/messages')
    app.register_blueprint(files_bp, url_prefix='/api/files')
    app.register_blueprint(users_bp, url_prefix='/api/users')
    app.register_blueprint(invitations_bp, url_prefix='/api/invitations')
    
    # Import socket event handlers
    from app.sockets import events
    
    # Create uploads directory if it doesn't exist
    uploads_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads')
    os.makedirs(uploads_dir, exist_ok=True)
    
    return app
