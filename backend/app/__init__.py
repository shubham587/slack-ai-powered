from flask import Flask, request
from flask_socketio import SocketIO
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_login import LoginManager
from pymongo import MongoClient
from dotenv import load_dotenv
import os
import logging

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)

# Initialize Flask-SocketIO
socketio = SocketIO(cors_allowed_origins="*")

# Initialize MongoDB
client = MongoClient(os.getenv('MONGODB_URI', 'mongodb://localhost:27017/'))
db = client.slack_db

# Initialize Flask-Login
login_manager = LoginManager()

def create_app(test_config=None):
    app = Flask(__name__)
    
    # Configure app
    app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'your-secret-key')
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'your-secret-key')  # Required for Flask-Login
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
    app.url_map.strict_slashes = False  # Allow URLs with or without trailing slashes
    
    # Configure CORS
    CORS(app, 
        resources={
            r"/api/*": {
                "origins": [os.getenv('FRONTEND_URL', 'http://localhost:5173')],
                "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                "allow_headers": ["Content-Type", "Authorization"],
                "supports_credentials": True,
                "expose_headers": ["Content-Type", "Authorization"],
                "max_age": 120,
                "send_wildcard": False,
                "vary_header": True
            }
        },
        supports_credentials=True
    )
    
    @app.after_request
    def after_request(response):
        if request.method == 'OPTIONS':
            response = app.make_default_options_response()
        
        # Don't add CORS headers for static files
        if not request.path.startswith('/static/'):
            origin = request.headers.get('Origin')
            allowed_origin = os.getenv('FRONTEND_URL', 'http://localhost:5173')
            if origin == allowed_origin:
                response.headers['Access-Control-Allow-Origin'] = origin
                response.headers['Access-Control-Allow-Credentials'] = 'true'
                response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
                response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
                response.headers['Access-Control-Max-Age'] = '120'
        
        return response
    
    # Initialize JWT
    jwt = JWTManager(app)
    
    # Initialize Flask-Login
    login_manager.init_app(app)
    
    # User loader callback
    @login_manager.user_loader
    def load_user(user_id):
        from app.models.user import User
        return User.get_by_id(user_id)
    
    # Request loader for token-based authentication
    @login_manager.request_loader
    def load_user_from_request(request):
        from app.models.user import User
        # Get token from header
        auth_header = request.headers.get('Authorization')
        if auth_header:
            try:
                # Extract token
                auth_token = auth_header.replace('Bearer ', '')
                # Decode token and get user
                decoded = jwt.decode_token(auth_token)
                user_id = decoded['sub']
                return User.get_by_id(user_id)
            except:
                return None
        return None
    
    # Initialize socketio with app
    socketio.init_app(app)
    
    # Import blueprints
    from app.routes.auth import auth_bp
    from app.routes.channels import channels_bp
    from app.routes.messages import bp as messages_bp
    from app.routes.files import bp as files_bp
    from app.routes.users import users_bp
    from app.routes.invitations import invitations_bp
    from app.routes.ai import ai_bp
    from app.routes.notes import notes_bp
    
    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(users_bp, url_prefix='/api/users')
    app.register_blueprint(channels_bp, url_prefix='/api/channels')
    app.register_blueprint(messages_bp, url_prefix='/api/messages')
    app.register_blueprint(files_bp, url_prefix='/api/files')
    app.register_blueprint(invitations_bp, url_prefix='/api/invitations')
    app.register_blueprint(ai_bp, url_prefix='/api/ai')
    app.register_blueprint(notes_bp, url_prefix='/api/notes')
    
    # Import socket event handlers
    from app.sockets import events
    
    # Create uploads directory if it doesn't exist
    uploads_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads')
    os.makedirs(uploads_dir, exist_ok=True)
    
    # Socket event handlers
    @socketio.on('connect')
    def handle_connect():
        print("Client connected")

    @socketio.on('disconnect')
    def handle_disconnect():
        print("Client disconnected")

    @socketio.on('join')
    def handle_join(data):
        if 'channel' in data:
            print(f"Client joining channel: {data['channel']}")
            socketio.emit('user_joined', {'channel': data['channel']}, room=data['channel'])

    @socketio.on('join_user_room')
    def handle_join_user_room(data):
        if 'user_id' in data:
            user_id = str(data['user_id'])
            print(f"User {user_id} joining their personal room")
            socketio.emit('user_room_joined', {'user_id': user_id}, room=user_id)
    
    return app
