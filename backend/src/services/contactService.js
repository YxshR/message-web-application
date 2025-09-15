const { getPrismaClient } = require('../utils/database');

/**
 * Get all contacts for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of contacts with user details
 */
async function getUserContacts(userId) {
  try {
    const prisma = getPrismaClient();
    const contacts = await prisma.contact.findMany({
      where: {
        userId: userId
      },
      include: {
        contact: {
          select: {
            id: true,
            username: true,
            email: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return contacts;
  } catch (error) {
    throw error;
  }
}

/**
 * Add a new contact for a user
 * @param {string} userId - User ID
 * @param {string|object} contactData - Username/email string or object with username/email
 * @returns {Promise<object>} - Created contact with user details
 */
async function addContact(userId, contactData) {
  try {
    let contactIdentifier;
    
    // Handle both string and object input for backward compatibility
    if (typeof contactData === 'string') {
      contactIdentifier = contactData;
    } else if (typeof contactData === 'object' && contactData !== null) {
      // Extract identifier from object (username or email)
      contactIdentifier = contactData.username || contactData.email || contactData.contactIdentifier;
    }

    // Validate input
    if (!contactIdentifier || typeof contactIdentifier !== 'string') {
      throw new Error('Contact identifier (username or email) is required');
    }

    const trimmedIdentifier = contactIdentifier.trim();
    if (!trimmedIdentifier) {
      throw new Error('Contact identifier (username or email) is required');
    }

    const prisma = getPrismaClient();
    
    // Find the user to add as contact by username or email
    const contactUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: trimmedIdentifier },
          { email: trimmedIdentifier }
        ]
      },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true
      }
    });

    if (!contactUser) {
      throw new Error('User not found with the provided username or email');
    }

    // Check if user is trying to add themselves
    if (contactUser.id === userId) {
      throw new Error('Cannot add yourself as a contact');
    }

    // Check if contact already exists
    const existingContact = await prisma.contact.findUnique({
      where: {
        userId_contactId: {
          userId: userId,
          contactId: contactUser.id
        }
      }
    });

    if (existingContact) {
      throw new Error('Contact already exists');
    }

    // Create the contact relationship
    const contact = await prisma.contact.create({
      data: {
        userId: userId,
        contactId: contactUser.id
      },
      include: {
        contact: {
          select: {
            id: true,
            username: true,
            email: true,
            createdAt: true
          }
        }
      }
    });

    return contact;
  } catch (error) {
    throw error;
  }
}

/**
 * Remove a contact for a user
 * @param {string} userId - User ID
 * @param {string} contactId - Contact ID to remove
 * @returns {Promise<object>} - Deletion result
 */
async function removeContact(userId, contactId) {
  try {
    // Validate input
    if (!contactId || typeof contactId !== 'string') {
      throw new Error('Contact ID is required');
    }

    const prisma = getPrismaClient();
    
    // Check if contact exists
    const existingContact = await prisma.contact.findUnique({
      where: {
        userId_contactId: {
          userId: userId,
          contactId: contactId
        }
      }
    });

    if (!existingContact) {
      throw new Error('Contact not found');
    }

    // Delete the contact
    await prisma.contact.delete({
      where: {
        userId_contactId: {
          userId: userId,
          contactId: contactId
        }
      }
    });

    return {
      success: true,
      message: 'Contact removed successfully'
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Check if a contact relationship exists
 * @param {string} userId - User ID
 * @param {string} contactId - Contact ID to check
 * @returns {Promise<boolean>} - Whether contact exists
 */
async function contactExists(userId, contactId) {
  try {
    const prisma = getPrismaClient();
    const contact = await prisma.contact.findUnique({
      where: {
        userId_contactId: {
          userId: userId,
          contactId: contactId
        }
      }
    });

    return !!contact;
  } catch (error) {
    throw error;
  }
}

module.exports = {
  getUserContacts,
  addContact,
  removeContact,
  contactExists
};