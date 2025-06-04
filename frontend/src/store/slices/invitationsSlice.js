import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { getSocket } from '../../socket';

// Configure axios defaults
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5001'
});

// Add request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Async thunks
export const fetchPendingInvitations = createAsyncThunk(
  'invitations/fetchPending',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/api/invitations/pending');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch invitations');
    }
  }
);

export const createInvitation = createAsyncThunk(
  'invitations/create',
  async ({ channelId, userId }, { rejectWithValue }) => {
    try {
      const requestBody = {
        channel_id: channelId,
        invitee_id: userId,
      };
      
      const response = await api.post('/api/invitations', requestBody);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to create invitation');
    }
  }
);

export const acceptInvitation = createAsyncThunk(
  'invitations/accept',
  async (invitationId, { rejectWithValue, dispatch }) => {
    try {
      const response = await api.post(`/api/invitations/${invitationId}/accept`);
      
      // After accepting, fetch the channel details
      const channelId = response.data.channel_id;
      const channelResponse = await api.get(`/api/channels/${channelId}`);
      
      // Add the channel to the store
      dispatch({ type: 'channels/addChannel', payload: channelResponse.data });
      
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to accept invitation');
    }
  }
);

export const rejectInvitation = createAsyncThunk(
  'invitations/reject',
  async (invitationId, { rejectWithValue }) => {
    try {
      const response = await api.post(`/api/invitations/${invitationId}/reject`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to reject invitation');
    }
  }
);

const invitationsSlice = createSlice({
  name: 'invitations',
  initialState: {
    invitations: [],
    status: 'idle',
    error: null,
  },
  reducers: {
    setInvitations: (state, action) => {
      state.invitations = action.payload;
    },
    addInvitation: (state, action) => {
      const exists = state.invitations.some(inv => inv.id === action.payload.id);
      if (!exists) {
        state.invitations.push(action.payload);
      }
    },
    removeInvitation: (state, action) => {
      state.invitations = state.invitations.filter(inv => inv.id !== action.payload);
    },
    clearInvitations: (state) => {
      state.invitations = [];
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchPendingInvitations
      .addCase(fetchPendingInvitations.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchPendingInvitations.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.invitations = action.payload;
      })
      .addCase(fetchPendingInvitations.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message;
      })
      // createInvitation
      .addCase(createInvitation.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(createInvitation.fulfilled, (state, action) => {
        state.status = 'succeeded';
        const exists = state.invitations.some(inv => inv.id === action.payload.id);
        if (!exists) {
          state.invitations.push(action.payload);
        }
      })
      .addCase(createInvitation.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      // acceptInvitation
      .addCase(acceptInvitation.fulfilled, (state, action) => {
        state.invitations = state.invitations.filter(
          inv => inv.id !== action.payload.id
        );
      })
      // rejectInvitation
      .addCase(rejectInvitation.fulfilled, (state, action) => {
        state.invitations = state.invitations.filter(
          inv => inv.id !== action.payload.id
        );
      });
  },
});

export const { setInvitations, addInvitation, removeInvitation, clearInvitations } = invitationsSlice.actions;

// Selectors
export const selectAllInvitations = (state) => state.invitations.invitations;
export const selectPendingInvitations = (state) => state.invitations.invitations.filter(inv => inv.status === 'pending');
export const selectInvitationsLoading = (state) => state.invitations.status === 'loading';
export const selectInvitationsError = (state) => state.invitations.error;

export default invitationsSlice.reducer; 