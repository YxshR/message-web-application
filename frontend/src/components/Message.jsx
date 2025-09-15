import React from 'react';

const Message = ({ message, isOwn, showAvatar = true, showTimestamp = true }) => {
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className={`message ${isOwn ? 'own' : 'other'}`}>
      {showAvatar && !isOwn && (
        <div className="message-avatar">
          <div className="avatar">
            {message.sender?.username?.charAt(0)?.toUpperCase() || 'U'}
          </div>
        </div>
      )}
      <div className="message-content">
        {!isOwn && (
          <div className="message-sender">
            {message.sender?.username || 'Unknown User'}
          </div>
        )}
        <div className="message-bubble">
          <div className="message-text">
            {message.content}
          </div>
          {showTimestamp && (
            <div className="message-timestamp">
              {formatTime(message.createdAt)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Message;