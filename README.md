# Misogi - Modern Real-Time Chat Platform

Misogi is a feature-rich Slack clone built with modern technologies, offering real-time communication, AI-powered features, and a seamless user experience.

![Misogi Screenshot](screenshot.png)

## 🌟 Features

### Core Communication
- **Real-time Messaging** - Instant message delivery using WebSocket
- **Channels & Direct Messages** - Public channels and private DMs
- **Thread Conversations** - Organize discussions in threads
- **File Sharing** - Upload and share files with team members
- **Message Reactions** - React to messages with emojis
- **Message Editing & Deletion** - Edit or delete sent messages
- **User Presence** - See who's online in real-time

### AI-Powered Features
- **Smart Reply Suggestions** - AI-generated response suggestions
- **Meeting Notes Generator** - Automatically generate structured notes from conversations
- **Message Enhancement** - AI-powered message improvement suggestions
- **Context-Aware Responses** - AI considers conversation context for better suggestions

### User Experience
- **Modern UI** - Clean and intuitive interface using Chakra UI
- **Responsive Design** - Works seamlessly on desktop and mobile
- **Real-time Updates** - Instant updates for messages, reactions, and user status
- **Search Functionality** - Search through messages and channels
- **User Settings** - Customize your profile and preferences
- **Dark/Light Mode** - Choose your preferred theme

## 🛠️ Technology Stack

### Frontend
- React.js with Vite
- Redux Toolkit for state management
- Chakra UI for components
- Socket.IO client for real-time features
- React Router for navigation

### Backend
- Flask (Python)
- Flask-SocketIO for WebSocket support
- MongoDB for database
- JWT for authentication
- OpenAI API for AI features

## 🚀 Getting Started

### Prerequisites
- Python 3.9+
- Node.js 16+
- MongoDB (or MongoDB Atlas account)
- OpenAI API key

### Environment Variables

#### Backend (.env)
\`\`\`env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET_KEY=your_jwt_secret
SECRET_KEY=your_app_secret
OPENAI_API_KEY=your_openai_api_key
FRONTEND_URL=http://localhost:5173
\`\`\`

#### Frontend (.env)
\`\`\`env
VITE_API_URL=http://localhost:5001
\`\`\`

### Installation

1. **Clone the repository**
   \`\`\`bash
   git clone https://github.com/yourusername/misogi.git
   cd misogi
   \`\`\`

2. **Backend Setup**
   \`\`\`bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\\Scripts\\activate
   pip install -r requirements.txt
   python run.py
   \`\`\`

3. **Frontend Setup**
   \`\`\`bash
   cd frontend
   npm install
   npm run dev
   \`\`\`

4. Open http://localhost:5173 in your browser

## 🌐 Deployment

### Backend (Railway)
1. Create a new project on Railway
2. Connect your GitHub repository
3. Add environment variables:
   - MONGODB_URI
   - JWT_SECRET_KEY
   - SECRET_KEY
   - OPENAI_API_KEY
   - FRONTEND_URL (your Vercel URL)

### Frontend (Vercel)
1. Import your repository to Vercel
2. Set environment variables:
   - VITE_API_URL (your Railway app URL)
3. Deploy!

## 📱 Usage

1. **Sign Up/Login**
   - Create an account or login
   - Set up your profile picture and display name

2. **Channels**
   - Create new channels
   - Join existing channels
   - Send messages and files

3. **Direct Messages**
   - Start private conversations
   - Share files securely

4. **AI Features**
   - Use the AI composer for smart replies
   - Generate meeting notes from conversations
   - Get message improvement suggestions

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- OpenAI for the AI capabilities
- Chakra UI for the component library
- The open-source community for inspiration and tools 