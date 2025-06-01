from app.routes.auth import auth_bp
from app.routes.channels import channels_bp
from app.routes.messages import bp as messages_bp

__all__ = ['auth_bp', 'channels_bp', 'messages_bp']
