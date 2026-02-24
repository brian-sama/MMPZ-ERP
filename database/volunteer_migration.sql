-- Add 'volunteer' to the allowed roles in users table
-- We need to drop the existing constraint and add a new one
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
ADD CONSTRAINT users_role_check CHECK (
        role IN (
            'admin',
            'director',
            'officer',
            'intern',
            'volunteer'
        )
    );
-- Create volunteer_submissions table
CREATE TABLE IF NOT EXISTS volunteer_submissions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    type VARCHAR(50) CHECK (
        type IN ('plan', 'concept_note', 'report', 'scanned_list')
    ) NOT NULL,
    file_data TEXT,
    -- Base64 encoded file content
    file_name VARCHAR(255),
    mime_type VARCHAR(100),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
-- Create volunteer_participants table
CREATE TABLE IF NOT EXISTS volunteer_participants (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    age INT,
    gender VARCHAR(20),
    contact VARCHAR(100),
    event_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
-- Create indexes
CREATE INDEX idx_volunteer_submissions_user ON volunteer_submissions(user_id);
CREATE INDEX idx_volunteer_participants_user ON volunteer_participants(user_id);