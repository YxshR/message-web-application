import apiClient, { apiCall } from '../utils/apiClient';

const friendRequestService = {
  searchUsers: async (query) => {
    return await apiCall(() => apiClient.get(`/api/friend-requests/search?q=${encodeURIComponent(query)}`, {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    }));
  },

  getFriendRequests: async () => {
    return await apiCall(() => apiClient.get('/api/friend-requests'));
  },

  sendFriendRequest: async (receiverId) => {
    return await apiCall(() => apiClient.post('/api/friend-requests', { receiverId }));
  },

  acceptFriendRequest: async (requestId) => {
    return await apiCall(() => apiClient.put(`/api/friend-requests/${requestId}/accept`));
  },

  rejectFriendRequest: async (requestId) => {
    return await apiCall(() => apiClient.put(`/api/friend-requests/${requestId}/reject`));
  },

  cancelFriendRequest: async (requestId) => {
    return await apiCall(() => apiClient.delete(`/api/friend-requests/${requestId}`));
  },
};

export default friendRequestService;