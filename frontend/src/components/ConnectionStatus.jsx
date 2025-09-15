import React from 'react';
import { useSelector } from 'react-redux';
import useSocket from '../hooks/useSocket';

const ConnectionStatus = () => {
  const { connectionStatus } = useSelector(state => state.ui);
  const { reconnect } = useSocket();

  const getStatusConfig = () => {
    switch (connectionStatus) {
      case 'connected':
        return {
          className: 'connection-status connected',
          icon: '●',
          text: 'Connected',
          color: '#10b981'
        };
      case 'connecting':
        return {
          className: 'connection-status connecting',
          icon: '●',
          text: 'Connecting...',
          color: '#f59e0b'
        };
      case 'disconnected':
        return {
          className: 'connection-status disconnected',
          icon: '●',
          text: 'Disconnected',
          color: '#ef4444'
        };
      case 'error':
        return {
          className: 'connection-status error',
          icon: '●',
          text: 'Connection Error',
          color: '#ef4444'
        };
      default:
        return {
          className: 'connection-status unknown',
          icon: '●',
          text: 'Unknown',
          color: '#6b7280'
        };
    }
  };

  const config = getStatusConfig();
  const showReconnectButton = connectionStatus === 'disconnected' || connectionStatus === 'error';

  return (
    <div className="flex items-center space-x-2">
      <div className="flex items-center space-x-1">
        <div 
          className={`status-dot ${
            connectionStatus === 'connected' ? 'status-connected' :
            connectionStatus === 'connecting' ? 'status-connecting' :
            'status-disconnected'
          }`}
        />
        <span className="text-xs text-gray-600 hidden sm:inline">
          {config.text}
        </span>
      </div>
      {showReconnectButton && (
        <button 
          className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          onClick={reconnect}
          title="Reconnect to chat server"
        >
          Reconnect
        </button>
      )}
    </div>
  );
};

export default ConnectionStatus;