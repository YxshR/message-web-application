import React, { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import Message from './Message';

const MessageList = ({ conversationId }) => {
  const messagesEndRef = useRef(null);
  const { messages, isLoadingMessages } = useSelector((state) => state.chat);
  const { user } = useSelector((state) => state.auth);
  
  const conversationMessages = messages[conversationId] || [];

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [conversationMessages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const shouldShowAvatar = (currentMessage, previousMessage) => {
    if (!previousMessage) return true;
    return previousMessage.senderId !== currentMessage.senderId;
  };

  const shouldShowTimestamp = (currentMessage, nextMessage) => {
    if (!nextMessage) return true;
    
    const currentTime = new Date(currentMessage.createdAt);
    const nextTime = new Date(nextMessage.createdAt);
    const timeDiff = nextTime - currentTime;
    
    // Show timestamp if more than 5 minutes between messages
    return timeDiff > 5 * 60 * 1000;
  };

  const shouldShowDateSeparator = (currentMessage, previousMessage) => {
    if (!previousMessage) return true;
    
    const currentDate = new Date(currentMessage.createdAt).toDateString();
    const previousDate = new Date(previousMessage.createdAt).toDateString();
    
    return currentDate !== previousDate;
  };

  const formatDateSeparator = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    }
  };

  if (isLoadingMessages) {
    return (
      <div className="message-list loading">
        <div className="loading-spinner">Loading messages...</div>
      </div>
    );
  }

  if (!conversationId) {
    return (
      <div className="message-list empty">
        <div className="empty-state">
          <h3>Welcome to Chat</h3>
          <p>Select a conversation to start messaging</p>
        </div>
      </div>
    );
  }

  if (conversationMessages.length === 0) {
    return (
      <div className="message-list empty">
        <div className="empty-state">
          <h3>No messages yet</h3>
          <p>Start the conversation by sending a message</p>
        </div>
      </div>
    );
  }

  return (
    <div className="message-list">
      <div className="messages-container">
        {conversationMessages.map((message, index) => {
          const previousMessage = conversationMessages[index - 1];
          const nextMessage = conversationMessages[index + 1];
          const isOwn = message.senderId === user?.id;
          const showAvatar = shouldShowAvatar(message, previousMessage);
          const showTimestamp = shouldShowTimestamp(message, nextMessage);
          const showDateSeparator = shouldShowDateSeparator(message, previousMessage);

          return (
            <React.Fragment key={message.id}>
              {showDateSeparator && (
                <div className="date-separator">
                  <span className="date-text">
                    {formatDateSeparator(message.createdAt)}
                  </span>
                </div>
              )}
              <Message
                message={message}
                isOwn={isOwn}
                showAvatar={showAvatar}
                showTimestamp={showTimestamp}
              />
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default MessageList;