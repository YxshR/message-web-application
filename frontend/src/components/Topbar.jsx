import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { setActiveView, toggleSidebar } from '../store/slices/uiSlice';
import { logout } from '../store/slices/authSlice';

const Topbar = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { activeView, connectionStatus } = useSelector((state) => state.ui);
  const { user } = useSelector((state) => state.auth);

  const handleViewClick = (view) => {
    dispatch(setActiveView(view));
    if (view === 'message') {
      navigate('/chat');
    } else if (view === 'dashboard') {
      navigate('/dashboard');
    }
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const handleToggleSidebar = () => {
    dispatch(toggleSidebar());
  };

  const getConnectionStatusClass = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'status-connected';
      case 'connecting':
        return 'status-connecting';
      case 'error':
      case 'disconnected':
        return 'status-disconnected';
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
      {/* Left section */}
      <div className="flex items-center space-x-4">
        <button 
          className="lg:hidden p-2 rounded-md hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          onClick={handleToggleSidebar}
          aria-label="Toggle navigation sidebar"
          aria-expanded={false}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        
        <div className="flex items-center space-x-2">
          <div 
            className={`status-dot ${getConnectionStatusClass()}`}
            title={`Connection: ${connectionStatus}`}
          />
          <span className="text-sm text-gray-600 hidden sm:inline capitalize">
            {connectionStatus}
          </span>
        </div>
      </div>

      {/* Center section - Navigation */}
      <nav className="hidden md:flex items-center space-x-2" role="navigation" aria-label="Main navigation">
        <button
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            activeView === 'message' 
              ? 'bg-blue-600 text-white' 
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          onClick={() => handleViewClick('message')}
        >
          <span className="flex items-center space-x-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span>Message</span>
          </span>
        </button>
        
        <button
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            activeView === 'dashboard' 
              ? 'bg-blue-600 text-white' 
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          onClick={() => handleViewClick('dashboard')}
        >
          <span className="flex items-center space-x-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span>Dashboard</span>
          </span>
        </button>
      </nav>

      {/* Right section */}
      <div className="flex items-center space-x-3">
        <span className="text-sm font-medium text-gray-700 hidden sm:inline">
          {user?.username || 'User'}
        </span>
        <button 
          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          onClick={handleLogout}
          title="Logout"
          aria-label="Logout from application"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </header>
  );
};

export default Topbar;