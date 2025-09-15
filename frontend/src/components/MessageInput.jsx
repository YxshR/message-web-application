import React, { useState, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { sendSocketMessage } from '../store/slices/chatSlice';
import useSocket from '../hooks/useSocket';

const MessageInput = ({ conversationId }) => {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const dispatch = useDispatch();
  const { isSendingMessage } = useSelector((state) => state.chat);
  const { isConnected, startTyping, stopTyping } = useSocket();
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    // Focus input when conversation changes
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [conversationId]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setMessage(value);

    // Handle typing indicators
    if (value.trim() && !isTyping && isConnected && conversationId) {
      setIsTyping(true);
      startTyping(conversationId);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      if (isTyping && isConnected && conversationId) {
        setIsTyping(false);
        stopTyping(conversationId);
      }
    }, 1000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!message.trim() || !conversationId || isSendingMessage) {
      return;
    }

    const messageContent = message.trim();
    setMessage('');
    setIsTyping(false);

    // Clear typing timeout and stop typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (isTyping && isConnected) {
      setIsTyping(false);
      stopTyping(conversationId);
    }

    try {
      // Use socket for real-time messaging if connected, fallback to HTTP
      if (isConnected) {
        await dispatch(sendSocketMessage({ 
          conversationId, 
          content: messageContent 
        })).unwrap();
      } else {
        // Fallback to HTTP API when socket is not connected
        const { sendMessage } = await import('../store/slices/chatSlice');
        await dispatch(sendMessage({ 
          conversationId, 
          content: messageContent 
        })).unwrap();
      }
    } catch (error) {
      // Error is handled by the slice
      console.error('Failed to send message:', error);
      // Optionally restore the message content
      setMessage(messageContent);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  if (!conversationId) {
    return null;
  }

  return (
    <div className="p-4">
      <form onSubmit={handleSubmit} className="flex items-end space-x-3">
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyPress}
            placeholder="Type a message..."
            className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            rows={1}
            disabled={isSendingMessage}
            maxLength={1000}
            style={{ minHeight: '48px', maxHeight: '120px' }}
          />
          <div className="absolute bottom-2 right-2 text-xs text-gray-400">
            {message.length}/1000
          </div>
        </div>
        
        <button
          type="submit"
          className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
            message.trim() && !isSendingMessage
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
          disabled={!message.trim() || isSendingMessage}
        >
          {isSendingMessage ? (
            <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
};

export default MessageInput;