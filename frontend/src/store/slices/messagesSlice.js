import { createSlice, createSelector } from '@reduxjs/toolkit';

const messagesSlice = createSlice({
  name: 'messages',
  initialState: {
    messages: {},  // Keyed by channel_id
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
      
      if (!state.messages[channelId]) {
        state.messages[channelId] = [];
      }
      
      // Check for duplicates
      const exists = state.messages[channelId].some(msg => msg.id === message.id);
      if (!exists) {
        state.messages[channelId].push(message);
        // Sort messages by timestamp
        state.messages[channelId].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      }
    },
    updateMessage: (state, action) => {
      const message = action.payload;
      const channelId = message.channel_id;
      
      if (state.messages[channelId]) {
        const index = state.messages[channelId].findIndex(msg => msg.id === message.id);
        if (index !== -1) {
          state.messages[channelId][index] = message;
        }
      }
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