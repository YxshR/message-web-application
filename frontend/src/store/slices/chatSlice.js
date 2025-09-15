import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import chatService from '../../services/chatService';

// Async thunks
export const fetchConversations = createAsyncThunk(
  'chat/fetchConversations',
  async (_, { rejectWithValue }) => {
    try {
      const response = await chatService.getConversations();
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          error.message || 
                          'Failed to fetch conversations';
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchMessages = createAsyncThunk(
  'chat/fetchMessages',
  async (conversationId, { rejectWithValue }) => {
    try {
      const response = await chatService.getMessages(conversationId);
      return { conversationId, messages: response.data };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          error.message || 
                          'Failed to fetch messages';
      return rejectWithValue(errorMessage);
    }
  }
);

export const sendMessage = createAsyncThunk(
  'chat/sendMessage',
  async ({ conversationId, content }, { rejectWithValue }) => {
    try {
      const response = await chatService.sendMessage(conversationId, content);
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          error.message || 
                          'Failed to send message';
      return rejectWithValue(errorMessage);
    }
  }
);

export const sendSocketMessage = createAsyncThunk(
  'chat/sendSocketMessage',
  async ({ conversationId, content }, { rejectWithValue }) => {
    try {
      // Import socketService dynamically to avoid circular dependency
      const { default: socketService } = await import('../../services/socketService');
      const success = socketService.sendMessage(conversationId, content);
      if (!success) {
        throw new Error('Failed to send message via socket');
      }
      return { conversationId, content };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to send message');
    }
  }
);

export const createConversation = createAsyncThunk(
  'chat/createConversation',
  async (participantIds, { rejectWithValue }) => {
    try {
      const response = await chatService.createConversation(participantIds);
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          error.message || 
                          'Failed to create conversation';
      return rejectWithValue(errorMessage);
    }
  }
);

const initialState = {
  conversations: [],
  messages: {}, // { conversationId: [messages] }
  activeConversationId: null,
  isLoading: false,
  isLoadingMessages: false,
  isSendingMessage: false,
  error: null,
  typingUsers: {}, // { conversationId: [userIds] }
  onlineUsers: [],
  joinedRooms: [], // Track which rooms we've joined
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setActiveConversation: (state, action) => {
      state.activeConversationId = action.payload;
    },
    addMessage: (state, action) => {
      const { conversationId, message } = action.payload;
      if (!state.messages[conversationId]) {
        state.messages[conversationId] = [];
      }
      state.messages[conversationId].push(message);
      
      // Update last message in conversation
      const conversation = state.conversations.find(c => c.id === conversationId);
      if (conversation) {
        conversation.lastMessage = message;
        conversation.updatedAt = message.createdAt;
      }
    },
    updateTypingUsers: (state, action) => {
      const { conversationId, userId, isTyping } = action.payload;
      if (!state.typingUsers[conversationId]) {
        state.typingUsers[conversationId] = [];
      }
      
      if (isTyping) {
        if (!state.typingUsers[conversationId].includes(userId)) {
          state.typingUsers[conversationId].push(userId);
        }
      } else {
        state.typingUsers[conversationId] = state.typingUsers[conversationId].filter(
          id => id !== userId
        );
      }
    },
    setOnlineUsers: (state, action) => {
      state.onlineUsers = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    joinRoom: (state, action) => {
      const conversationId = action.payload;
      if (!state.joinedRooms.includes(conversationId)) {
        state.joinedRooms.push(conversationId);
      }
    },
    leaveRoom: (state, action) => {
      const conversationId = action.payload;
      state.joinedRooms = state.joinedRooms.filter(id => id !== conversationId);
    },
    resetChat: (state) => {
      state.conversations = [];
      state.messages = {};
      state.activeConversationId = null;
      state.typingUsers = {};
      state.onlineUsers = [];
      state.joinedRooms = [];
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch conversations
      .addCase(fetchConversations.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.isLoading = false;
        state.conversations = action.payload;
      })
      .addCase(fetchConversations.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Fetch messages
      .addCase(fetchMessages.pending, (state) => {
        state.isLoadingMessages = true;
        state.error = null;
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        state.isLoadingMessages = false;
        const { conversationId, messages } = action.payload;
        state.messages[conversationId] = messages;
      })
      .addCase(fetchMessages.rejected, (state, action) => {
        state.isLoadingMessages = false;
        state.error = action.payload;
      })
      // Send message
      .addCase(sendMessage.pending, (state) => {
        state.isSendingMessage = true;
        state.error = null;
      })
      .addCase(sendMessage.fulfilled, (state) => {
        state.isSendingMessage = false;
        // Message will be added via socket event or addMessage action
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.isSendingMessage = false;
        state.error = action.payload;
      })
      // Create conversation
      .addCase(createConversation.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createConversation.fulfilled, (state, action) => {
        state.isLoading = false;
        state.conversations.unshift(action.payload);
        state.activeConversationId = action.payload.id;
      })
      .addCase(createConversation.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Send socket message
      .addCase(sendSocketMessage.pending, (state) => {
        state.isSendingMessage = true;
        state.error = null;
      })
      .addCase(sendSocketMessage.fulfilled, (state) => {
        state.isSendingMessage = false;
        // Message will be added via socket event
      })
      .addCase(sendSocketMessage.rejected, (state, action) => {
        state.isSendingMessage = false;
        state.error = action.payload;
      });
  },
});

export const {
  setActiveConversation,
  addMessage,
  updateTypingUsers,
  setOnlineUsers,
  joinRoom,
  leaveRoom,
  clearError,
  resetChat,
} = chatSlice.actions;

export default chatSlice.reducer;