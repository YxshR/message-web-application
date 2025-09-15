import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchMessages } from '../store/slices/chatSlice';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';
import ConnectionStatus from './ConnectionStatus';
import useSocket from '../hooks/useSocket';

const ChatWindow = () => {
  const dispatch = useDispatch();
  const { 
    activeConversationId, 
    conversations, 
    onlineUsers,
    error 
  } = useSelector((state) => state.chat);
  const { isConnected } = useSocket();

  const activeConversation = conversations.find(
    (conv) => conv.id === activeConversationId
  );

  useEffect(() => {
    if (activeConversationId) {
      dispatch(fetchMessages(activeConversationId));
    }
  }, [dispatch, activeConversationId]);

  const getConversationName = () => {
    if (!activeConversation) return '';
    
    if (activeConversation.isGroup) {
      return activeConversation.name || 'Group Chat';
    }
    
    // For direct messages, show the other participant's name
    const otherParticipant = activeConversation.participants?.find(
      (p) => p.id !== activeConversation.currentUserId
    );
    
    return otherParticipant?.username || 'Unknown User';
  };

  const getOnlineStatus = () => {
    if (!activeConversation || activeConversation.isGroup) return null;
    
    const otherParticipant = activeConversation.participants?.find(
      (p) => p.id !== activeConversation.currentUserId
    );
    
    if (!otherParticipant) return 'Offline';
    
    // Check if user is in online users list
    const isOnline = onlineUsers.some(user => user.id === otherParticipant.id);
    return isOnline ? 'Online' : 'Offline';
  };



  if (!activeConversationId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Welcome to Chat</h2>
          <p className="text-gray-500">Select a conversation from the sidebar to start messaging</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Chat Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            {activeConversation?.isGroup ? (
              <div className="avatar avatar-md bg-green-600">G</div>
            ) : (
              <div className="avatar avatar-md bg-blue-600">
                {getConversationName().charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-gray-900 text-truncate">
              {getConversationName()}
            </h3>
            {!activeConversation?.isGroup && (
              <span className={`text-sm ${
                getOnlineStatus() === 'Online' ? 'text-green-600' : 'text-gray-500'
              }`}>
                {getOnlineStatus()}
              </span>
            )}
            {activeConversation?.isGroup && (
              <span className="text-sm text-gray-500">
                {activeConversation.participants?.length || 0} participants
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <ConnectionStatus />
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="px-6 py-3 bg-red-50 border-b border-red-200">
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-hidden">
        <MessageList conversationId={activeConversationId} />
      </div>

      {/* Typing Indicator */}
      <TypingIndicator conversationId={activeConversationId} />

      {/* Message Input */}
      <div className="border-t border-gray-200 bg-white">
        <MessageInput conversationId={activeConversationId} />
      </div>
    </div>
  );
};

export default ChatWindow;