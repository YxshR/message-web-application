import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  searchUsers, 
  sendFriendRequest, 
  clearSearchResults, 
  clearSearchError,
  clearError 
} from '../store/slices/friendRequestSlice';
import { useFormValidation, sanitizeInput } from '../utils/validation';
import ErrorMessage from './ErrorMessage';
import LoadingSpinner from './LoadingSpinner';
import UserSearchGuide from './UserSearchGuide';

const UserSearch = ({ onClose }) => {
  const dispatch = useDispatch();
  const { 
    searchResults, 
    isSearching, 
    isSending, 
    searchError, 
    error 
  } = useSelector(state => state.friendRequests);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTimeout, setSearchTimeout] = useState(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      dispatch(clearSearchResults());
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [dispatch, searchTimeout]);

  const handleSearchChange = (e) => {
    const value = sanitizeInput(e.target.value);
    setSearchQuery(value);

    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Clear results if query is empty
    if (!value.trim()) {
      dispatch(clearSearchResults());
      return;
    }

    // Debounce search
    const timeout = setTimeout(() => {
      if (value.trim().length >= 2) {
        console.log('Searching for users with query:', value.trim());
        dispatch(searchUsers(value.trim()));
      }
    }, 300);

    setSearchTimeout(timeout);
  };

  const handleSendRequest = async (userId) => {
    try {
      await dispatch(sendFriendRequest(userId)).unwrap();
      // Optionally show success message or update UI
    } catch (error) {
      // Error is handled by Redux slice
      console.error('Failed to send friend request:', error);
    }
  };

  const handleClose = () => {
    dispatch(clearSearchResults());
    dispatch(clearSearchError());
    dispatch(clearError());
    if (onClose) onClose();
  };

  const handleRetry = () => {
    dispatch(clearError());
    dispatch(clearSearchError());
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 flex-1 overflow-hidden flex flex-col">
          {(error || searchError) && (
            <ErrorMessage 
              error={error || searchError}
              onRetry={handleRetry}
              onDismiss={() => {
                dispatch(clearError());
                dispatch(clearSearchError());
              }}
            />
          )}

          <UserSearchGuide />

          <div className="mb-4">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
              Search by username or email
            </label>
            <div className="relative">
              <input
                type="text"
                id="search"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Enter username or email..."
                className="input-field pr-10"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <LoadingSpinner size="sm" />
                </div>
              )}
            </div>
            {searchQuery.trim().length > 0 && searchQuery.trim().length < 2 && (
              <p className="mt-1 text-sm text-gray-500">Enter at least 2 characters to search</p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {searchResults.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-700">Search Results</h3>
                {searchResults.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{user.username}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                    <button
                      onClick={() => handleSendRequest(user.id)}
                      disabled={isSending}
                      className="btn-primary text-sm px-3 py-1"
                    >
                      {isSending ? (
                        <LoadingSpinner size="sm" color="white" />
                      ) : (
                        'Send Request'
                      )}
                    </button>
                  </div>
                ))}
              </div>
            ) : searchQuery.trim().length >= 2 && !isSearching ? (
              <div className="text-center py-8">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="mt-2 text-sm text-gray-500">No users found</p>
                <p className="text-xs text-gray-400">Try a different username or email</p>
              </div>
            ) : !searchQuery.trim() ? (
              <div className="text-center py-8">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="mt-2 text-sm text-gray-500">Search for friends</p>
                <p className="text-xs text-gray-400">Enter a username or email to get started</p>
              </div>
            ) : null}
          </div>
        </div>
    </div>
  );
};

export default UserSearch;