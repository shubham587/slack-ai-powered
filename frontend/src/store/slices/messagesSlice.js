import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  messages: {},
  isLoading: false,
  error: null,
};

const messagesSlice = createSlice({
  name: 'messages',
  initialState,
  reducers: {
    addMessage: (state, action) => {
      const message = action.payload;
      const channelId = message.channel_id || message.channelId;
      if (!state.messages[channelId]) {
        state.messages[channelId] = [];
      }
      state.messages[channelId].push(message);
    },
    updateMessage: (state, action) => {
      const message = action.payload;
      const channelId = message.channel_id || message.channelId;
      if (state.messages[channelId]) {
        const index = state.messages[channelId].findIndex(
          m => m.id === message.id || m._id === message._id
        );
        if (index !== -1) {
          state.messages[channelId][index] = message;
        }
      }
    },
    setMessages: (state, action) => {
      const { channelId, messages } = action.payload;
      state.messages[channelId] = messages;
    },
    clearMessages: (state, action) => {
      const channelId = action.payload;
      if (channelId) {
        delete state.messages[channelId];
      } else {
        state.messages = {};
      }
    },
  },
});

export const { addMessage, updateMessage, setMessages, clearMessages } = messagesSlice.actions;

export const selectMessages = (state, channelId) => state.messages.messages[channelId] || [];

export default messagesSlice.reducer; 