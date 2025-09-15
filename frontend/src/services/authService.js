import apiClient, { apiCall } from '../utils/apiClient';

const authService = {
  login: async (credentials) => {
    const result = await apiCall(() => apiClient.post('/api/auth/login', credentials));
    // Extract data from nested response structure
    return result.data ? { data: result.data.data } : result;
  },

  register: async (userData) => {
    const result = await apiCall(() => apiClient.post('/api/auth/register', userData));
    // Extract data from nested response structure
    return result.data ? { data: result.data.data } : result;
  },

  getCurrentUser: async () => {
    const result = await apiCall(() => apiClient.get('/api/auth/me'));
    // Extract data from nested response structure
    return result.data ? { data: result.data.data } : result;
  },

  logout: () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('token');
    }
  },
};

export default authService;