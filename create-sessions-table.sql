-- Create sessions table for express-session with connect-pg-simple
CREATE TABLE IF NOT EXISTS sessions (
  sid VARCHAR NOT NULL COLLATE "default",
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
) WITH (OIDS=FALSE);

-- Add primary key constraint
ALTER TABLE sessions ADD CONSTRAINT IF NOT EXISTS sessions_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE;

-- Create index on expire column for cleanup
CREATE INDEX IF NOT EXISTS IDX_session_expire ON sessions (expire);

-- Grant permissions (adjust if needed)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON sessions TO your_user;