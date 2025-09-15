import { useState, useCallback } from 'react';
import { createRetryHandler } from '../utils/errorHandler';

export const useRetry = (maxRetries = 3, delay = 1000) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const retryHandler = createRetryHandler(maxRetries, delay);

  const executeWithRetry = useCallback(async (fn, ...args) => {
    setIsRetrying(true);
    setRetryCount(0);

    try {
      const result = await retryHandler(async (...fnArgs) => {
        setRetryCount(prev => prev + 1);
        return await fn(...fnArgs);
      }, ...args);
      
      setIsRetrying(false);
      setRetryCount(0);
      return result;
    } catch (error) {
      setIsRetrying(false);
      setRetryCount(0);
      throw error;
    }
  }, [retryHandler]);

  const reset = useCallback(() => {
    setIsRetrying(false);
    setRetryCount(0);
  }, []);

  return {
    executeWithRetry,
    isRetrying,
    retryCount,
    reset
  };
};