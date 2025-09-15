import { io } from 'socket.io-client';
import { store } from '../store';
import { addMessage, updateTypingUsers, setOnlineUsers } from '../store/slices/chatSlice';
import { setConnectionStatus, addNotification } from '../store/slices/uiSlice';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
  }

  connect() {
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('No authentication token found');
      return;
    }

    // Disconnect existing connection if any
    if (this.socket) {
      this.disconnect();
    }

    const serverUrl = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5002';
    
    store.dispatch(setConnectionStatus('connecting'));

    this.socket = io(serverUrl, {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling'],
      timeout: 10000,
      forceNew: true
    });

    this.setupEventListeners();
  }

  setupEventListeners() {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket.id);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      store.dispatch(setConnectionStatus('connected'));
      store.dispatch(addNotification({
        type: 'success',
        message: 'Connected to chat server',
        duration: 3000
      }));
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      this.isConnected = false;
      store.dispatch(setConnectionStatus('disconnected'));
      
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, don't reconnect automatically
        store.dispatch(addNotification({
          type: 'error',
          message: 'Disconnected from chat server',
          duration: 5000
        }));
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.isConnected = false;
      store.dispatch(setConnectionStatus('error'));
      
      if (error.message.includes('Authentication')) {
        store.dispatch(addNotification({
          type: 'error',
          message: 'Authentication failed. Please login again.',
          duration: 5000
        }));
        // Redirect to login or handle auth error
        localStorage.removeItem('token');
        window.location.href = '/login';
      } else {
        this.handleReconnection();
      }
    });

    // Message events
    this.socket.on('message_received', (message) => {
      console.log('Message received:', message);
      store.dispatch(addMessage({
        conversationId: message.conversationId,
        message: message
      }));
      
      // Show notification if not in active conversation
      const state = store.getState();
      if (state.chat.activeConversationId !== message.conversationId) {
        store.dispatch(addNotification({
          type: 'info',
          message: `New message from ${message.sender.username}`,
          duration: 4000
        }));
      }
    });

    // Typing events
    this.socket.on('typing_indicator', ({ userId, conversationId, isTyping, username }) => {
      console.log('Typing indicator:', { userId, conversationId, isTyping, username });
      store.dispatch(updateTypingUsers({
        conversationId,
        userId,
        isTyping
      }));
    });

    // User presence events
    this.socket.on('user_joined', ({ userId, conversationId, username }) => {
      console.log('User joined:', { userId, conversationId, username });
      store.dispatch(addNotification({
        type: 'info',
        message: `${username} joined the conversation`,
        duration: 3000
      }));
    });

    this.socket.on('user_left', ({ userId, conversationId, username }) => {
      console.log('User left:', { userId, conversationId, username });
      store.dispatch(addNotification({
        type: 'info',
        message: `${username} left the conversation`,
        duration: 3000
      }));
    });

    this.socket.on('online_users', (users) => {
      console.log('Online users updated:', users);
      store.dispatch(setOnlineUsers(users));
    });

    // Error events
    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
      store.dispatch(addNotification({
        type: 'error',
        message: error.message || 'An error occurred',
        duration: 5000
      }));
    });
  }

  handleReconnection() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      store.dispatch(addNotification({
        type: 'warning',
        message: `Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
        duration: 3000
      }));

      setTimeout(() => {
        if (!this.isConnected) {
          this.connect();
        }
      }, delay);
    } else {
      store.dispatch(addNotification({
        type: 'error',
        message: 'Failed to reconnect. Please refresh the page.',
        duration: 10000
      }));
    }
  }

  // Room management
  joinRoom(conversationId) {
    if (this.socket && this.isConnected) {
      console.log('Joining room:', conversationId);
      this.socket.emit('join_room', { conversationId });
    }
  }

  leaveRoom(conversationId) {
    if (this.socket && this.isConnected) {
      console.log('Leaving room:', conversationId);
      this.socket.emit('leave_room', { conversationId });
    }
  }

  // Message sending
  sendMessage(conversationId, content) {
    if (this.socket && this.isConnected) {
      console.log('Sending message:', { conversationId, content });
      this.socket.emit('send_message', {
        conversationId,
        content
      });
      return true;
    } else {
      store.dispatch(addNotification({
        type: 'error',
        message: 'Not connected to chat server',
        duration: 3000
      }));
      return false;
    }
  }

  // Typing indicators
  startTyping(conversationId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing_start', { conversationId });
    }
  }

  stopTyping(conversationId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing_stop', { conversationId });
    }
  }

  // Connection management
  disconnect() {
    if (this.socket) {
      console.log('Disconnecting socket');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      store.dispatch(setConnectionStatus('disconnected'));
    }
  }

  reconnect() {
    this.reconnectAttempts = 0;
    this.connect();
  }

  // Getters
  getConnectionStatus() {
    return this.isConnected;
  }

  getSocket() {
    return this.socket;
  }
}

// Create singleton instance
const socketService = new SocketService();

export default socketService;