import api from './api';

const chatService = {
  getConversations: async () => {
    return await api.get('/chats');
  },

  getMessages: async (conversationId) => {
    return await api.get(`/chats/${conversationId}/messages`);
  },

  sendMessage: async (conversationId, content) => {
    return await api.post(`/chats/${conversationId}/messages`, { content });
  },

  createConversation: async (participantIds) => {
    return await api.post('/chats', { participantIds });
  },
};

export default chatService;