import React, { useState } from 'react';
import ContactsList from '../components/ContactsList';
import AddContact from '../components/AddContact';

const Contacts = () => {
  const [showAddContact, setShowAddContact] = useState(false);

  const handleOpenAddContact = () => {
    setShowAddContact(true);
  };

  const handleCloseAddContact = () => {
    setShowAddContact(false);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Contacts</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage your contacts and start conversations
          </p>
        </div>
        <button 
          onClick={handleOpenAddContact}
          className="btn-primary mt-4 sm:mt-0 flex items-center space-x-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span>Add Contact</span>
        </button>
      </div>
      
      <ContactsList />
      
      {showAddContact && (
        <AddContact onClose={handleCloseAddContact} />
      )}
    </div>
  );
};

export default Contacts;