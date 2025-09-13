-- Create contacts table for user relationships
CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_contact_relationship UNIQUE(user_id, contact_user_id),
    CONSTRAINT no_self_contact CHECK (user_id != contact_user_id)
);

-- Create indexes for efficient contact queries
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_contact_user_id ON contacts(contact_user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_relationship ON contacts(user_id, contact_user_id);