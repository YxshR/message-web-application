import apiClient, { apiCall } from '../utils/apiClient';

const dashboardService = {
  getStats: async () => {
    const result = await apiCall(() => apiClient.get('/api/dashboard/stats'));
    return result.data ? { data: result.data.data } : result;
  },
};

export default dashboardService;