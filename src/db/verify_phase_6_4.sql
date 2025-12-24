-- Phase 6-4 Verification SQL
-- Run these queries one by one to verify the implementation.

-- ---------------------------------------------------------
-- 1. Test "Medium" Severity (First After-Hours Access)
-- ---------------------------------------------------------
-- Scenario: "hanako-tanaka" accesses the system at 22:00 JST (After hours).
-- Expectation: 
--   1. An 'ANOMALY_DETECTED' log is automatically created.
--   2. Severity is 'medium' (First occurrence).
--   3. Frontend shows Blue/Yellow Toast (depending on setting) & Yellow Badge.

INSERT INTO audit_logs (
    action_type, 
    actor_name, 
    actor_employee_code, 
    target_type, 
    target_id, 
    ip_address, 
    occurred_at
) VALUES (
    'LOGIN_SUCCESS', 
    '田中ハナコ', 
    'EMP001', 
    'system', 
    'login', 
    '192.168.1.100', 
    CURRENT_DATE + TIME '22:00:00+09' -- Use today's date but force 22:00 JST
);


-- ---------------------------------------------------------
-- 2. Test "High" Severity (Repeated Access)
-- ---------------------------------------------------------
-- Scenario: Same user "hanako-tanaka" accesses again 10 minutes later (22:10 JST).
-- Expectation:
--   1. Another 'ANOMALY_DETECTED' log is created.
--   2. Severity is 'high' (Repeated within 30 mins).
--   3. Frontend shows Orange Toast & Orange Badge.

INSERT INTO audit_logs (
    action_type, 
    actor_name, 
    actor_employee_code, 
    target_type, 
    target_id, 
    ip_address, 
    occurred_at
) VALUES (
    'VIEW_PAGE', 
    '田中ハナコ', 
    'EMP001', 
    'employee_list', 
    'page_view', 
    '192.168.1.100', 
    CURRENT_DATE + TIME '22:10:00+09' -- 10 mins after previous
);

-- ---------------------------------------------------------
-- 3. Test "Critical" Severity (Manual Insert)
-- ---------------------------------------------------------
-- Scenario: Manually inserting a Critical/Fatal anomaly (e.g., detected by external system or admin).
-- Note: The trigger logic currently only assigns Medium/High. Critical is reserved.
-- Expectation:
--   1. Frontend shows Red Toast (Persistent) & Red Badge.
--   2. Dashboard shows "Critical" slice in Chart.

INSERT INTO audit_logs (
    action_type, 
    actor_name, 
    actor_employee_code, 
    target_type, 
    target_id, 
    result,
    -- details, 
    severity, -- Manual assignment
    occurred_at,
    metadata
) VALUES (
    'ANOMALY_DETECTED', 
    'Unknown Attacker', 
    'UNKNOWN', 
    'security', 
    'brute_force', 
    'failure',
    -- 'Multiple failed login attempts from blocked IP',
    'critical', -- Set Critical
    now(),
    jsonb_build_object('details', 'Multiple failed login attempts from blocked IP')
);

-- ---------------------------------------------------------
-- 4. Verify Dashboard Data (Check DB content)
-- ---------------------------------------------------------
-- Check current breakdown of severities in DB.

SELECT severity, COUNT(*) as count
FROM audit_logs
WHERE action_type = 'ANOMALY_DETECTED'
GROUP BY severity;

-- ---------------------------------------------------------
-- 5. Cleanup (Optional: Reset for testing)
-- ---------------------------------------------------------
-- DELETE FROM audit_logs WHERE action_type = 'ANOMALY_DETECTED';
-- UPDATE audit_logs SET is_acknowledged = true WHERE action_type = 'ANOMALY_DETECTED';
