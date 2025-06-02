import os
from dotenv import load_dotenv
from datetime import timedelta

# Load environment variables
load_dotenv()

# MongoDB Configuration
MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/')
DB_NAME = 'slack_db'

# JWT Configuration
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'your-secret-key')
JWT_ACCESS_TOKEN_EXPIRES = 24 * 60 * 60  # 24 hours

# File Upload Configuration
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads')
ALLOWED_EXTENSIONS = {
    'image': {'png', 'jpg', 'jpeg', 'gif'},
    'document': {'pdf', 'doc', 'docx', 'txt', 'md'},
    'code': {'py', 'js', 'jsx', 'ts', 'tsx', 'json', 'html', 'css'},
    'archive': {'zip', 'rar', '7z', 'tar', 'gz'}
}
MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size

class Config:
    # Existing configurations...
    
    # AI Rate Limiting
    AI_REQUESTS_PER_MINUTE = 10  # Adjust based on your needs
    
    # Response Caching
    AI_CACHE_TIMEOUT = 300  # 5 minutes 