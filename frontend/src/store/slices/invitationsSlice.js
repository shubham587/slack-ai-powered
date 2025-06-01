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
      console.log('Creating invitation with data:', { channelId, userId });
      const token = localStorage.getItem('token');
      
      const requestBody = {
        channel_id: channelId,
        invitee_id: userId,
      };
      console.log('Request body:', requestBody);
      
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      console.log('Response status:', response.status);
      console.log('Response data:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create invitation');
      }

      return data;
    } catch (error) {
      console.error('Error creating invitation:', error);
      return rejectWithValue(error.message);
    }
  }
);

export const acceptInvitation = createAsyncThunk(
  'invitations/accept',
  async (invitationId, { rejectWithValue }) => {
    try {
      const response = await api.post(`/api/invitations/${invitationId}/accept`);
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
      console.log('Adding invitation:', action.payload);
      console.log('Current user ID:', localStorage.getItem('userId'));
      
      // Check if invitation already exists
      const exists = state.invitations.some(inv => inv.id === action.payload.id);
      // Compare string versions of IDs
      const isInvitee = String(action.payload.invitee_id) === String(localStorage.getItem('userId'));
      
      console.log('Invitation exists:', exists);
      console.log('Is invitee:', isInvitee);
      
      if (!exists && isInvitee) {
        state.invitations.push(action.payload);
      }
    },
    removeInvitation: (state, action) => {
      state.invitations = state.invitations.filter(inv => inv.id !== action.payload);
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
        // Filter invitations for current user
        const currentUserId = localStorage.getItem('userId');
        state.invitations = action.payload.filter(inv => 
          String(inv.invitee_id) === String(currentUserId)
        );
      })
      .addCase(fetchPendingInvitations.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload?.error || 'Failed to fetch invitations';
      })
      // createInvitation
      .addCase(createInvitation.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(createInvitation.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.invitations.push(action.payload);
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

export const { setInvitations, addInvitation, removeInvitation } = invitationsSlice.actions;

// Selectors
export const selectAllInvitations = (state) => state.invitations.invitations;
export const selectPendingInvitations = (state) => state.invitations.invitations;
export const selectInvitationsLoading = (state) => state.invitations.status === 'loading';
export const selectInvitationsError = (state) => state.invitations.error;

export default invitationsSlice.reducer; 