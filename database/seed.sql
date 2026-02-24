-- MMPZ Seed Data for PostgreSQL/Supabase
-- Initial data for testing and development

-- Note: Passwords are plaintext for initial setup
-- They should be hashed with bcrypt before production use

-- Insert default users (using plaintext passwords for initial setup)
-- These can be changed after first login
INSERT INTO users (name, email, role, password_hash) VALUES 
('System Admin', 'brianmagagula5@gmail.com', 'admin', E'Brian7350$@#'),
('Director Sarah', 'sarah@mmpz.org', 'director', 'director123'),
('Officer Tinashe', 'tinashe@mmpz.org', 'officer', 'officer123'),
('Intern Mandla', 'mandla@mmpz.org', 'intern', 'intern123');

-- Insert sample indicators
INSERT INTO indicators (title, target_value, current_value, total_budget, current_budget_balance, created_by_user_id, priority)
VALUES 
('Digital Literacy Campaign', 500, 125, 2000.00, 1500.00, 1, 'high'),
('Youth Empowerment Workshop', 200, 50, 1500.00, 1200.00, 1, 'medium'),
('Community Outreach Program', 1000, 300, 5000.00, 4000.00, 1, 'critical');

-- Insert sample notifications
INSERT INTO notifications (user_id, type, title, message, related_indicator_id) VALUES
(1, 'system', 'Welcome to MMPZ', 'Your M&E system is now set up and ready to use.', NULL),
(2, 'approval_needed', 'Progress Update Pending', 'A progress update for Digital Literacy Campaign needs your approval.', 1);

-- Initialize Kobo config
INSERT INTO kobo_config (server_url, api_token, is_connected) VALUES 
('https://kf.kobotoolbox.org', '', FALSE);
