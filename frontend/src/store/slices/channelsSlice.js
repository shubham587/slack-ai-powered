import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

// Configure axios defaults
axios.defaults.baseURL = API_URL;
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Async thunks
export const fetchChannels = createAsyncThunk(
  'channels/fetchChannels',
  async (_, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await axios.get(`${API_URL}/api/channels`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!response.data) {
        throw new Error('Invalid response format');
      }

      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
      return rejectWithValue(error.response?.data || { error: error.message || 'Failed to fetch channels' });
    }
  }
);

export const createChannel = createAsyncThunk(
  'channels/createChannel',
  async (channelData, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/api/channels`, channelData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { error: 'Failed to create channel' });
    }
  }
);

export const updateChannel = createAsyncThunk(
  'channels/updateChannel',
  async ({ channelId, data }, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/channels/${channelId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to update channel');
      }

      const updatedChannel = await response.json();
      return updatedChannel;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const addChannelMember = createAsyncThunk(
  'channels/addMember',
  async ({ channelId, userId }, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/channels/${channelId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id: userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to add member');
      }

      const updatedChannel = await response.json();
      return { channelId, updatedChannel };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const removeChannelMember = createAsyncThunk(
  'channels/removeMember',
  async ({ channelId, userId }, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/channels/${channelId}/members/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to remove member');
      }

      return { channelId, userId };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const createDirectMessage = createAsyncThunk(
  'channels/createDirectMessage',
  async (userId, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${API_URL}/api/channels/dm/${userId}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);

export const pinMessage = createAsyncThunk(
  'channels/pinMessage',
  async ({ channelId, messageId }, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${API_URL}/api/channels/${channelId}/pin/${messageId}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);

export const unpinMessage = createAsyncThunk(
  'channels/unpinMessage',
  async ({ channelId, messageId }, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${API_URL}/api/channels/${channelId}/unpin/${messageId}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);

const channelsSlice = createSlice({
  name: 'channels',
  initialState: {
    channels: [],
    activeChannel: null,
    loading: false,
    error: null,
    channelMembers: {},
    typingUsers: {},
  },
  reducers: {
    setChannels: (state, action) => {
      state.channels = action.payload;
    },
    setActiveChannel: (state, action) => {
      state.activeChannel = action.payload;
    },
    addTypingUser: (state, action) => {
      const { channelId, user } = action.payload;
      if (!state.typingUsers[channelId]) {
        state.typingUsers[channelId] = {};
      }
      state.typingUsers[channelId][user.id] = user;
    },
    removeTypingUser: (state, action) => {
      const { channelId, userId } = action.payload;
      if (state.typingUsers[channelId]) {
        delete state.typingUsers[channelId][userId];
      }
    },
    updateChannelLastMessage: (state, action) => {
      const { channelId, lastMessageAt } = action.payload;
      const channel = state.channels.find(c => c.id === channelId);
      if (channel) {
        channel.last_message_at = lastMessageAt;
      }
    },
    handleChannelCreated: (state, action) => {
      state.channels.push(action.payload);
    },
    handleChannelUpdated: (state, action) => {
      const index = state.channels.findIndex(c => c.id === action.payload.id);
      if (index !== -1) {
        state.channels[index] = action.payload;
      }
    },
    handleMemberAdded: (state, action) => {
      const { channelId, userId } = action.payload;
      const channel = state.channels.find(c => c.id === channelId);
      if (channel) {
        if (!channel.members.includes(userId)) {
          channel.members.push(userId);
        }
      } else {
        state.needsRefresh = true;
      }
    },
    handleMemberRemoved: (state, action) => {
      const { channelId, userId } = action.payload;
      const channel = state.channels.find(c => c.id === channelId);
      if (channel) {
        channel.members = channel.members.filter(m => m.id !== userId);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchChannels
      .addCase(fetchChannels.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchChannels.fulfilled, (state, action) => {
        state.loading = false;
        state.channels = action.payload;
        state.error = null;
      })
      .addCase(fetchChannels.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.error || 'Failed to fetch channels';
      })
      // createChannel
      .addCase(createChannel.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createChannel.fulfilled, (state, action) => {
        state.loading = false;
        state.channels.push(action.payload);
        state.activeChannel = action.payload;
        state.error = null;
      })
      .addCase(createChannel.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.error || 'Failed to create channel';
      })
      // updateChannel
      .addCase(updateChannel.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateChannel.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.channels.findIndex(c => c.id === action.payload.id);
        if (index !== -1) {
          state.channels[index] = action.payload;
          if (state.activeChannel?.id === action.payload.id) {
            state.activeChannel = action.payload;
          }
        }
        state.error = null;
      })
      .addCase(updateChannel.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // addChannelMember
      .addCase(addChannelMember.fulfilled, (state, action) => {
        const index = state.channels.findIndex(c => c.id === action.payload.channelId);
        if (index !== -1) {
          state.channels[index] = action.payload.updatedChannel;
        }
      })
      // removeChannelMember
      .addCase(removeChannelMember.fulfilled, (state, action) => {
        const index = state.channels.findIndex(c => c.id === action.payload.channelId);
        if (index !== -1) {
          state.channels[index] = action.payload;
        }
      })
      // createDirectMessage
      .addCase(createDirectMessage.fulfilled, (state, action) => {
        if (!state.channels.find(c => c.id === action.payload.id)) {
          state.channels.push(action.payload);
        }
      })
      // pinMessage
      .addCase(pinMessage.fulfilled, (state, action) => {
        const index = state.channels.findIndex(c => c.id === action.payload.id);
        if (index !== -1) {
          state.channels[index] = action.payload;
        }
      })
      // unpinMessage
      .addCase(unpinMessage.fulfilled, (state, action) => {
        const index = state.channels.findIndex(c => c.id === action.payload.id);
        if (index !== -1) {
          state.channels[index] = action.payload;
        }
      });
  },
});

export const {
  setChannels,
  setActiveChannel,
  addTypingUser,
  removeTypingUser,
  updateChannelLastMessage,
  handleChannelCreated,
  handleChannelUpdated,
  handleMemberAdded,
  handleMemberRemoved,
} = channelsSlice.actions;

// Selectors
export const selectChannels = state => state.channels.channels;
export const selectActiveChannel = state => state.channels.activeChannel;
export const selectChannelById = (state, channelId) => 
  state.channels.channels.find(c => c.id === channelId);
export const selectDirectMessageChannels = state => 
  state.channels.channels.filter(c => c.is_direct);
export const selectPublicChannels = state => 
  state.channels.channels.filter(c => !c.is_private && !c.is_direct);
export const selectPrivateChannels = state => 
  state.channels.channels.filter(c => c.is_private && !c.is_direct);
export const selectTypingUsers = (state, channelId) => 
  state.channels.typingUsers[channelId] || {};
export const selectChannelMembers = (state, channelId) => {
  const channel = state.channels.channels.find(c => c.id === channelId);
  return channel ? channel.members : [];
};

export default channelsSlice.reducer; 