import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isSidebarOpen: true,
  activeModal: null,
  loadingStates: {},
  toasts: [],
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar: (state) => {
      state.isSidebarOpen = !state.isSidebarOpen;
    },
    setSidebarOpen: (state, { payload }) => {
      state.isSidebarOpen = payload;
    },
    setActiveModal: (state, { payload }) => {
      state.activeModal = payload;
    },
    setLoadingState: (state, { payload: { key, isLoading } }) => {
      state.loadingStates[key] = isLoading;
    },
    addToast: (state, { payload: { id, type, message } }) => {
      state.toasts.push({ id, type, message });
    },
    removeToast: (state, { payload: id }) => {
      state.toasts = state.toasts.filter(toast => toast.id !== id);
    },
  },
});

export const {
  toggleSidebar,
  setSidebarOpen,
  setActiveModal,
  setLoadingState,
  addToast,
  removeToast,
} = uiSlice.actions;

export default uiSlice.reducer;

// Selectors
export const selectIsSidebarOpen = (state) => state.ui.isSidebarOpen;
export const selectActiveModal = (state) => state.ui.activeModal;
export const selectLoadingState = (key) => (state) => state.ui.loadingStates[key] || false;
export const selectToasts = (state) => state.ui.toasts; 