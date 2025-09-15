const { ensureConnection } = require('../utils/database');

/**
 * Search for users by username or email
 * @param {string} query - Search query (username or email)
 * @param {string} currentUserId - Current user ID to exclude from results
 * @returns {Promise<Array>} - Array of matching users
 */
async function searchUsers(query, currentUserId) {
  try {
    if (!query || typeof query !== 'string') {
      throw new Error('Search query is required');
    }

    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      throw new Error('Search query cannot be empty');
    }

    const prisma = await ensureConnection();
    const users = await prisma.user.findMany({
      where: {
        AND: [
          {
            id: {
              not: currentUserId
            }
          },
          {
            OR: [
              {
                username: {
                  contains: trimmedQuery,
                  mode: 'insensitive'
                }
              },
              {
                email: {
                  contains: trimmedQuery,
                  mode: 'insensitive'
                }
              }
            ]
          }
        ]
      },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true
      },
      take: 10 // Limit results
    });

    return users;
  } catch (error) {
    throw error;
  }
}

/**
 * Send a friend request
 * @param {string} senderId - Sender user ID
 * @param {string} receiverId - Receiver user ID
 * @returns {Promise<object>} - Created friend request
 */
async function sendFriendRequest(senderId, receiverId) {
  try {
    // Validate input
    if (!receiverId || typeof receiverId !== 'string') {
      throw new Error('Receiver ID is required');
    }

    const prisma = await ensureConnection();
    
    // Check if receiver exists
    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
      select: {
        id: true,
        username: true,
        email: true
      }
    });

    if (!receiver) {
      throw new Error('User not found');
    }

    // Check if user is trying to send request to themselves
    if (receiverId === senderId) {
      throw new Error('Cannot send friend request to yourself');
    }

    // Check if they are already contacts
    const existingContact = await prisma.contact.findUnique({
      where: {
        userId_contactId: {
          userId: senderId,
          contactId: receiverId
        }
      }
    });

    if (existingContact) {
      throw new Error('User is already in your contacts');
    }

    // Check if friend request already exists
    const existingRequest = await prisma.friendRequest.findUnique({
      where: {
        senderId_receiverId: {
          senderId: senderId,
          receiverId: receiverId
        }
      }
    });

    if (existingRequest) {
      if (existingRequest.status === 'PENDING') {
        throw new Error('Friend request already sent');
      } else if (existingRequest.status === 'REJECTED') {
        // Update existing rejected request to pending
        const updatedRequest = await prisma.friendRequest.update({
          where: {
            id: existingRequest.id
          },
          data: {
            status: 'PENDING',
            updatedAt: new Date()
          },
          include: {
            receiver: {
              select: {
                id: true,
                username: true,
                email: true
              }
            }
          }
        });
        return updatedRequest;
      }
    }

    // Check if there's a reverse request (receiver sent to sender)
    const reverseRequest = await prisma.friendRequest.findUnique({
      where: {
        senderId_receiverId: {
          senderId: receiverId,
          receiverId: senderId
        }
      }
    });

    if (reverseRequest && reverseRequest.status === 'PENDING') {
      throw new Error('This user has already sent you a friend request. Check your pending requests.');
    }

    // Create the friend request
    const friendRequest = await prisma.friendRequest.create({
      data: {
        senderId: senderId,
        receiverId: receiverId,
        status: 'PENDING'
      },
      include: {
        receiver: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      }
    });

    return friendRequest;
  } catch (error) {
    throw error;
  }
}

/**
 * Get pending friend requests for a user
 * @param {string} userId - User ID
 * @returns {Promise<object>} - Sent and received friend requests
 */
async function getFriendRequests(userId) {
  try {
    const prisma = await ensureConnection();
    const [sentRequests, receivedRequests] = await Promise.all([
      // Requests sent by the user
      prisma.friendRequest.findMany({
        where: {
          senderId: userId,
          status: 'PENDING'
        },
        include: {
          receiver: {
            select: {
              id: true,
              username: true,
              email: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      }),
      // Requests received by the user
      prisma.friendRequest.findMany({
        where: {
          receiverId: userId,
          status: 'PENDING'
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              email: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
    ]);

    return {
      sent: sentRequests,
      received: receivedRequests
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Accept a friend request
 * @param {string} requestId - Friend request ID
 * @param {string} userId - User ID (must be the receiver)
 * @returns {Promise<object>} - Result with created contact relationships
 */
async function acceptFriendRequest(requestId, userId) {
  try {
    const prisma = await ensureConnection();
    
    // Find the friend request
    const friendRequest = await prisma.friendRequest.findUnique({
      where: { id: requestId },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            email: true
          }
        },
        receiver: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      }
    });

    if (!friendRequest) {
      throw new Error('Friend request not found');
    }

    // Check if user is the receiver
    if (friendRequest.receiverId !== userId) {
      throw new Error('You can only accept friend requests sent to you');
    }

    // Check if request is still pending
    if (friendRequest.status !== 'PENDING') {
      throw new Error('Friend request is no longer pending');
    }

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Update friend request status
      await tx.friendRequest.update({
        where: { id: requestId },
        data: {
          status: 'ACCEPTED',
          updatedAt: new Date()
        }
      });

      // Create mutual contact relationships
      const [contact1, contact2] = await Promise.all([
        tx.contact.create({
          data: {
            userId: friendRequest.senderId,
            contactId: friendRequest.receiverId
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
        }),
        tx.contact.create({
          data: {
            userId: friendRequest.receiverId,
            contactId: friendRequest.senderId
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
        })
      ]);

      return { contact1, contact2 };
    });

    return {
      success: true,
      message: 'Friend request accepted successfully',
      friendRequest,
      contacts: result
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Reject a friend request
 * @param {string} requestId - Friend request ID
 * @param {string} userId - User ID (must be the receiver)
 * @returns {Promise<object>} - Result
 */
async function rejectFriendRequest(requestId, userId) {
  try {
    const prisma = await ensureConnection();
    
    // Find the friend request
    const friendRequest = await prisma.friendRequest.findUnique({
      where: { id: requestId }
    });

    if (!friendRequest) {
      throw new Error('Friend request not found');
    }

    // Check if user is the receiver
    if (friendRequest.receiverId !== userId) {
      throw new Error('You can only reject friend requests sent to you');
    }

    // Check if request is still pending
    if (friendRequest.status !== 'PENDING') {
      throw new Error('Friend request is no longer pending');
    }

    // Update friend request status
    await prisma.friendRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        updatedAt: new Date()
      }
    });

    return {
      success: true,
      message: 'Friend request rejected'
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Cancel a sent friend request
 * @param {string} requestId - Friend request ID
 * @param {string} userId - User ID (must be the sender)
 * @returns {Promise<object>} - Result
 */
async function cancelFriendRequest(requestId, userId) {
  try {
    const prisma = await ensureConnection();
    
    // Find the friend request
    const friendRequest = await prisma.friendRequest.findUnique({
      where: { id: requestId }
    });

    if (!friendRequest) {
      throw new Error('Friend request not found');
    }

    // Check if user is the sender
    if (friendRequest.senderId !== userId) {
      throw new Error('You can only cancel friend requests you sent');
    }

    // Check if request is still pending
    if (friendRequest.status !== 'PENDING') {
      throw new Error('Friend request is no longer pending');
    }

    // Delete the friend request
    await prisma.friendRequest.delete({
      where: { id: requestId }
    });

    return {
      success: true,
      message: 'Friend request cancelled'
    };
  } catch (error) {
    throw error;
  }
}

module.exports = {
  searchUsers,
  sendFriendRequest,
  getFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest
};