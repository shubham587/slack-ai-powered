from app import db
from app.models.user import User

def check_test_user():
    # Try to find user by username
    user = User.get_by_username('testuser')
    if user:
        print(f"Found user with username 'testuser'")
        print(f"Email: {user.email}")
        # Test password
        if user.check_password('password123'):
            print("Password is correct!")
        else:
            print("Password is incorrect!")
    else:
        print("User 'testuser' not found")
        # Create test user if not exists
        user = User.create(
            username='testuser',
            email='test@example.com',
            password='password123'
        )
        if user:
            print("Created new test user")
        else:
            print("Failed to create test user")

if __name__ == '__main__':
    check_test_user() 