const { PrismaClient } = require('@prisma/client');
const { searchUsers } = require('./src/services/friendRequestService');

const prisma = new PrismaClient();

async function debugSearch() {
    try {
        console.log('🔍 Debugging user search...\n');

        // First, let's see what users exist in the database
        console.log('1. Checking existing users...');
        const allUsers = await prisma.user.findMany({
            select: {
                id: true,
                username: true,
                email: true,
                createdAt: true
            }
        });

        console.log(`Found ${allUsers.length} users in database:`);
        allUsers.forEach(user => {
            console.log(`  - ${user.username} (${user.email}) - ID: ${user.id}`);
        });
        console.log('');

        if (allUsers.length >= 2) {
            // Test search with existing users
            const testUser = allUsers[0];
            const searchQuery = allUsers[1].username.substring(0, 3); // Search for part of another user's name
            
            console.log(`2. Testing search for "${searchQuery}" as user ${testUser.username}...`);
            const searchResults = await searchUsers(searchQuery, testUser.id);
            
            console.log(`Search results (${searchResults.length} found):`);
            searchResults.forEach(user => {
                console.log(`  - ${user.username} (${user.email})`);
            });
        } else {
            console.log('2. Not enough users to test search. Need at least 2 users.');
        }

    } catch (error) {
        console.error('❌ Debug failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

debugSearch();