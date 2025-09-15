import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  activeTab: 'chat', // 'chat' | 'contacts'
  activeView: 'message', // 'message' | 'dashboard'
  sidebarOpen: true,
  isConnected: false,
  connectionStatus: 'disconnected', // 'connected' | 'connecting' | 'disconnected' | 'error'
  notifications: [],
  theme: 'light', // 'light' | 'dark'
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setActiveTab: (state, action) => {
      state.activeTab = action.payload;
    },
    setActiveView: (state, action) => {
      state.activeView = action.payload;
    },
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen: (state, action) => {
      state.sidebarOpen = action.payload;
    },
    setConnectionStatus: (state, action) => {
      state.connectionStatus = action.payload;
      state.isConnected = action.payload === 'connected';
    },
    addNotification: (state, action) => {
      const notification = {
        id: Date.now(),
        type: 'info',
        message: '',
        duration: 5000,
        ...action.payload,
      };
      state.notifications.push(notification);
    },
    removeNotification: (state, action) => {
      state.notifications = state.notifications.filter(
        notification => notification.id !== action.payload
      );
    },
    clearNotifications: (state) => {
      state.notifications = [];
    },
    setTheme: (state, action) => {
      state.theme = action.payload;
    },
    resetUI: (state) => {
      state.activeTab = 'chat';
      state.activeView = 'message';
      state.sidebarOpen = true;
      state.isConnected = false;
      state.connectionStatus = 'disconnected';
      state.notifications = [];
    },
  },
});

export const {
  setActiveTab,
  setActiveView,
  toggleSidebar,
  setSidebarOpen,
  setConnectionStatus,
  addNotification,
  removeNotification,
  clearNotifications,
  setTheme,
  resetUI,
} = uiSlice.actions;

export default uiSlice.reducer;