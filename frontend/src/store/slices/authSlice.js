import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { initializeSocket, getSocket, disconnectSocket } from '../../socket';

// Async thunks
export const checkAuth = createAsyncThunk(
  'auth/checkAuth',
  async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No token found');
    }

    const response = await fetch('http://localhost:5001/api/auth/verify', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      localStorage.removeItem('token');
      localStorage.removeItem('userId');
      throw new Error('Invalid token');
    }

    const data = await response.json();
    localStorage.setItem('userId', data.user.id);
    initializeSocket(data.user.id);
    return data.user;
  }
);

export const login = createAsyncThunk(
  'auth/login',
  async (credentials) => {
    const response = await fetch('http://localhost:5001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      throw new Error('Invalid credentials');
    }

    const data = await response.json();
    localStorage.setItem('token', data.token);
    localStorage.setItem('userId', data.user.id);
    initializeSocket(data.user.id);
    return data.user;
  }
);

export const register = createAsyncThunk(
  'auth/register',
  async (userData) => {
    const response = await fetch('http://localhost:5001/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      throw new Error('Registration failed');
    }

    const data = await response.json();
    localStorage.setItem('token', data.token);
    localStorage.setItem('userId', data.user.id);
    initializeSocket(data.user.id);
    return data.user;
  }
);

export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async (profileData) => {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No token found');
    }

    const response = await fetch('http://localhost:5001/api/auth/me', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(profileData),
    });

    if (!response.ok) {
      throw new Error('Failed to update profile');
    }

    const data = await response.json();
    return data.user;
  }
);

export const updateSettings = createAsyncThunk(
  'auth/updateSettings',
  async (settings) => {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No token found');
    }

    const response = await fetch('http://localhost:5001/api/auth/settings', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settings),
    });

    if (!response.ok) {
      throw new Error('Failed to update settings');
    }

    const data = await response.json();
    return data.settings;
  }
);

const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      localStorage.removeItem('token');
      localStorage.removeItem('userId');
      const socket = getSocket();
      if (socket) {
        socket.disconnect();
      }
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Check Auth
      .addCase(checkAuth.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(checkAuth.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload;
      })
      .addCase(checkAuth.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message;
        state.isAuthenticated = false;
        state.user = null;
      })
      // Login
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message;
      })
      // Register
      .addCase(register.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload;
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message;
      })
      // Update Profile
      .addCase(updateProfile.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message;
      })
      // Update Settings
      .addCase(updateSettings.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateSettings.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = {
          ...state.user,
          settings: action.payload
        };
      })
      .addCase(updateSettings.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message;
      });
  },
});

export const { logout, clearError } = authSlice.actions;

export const selectUser = (state) => state.auth.user;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectIsLoading = (state) => state.auth.isLoading;
export const selectError = (state) => state.auth.error;

export default authSlice.reducer; 