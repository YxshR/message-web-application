const { getPrismaClient, executeWithErrorHandling } = require('../utils/database');

class DatabaseService {
  constructor() {
    this.prisma = getPrismaClient();
  }

  // User operations
  async createUser(userData) {
    return executeWithErrorHandling(async () => {
      return await this.prisma.user.create({
        data: userData,
        select: {
          id: true,
          username: true,
          email: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });
  }

  async findUserById(id) {
    return executeWithErrorHandling(async () => {
      return await this.prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          username: true,
          email: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });
  }

  async findUserByEmail(email) {
    return executeWithErrorHandling(async () => {
      return await this.prisma.user.findUnique({
        where: { email },
      });
    });
  }

  async findUserByUsername(username) {
    return executeWithErrorHandling(async () => {
      return await this.prisma.user.findUnique({
        where: { username },
      });
    });
  }

  // Contact operations
  async getUserContacts(userId) {
    return executeWithErrorHandling(async () => {
      return await this.prisma.contact.findMany({
        where: { userId },
        include: {
          contact: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });
  }

  async addContact(userId, contactId) {
    return executeWithErrorHandling(async () => {
      return await this.prisma.contact.create({
        data: {
          userId,
          contactId,
        },
        include: {
          contact: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      });
    });
  }

  async removeContact(userId, contactId) {
    return executeWithErrorHandling(async () => {
      return await this.prisma.contact.delete({
        where: {
          userId_contactId: {
            userId,
            contactId,
          },
        },
      });
    });
  }

  async checkContactExists(userId, contactId) {
    return executeWithErrorHandling(async () => {
      const contact = await this.prisma.contact.findUnique({
        where: {
          userId_contactId: {
            userId,
            contactId,
          },
        },
      });
      return !!contact;
    });
  }

  // Conversation operations
  async getUserConversations(userId) {
    return executeWithErrorHandling(async () => {
      return await this.prisma.conversation.findMany({
        where: {
          participants: {
            some: {
              userId,
            },
          },
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  email: true,
                },
              },
            },
          },
          messages: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
            include: {
              sender: {
                select: {
                  id: true,
                  username: true,
                },
              },
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });
    });
  }

  async createConversation(participantIds, isGroup = false, name = null) {
    return executeWithErrorHandling(async () => {
      return await this.prisma.conversation.create({
        data: {
          isGroup,
          name,
          participants: {
            create: participantIds.map(userId => ({ userId })),
          },
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  email: true,
                },
              },
            },
          },
        },
      });
    });
  }

  async findConversationById(conversationId) {
    return executeWithErrorHandling(async () => {
      return await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  email: true,
                },
              },
            },
          },
        },
      });
    });
  }

  // Message operations
  async getConversationMessages(conversationId, limit = 50, offset = 0) {
    return executeWithErrorHandling(async () => {
      return await this.prisma.message.findMany({
        where: { conversationId },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        skip: offset,
      });
    });
  }

  async createMessage(messageData) {
    return executeWithErrorHandling(async () => {
      const message = await this.prisma.message.create({
        data: messageData,
        include: {
          sender: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });

      // Update conversation's updatedAt timestamp
      await this.prisma.conversation.update({
        where: { id: messageData.conversationId },
        data: { updatedAt: new Date() },
      });

      return message;
    });
  }

  // Dashboard statistics
  async getUserStats(userId) {
    return executeWithErrorHandling(async () => {
      const [contactsCount, sentMessagesCount, receivedMessagesCount, activeChatsCount] = await Promise.all([
        // Total contacts
        this.prisma.contact.count({
          where: { userId },
        }),
        // Messages sent by user
        this.prisma.message.count({
          where: { senderId: userId },
        }),
        // Messages received by user (in conversations they participate in, but not sent by them)
        this.prisma.message.count({
          where: {
            conversation: {
              participants: {
                some: { userId },
              },
            },
            NOT: {
              senderId: userId,
            },
          },
        }),
        // Active conversations (conversations with at least one message)
        this.prisma.conversation.count({
          where: {
            participants: {
              some: { userId },
            },
            messages: {
              some: {},
            },
          },
        }),
      ]);

      return {
        totalContacts: contactsCount,
        totalMessagesSent: sentMessagesCount,
        totalMessagesReceived: receivedMessagesCount,
        activeChats: activeChatsCount,
      };
    });
  }

  // Utility methods
  async checkUserIsInConversation(userId, conversationId) {
    return executeWithErrorHandling(async () => {
      const participant = await this.prisma.conversationParticipant.findUnique({
        where: {
          conversationId_userId: {
            conversationId,
            userId,
          },
        },
      });
      return !!participant;
    });
  }

  async findOrCreateDirectConversation(userId1, userId2) {
    return executeWithErrorHandling(async () => {
      // Try to find existing direct conversation between these two users
      const existingConversation = await this.prisma.conversation.findFirst({
        where: {
          isGroup: false,
          participants: {
            every: {
              userId: {
                in: [userId1, userId2],
              },
            },
          },
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      if (existingConversation && existingConversation.participants.length === 2) {
        return existingConversation;
      }

      // Create new conversation if none exists
      return await this.createConversation([userId1, userId2], false);
    });
  }
}

module.exports = new DatabaseService();