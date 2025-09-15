import React from 'react';

const UserSearchGuide = () => {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <div className="flex items-start space-x-3">
        <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-blue-800 mb-1">How to find users</h3>
          <div className="text-sm text-blue-700 space-y-1">
            <p>• Search by username or email address</p>
            <p>• Enter at least 2 characters to start searching</p>
            <p>• Try searching for: <code className="bg-blue-100 px-1 rounded">mkomko1234</code> or <code className="bg-blue-100 px-1 rounded">sisewo8995</code></p>
            <p>• Make sure the user has registered an account first</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserSearchGuide;