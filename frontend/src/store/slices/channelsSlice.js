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

export const updateChannelDetails = createAsyncThunk(
  'channels/updateChannel',
  async ({ channelId, data }, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_URL}/api/channels/${channelId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        }
      );

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

export const addMemberToChannel = createAsyncThunk(
  'channels/addMember',
  async ({ channelId, userId }, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${API_URL}/api/channels/${channelId}/members`, { user_id: userId });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to add member');
    }
  }
);

export const removeChannelMember = createAsyncThunk(
  'channels/removeMember',
  async ({ channelId, userId }, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_URL}/api/channels/${channelId}/members/${userId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to remove member from channel');
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
    addChannel: (state, action) => {
      const channel = action.payload;
      if (!channel.is_direct) {
        state.channels[channel.id] = {
          ...state.channels[channel.id],
          ...channel,
          members: channel.members || [],
          name: channel.name || '',
          description: channel.description || '',
          is_private: channel.is_private || false,
          created_by: channel.created_by || '',
          created_at: channel.created_at || new Date().toISOString(),
          last_message: channel.last_message || null,
          last_message_at: channel.last_message_at || null,
          topic: channel.topic || ''
        };
        console.log('Added/Updated channel in store:', state.channels[channel.id]);
      }
    },
    updateChannel: (state, action) => {
      const channel = action.payload;
      if (state.channels[channel.id]) {
        state.channels[channel.id] = {
          ...state.channels[channel.id],
          ...channel,
          members: channel.members || state.channels[channel.id].members
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
      if (!channel.is_direct) {
        state.channels[channel.id] = {
          ...state.channels[channel.id],
          ...channel,
          members: channel.members || state.channels[channel.id]?.members || []
        };
      }
    },
    handleMemberAdded: (state, action) => {
      const { channelId, member } = action.payload;
      if (state.channels[channelId]) {
        state.channels[channelId].members = state.channels[channelId].members || [];
        if (!state.channels[channelId].members.some(m => m.id === member.id)) {
          state.channels[channelId].members.push(member);
        }
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
            acc[channel.id] = {
              ...channel,
              members: channel.members || []
            };
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
      .addCase(updateChannelDetails.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateChannelDetails.fulfilled, (state, action) => {
        const updatedChannel = action.payload;
        state.channels[updatedChannel.id] = {
          ...state.channels[updatedChannel.id],
          ...updatedChannel,
        };
        state.isLoading = false;
      })
      .addCase(updateChannelDetails.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(addMemberToChannel.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(addMemberToChannel.fulfilled, (state, action) => {
        const channel = action.payload;
        if (!channel.is_direct) {
          state.channels[channel.id] = channel;
        }
        state.isLoading = false;
      })
      .addCase(addMemberToChannel.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(removeChannelMember.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(removeChannelMember.fulfilled, (state, action) => {
        const { channelId, userId } = action.payload;
        if (state.channels[channelId] && state.channels[channelId].members) {
          state.channels[channelId].members = state.channels[channelId].members.filter(
            member => member.id !== userId
          );
        }
        state.isLoading = false;
      })
      .addCase(removeChannelMember.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
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
  addChannel,
  updateChannel,
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