import { useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import socketService from '../services/socketService';
import { joinRoom, leaveRoom } from '../store/slices/chatSlice';

export const useSocket = () => {
  const dispatch = useDispatch();
  const { user } = useSelector(state => state.auth);
  const { activeConversationId, joinedRooms } = useSelector(state => state.chat);
  const { isConnected } = useSelector(state => state.ui);

  // Initialize socket connection when user is authenticated
  useEffect(() => {
    if (user && !isConnected) {
      socketService.connect();
    }

    return () => {
      if (!user) {
        socketService.disconnect();
      }
    };
  }, [user, isConnected]);

  // Handle active conversation changes
  useEffect(() => {
    if (activeConversationId && isConnected) {
      // Leave previous rooms that are not the active one
      joinedRooms.forEach(roomId => {
        if (roomId !== activeConversationId) {
          socketService.leaveRoom(roomId);
          dispatch(leaveRoom(roomId));
        }
      });

      // Join the active conversation room
      if (!joinedRooms.includes(activeConversationId)) {
        socketService.joinRoom(activeConversationId);
        dispatch(joinRoom(activeConversationId));
      }
    }
  }, [activeConversationId, isConnected, joinedRooms, dispatch]);

  // Socket methods
  const sendMessage = useCallback((conversationId, content) => {
    return socketService.sendMessage(conversationId, content);
  }, []);

  const startTyping = useCallback((conversationId) => {
    socketService.startTyping(conversationId);
  }, []);

  const stopTyping = useCallback((conversationId) => {
    socketService.stopTyping(conversationId);
  }, []);

  const reconnect = useCallback(() => {
    socketService.reconnect();
  }, []);

  const disconnect = useCallback(() => {
    socketService.disconnect();
  }, []);

  return {
    isConnected,
    sendMessage,
    startTyping,
    stopTyping,
    reconnect,
    disconnect,
  };
};

export default useSocket;