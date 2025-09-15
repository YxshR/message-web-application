import axios from 'axios';
import { formatError, logError, ERROR_TYPES } from './errorHandler';

// Create axios instance
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5002',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    logError(error, 'Request interceptor');
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const formattedError = formatError(error);
    
    // Log the error
    logError(error, `API Error - ${error.config?.method?.toUpperCase()} ${error.config?.url}`);
    
    // Handle authentication errors
    if (formattedError.type === ERROR_TYPES.AUTHENTICATION) {
      // Clear invalid token
      localStorage.removeItem('token');
      
      // Redirect to login if not already there
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    
    // Attach formatted error to the error object
    error.formattedError = formattedError;
    
    return Promise.reject(error);
  }
);

// Helper function to handle API calls with consistent error handling
export const apiCall = async (requestFn) => {
  try {
    const response = await requestFn();
    return { data: response.data, error: null };
  } catch (error) {
    return { 
      data: null, 
      error: error.formattedError || formatError(error) 
    };
  }
};

export default apiClient;