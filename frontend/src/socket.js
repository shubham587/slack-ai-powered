import io from 'socket.io-client';
import { store } from './store';
import { addMessage, updateMessage, deleteMessage } from './store/slices/messagesSlice';
import { addInvitation } from './store/slices/invitationsSlice';
import { addMemberToChannel, updateChannelData } from './store/slices/channelsSlice';

let socket = null;
let reconnectTimer = null;
const RECONNECT_DELAY = 5000; // 5 seconds

export const initializeSocket = (token) => {
  if (socket?.connected) {
    console.log('Socket already connected');
    return socket;
  }

  try {
    socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5001', {
      auth: {
        token
      },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socket.on('connect', () => {
      console.log('Socket connected');
      clearTimeout(reconnectTimer);
      // Join user's personal room
      const userId = localStorage.getItem('userId');
      if (userId) {
        socket.emit('join_user_room', { user_id: userId });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      if (reason === 'io server disconnect' || reason === 'io client disconnect') {
        // Don't attempt to reconnect if the server/client initiated the disconnect
        return;
      }
      
      // Try to reconnect
      reconnectTimer = setTimeout(() => {
        if (!socket.connected) {
          console.log('Attempting to reconnect socket...');
          socket.connect();
        }
      }, RECONNECT_DELAY);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    socket.on('new_message', (message) => {
      console.log('Received new message:', message);
      store.dispatch(addMessage(message));
    });

    socket.on('message_created', (message) => {
      console.log('Received message_created:', message);
      store.dispatch(addMessage(message));
    });

    socket.on('message_updated', (message) => {
      console.log('Received message update:', message);
      store.dispatch(updateMessage(message));
    });

    socket.on('message_deleted', (data) => {
      console.log('Received message deletion:', data);
      store.dispatch(deleteMessage({
        messageId: data.message_id || data.id,
        channelId: data.channel_id
      }));
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

    socket.on('user_room_joined', (data) => {
      console.log('Joined personal room:', data);
    });

    socket.on('user_joined', (data) => {
      console.log('User joined channel:', data);
    });

    return socket;
  } catch (error) {
    console.error('Error initializing socket:', error);
    return null;
  }
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    clearTimeout(reconnectTimer);
    console.log('Disconnecting socket');
    socket.disconnect();
    socket = null;
  }
};

export const joinChannel = (channelId) => {
  if (socket?.connected) {
    socket.emit('join', { channel: channelId });
  }
};

export const leaveChannel = (channelId) => {
  if (socket?.connected) {
    socket.emit('leave', { channel: channelId });
  }
};

export default {
  initializeSocket,
  getSocket,
  disconnectSocket,
  joinChannel,
  leaveChannel
}; 