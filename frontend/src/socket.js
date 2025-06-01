import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_WS_URL || 'http://localhost:5001';

let socket = null;

// Function to initialize socket with token
export const initializeSocket = (token) => {
  if (!token) {
    console.error('No token provided for socket initialization');
    return null;
  }

  // If socket exists and is connected, update auth and return
  if (socket?.connected) {
    socket.auth = { token };
    return socket;
  }

  // Create new socket instance
  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5
  });

  // Add connection event handlers
  socket.on('connect', () => {
    console.log('Socket connected');
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
    if (error.message === 'Invalid token') {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
  });

  // Connect the socket
  socket.connect();

  return socket;
};

// Export the socket getter
export const getSocket = () => socket; 