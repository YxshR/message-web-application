import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import authService from '../../services/authService';

// Async thunks
export const loginUser = createAsyncThunk(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await authService.login(credentials);
      if (response.error) {
        return rejectWithValue(response.error.message || 'Login failed');
      }
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || error.message || 'Login failed');
    }
  }
);

export const registerUser = createAsyncThunk(
  'auth/register',
  async (userData, { rejectWithValue }) => {
    try {
      const response = await authService.register(userData);
      if (response.error) {
        return rejectWithValue(response.error.message || 'Registration failed');
      }
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || error.message || 'Registration failed');
    }
  }
);

export const getCurrentUser = createAsyncThunk(
  'auth/getCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authService.getCurrentUser();
      if (response.error) {
        return rejectWithValue(response.error.message || 'Failed to get user');
      }
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || error.message || 'Failed to get user');
    }
  }
);

const initialState = {
  user: null,
  token: localStorage.getItem('token'),
  isLoading: false,
  isAuthenticated: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.error = null;
      localStorage.removeItem('token');
    },
    clearError: (state) => {
      state.error = null;
    },
    setToken: (state, action) => {
      state.token = action.payload;
      localStorage.setItem('token', action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        console.log('Login fulfilled with payload:', action.payload);
        state.isLoading = false;
        const data = action.payload?.data || action.payload;
        console.log('Extracted data:', data);
        if (data && data.user && data.token) {
          console.log('Setting user and token, isAuthenticated = true');
          state.user = data.user;
          state.token = data.token;
          state.isAuthenticated = true;
          localStorage.setItem('token', data.token);
        } else {
          console.log('Missing user or token in data:', data);
        }
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
        state.isAuthenticated = false;
      })
      // Register
      .addCase(registerUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        console.log('Register fulfilled with payload:', action.payload);
        state.isLoading = false;
        const data = action.payload?.data || action.payload;
        console.log('Extracted data:', data);
        if (data && data.user && data.token) {
          console.log('Setting user and token, isAuthenticated = true');
          state.user = data.user;
          state.token = data.token;
          state.isAuthenticated = true;
          localStorage.setItem('token', data.token);
        } else {
          console.log('Missing user or token in data:', data);
        }
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
        state.isAuthenticated = false;
      })
      // Get current user
      .addCase(getCurrentUser.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getCurrentUser.fulfilled, (state, action) => {
        state.isLoading = false;
        const data = action.payload?.data || action.payload;
        state.user = data.user;
        state.isAuthenticated = true;
      })
      .addCase(getCurrentUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
        state.isAuthenticated = false;
        state.token = null;
        localStorage.removeItem('token');
      });
  },
});

export const { logout, clearError, setToken } = authSlice.actions;
export default authSlice.reducer;