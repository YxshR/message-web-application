import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import contactService from '../../services/contactService';

// Async thunks
export const fetchContacts = createAsyncThunk(
  'contacts/fetchContacts',
  async (_, { rejectWithValue }) => {
    try {
      const response = await contactService.getContacts();
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          error.message || 
                          'Failed to fetch contacts';
      return rejectWithValue(errorMessage);
    }
  }
);

export const addContact = createAsyncThunk(
  'contacts/addContact',
  async (contactData, { rejectWithValue }) => {
    try {
      const response = await contactService.addContact(contactData);
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          error.message || 
                          'Failed to add contact';
      return rejectWithValue(errorMessage);
    }
  }
);

export const removeContact = createAsyncThunk(
  'contacts/removeContact',
  async (contactId, { rejectWithValue }) => {
    try {
      await contactService.removeContact(contactId);
      return contactId;
    } catch (error) {
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          error.message || 
                          'Failed to remove contact';
      return rejectWithValue(errorMessage);
    }
  }
);

const initialState = {
  contacts: [],
  isLoading: false,
  isAdding: false,
  isRemoving: false,
  error: null,
};

const contactsSlice = createSlice({
  name: 'contacts',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    resetContacts: (state) => {
      state.contacts = [];
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch contacts
      .addCase(fetchContacts.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchContacts.fulfilled, (state, action) => {
        state.isLoading = false;
        state.contacts = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchContacts.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Add contact
      .addCase(addContact.pending, (state) => {
        state.isAdding = true;
        state.error = null;
      })
      .addCase(addContact.fulfilled, (state, action) => {
        state.isAdding = false;
        if (Array.isArray(state.contacts)) {
          state.contacts.push(action.payload);
        } else {
          state.contacts = [action.payload];
        }
      })
      .addCase(addContact.rejected, (state, action) => {
        state.isAdding = false;
        state.error = action.payload;
      })
      // Remove contact
      .addCase(removeContact.pending, (state) => {
        state.isRemoving = true;
        state.error = null;
      })
      .addCase(removeContact.fulfilled, (state, action) => {
        state.isRemoving = false;
        if (Array.isArray(state.contacts)) {
          state.contacts = state.contacts.filter(contact => contact.id !== action.payload);
        }
      })
      .addCase(removeContact.rejected, (state, action) => {
        state.isRemoving = false;
        state.error = action.payload;
      });
  },
});

export const { clearError, resetContacts } = contactsSlice.actions;
export default contactsSlice.reducer;