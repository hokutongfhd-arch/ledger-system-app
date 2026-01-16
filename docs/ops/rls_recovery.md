# Emergency RLS Recovery Procedure

## 🚨 Critical Situation Protocol

This document outlines the procedures to recover from RLS-related incidents, such as:
1.  **Admin Lockout**: No admins can access the system.
2.  **Service Disruption**: Valid users are blocked by overly strict policies.
3.  **Critical Data Fix**: Need to edit "Immutable" logs for legal/compliance reasons.

---

## 🛠 Prerequisites

- **Role**: Must have **Service Role** access (SUPABASE_SERVICE_ROLE_KEY).
- **Tool**: Supabase Dashboard SQL Editor or direct postgres connection.
- **Authority**: Must have approval from CTO/Security Lead.

---

## 🚑 Scenario 1: Partial Relaxation (Recommended)
If valid users are blocked, **temporarily disable RLS for specific tables** rather than globally.

### Action
Run in SQL Editor:
```sql
-- Example: Allow ALL access to 'employees' temporarily to fix permissions
ALTER TABLE public.employees DISABLE ROW LEVEL SECURITY;

-- ... Perform Fix ...

-- RE-ENABLE IMMEDIATELY
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
```

---

## 🚑 Scenario 2: Emergency Admin Access
If all Admin accounts are locked out or broken.

### Action
Use Service Role to manually promote a user or reset credentials.
```sql
-- Promote a specific user to Admin via SQL (Bypasses RLS)
UPDATE public.employees
SET authority = 'admin'
WHERE employee_code = 'TARGET_CODE';
```

---

## 🚑 Scenario 3: "Nuclear Option" (Global RLS Disable)
> [!CAUTION]
> **Extremely Dangerous.** This exposes ALL data to the public API if policies are missing.
> Only use if the entire production system is halted and debugging is impossible.

### Steps
1.  **Stop Frontend/API access** (Maintenance Mode) if possible.
2.  Run SQL:
    ```sql
    DO $$
    DECLARE r RECORD;
    BEGIN
      FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
        EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', r.tablename);
      END LOOP;
    END $$;
    ```
3.  **Perform Emergency Maintenance.**
4.  **Re-Apply Migration**: Run `supabase/migrations/20260116_rls_security_audit.sql` immediately after fix.

---

## 🛡 Verification after Recovery
After any emergency change, run the **Verification Script** to ensure security is restored.

```bash
node scripts/migration/verify_rls.js
```
