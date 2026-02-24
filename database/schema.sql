-- MMPZ PostgreSQL Schema for Supabase
-- Converted from MySQL schema
-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100) UNIQUE,
    role VARCHAR(20) CHECK (
        role IN ('admin', 'director', 'officer', 'intern')
    ) NOT NULL,
    password_hash VARCHAR(255),
    require_password_reset BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Indicators table
CREATE TABLE indicators (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    target_value INT DEFAULT 0,
    current_value INT DEFAULT 0,
    total_budget DECIMAL(10, 2) NOT NULL,
    current_budget_balance DECIMAL(10, 2) NOT NULL,
    created_by_user_id INT,
    status VARCHAR(20) CHECK (status IN ('active', 'completed', 'flagged')) DEFAULT 'active',
    priority VARCHAR(20) CHECK (
        priority IN ('low', 'medium', 'high', 'critical')
    ) DEFAULT 'medium',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE
    SET NULL
);
-- Progress updates table
CREATE TABLE progress_updates (
    id SERIAL PRIMARY KEY,
    indicator_id INT NOT NULL,
    updated_by_user_id INT,
    previous_value INT DEFAULT 0,
    new_value INT NOT NULL,
    notes TEXT,
    approval_status VARCHAR(20) CHECK (
        approval_status IN (
            'pending',
            'approved',
            'rejected',
            'awaiting_audit',
            'audited'
        )
    ) DEFAULT 'pending',
    approved_by_user_id INT,
    approval_date TIMESTAMP NULL,
    update_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tally_value INT DEFAULT NULL,
    tally_status JSONB DEFAULT NULL,
    FOREIGN KEY (indicator_id) REFERENCES indicators(id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE
    SET NULL,
        FOREIGN KEY (approved_by_user_id) REFERENCES users(id) ON DELETE
    SET NULL
);
-- Notifications table
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    type VARCHAR(30) CHECK (
        type IN (
            'progress_update',
            'approval_needed',
            'approval_result',
            'budget_warning',
            'system'
        )
    ) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    related_indicator_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (related_indicator_id) REFERENCES indicators(id) ON DELETE CASCADE
);
-- Activities table
CREATE TABLE activities (
    id SERIAL PRIMARY KEY,
    indicator_id INT,
    description TEXT,
    category VARCHAR(20) CHECK (
        category IN (
            'personnel',
            'materials',
            'travel',
            'training',
            'equipment',
            'other'
        )
    ) DEFAULT 'other',
    cost DECIMAL(10, 2) DEFAULT 0.00,
    activity_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (indicator_id) REFERENCES indicators(id) ON DELETE CASCADE
);
-- KoboToolbox Integration Tables
CREATE TABLE kobo_config (
    id SERIAL PRIMARY KEY,
    server_url VARCHAR(255) NOT NULL DEFAULT 'https://kf.kobotoolbox.org',
    api_token VARCHAR(255),
    is_connected BOOLEAN DEFAULT FALSE,
    last_sync TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE kobo_form_links (
    id SERIAL PRIMARY KEY,
    kobo_form_uid VARCHAR(100) NOT NULL,
    kobo_form_name VARCHAR(255),
    indicator_id INT NOT NULL,
    sync_enabled BOOLEAN DEFAULT TRUE,
    last_synced_submission_id VARCHAR(100),
    submissions_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (indicator_id) REFERENCES indicators(id) ON DELETE CASCADE
);
CREATE TABLE kobo_submissions (
    id SERIAL PRIMARY KEY,
    kobo_submission_id VARCHAR(100) NOT NULL UNIQUE,
    kobo_form_uid VARCHAR(100) NOT NULL,
    indicator_id INT,
    submission_data JSONB,
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (indicator_id) REFERENCES indicators(id) ON DELETE CASCADE
);
-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_indicators_created_by ON indicators(created_by_user_id);
CREATE INDEX idx_indicators_status ON indicators(status);
CREATE INDEX idx_progress_updates_indicator ON progress_updates(indicator_id);
CREATE INDEX idx_progress_updates_approval_status ON progress_updates(approval_status);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);
CREATE INDEX idx_activities_indicator ON activities(indicator_id);
CREATE INDEX idx_kobo_form_links_indicator ON kobo_form_links(indicator_id);
CREATE INDEX idx_kobo_submissions_indicator ON kobo_submissions(indicator_id);