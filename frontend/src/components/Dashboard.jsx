import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchDashboardStats,
  selectDashboardStats,
  selectDashboardLoading,
  selectDashboardError,
  selectDashboardLastUpdated,
  clearError,
} from '../store/slices/dashboardSlice';
import StatCard from './StatCard';

const Dashboard = () => {
  const dispatch = useDispatch();
  const stats = useSelector(selectDashboardStats);
  const loading = useSelector(selectDashboardLoading);
  const error = useSelector(selectDashboardError);
  const lastUpdated = useSelector(selectDashboardLastUpdated);

  useEffect(() => {
    // Fetch stats on component mount
    dispatch(fetchDashboardStats());
  }, [dispatch]);

  const handleRefresh = () => {
    dispatch(clearError());
    dispatch(fetchDashboardStats());
  };

  const formatLastUpdated = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return `Last updated: ${date.toLocaleTimeString()}`;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">
            Overview of your chat activity and statistics
          </p>
        </div>
        
        <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
          {lastUpdated && (
            <span className="text-sm text-gray-500">
              {formatLastUpdated(lastUpdated)}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="btn-primary flex items-center space-x-2"
            aria-label="Refresh dashboard"
          >
            <svg 
              className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-red-700">
                Failed to load dashboard data: {error}
              </span>
            </div>
            <button 
              onClick={handleRefresh} 
              className="btn-danger text-xs px-3 py-1"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Contacts"
          value={stats.totalContacts}
          icon="👥"
          loading={loading}
          error={!!error}
        />
        <StatCard
          title="Messages Sent"
          value={stats.totalMessagesSent}
          icon="📤"
          loading={loading}
          error={!!error}
        />
        <StatCard
          title="Messages Received"
          value={stats.totalMessagesReceived}
          icon="📥"
          loading={loading}
          error={!!error}
        />
        <StatCard
          title="Active Chats"
          value={stats.activeChats}
          icon="💬"
          loading={loading}
          error={!!error}
        />
      </div>

      {/* Summary Section */}
      {!loading && !error && (
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-gray-900">Activity Summary</h2>
          </div>
          <div className="card-body">
            <div className="space-y-3 text-gray-600">
              <p className="flex flex-wrap items-center gap-1">
                <span>You have</span>
                <span className="font-semibold text-blue-600">{stats.totalContacts}</span>
                <span>contacts and have participated in</span>
                <span className="font-semibold text-blue-600">{stats.activeChats}</span>
                <span>active conversations in the last 30 days.</span>
              </p>
              <p className="flex flex-wrap items-center gap-1">
                <span>Your messaging activity:</span>
                <span className="font-semibold text-green-600">{stats.totalMessagesSent}</span>
                <span>messages sent and</span>
                <span className="font-semibold text-blue-600">{stats.totalMessagesReceived}</span>
                <span>messages received.</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;