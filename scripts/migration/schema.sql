-- 1. Add auth_id column to link with Supabase Auth
ALTER TABLE employees ADD COLUMN IF NOT EXISTS auth_id UUID REFERENCES auth.users(id);

-- 2. Enable RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON employees FOR SELECT
  USING ( auth_id = auth.uid() );

-- 4. Policy: Admins can view all profiles
-- Note: This relies on app_metadata.role being set to 'admin'
CREATE POLICY "Admins can view all"
  ON employees FOR SELECT
  USING ( 
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' 
  );

-- Optional: Allow Service Role to do everything (for migration scripts)
-- Usually service_role bypasses RLS, but explicit policy can be safer if needed.
-- (Supabase default is that service_role bypasses RLS)
