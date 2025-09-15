import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchConversations, setActiveConversation } from '../store/slices/chatSlice';

const ChatList = () => {
  const dispatch = useDispatch();
  const { conversations, activeConversationId, isLoading, error } = useSelector(
    (state) => state.chat
  );

  useEffect(() => {
    dispatch(fetchConversations());
  }, [dispatch]);

  const handleConversationClick = (conversationId) => {
    dispatch(setActiveConversation(conversationId));
  };

  const formatLastMessage = (message) => {
    if (!message) return 'No messages yet';
    return message.content.length > 50 
      ? `${message.content.substring(0, 50)}...` 
      : message.content;
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString();
    }
  };

  if (isLoading) {
    return (
      <div className="chat-list loading">
        <div className="loading-spinner">Loading conversations...</div>
      </div>
    );
  }

  if (error) {
    const errorMessage = typeof error === 'string' ? error : error?.message || 'An error occurred';
    return (
      <div className="chat-list error">
        <div className="error-message">Error: {errorMessage}</div>
      </div>
    );
  }

  return (
    <div className="chat-list">
      <div className="chat-list-header">
        <h3>Conversations</h3>
      </div>
      <div className="conversations">
        {conversations.length === 0 ? (
          <div className="no-conversations">
            <p>No conversations yet</p>
            <p>Start a conversation with your contacts!</p>
          </div>
        ) : (
          conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`conversation-item ${
                activeConversationId === conversation.id ? 'active' : ''
              }`}
              onClick={() => handleConversationClick(conversation.id)}
            >
              <div className="conversation-avatar">
                {conversation.isGroup ? (
                  <div className="group-avatar">G</div>
                ) : (
                  <div className="user-avatar">
                    {conversation.participants
                      ?.find(p => p.id !== conversation.currentUserId)
                      ?.username?.charAt(0)
                      ?.toUpperCase() || 'U'}
                  </div>
                )}
              </div>
              <div className="conversation-content">
                <div className="conversation-header">
                  <span className="conversation-name">
                    {conversation.name || 
                     conversation.participants
                       ?.find(p => p.id !== conversation.currentUserId)
                       ?.username || 
                     'Unknown'}
                  </span>
                  {conversation.lastMessage && (
                    <span className="conversation-time">
                      {formatTime(conversation.lastMessage.createdAt)}
                    </span>
                  )}
                </div>
                <div className="conversation-preview">
                  <span className="last-message">
                    {formatLastMessage(conversation.lastMessage)}
                  </span>
                  {conversation.unreadCount > 0 && (
                    <span className="unread-badge">{conversation.unreadCount}</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ChatList;