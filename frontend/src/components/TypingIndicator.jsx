import React from 'react';
import { useSelector } from 'react-redux';

const TypingIndicator = ({ conversationId }) => {
  const { typingUsers } = useSelector(state => state.chat);
  const { user } = useSelector(state => state.auth);
  
  if (!conversationId || !typingUsers[conversationId]) {
    return null;
  }

  // Filter out current user from typing users
  const otherTypingUsers = typingUsers[conversationId].filter(userId => userId !== user?.id);
  
  if (otherTypingUsers.length === 0) {
    return null;
  }

  const getTypingText = () => {
    const count = otherTypingUsers.length;
    if (count === 1) {
      return 'Someone is typing...';
    } else if (count === 2) {
      return '2 people are typing...';
    } else {
      return `${count} people are typing...`;
    }
  };

  return (
    <div className="px-6 py-2 bg-gray-50 border-t border-gray-200">
      <div className="flex items-center space-x-2 text-sm text-gray-500">
        <div className="flex space-x-1">
          <div className="w-1 h-1 bg-gray-400 rounded-full animate-typing"></div>
          <div className="w-1 h-1 bg-gray-400 rounded-full animate-typing-delay-1"></div>
          <div className="w-1 h-1 bg-gray-400 rounded-full animate-typing-delay-2"></div>
        </div>
        <span className="italic">{getTypingText()}</span>
      </div>
    </div>
  );
};

export default TypingIndicator;