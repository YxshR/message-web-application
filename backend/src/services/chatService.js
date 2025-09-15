const { PrismaClient } = require('@prisma/client');

class ChatService {
  constructor(prismaClient = null) {
    this.prisma = prismaClient || new PrismaClient();
  }
  /**
   * Get all conversations for a user
   * @param {string} userId - The user ID
   * @returns {Promise<Array>} Array of conversations with participants and last message
   */
  async getUserConversations(userId) {
    try {
      const conversations = await this.prisma.conversation.findMany({
        where: {
          participants: {
            some: {
              userId: userId
            }
          }
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  email: true
                }
              }
            }
          },
          messages: {
            orderBy: {
              createdAt: 'desc'
            },
            take: 1,
            include: {
              sender: {
                select: {
                  id: true,
                  username: true,
                  email: true
                }
              }
            }
          }
        },
        orderBy: {
          updatedAt: 'desc'
        }
      });

      // Format the response to include lastMessage and participant info
      return conversations.map(conversation => ({
        id: conversation.id,
        name: conversation.name,
        isGroup: conversation.isGroup,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        participants: conversation.participants.map(p => p.user),
        lastMessage: conversation.messages[0] || null
      }));
    } catch (error) {
      throw new Error(`Failed to get user conversations: ${error.message}`);
    }
  }

  /**
   * Get messages for a specific conversation
   * @param {string} conversationId - The conversation ID
   * @param {string} userId - The user ID (for authorization)
   * @param {number} limit - Number of messages to retrieve (default: 50)
   * @param {number} offset - Offset for pagination (default: 0)
   * @returns {Promise<Array>} Array of messages
   */
  async getConversationMessages(conversationId, userId, limit = 50, offset = 0) {
    try {
      // First verify user is participant in the conversation
      const participant = await this.prisma.conversationParticipant.findUnique({
        where: {
          conversationId_userId: {
            conversationId,
            userId
          }
        }
      });

      if (!participant) {
        throw new Error('User is not a participant in this conversation');
      }

      const messages = await this.prisma.message.findMany({
        where: {
          conversationId: conversationId
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
        },
        take: limit,
        skip: offset
      });

      return messages.reverse(); // Return in chronological order
    } catch (error) {
      throw new Error(`Failed to get conversation messages: ${error.message}`);
    }
  }

  /**
   * Send a message to a conversation
   * @param {string} conversationId - The conversation ID
   * @param {string} senderId - The sender's user ID
   * @param {string} content - The message content
   * @returns {Promise<Object>} The created message with sender info
   */
  async sendMessage(conversationId, senderId, content) {
    try {
      // Verify user is participant in the conversation
      const participant = await this.prisma.conversationParticipant.findUnique({
        where: {
          conversationId_userId: {
            conversationId,
            userId: senderId
          }
        }
      });

      if (!participant) {
        throw new Error('User is not a participant in this conversation');
      }

      // Create the message and update conversation timestamp
      const result = await this.prisma.$transaction(async (tx) => {
        const message = await tx.message.create({
          data: {
            content,
            senderId,
            conversationId
          },
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                email: true
              }
            }
          }
        });

        // Update conversation's updatedAt timestamp
        await tx.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() }
        });

        return message;
      });

      return result;
    } catch (error) {
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }

  /**
   * Create a new conversation between users
   * @param {Array<string>} userIds - Array of user IDs to include in conversation
   * @param {string} name - Optional name for group conversations
   * @returns {Promise<Object>} The created conversation with participants
   */
  async createConversation(userIds, name = null) {
    try {
      if (!userIds || userIds.length < 2) {
        throw new Error('At least 2 users are required to create a conversation');
      }

      // Check if all users exist
      const users = await this.prisma.user.findMany({
        where: {
          id: {
            in: userIds
          }
        }
      });

      if (users.length !== userIds.length) {
        throw new Error('One or more users not found');
      }

      // For direct conversations (2 users), check if conversation already exists
      if (userIds.length === 2 && !name) {
        const existingConversation = await this.prisma.conversation.findFirst({
          where: {
            isGroup: false,
            participants: {
              every: {
                userId: {
                  in: userIds
                }
              }
            }
          },
          include: {
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    email: true
                  }
                }
              }
            }
          }
        });

        if (existingConversation && existingConversation.participants.length === 2) {
          return {
            id: existingConversation.id,
            name: existingConversation.name,
            isGroup: existingConversation.isGroup,
            createdAt: existingConversation.createdAt,
            updatedAt: existingConversation.updatedAt,
            participants: existingConversation.participants.map(p => p.user)
          };
        }
      }

      // Create new conversation
      const conversation = await this.prisma.$transaction(async (tx) => {
        const newConversation = await tx.conversation.create({
          data: {
            name,
            isGroup: userIds.length > 2 || !!name
          }
        });

        // Add participants
        await tx.conversationParticipant.createMany({
          data: userIds.map(userId => ({
            conversationId: newConversation.id,
            userId
          }))
        });

        // Fetch the complete conversation with participants
        return await tx.conversation.findUnique({
          where: { id: newConversation.id },
          include: {
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    email: true
                  }
                }
              }
            }
          }
        });
      });

      return {
        id: conversation.id,
        name: conversation.name,
        isGroup: conversation.isGroup,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        participants: conversation.participants.map(p => p.user)
      };
    } catch (error) {
      throw new Error(`Failed to create conversation: ${error.message}`);
    }
  }

  /**
   * Find or create a direct conversation between two users
   * @param {string} userId1 - First user ID
   * @param {string} userId2 - Second user ID
   * @returns {Promise<Object>} The conversation
   */
  async findOrCreateDirectConversation(userId1, userId2) {
    try {
      return await this.createConversation([userId1, userId2]);
    } catch (error) {
      throw new Error(`Failed to find or create direct conversation: ${error.message}`);
    }
  }
}

module.exports = ChatService;