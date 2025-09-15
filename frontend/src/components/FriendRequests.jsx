import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  fetchFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
  clearError 
} from '../store/slices/friendRequestSlice';
import { fetchContacts } from '../store/slices/contactsSlice';
import ErrorMessage from './ErrorMessage';
import LoadingSpinner from './LoadingSpinner';

const FriendRequests = ({ onClose }) => {
  const dispatch = useDispatch();
  const { 
    sentRequests, 
    receivedRequests, 
    isLoading, 
    isAccepting, 
    isRejecting, 
    isCancelling, 
    error 
  } = useSelector(state => state.friendRequests);

  useEffect(() => {
    dispatch(fetchFriendRequests());
  }, [dispatch]);

  const handleAccept = async (requestId) => {
    try {
      await dispatch(acceptFriendRequest(requestId)).unwrap();
      // Refresh contacts list since a new contact was added
      dispatch(fetchContacts());
    } catch (error) {
      console.error('Failed to accept friend request:', error);
    }
  };

  const handleReject = async (requestId) => {
    try {
      await dispatch(rejectFriendRequest(requestId)).unwrap();
    } catch (error) {
      console.error('Failed to reject friend request:', error);
    }
  };

  const handleCancel = async (requestId) => {
    try {
      await dispatch(cancelFriendRequest(requestId)).unwrap();
    } catch (error) {
      console.error('Failed to cancel friend request:', error);
    }
  };

  const handleClose = () => {
    dispatch(clearError());
    if (onClose) onClose();
  };

  const handleRetry = () => {
    dispatch(clearError());
    dispatch(fetchFriendRequests());
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 flex-1 overflow-y-auto">
          {error && (
            <ErrorMessage 
              error={error}
              onRetry={handleRetry}
              onDismiss={() => dispatch(clearError())}
            />
          )}

          {isLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="lg" text="Loading friend requests..." />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Received Requests */}
              <div>
                <h3 className="text-md font-medium text-gray-900 mb-3">
                  Received Requests ({receivedRequests.length})
                </h3>
                {receivedRequests.length > 0 ? (
                  <div className="space-y-3">
                    {receivedRequests.map((request) => (
                      <div key={request.id} className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{request.sender.username}</p>
                          <p className="text-sm text-gray-500">{request.sender.email}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            Sent {formatDate(request.createdAt)}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleAccept(request.id)}
                            disabled={isAccepting || isRejecting}
                            className="btn-primary text-sm px-3 py-1"
                          >
                            {isAccepting ? (
                              <LoadingSpinner size="sm" color="white" />
                            ) : (
                              'Accept'
                            )}
                          </button>
                          <button
                            onClick={() => handleReject(request.id)}
                            disabled={isAccepting || isRejecting}
                            className="btn-secondary text-sm px-3 py-1"
                          >
                            {isRejecting ? (
                              <LoadingSpinner size="sm" />
                            ) : (
                              'Reject'
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 bg-gray-50 rounded-lg">
                    <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m13-8l-4 4m0 0l-4-4m4 4V3" />
                    </svg>
                    <p className="mt-2 text-sm text-gray-500">No pending requests</p>
                  </div>
                )}
              </div>

              {/* Sent Requests */}
              <div>
                <h3 className="text-md font-medium text-gray-900 mb-3">
                  Sent Requests ({sentRequests.length})
                </h3>
                {sentRequests.length > 0 ? (
                  <div className="space-y-3">
                    {sentRequests.map((request) => (
                      <div key={request.id} className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{request.receiver.username}</p>
                          <p className="text-sm text-gray-500">{request.receiver.email}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            Sent {formatDate(request.createdAt)}
                          </p>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="text-xs text-yellow-600 bg-yellow-100 px-2 py-1 rounded-full">
                            Pending
                          </span>
                          <button
                            onClick={() => handleCancel(request.id)}
                            disabled={isCancelling}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            {isCancelling ? (
                              <LoadingSpinner size="sm" />
                            ) : (
                              'Cancel'
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 bg-gray-50 rounded-lg">
                    <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    <p className="mt-2 text-sm text-gray-500">No sent requests</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
    </div>
  );
};

export default FriendRequests;