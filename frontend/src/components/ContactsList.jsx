import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchContacts, removeContact, clearError } from '../store/slices/contactsSlice';
import ErrorMessage from './ErrorMessage';
import LoadingSpinner from './LoadingSpinner';
import { useRetry } from '../hooks/useRetry';

const ContactsList = () => {
  const dispatch = useDispatch();
  const { contacts = [], isLoading, error } = useSelector(state => state.contacts);
  const [removingContactId, setRemovingContactId] = useState(null);
  const { executeWithRetry } = useRetry();

  useEffect(() => {
    // Only fetch if we don't have contacts or there's no loading state
    if (contacts.length === 0 && !isLoading && !error) {
      const loadContacts = async () => {
        try {
          await executeWithRetry(() => dispatch(fetchContacts()).unwrap());
        } catch (error) {
          console.error('Failed to load contacts:', error);
        }
      };
      
      loadContacts();
    }
  }, [dispatch, executeWithRetry, contacts.length, isLoading, error]);

  const handleRemoveContact = async (contactId) => {
    setRemovingContactId(contactId);
    try {
      await dispatch(removeContact(contactId)).unwrap();
    } catch (error) {
      console.error('Failed to remove contact:', error);
    } finally {
      setRemovingContactId(null);
    }
  };

  const handleClearError = () => {
    dispatch(clearError());
  };

  const handleRetryFetch = async () => {
    try {
      await executeWithRetry(() => dispatch(fetchContacts()).unwrap());
    } catch (error) {
      console.error('Failed to retry loading contacts:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="md" text="Loading contacts..." />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-semibold text-gray-900">Contacts</h2>
          <span className="bg-gray-100 text-gray-600 text-sm px-2 py-1 rounded-full">
            {Array.isArray(contacts) ? contacts.length : 0}
          </span>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4">
          <ErrorMessage 
            error={error}
            onRetry={handleRetryFetch}
            onDismiss={handleClearError}
          />
        </div>
      )}

      {!Array.isArray(contacts) || contacts.length === 0 ? (
        <div className="card-body">
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-gray-500 text-sm">No contacts yet. Add some contacts to start chatting!</p>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-gray-200">
          {Array.isArray(contacts) && contacts.map((contact) => (
            <div key={contact.id} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="avatar avatar-md bg-blue-600">
                    {contact.contact.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-medium text-gray-900 text-truncate">
                      {contact.contact.username}
                    </h3>
                    <p className="text-xs text-gray-500 text-truncate">
                      {contact.contact.email}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveContact(contact.id)}
                  disabled={removingContactId === contact.id}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Remove contact"
                >
                  {removingContactId === contact.id ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ContactsList;