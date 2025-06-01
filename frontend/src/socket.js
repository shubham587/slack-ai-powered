import { io } from 'socket.io-client';
import { store } from './store';
import { addMessage, updateMessage } from './store/slices/messagesSlice';
import { addInvitation } from './store/slices/invitationsSlice';
import { addMemberToChannel, updateChannelData } from './store/slices/channelsSlice';

let socket = null;

export const initializeSocket = (userId) => {
  if (!userId) {
    console.warn('No userId provided to initializeSocket');
    return null;
  }

  const token = localStorage.getItem('token');
  if (!token) {
    console.warn('No token found in localStorage');
    return null;
  }

  console.log('Initializing socket connection for user:', userId);
  
  if (socket) {
    console.log('Socket already exists, disconnecting...');
    socket.disconnect();
  }

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
  console.log('Connecting to socket server at:', apiUrl);
  
  socket = io(apiUrl, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5
  });

  socket.on('connect', () => {
    console.log('Socket connected successfully');
    
    // Join user's personal room for notifications
    console.log('Joining personal room for user:', userId);
    socket.emit('join_user_room', { user_id: userId });
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
  });

  socket.on('new_message', (message) => {
    console.log('Received new message:', message);
    store.dispatch(addMessage(message));
  });

  socket.on('message_updated', (message) => {
    console.log('Received message update:', message);
    store.dispatch(updateMessage(message));
  });

  socket.on('new_invitation', (invitation) => {
    console.log('Received new invitation:', invitation);
    store.dispatch(addInvitation(invitation));
  });

  socket.on('channel_member_added', (data) => {
    console.log('Channel member added:', data);
    store.dispatch(addMemberToChannel(data));
  });

  socket.on('channel_updated', (channel) => {
    console.log('Channel updated:', channel);
    store.dispatch(updateChannelData(channel));
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected. Reason:', reason);
    // Try to reconnect if disconnected
    if (reason === 'io server disconnect' || reason === 'transport close') {
      console.log('Attempting to reconnect...');
      socket.connect();
    }
  });

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    console.log('Disconnecting socket');
    socket.disconnect();
    socket = null;
  }
}; 