import { createSlice, createSelector } from '@reduxjs/toolkit';

const messagesSlice = createSlice({
  name: 'messages',
  initialState: {
    messages: {},  // Keyed by channel_id
    replies: {},  // Keyed by parent_id
    loading: false,
    error: null
  },
  reducers: {
    setMessages: (state, action) => {
      const { channelId, messages } = action.payload;
      state.messages[channelId] = messages;
    },
    addMessage: (state, action) => {
      const message = action.payload;
      const channelId = message.channel_id;
      
      // Initialize messages array for channel if it doesn't exist
      if (!state.messages[channelId]) {
        state.messages[channelId] = [];
      }
      
      // Add message if it doesn't already exist
      const messageExists = state.messages[channelId].some(
        m => (m._id === message._id || m.id === message.id)
      );
      
      if (!messageExists) {
        state.messages[channelId].push(message);
      }
    },
    addReply: (state, action) => {
      const reply = action.payload;
      const parentId = reply.parent_id;
      
      // Initialize replies map if it doesn't exist
      if (!state.replies[parentId]) {
        state.replies[parentId] = [];
      }
      
      // Add reply if it doesn't already exist
      const replyExists = state.replies[parentId].some(
        r => (r._id === reply._id || r.id === reply.id)
      );
      
      if (!replyExists) {
        state.replies[parentId].push(reply);
        
        // Update reply count in all messages
        Object.values(state.messages).forEach(channelMessages => {
          channelMessages.forEach(message => {
            if (message._id === parentId || message.id === parentId) {
              message.reply_count = (message.reply_count || 0) + 1;
            }
          });
        });
      }
    },
    updateMessage: (state, action) => {
      const { id, changes } = action.payload;
      
      // Update message in all channels
      Object.values(state.messages).forEach(channelMessages => {
        channelMessages.forEach(message => {
          if (message._id === id || message.id === id) {
            Object.assign(message, changes);
          }
        });
      });
    },
    deleteMessage: (state, action) => {
      const { messageId, channelId } = action.payload;
      if (state.messages[channelId]) {
        state.messages[channelId] = state.messages[channelId].filter(msg => msg.id !== messageId);
      }
    },
    clearChannelMessages: (state, action) => {
      const channelId = action.payload;
      delete state.messages[channelId];
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
    }
  }
});

export const {
  setMessages,
  addMessage,
  addReply,
  updateMessage,
  deleteMessage,
  clearChannelMessages,
  setLoading,
  setError
} = messagesSlice.actions;

// Memoized selector for channel messages
export const selectChannelMessages = createSelector(
  [(state) => state.messages.messages, (state, channelId) => channelId],
  (messages, channelId) => messages[channelId] || []
);

export const selectMessagesLoading = (state) => state.messages.loading;
export const selectMessagesError = (state) => state.messages.error;

export default messagesSlice.reducer; 