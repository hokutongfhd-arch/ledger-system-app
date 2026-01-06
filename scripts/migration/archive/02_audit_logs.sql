-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurred_at TIMESTAMPTZ DEFAULT NOW(),
    actor_auth_id UUID REFERENCES auth.users(id),
    actor_employee_code TEXT,
    actor_name TEXT,
    action_type TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    result TEXT,
    metadata JSONB,
    ip_address TEXT
);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view all audit logs
-- Assumes app_metadata.role is set to 'admin'
CREATE POLICY "Admins can view audit logs" 
    ON audit_logs 
    FOR SELECT 
    USING ( (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' );

-- Policy: Users can insert their own logs (or logs where they are the actor)
-- Strictly speaking, for login failures where user is not auth'd yet, we might need a broader policy 
-- or use a database function with SECURITY DEFINER. 
-- For now, allow authenticated users to insert.
CREATE POLICY "Authenticated users can insert audit logs" 
    ON audit_logs 
    FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_occurred_at ON audit_logs(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_type ON audit_logs(target_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_name ON audit_logs(actor_name);
