import apiClient, { apiCall } from '../utils/apiClient';

const contactService = {
  getContacts: async () => {
    return await apiCall(() => apiClient.get('/api/contacts'));
  },

  addContact: async (contactData) => {
    return await apiCall(() => apiClient.post('/api/contacts', contactData));
  },

  removeContact: async (contactId) => {
    return await apiCall(() => apiClient.delete(`/api/contacts/${contactId}`));
  },
};

export default contactService;