const bcrypt = require('bcrypt');
const { query, transaction } = require('../config/database');

// Sample users data
const sampleUsers = [
  {
    name: 'John Doe',
    email: 'john@example.com',
    password: 'password123'
  },
  {
    name: 'Jane Smith',
    email: 'jane@example.com',
    password: 'password123'
  },
  {
    name: 'Bob Johnson',
    email: 'bob@example.com',
    password: 'password123'
  },
  {
    name: 'Alice Brown',
    email: 'alice@example.com',
    password: 'password123'
  }
];

// Sample messages data (will be populated after users are created)
const sampleMessages = [
  {
    senderEmail: 'john@example.com',
    recipientEmail: 'jane@example.com',
    content: 'Hey Jane! How are you doing?',
    createdAt: new Date(Date.now() - 3600000) // 1 hour ago
  },
  {
    senderEmail: 'jane@example.com',
    recipientEmail: 'john@example.com',
    content: 'Hi John! I\'m doing great, thanks for asking. How about you?',
    createdAt: new Date(Date.now() - 3300000) // 55 minutes ago
  },
  {
    senderEmail: 'john@example.com',
    recipientEmail: 'jane@example.com',
    content: 'I\'m good too! Want to grab coffee later?',
    createdAt: new Date(Date.now() - 3000000) // 50 minutes ago
  },
  {
    senderEmail: 'bob@example.com',
    recipientEmail: 'alice@example.com',
    content: 'Alice, did you finish the project report?',
    createdAt: new Date(Date.now() - 7200000) // 2 hours ago
  },
  {
    senderEmail: 'alice@example.com',
    recipientEmail: 'bob@example.com',
    content: 'Yes, I sent it to you via email. Check your inbox!',
    createdAt: new Date(Date.now() - 6900000) // 1 hour 55 minutes ago
  }
];

// Clear existing data
const clearData = async () => {
  console.log('Clearing existing data...');
  await query('DELETE FROM messages');
  await query('DELETE FROM contacts');
  await query('DELETE FROM users');
  console.log('✓ Existing data cleared');
};

// Seed users
const seedUsers = async () => {
  console.log('Seeding users...');
  const userIds = {};
  
  for (const user of sampleUsers) {
    const hashedPassword = await bcrypt.hash(user.password, 12);
    const result = await query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
      [user.name, user.email, hashedPassword]
    );
    userIds[user.email] = result.rows[0].id;
    console.log(`✓ Created user: ${user.name} (${user.email})`);
  }
  
  return userIds;
};

// Seed contacts (mutual relationships)
const seedContacts = async (userIds) => {
  console.log('Seeding contacts...');
  
  const contactPairs = [
    ['john@example.com', 'jane@example.com'],
    ['john@example.com', 'bob@example.com'],
    ['jane@example.com', 'alice@example.com'],
    ['bob@example.com', 'alice@example.com']
  ];
  
  for (const [email1, email2] of contactPairs) {
    const userId1 = userIds[email1];
    const userId2 = userIds[email2];
    
    // Create mutual contact relationships
    await query(
      'INSERT INTO contacts (user_id, contact_user_id) VALUES ($1, $2)',
      [userId1, userId2]
    );
    await query(
      'INSERT INTO contacts (user_id, contact_user_id) VALUES ($1, $2)',
      [userId2, userId1]
    );
    
    console.log(`✓ Created contact relationship: ${email1} <-> ${email2}`);
  }
};

// Seed messages
const seedMessages = async (userIds) => {
  console.log('Seeding messages...');
  
  for (const message of sampleMessages) {
    const senderId = userIds[message.senderEmail];
    const recipientId = userIds[message.recipientEmail];
    
    await query(
      'INSERT INTO messages (sender_id, recipient_id, content, created_at) VALUES ($1, $2, $3, $4)',
      [senderId, recipientId, message.content, message.createdAt]
    );
    
    console.log(`✓ Created message: ${message.senderEmail} -> ${message.recipientEmail}`);
  }
};

// Main seeding function
const seedDatabase = async () => {
  try {
    console.log('Starting database seeding...');
    
    await transaction(async (client) => {
      // Clear existing data
      await client.query('DELETE FROM messages');
      await client.query('DELETE FROM contacts');
      await client.query('DELETE FROM users');
      
      // Seed users
      const userIds = {};
      for (const user of sampleUsers) {
        const hashedPassword = await bcrypt.hash(user.password, 12);
        const result = await client.query(
          'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
          [user.name, user.email, hashedPassword]
        );
        userIds[user.email] = result.rows[0].id;
      }
      
      // Seed contacts
      const contactPairs = [
        ['john@example.com', 'jane@example.com'],
        ['john@example.com', 'bob@example.com'],
        ['jane@example.com', 'alice@example.com'],
        ['bob@example.com', 'alice@example.com']
      ];
      
      for (const [email1, email2] of contactPairs) {
        const userId1 = userIds[email1];
        const userId2 = userIds[email2];
        
        await client.query(
          'INSERT INTO contacts (user_id, contact_user_id) VALUES ($1, $2)',
          [userId1, userId2]
        );
        await client.query(
          'INSERT INTO contacts (user_id, contact_user_id) VALUES ($1, $2)',
          [userId2, userId1]
        );
      }
      
      // Seed messages
      for (const message of sampleMessages) {
        const senderId = userIds[message.senderEmail];
        const recipientId = userIds[message.recipientEmail];
        
        await client.query(
          'INSERT INTO messages (sender_id, recipient_id, content, created_at) VALUES ($1, $2, $3, $4)',
          [senderId, recipientId, message.content, message.createdAt]
        );
      }
    });
    
    console.log('✓ Database seeding completed successfully');
    console.log('\nSample users created:');
    sampleUsers.forEach(user => {
      console.log(`  - ${user.name} (${user.email}) - password: ${user.password}`);
    });
    
  } catch (err) {
    console.error('✗ Database seeding failed:', err.message);
    throw err;
  }
};

module.exports = {
  seedDatabase,
  clearData
};

// Allow running seeding directly
if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}