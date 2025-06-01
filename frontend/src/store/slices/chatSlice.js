import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  activeChannel: null,
  channels: [],
  messages: {},
  typingUsers: {},
  unreadCounts: {},
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setActiveChannel: (state, { payload }) => {
      state.activeChannel = payload;
    },
    setChannels: (state, { payload }) => {
      state.channels = payload;
    },
    addChannel: (state, { payload }) => {
      state.channels.push(payload);
    },
    updateChannel: (state, { payload }) => {
      const index = state.channels.findIndex(ch => ch.id === payload.id);
      if (index !== -1) {
        state.channels[index] = payload;
      }
    },
    setMessages: (state, { payload: { channelId, messages } }) => {
      state.messages[channelId] = messages;
    },
    addMessage: (state, { payload: { channelId, message } }) => {
      if (!state.messages[channelId]) {
        state.messages[channelId] = [];
      }
      state.messages[channelId].push(message);
    },
    setTypingUsers: (state, { payload: { channelId, users } }) => {
      state.typingUsers[channelId] = users;
    },
    updateUnreadCount: (state, { payload: { channelId, count } }) => {
      state.unreadCounts[channelId] = count;
    },
  },
});

export const {
  setActiveChannel,
  setChannels,
  addChannel,
  updateChannel,
  setMessages,
  addMessage,
  setTypingUsers,
  updateUnreadCount,
} = chatSlice.actions;

export default chatSlice.reducer;

// Selectors
export const selectActiveChannel = (state) => state.chat.activeChannel;
export const selectChannels = (state) => state.chat.channels;
export const selectMessages = (channelId) => (state) => state.chat.messages[channelId] || [];
export const selectTypingUsers = (channelId) => (state) => state.chat.typingUsers[channelId] || [];
export const selectUnreadCount = (channelId) => (state) => state.chat.unreadCounts[channelId] || 0; 