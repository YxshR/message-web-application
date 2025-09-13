# Authentication System

This directory contains the authentication system implementation for the real-time messaging application.

## Overview

The authentication system provides secure user registration, login, logout, and token-based authentication using JWT tokens with HTTP-only cookies for refresh tokens.

## Components

### Utilities

#### `src/utils/jwt.js`
- JWT token generation and verification
- Access token (15 minutes) and refresh token (7 days) management
- Token extraction from Authorization headers

#### `src/utils/password.js`
- Password hashing using bcrypt with 12 salt rounds
- Password strength validation
- Secure password comparison

### Middleware

#### `src/middleware/auth.js`
- `authenticateToken`: Protects routes requiring authentication
- `optionalAuth`: Adds user info to request if token is present

### Routes

#### `src/routes/auth.js`
- `POST /api/auth/register`: User registration with validation
- `POST /api/auth/login`: User login with credential verification
- `POST /api/auth/logout`: User logout with token invalidation
- `GET /api/auth/me`: Get current user profile
- `POST /api/auth/refresh`: Refresh access token using refresh token

## Security Features

- Password strength validation (8+ chars, uppercase, lowercase, number)
- Bcrypt password hashing with 12 salt rounds
- JWT tokens with short expiration (15 minutes for access, 7 days for refresh)
- HTTP-only cookies for refresh tokens
- Input validation and sanitization
- Proper error handling without information leakage

## Environment Variables

```env
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
BCRYPT_SALT_ROUNDS=12
```

## Usage Examples

### Registration
```javascript
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

### Login
```javascript
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

### Protected Route Access
```javascript
GET /api/auth/me
Authorization: Bearer <access_token>
```

### Logout
```javascript
POST /api/auth/logout
Authorization: Bearer <access_token>
```

## Testing

The authentication system includes comprehensive unit tests:

- `src/tests/auth-utils.test.js`: Tests for JWT and password utilities
- `src/tests/auth-middleware.test.js`: Tests for authentication middleware
- `src/tests/auth-routes-basic.test.js`: Basic route validation tests

Run tests with:
```bash
npm test -- --testPathPatterns=auth
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {} // Optional additional details
  }
}
```

Common error codes:
- `MISSING_TOKEN`: Authorization token not provided
- `INVALID_TOKEN`: Token is malformed or invalid
- `TOKEN_EXPIRED`: Token has expired
- `USER_NOT_FOUND`: User no longer exists
- `INVALID_CREDENTIALS`: Login credentials are incorrect
- `WEAK_PASSWORD`: Password doesn't meet requirements
- `USER_EXISTS`: Email already registered