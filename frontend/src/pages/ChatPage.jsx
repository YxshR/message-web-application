import React from 'react';
import ChatList from '../components/ChatList';
import ChatWindow from '../components/ChatWindow';

const ChatPage = () => {
  return (
    <div className="flex h-full">
      <div className="w-80 border-r border-gray-200 bg-gray-50">
        <ChatList />
      </div>
      <ChatWindow />
    </div>
  );
};

export default ChatPage;