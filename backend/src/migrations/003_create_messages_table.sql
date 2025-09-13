-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP NULL,
    message_type VARCHAR(20) DEFAULT 'text',
    CONSTRAINT valid_message_type CHECK (message_type IN ('text', 'image', 'file'))
);

-- Create indexes for optimal query performance
-- Index for conversation queries (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(
    LEAST(sender_id, recipient_id), 
    GREATEST(sender_id, recipient_id), 
    created_at DESC
);

-- Index for recipient queries (for unread messages)
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id, created_at DESC);

-- Index for sender queries
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id, created_at DESC);

-- Index for unread messages
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(recipient_id, read_at) WHERE read_at IS NULL;

-- Composite index for efficient conversation pagination
CREATE INDEX IF NOT EXISTS idx_messages_conversation_pagination ON messages(sender_id, recipient_id, created_at DESC);