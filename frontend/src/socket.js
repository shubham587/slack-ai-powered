import io from 'socket.io-client';
import { store } from './store';
import { addMessage, updateMessage, deleteMessage } from './store/slices/messagesSlice';
import { addInvitation } from './store/slices/invitationsSlice';
import { addChannel, updateChannel, handleChannelCreated, handleChannelUpdated, handleMemberAdded, handleMemberRemoved } from './store/slices/channelsSlice';
import { setMessages } from './store/slices/messagesSlice';
import axios from 'axios';

let socket = null;
let reconnectTimer = null;
const RECONNECT_DELAY = 5000; // 5 seconds

export const initializeSocket = (token) => {
  if (socket) {
    console.log('Socket already initialized');
    return socket;
  }

  console.log('Initializing socket with token:', token);
  socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5001', {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 5000,
    reconnectionAttempts: 5
  });

  socket.on('connect', () => {
    console.log('Socket connected successfully');
    // Join user room immediately after connection
    const userId = localStorage.getItem('user_id');
    if (!userId) {
      console.error('No user ID found in localStorage. Attempting to get from token...');
      try {
        // Try to decode the token to get user ID
        const tokenData = JSON.parse(atob(token.split('.')[1]));
        if (tokenData.sub) {
          console.log('Found user ID in token:', tokenData.sub);
          localStorage.setItem('user_id', tokenData.sub);
          socket.emit('join_user_room', { user_id: tokenData.sub });
        } else {
          console.error('No user ID found in token');
        }
      } catch (error) {
        console.error('Error decoding token:', error);
      }
    } else {
      console.log('Joining user room with ID from localStorage:', userId);
      socket.emit('join_user_room', { user_id: userId });
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
  });

  // Listen for new messages
  socket.on('message_created', (data) => {
    console.log('Socket: Message created:', data);
    // If it's a reply (has parent_id), handle as reply
    if (data.parent_id) {
      store.dispatch({ 
        type: 'messages/addReply', 
        payload: data 
      });
      
      // Update parent message reply count
      store.dispatch({
        type: 'messages/updateMessage',
        payload: {
          id: data.parent_id,
          changes: {
            reply_count: (data.parent_reply_count || 0) + 1
          }
        }
      });
    } else {
      // Handle as normal message
      store.dispatch({ 
        type: 'messages/addMessage', 
        payload: data 
      });
    }
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
    // Ensure we're only handling invitations for the current user
    const currentUserId = localStorage.getItem('user_id');
    console.log('Checking invitation for current user:', {
      currentUserId,
      inviteeId: invitation.invitee_id,
      isMatch: invitation.invitee_id === currentUserId
    });
    
    if (invitation.invitee_id === currentUserId) {
      console.log('Dispatching invitation to store');
      store.dispatch({ type: 'invitations/addInvitation', payload: invitation });
      
      // Show a toast notification
      store.dispatch({
        type: 'ui/showToast',
        payload: {
          title: 'New Channel Invitation',
          description: `${invitation.inviter_username} invited you to join #${invitation.channel_name}`,
          status: 'info',
          duration: 5000,
          isClosable: true,
        }
      });
    }
  });

  socket.on('invitation_accepted', (data) => {
    console.log('Invitation accepted:', data);
    // No need to handle invitation_accepted event for channels
    // The channel_member_added event will handle the channel addition
  });

  socket.on('invitation_rejected', (data) => {
    console.log('Invitation rejected:', data);
    // No need to do anything special for rejected invitations
  });

  socket.on('channel_member_added', (data) => {
    console.log('Channel member added:', data);
    const currentUserId = localStorage.getItem('user_id');
    
    // If the current user was added to the channel
    if (data.user_id === currentUserId) {
      // Fetch the channel details
      const token = localStorage.getItem('token');
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
      
      axios.get(`${baseUrl}/api/channels/${data.channel_id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      .then(response => {
        console.log('Fetched channel details:', response.data);
        // Add channel to store
        store.dispatch({ type: 'channels/addChannel', payload: response.data });
        
        // Join the channel room
        socket.emit('join_channel', { channel_id: data.channel_id });
        
        // Show success toast
        store.dispatch({
          type: 'ui/showToast',
          payload: {
            title: 'Channel Joined',
            description: `You have been added to #${response.data.name}`,
            status: 'success',
            duration: 3000,
            isClosable: true,
          }
        });
      })
      .catch(error => {
        console.error('Error fetching channel details:', error);
      });
    }
  });

  socket.on('channel_updated', (channel) => {
    console.log('Channel updated:', channel);
    store.dispatch(updateChannel(channel));
  });

  socket.on('user_room_joined', (data) => {
    console.log('Successfully joined personal room:', data);
  });

  socket.on('user_joined', (data) => {
    console.log('User joined channel:', data);
  });

  socket.on('typing', (data) => {
    console.log('User typing:', data);
  });

  socket.on('new_reply', (data) => {
    console.log('Socket: Received new reply:', data);
    // Add reply to thread
    store.dispatch({ 
      type: 'messages/addReply', 
      payload: data 
    });
    
    // Update parent message reply count
    store.dispatch({
      type: 'messages/updateMessage',
      payload: {
        id: data.parent_id,
        changes: {
          reply_count: (data.parent_reply_count || 0) + 1
        }
      }
    });
  });

  return socket;
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
  const socket = getSocket();
  if (!socket) {
    console.error('Socket not initialized when trying to join channel');
    return;
  }
  console.log('Attempting to join channel:', channelId);
  socket.emit('join', { channel: channelId });
};

export const leaveChannel = (channelId) => {
  const socket = getSocket();
  if (!socket) {
    console.error('Socket not initialized when trying to leave channel');
    return;
  }
  console.log('Leaving channel:', channelId);
  socket.emit('leave', { channel: channelId });
};

export default {
  initializeSocket,
  getSocket,
  disconnectSocket,
  joinChannel,
  leaveChannel
}; 