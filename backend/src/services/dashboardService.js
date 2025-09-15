const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Get dashboard statistics for a user
 * @param {string} userId - User ID
 * @returns {Promise<object>} - Dashboard statistics
 */
async function getDashboardStats(userId) {
  try {
    // Validate input
    if (!userId || typeof userId !== 'string') {
      throw new Error('User ID is required');
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Get total contacts count
    const totalContacts = await prisma.contact.count({
      where: {
        userId: userId
      }
    });

    // Get total messages sent by user
    const totalMessagesSent = await prisma.message.count({
      where: {
        senderId: userId
      }
    });

    // Get total messages received by user (messages in conversations user participates in, excluding own messages)
    const userConversations = await prisma.conversationParticipant.findMany({
      where: {
        userId: userId
      },
      select: {
        conversationId: true
      }
    });

    const conversationIds = userConversations.map(cp => cp.conversationId);

    const totalMessagesReceived = await prisma.message.count({
      where: {
        conversationId: {
          in: conversationIds
        },
        senderId: {
          not: userId
        }
      }
    });

    // Get active chats count (conversations with at least one message in the last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activeChats = await prisma.conversation.count({
      where: {
        participants: {
          some: {
            userId: userId
          }
        },
        messages: {
          some: {
            createdAt: {
              gte: thirtyDaysAgo
            }
          }
        }
      }
    });

    return {
      totalContacts,
      totalMessagesSent,
      totalMessagesReceived,
      activeChats
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Get detailed user statistics (for potential future use)
 * @param {string} userId - User ID
 * @returns {Promise<object>} - Detailed user statistics
 */
async function getDetailedUserStats(userId) {
  try {
    // Validate input
    if (!userId || typeof userId !== 'string') {
      throw new Error('User ID is required');
    }

    // Get basic stats
    const basicStats = await getDashboardStats(userId);

    // Get additional detailed stats
    const userConversations = await prisma.conversationParticipant.findMany({
      where: {
        userId: userId
      },
      include: {
        conversation: {
          include: {
            messages: {
              select: {
                id: true,
                createdAt: true,
                senderId: true
              },
              orderBy: {
                createdAt: 'desc'
              },
              take: 1
            }
          }
        }
      }
    });

    const totalConversations = userConversations.length;
    const groupChats = userConversations.filter(cp => cp.conversation.isGroup).length;
    const directChats = totalConversations - groupChats;

    // Get most recent activity
    const recentMessages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId },
          {
            conversation: {
              participants: {
                some: {
                  userId: userId
                }
              }
            }
          }
        ]
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 1,
      select: {
        createdAt: true
      }
    });

    const lastActivity = recentMessages.length > 0 ? recentMessages[0].createdAt : null;

    return {
      ...basicStats,
      totalConversations,
      groupChats,
      directChats,
      lastActivity
    };
  } catch (error) {
    throw error;
  }
}

module.exports = {
  getDashboardStats,
  getDetailedUserStats
};