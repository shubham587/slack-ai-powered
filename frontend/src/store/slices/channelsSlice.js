import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
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
    channels: {},
    isLoading: false,
    error: null,
    activeChannel: null,
    typingUsers: {},
  },
  reducers: {
    addMemberToChannel: (state, action) => {
      const { channel_id, user } = action.payload;
      if (state.channels[channel_id] && !state.channels[channel_id].is_direct) {
        if (!state.channels[channel_id].members) {
          state.channels[channel_id].members = [];
        }
        state.channels[channel_id].members.push(user);
      }
    },
    updateChannelData: (state, action) => {
      const channel = action.payload;
      if (!channel.is_direct || state.channels[channel.id]) {
        state.channels[channel.id] = {
          ...state.channels[channel.id],
          ...channel,
        };
      }
    },
    setChannels: (state, action) => {
      const channels = action.payload;
      state.channels = channels.reduce((acc, channel) => {
        acc[channel.id] = channel;
        return acc;
      }, {});
    },
    removeChannel: (state, action) => {
      const channelId = action.payload;
      delete state.channels[channelId];
    },
    setActiveChannel: (state, action) => {
      state.activeChannel = action.payload;
    },
    addTypingUser: (state, action) => {
      const { channelId, username } = action.payload;
      if (!state.typingUsers[channelId]) {
        state.typingUsers[channelId] = new Set();
      }
      state.typingUsers[channelId].add(username);
    },
    removeTypingUser: (state, action) => {
      const { channelId, username } = action.payload;
      if (state.typingUsers[channelId]) {
        state.typingUsers[channelId].delete(username);
      }
    },
    updateChannelLastMessage: (state, action) => {
      const { channelId, message } = action.payload;
      const channel = state.channels[channelId];
      if (channel) {
        channel.last_message = message;
        channel.last_message_at = message.created_at;
      }
    },
    handleChannelCreated: (state, action) => {
      if (!action.payload.is_direct) {
        state.channels[action.payload.id] = action.payload;
      }
    },
    handleChannelUpdated: (state, action) => {
      const channel = action.payload;
      if (!channel.is_direct || state.channels[channel.id]) {
        state.channels[channel.id] = {
          ...state.channels[channel.id],
          ...channel,
        };
      }
    },
    handleMemberAdded: (state, action) => {
      const channel = state.channels[action.payload.channelId];
      if (channel) {
        channel.members = channel.members || [];
        channel.members.push(action.payload.member);
      }
    },
    handleMemberRemoved: (state, action) => {
      const channel = state.channels[action.payload.channelId];
      if (channel) {
        channel.members = channel.members.filter(m => m.id !== action.payload.memberId);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchChannels.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchChannels.fulfilled, (state, action) => {
        state.isLoading = false;
        state.channels = action.payload.reduce((acc, channel) => {
          if (!channel.is_direct) {
            acc[channel.id] = channel;
          }
          return acc;
        }, {});
      })
      .addCase(fetchChannels.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(createChannel.fulfilled, (state, action) => {
        if (!action.payload.is_direct) {
          state.channels[action.payload.id] = action.payload;
        }
      })
      .addCase(updateChannel.fulfilled, (state, action) => {
        state.channels[action.payload.id] = action.payload;
      })
      .addCase(updateChannel.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(addChannelMember.fulfilled, (state, action) => {
        state.channels[action.payload.channelId] = action.payload.updatedChannel;
      })
      .addCase(removeChannelMember.fulfilled, (state, action) => {
        delete state.channels[action.payload.channelId];
      })
      .addCase(createDirectMessage.fulfilled, (state, action) => {
        // Don't add direct messages to the channels list
        // They will be handled separately in the directMessages state
      })
      .addCase(pinMessage.fulfilled, (state, action) => {
        state.channels[action.payload.id] = action.payload;
      })
      .addCase(unpinMessage.fulfilled, (state, action) => {
        state.channels[action.payload.id] = action.payload;
      });
  },
});

export const {
  addMemberToChannel,
  updateChannelData,
  setChannels,
  removeChannel,
  setActiveChannel,
  addTypingUser,
  removeTypingUser,
  updateChannelLastMessage,
  handleChannelCreated,
  handleChannelUpdated,
  handleMemberAdded,
  handleMemberRemoved,
} = channelsSlice.actions;

// Memoized selectors
export const selectChannels = createSelector(
  [(state) => state.channels.channels],
  (channels) => Object.values(channels)
);

export const selectActiveChannel = state => state.channels.activeChannel;

export const selectChannelById = createSelector(
  [(state) => state.channels.channels, (state, channelId) => channelId],
  (channels, channelId) => {
    const channel = channels[channelId];
    if (!channel) return null;
    return {
      ...channel,
      members: (channel.members || []).filter(member => member && member.id && member.username)
    };
  }
);

export const selectDirectMessageChannels = createSelector(
  [(state) => state.channels.channels],
  (channels) => Object.values(channels).filter(c => c.is_direct)
);

export const selectPublicChannels = createSelector(
  [(state) => state.channels.channels],
  (channels) => Object.values(channels).filter(c => !c.is_private && !c.is_direct)
);

export const selectPrivateChannels = state => 
  Object.values(state.channels.channels).filter(c => c.is_private && !c.is_direct);

export const selectTypingUsers = (state, channelId) => 
  state.channels.typingUsers[channelId] || {};

export const selectChannelMembers = createSelector(
  [(state) => state.channels.channels, (state, channelId) => channelId],
  (channels, channelId) => {
    const channel = channels[channelId];
    return channel ? channel.members : [];
  }
);

export default channelsSlice.reducer; 