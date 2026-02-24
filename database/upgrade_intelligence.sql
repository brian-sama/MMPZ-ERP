
-- Projects Layer
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    donor TEXT,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE indicators
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id),
ADD COLUMN IF NOT EXISTS risk_level TEXT DEFAULT 'low',
ADD COLUMN IF NOT EXISTS auto_risk_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS performance_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP DEFAULT NOW();
