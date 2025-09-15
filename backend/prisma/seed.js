const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  try {
    // Create test users
    const hashedPassword = await bcrypt.hash('password123', 12);
    
    const user1 = await prisma.user.upsert({
      where: { email: 'alice@example.com' },
      update: {},
      create: {
        username: 'alice',
        email: 'alice@example.com',
        passwordHash: hashedPassword,
      },
    });

    const user2 = await prisma.user.upsert({
      where: { email: 'bob@example.com' },
      update: {},
      create: {
        username: 'bob',
        email: 'bob@example.com',
        passwordHash: hashedPassword,
      },
    });

    const user3 = await prisma.user.upsert({
      where: { email: 'charlie@example.com' },
      update: {},
      create: {
        username: 'charlie',
        email: 'charlie@example.com',
        passwordHash: hashedPassword,
      },
    });

    console.log('✅ Created test users:', { user1: user1.username, user2: user2.username, user3: user3.username });

    // Create contacts (Alice and Bob are contacts, Alice and Charlie are contacts)
    const contact1 = await prisma.contact.upsert({
      where: {
        userId_contactId: {
          userId: user1.id,
          contactId: user2.id,
        },
      },
      update: {},
      create: {
        userId: user1.id,
        contactId: user2.id,
      },
    });

    const contact2 = await prisma.contact.upsert({
      where: {
        userId_contactId: {
          userId: user2.id,
          contactId: user1.id,
        },
      },
      update: {},
      create: {
        userId: user2.id,
        contactId: user1.id,
      },
    });

    const contact3 = await prisma.contact.upsert({
      where: {
        userId_contactId: {
          userId: user1.id,
          contactId: user3.id,
        },
      },
      update: {},
      create: {
        userId: user1.id,
        contactId: user3.id,
      },
    });

    const contact4 = await prisma.contact.upsert({
      where: {
        userId_contactId: {
          userId: user3.id,
          contactId: user1.id,
        },
      },
      update: {},
      create: {
        userId: user3.id,
        contactId: user1.id,
      },
    });

    console.log('✅ Created contact relationships');

    // Create a conversation between Alice and Bob
    const conversation1 = await prisma.conversation.create({
      data: {
        isGroup: false,
        participants: {
          create: [
            { userId: user1.id },
            { userId: user2.id },
          ],
        },
      },
    });

    // Create a group conversation with all three users
    const conversation2 = await prisma.conversation.create({
      data: {
        name: 'Test Group Chat',
        isGroup: true,
        participants: {
          create: [
            { userId: user1.id },
            { userId: user2.id },
            { userId: user3.id },
          ],
        },
      },
    });

    console.log('✅ Created conversations');

    // Create some sample messages
    await prisma.message.createMany({
      data: [
        {
          content: 'Hello Bob! How are you?',
          senderId: user1.id,
          conversationId: conversation1.id,
        },
        {
          content: 'Hi Alice! I\'m doing great, thanks for asking!',
          senderId: user2.id,
          conversationId: conversation1.id,
        },
        {
          content: 'Welcome to our group chat everyone!',
          senderId: user1.id,
          conversationId: conversation2.id,
        },
        {
          content: 'Thanks Alice! Excited to be here.',
          senderId: user2.id,
          conversationId: conversation2.id,
        },
        {
          content: 'Hello everyone! Great to meet you all.',
          senderId: user3.id,
          conversationId: conversation2.id,
        },
      ],
    });

    console.log('✅ Created sample messages');
    console.log('🎉 Database seeding completed successfully!');

  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });