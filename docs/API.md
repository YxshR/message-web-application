# API Documentation

## Overview

The Real-time Messaging App provides a RESTful API for user authentication, contact management, and message handling, along with Socket.IO for real-time communication.

**Base URL:** `http://localhost:5000/api` (development) or `https://yourdomain.com/api` (production)

## Authentication

All protected endpoints require a valid JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

### Register User

**Endpoint:** `POST /api/auth/register`

**Description:** Register a new user account

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid input data
- `409 Conflict` - Email already exists

### Login User

**Endpoint:** `POST /api/auth/login`

**Description:** Authenticate user and receive JWT token

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "lastSeen": "2024-01-15T10:30:00Z"
    }
  }
}
```

**Error Responses:**
- `400 Bad Request` - Missing email or password
- `401 Unauthorized` - Invalid credentials

### Logout User

**Endpoint:** `POST /api/auth/logout`

**Description:** Invalidate current user session

**Headers:** `Authorization: Bearer <token>`

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

## Contacts

### Get User Contacts

**Endpoint:** `GET /api/contacts`

**Description:** Retrieve all contacts for the authenticated user

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `search` (optional) - Filter contacts by name or email
- `limit` (optional) - Number of contacts to return (default: 50)
- `offset` (optional) - Number of contacts to skip (default: 0)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "contacts": [
      {
        "id": 2,
        "name": "Jane Smith",
        "email": "jane@example.com",
        "lastMessage": "Hey, how are you?",
        "lastMessageTime": "2024-01-15T09:45:00Z",
        "unreadCount": 2,
        "isOnline": true
      }
    ],
    "total": 1,
    "hasMore": false
  }
}
```

### Add Contact

**Endpoint:** `POST /api/contacts`

**Description:** Add a new contact by email

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "email": "jane@example.com"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "contact": {
      "id": 2,
      "name": "Jane Smith",
      "email": "jane@example.com",
      "isOnline": false,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid email format
- `404 Not Found` - User with email not found
- `409 Conflict` - Contact already exists

## Messages

### Get Conversation Messages

**Endpoint:** `GET /api/messages/:contactId`

**Description:** Retrieve message history for a specific conversation

**Headers:** `Authorization: Bearer <token>`

**Path Parameters:**
- `contactId` - ID of the contact/conversation

**Query Parameters:**
- `page` (optional) - Page number for pagination (default: 1)
- `limit` (optional) - Messages per page (default: 50)
- `before` (optional) - Get messages before this timestamp (ISO string)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": 1,
        "senderId": 1,
        "recipientId": 2,
        "content": "Hello there!",
        "timestamp": "2024-01-15T10:30:00Z",
        "readAt": null,
        "messageType": "text"
      },
      {
        "id": 2,
        "senderId": 2,
        "recipientId": 1,
        "content": "Hi! How are you?",
        "timestamp": "2024-01-15T10:31:00Z",
        "readAt": "2024-01-15T10:31:30Z",
        "messageType": "text"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 2,
      "hasMore": false
    }
  }
}
```

### Send Message

**Endpoint:** `POST /api/messages`

**Description:** Send a new message to a contact

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "recipientId": 2,
  "content": "Hello there!",
  "messageType": "text"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "message": {
      "id": 3,
      "senderId": 1,
      "recipientId": 2,
      "content": "Hello there!",
      "timestamp": "2024-01-15T10:32:00Z",
      "readAt": null,
      "messageType": "text"
    }
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid message content or recipient
- `404 Not Found` - Recipient not found
- `403 Forbidden` - Not authorized to message this user

### Mark Messages as Read

**Endpoint:** `PUT /api/messages/:contactId/read`

**Description:** Mark all messages from a contact as read

**Headers:** `Authorization: Bearer <token>`

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "updatedCount": 3
  }
}
```

## User Profile

### Get Current User

**Endpoint:** `GET /api/users/me`

**Description:** Get current authenticated user information

**Headers:** `Authorization: Bearer <token>`

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "createdAt": "2024-01-15T08:00:00Z",
      "lastSeen": "2024-01-15T10:30:00Z"
    }
  }
}
```

### Update User Profile

**Endpoint:** `PUT /api/users/me`

**Description:** Update current user profile information

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "John Updated Doe"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "name": "John Updated Doe",
      "email": "john@example.com",
      "updatedAt": "2024-01-15T10:35:00Z"
    }
  }
}
```

## Error Handling

All API endpoints return consistent error responses:

**Error Response Format:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {
      "field": "fieldName",
      "value": "invalidValue"
    }
  }
}
```

**Common Error Codes:**
- `VALIDATION_ERROR` - Input validation failed
- `AUTHENTICATION_ERROR` - Invalid or missing authentication
- `AUTHORIZATION_ERROR` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `CONFLICT` - Resource already exists
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INTERNAL_ERROR` - Server error

**HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `429` - Too Many Requests
- `500` - Internal Server Error

## Rate Limiting

API endpoints are rate limited to prevent abuse:

- **General API**: 100 requests per 15 minutes per IP
- **Authentication**: 5 login attempts per 15 minutes per IP
- **Message sending**: 60 messages per minute per user

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642248000
```

## Pagination

Endpoints that return lists support pagination:

**Query Parameters:**
- `page` - Page number (1-based)
- `limit` - Items per page (max 100)
- `offset` - Alternative to page-based pagination

**Response Format:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "hasMore": true,
    "nextPage": 2
  }
}
```