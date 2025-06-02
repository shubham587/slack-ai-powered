import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { generateAIResponse, getAIUsageStats, checkAIHealth } from '../../utils/ai';

// Async thunks
export const generateResponse = createAsyncThunk(
  'ai/generateResponse',
  async (params) => {
    const response = await generateAIResponse(params);
    return response.data;
  }
);

export const fetchUsageStats = createAsyncThunk(
  'ai/fetchUsageStats',
  async () => {
    const response = await getAIUsageStats();
    return response.data;
  }
);

export const checkHealth = createAsyncThunk(
  'ai/checkHealth',
  async () => {
    return await checkAIHealth();
  }
);

const initialState = {
  // Loading states
  isGenerating: false,
  isFetchingStats: false,
  isCheckingHealth: false,
  
  // Error states
  error: null,
  
  // Data
  lastResponse: null,
  usageStats: null,
  isHealthy: true,
  
  // User preferences
  preferredModel: '3.5',
  
  // Rate limiting
  isRateLimited: false,
  rateLimitResetTime: null
};

const aiSlice = createSlice({
  name: 'ai',
  initialState,
  reducers: {
    setPreferredModel: (state, action) => {
      state.preferredModel = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    clearLastResponse: (state) => {
      state.lastResponse = null;
    }
  },
  extraReducers: (builder) => {
    // Generate response
    builder
      .addCase(generateResponse.pending, (state) => {
        state.isGenerating = true;
        state.error = null;
      })
      .addCase(generateResponse.fulfilled, (state, action) => {
        state.isGenerating = false;
        state.lastResponse = action.payload;
        state.error = null;
        state.isRateLimited = false;
      })
      .addCase(generateResponse.rejected, (state, action) => {
        state.isGenerating = false;
        state.error = action.error.message;
        if (action.error.message.includes('Rate limit exceeded')) {
          state.isRateLimited = true;
          // Extract wait time from error message
          const waitTime = parseInt(action.error.message.match(/\d+/)?.[0] || '60');
          state.rateLimitResetTime = Date.now() + (waitTime * 1000);
        }
      })
      
    // Fetch usage stats
    builder
      .addCase(fetchUsageStats.pending, (state) => {
        state.isFetchingStats = true;
      })
      .addCase(fetchUsageStats.fulfilled, (state, action) => {
        state.isFetchingStats = false;
        state.usageStats = action.payload;
      })
      .addCase(fetchUsageStats.rejected, (state, action) => {
        state.isFetchingStats = false;
        state.error = action.error.message;
      })
      
    // Check health
    builder
      .addCase(checkHealth.pending, (state) => {
        state.isCheckingHealth = true;
      })
      .addCase(checkHealth.fulfilled, (state, action) => {
        state.isCheckingHealth = false;
        state.isHealthy = action.payload;
      })
      .addCase(checkHealth.rejected, (state) => {
        state.isCheckingHealth = false;
        state.isHealthy = false;
      });
  }
});

export const { setPreferredModel, clearError, clearLastResponse } = aiSlice.actions;

// Export the reducer as default export
export default aiSlice.reducer; 