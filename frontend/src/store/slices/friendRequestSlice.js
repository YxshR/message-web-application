import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import friendRequestService from '../../services/friendRequestService';

// Async thunks
export const searchUsers = createAsyncThunk(
  'friendRequests/searchUsers',
  async (query, { rejectWithValue }) => {
    const response = await friendRequestService.searchUsers(query);
    if (response.error) {
      return rejectWithValue(response.error);
    }
    return response.data;
  }
);

export const fetchFriendRequests = createAsyncThunk(
  'friendRequests/fetchFriendRequests',
  async (_, { rejectWithValue }) => {
    const response = await friendRequestService.getFriendRequests();
    if (response.error) {
      return rejectWithValue(response.error);
    }
    return response.data;
  }
);

export const sendFriendRequest = createAsyncThunk(
  'friendRequests/sendFriendRequest',
  async (receiverId, { rejectWithValue }) => {
    const response = await friendRequestService.sendFriendRequest(receiverId);
    if (response.error) {
      return rejectWithValue(response.error);
    }
    return response.data;
  }
);

export const acceptFriendRequest = createAsyncThunk(
  'friendRequests/acceptFriendRequest',
  async (requestId, { rejectWithValue }) => {
    const response = await friendRequestService.acceptFriendRequest(requestId);
    if (response.error) {
      return rejectWithValue(response.error);
    }
    return { requestId, ...response.data };
  }
);

export const rejectFriendRequest = createAsyncThunk(
  'friendRequests/rejectFriendRequest',
  async (requestId, { rejectWithValue }) => {
    const response = await friendRequestService.rejectFriendRequest(requestId);
    if (response.error) {
      return rejectWithValue(response.error);
    }
    return requestId;
  }
);

export const cancelFriendRequest = createAsyncThunk(
  'friendRequests/cancelFriendRequest',
  async (requestId, { rejectWithValue }) => {
    const response = await friendRequestService.cancelFriendRequest(requestId);
    if (response.error) {
      return rejectWithValue(response.error);
    }
    return requestId;
  }
);

const initialState = {
  searchResults: [],
  sentRequests: [],
  receivedRequests: [],
  isSearching: false,
  isLoading: false,
  isSending: false,
  isAccepting: false,
  isRejecting: false,
  isCancelling: false,
  error: null,
  searchError: null,
};

const friendRequestSlice = createSlice({
  name: 'friendRequests',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearSearchError: (state) => {
      state.searchError = null;
    },
    clearSearchResults: (state) => {
      state.searchResults = [];
      state.searchError = null;
    },
    resetFriendRequests: (state) => {
      state.sentRequests = [];
      state.receivedRequests = [];
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Search users
      .addCase(searchUsers.pending, (state) => {
        state.isSearching = true;
        state.searchError = null;
      })
      .addCase(searchUsers.fulfilled, (state, action) => {
        state.isSearching = false;
        state.searchResults = Array.isArray(action.payload.users) ? action.payload.users : [];
      })
      .addCase(searchUsers.rejected, (state, action) => {
        state.isSearching = false;
        state.searchError = action.payload;
        state.searchResults = [];
      })
      // Fetch friend requests
      .addCase(fetchFriendRequests.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchFriendRequests.fulfilled, (state, action) => {
        state.isLoading = false;
        state.sentRequests = Array.isArray(action.payload.sent) ? action.payload.sent : [];
        state.receivedRequests = Array.isArray(action.payload.received) ? action.payload.received : [];
      })
      .addCase(fetchFriendRequests.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Send friend request
      .addCase(sendFriendRequest.pending, (state) => {
        state.isSending = true;
        state.error = null;
      })
      .addCase(sendFriendRequest.fulfilled, (state, action) => {
        state.isSending = false;
        if (Array.isArray(state.sentRequests)) {
          state.sentRequests.push(action.payload.friendRequest);
        } else {
          state.sentRequests = [action.payload.friendRequest];
        }
      })
      .addCase(sendFriendRequest.rejected, (state, action) => {
        state.isSending = false;
        state.error = action.payload;
      })
      // Accept friend request
      .addCase(acceptFriendRequest.pending, (state) => {
        state.isAccepting = true;
        state.error = null;
      })
      .addCase(acceptFriendRequest.fulfilled, (state, action) => {
        state.isAccepting = false;
        // Remove from received requests
        if (Array.isArray(state.receivedRequests)) {
          state.receivedRequests = state.receivedRequests.filter(
            request => request.id !== action.payload.requestId
          );
        }
      })
      .addCase(acceptFriendRequest.rejected, (state, action) => {
        state.isAccepting = false;
        state.error = action.payload;
      })
      // Reject friend request
      .addCase(rejectFriendRequest.pending, (state) => {
        state.isRejecting = true;
        state.error = null;
      })
      .addCase(rejectFriendRequest.fulfilled, (state, action) => {
        state.isRejecting = false;
        // Remove from received requests
        if (Array.isArray(state.receivedRequests)) {
          state.receivedRequests = state.receivedRequests.filter(
            request => request.id !== action.payload
          );
        }
      })
      .addCase(rejectFriendRequest.rejected, (state, action) => {
        state.isRejecting = false;
        state.error = action.payload;
      })
      // Cancel friend request
      .addCase(cancelFriendRequest.pending, (state) => {
        state.isCancelling = true;
        state.error = null;
      })
      .addCase(cancelFriendRequest.fulfilled, (state, action) => {
        state.isCancelling = false;
        // Remove from sent requests
        if (Array.isArray(state.sentRequests)) {
          state.sentRequests = state.sentRequests.filter(
            request => request.id !== action.payload
          );
        }
      })
      .addCase(cancelFriendRequest.rejected, (state, action) => {
        state.isCancelling = false;
        state.error = action.payload;
      });
  },
});

export const { 
  clearError, 
  clearSearchError, 
  clearSearchResults, 
  resetFriendRequests 
} = friendRequestSlice.actions;

export default friendRequestSlice.reducer;