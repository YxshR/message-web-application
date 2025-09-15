const { PrismaClient } = require('@prisma/client');
const { 
  hashPassword, 
  comparePassword, 
  generateToken, 
  validateRegistrationInput, 
  validateLoginInput 
} = require('../utils/auth');

const prisma = new PrismaClient();

/**
 * Register a new user
 * @param {object} userData - User registration data
 * @returns {Promise<object>} - Registration result with user and token
 */
async function registerUser(userData) {
  // Validate input
  const validation = validateRegistrationInput(userData);
  if (!validation.isValid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }

  const { username, email, password } = userData;

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: username },
          { email: email }
        ]
      }
    });

    if (existingUser) {
      if (existingUser.username === username) {
        throw new Error('Username already exists');
      }
      if (existingUser.email === email) {
        throw new Error('Email already exists');
      }
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash
      },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true
      }
    });

    // Generate token
    const token = generateToken(user);

    return {
      success: true,
      user,
      token
    };

  } catch (error) {
    throw error;
  }
}

/**
 * Login a user
 * @param {object} credentials - User login credentials
 * @returns {Promise<object>} - Login result with user and token
 */
async function loginUser(credentials) {
  // Validate input
  const validation = validateLoginInput(credentials);
  if (!validation.isValid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }

  const { username, password } = credentials;

  try {
    // Find user by username or email
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: username },
          { email: username }
        ]
      }
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    // Create user object without password hash
    const userResponse = {
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt
    };

    // Generate token
    const token = generateToken(userResponse);

    return {
      success: true,
      user: userResponse,
      token
    };

  } catch (error) {
    throw error;
  }
}

/**
 * Get user by ID
 * @param {string} userId - User ID
 * @returns {Promise<object>} - User object
 */
async function getUserById(userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  } catch (error) {
    throw error;
  }
}

module.exports = {
  registerUser,
  loginUser,
  getUserById
};