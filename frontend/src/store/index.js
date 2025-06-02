import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { baseApi } from './api/baseApi';
import authReducer from './slices/authSlice';
import channelsReducer from './slices/channelsSlice';
import messagesReducer from './slices/messagesSlice';
import invitationsReducer from './slices/invitationsSlice';
import aiReducer from './slices/aiSlice';

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    auth: authReducer,
    channels: channelsReducer,
    messages: messagesReducer,
    invitations: invitationsReducer,
    ai: aiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }).concat(baseApi.middleware),
  devTools: process.env.NODE_ENV !== 'production',
});

// Enable listener behavior for RTK Query
setupListeners(store.dispatch);

// Export the store as default export
export default store; 