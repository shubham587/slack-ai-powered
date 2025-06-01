import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:5001',
    prepareHeaders: (headers, { getState }) => {
      // Get the token from the auth state
      const token = getState().auth.token;
      
      // If we have a token, add it to the headers
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
      
      return headers;
    },
  }),
  endpoints: () => ({}), // Will be extended by other API slices
  tagTypes: ['Messages', 'Channels', 'Users', 'Profile'],
}); 