-- Fix RLS for audit_anomaly_rules
-- The previous policy relied on auth.jwt() ->> 'email' matching employee_code, 
-- but the app uses 'code@ledger-system.local' as the email.
-- Using auth.uid() matched against employees.auth_id is more robust.

DROP POLICY IF EXISTS admin_all_anomaly_rules ON audit_anomaly_rules;

CREATE POLICY admin_all_anomaly_rules ON audit_anomaly_rules
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM employees
    WHERE auth_id = auth.uid()
    AND authority = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM employees
    WHERE auth_id = auth.uid()
    AND authority = 'admin'
  )
);

-- Ensure anon can also see it if the app doesn't always have a strict session in the static client
-- Actually, the app seems to expect these rules to be readable by the trigger (which uses SECURITY DEFINER, so it's fine)
-- and the UI (which should be authenticated as admin).

-- If the static client is used without a session, we might need a bypass or to ensure it's authenticated.
-- For now, let's keep it restricted but correct the logic.
