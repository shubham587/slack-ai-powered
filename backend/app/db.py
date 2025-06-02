from pymongo import MongoClient
from pymongo.errors import ConnectionFailure
import os

try:
    # Get MongoDB URI from environment variable or use default
    MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017')
    print(f"Connecting to MongoDB at: {MONGODB_URI}")
    
    # Create MongoDB client
    client = MongoClient(MONGODB_URI)
    
    # Test connection
    client.admin.command('ping')
    print("Successfully connected to MongoDB")
    
    # Get database
    db = client.slack_db
    print("Connected to 'slack_db' database")
    
    # Create indexes if they don't exist
    db.users.create_index('username', unique=True)
    db.users.create_index('email', unique=True)
    db.channels.create_index('name', unique=True)
    db.messages.create_index('channel_id')
    db.messages.create_index('created_at')
    print("Created database indexes")
    
except ConnectionFailure as e:
    print(f"Failed to connect to MongoDB: {str(e)}")
    raise
except Exception as e:
    print(f"Unexpected error connecting to MongoDB: {str(e)}")
    raise 