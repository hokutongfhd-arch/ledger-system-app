# Role Extension Guideline

## Purpose
This guide defines how to add new roles (e.g., `Auditor`, `Operator`) without breaking the existing security model.

---

## 1. Principles of Extension
1.  **Deny by Default**: Start with NO permissions. Explicitly adding a policy is safer than refining a broad one.
2.  **Don't Touch Existing Policies**: Do not modify "Admin" policies to accommodate "Auditor". Create a **new, separate policy** for the new role.
    *   *Bad*: `OR authority IN ('admin', 'auditor')` inside complex logic.
    *   *Good*: `CREATE POLICY "Auditor Select" ...`
3.  **Verify First**: Never deploy a new role without adding a test case to `verify_rls.js`.

---

## 2. Implementation Template

### Step 1: Database Change
Add the role to the `authority` enum or check (depending on implementation).
```sql
-- e.g.
ALTER TYPE public.authority_type ADD VALUE 'auditor';
```

### Step 2: Helper Function
Create a dedicated check function for readability and reuse.
```sql
CREATE FUNCTION public.is_auditor() RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM employees WHERE auth_id = auth.uid() AND authority = 'auditor');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Step 3: Policy Definition (RLS)
Apply policies per table. **Auditors usually need Read-Only access.**

```sql
-- Target: audit_logs
CREATE POLICY "audit_logs_auditor_select" 
ON public.audit_logs 
FOR SELECT 
TO authenticated 
USING ( public.is_auditor() );
```

---

## 3. Safety Checklist for New Roles

- [ ] Does this role need broad `SELECT` access? (If yes, audit PII risks).
- [ ] Does this role need `INSERT/UPDATE`? (Minimize write access strictly).
- [ ] Have you added a test in `scripts/migration/verify_rls.js`?
    ```javascript
    // Test: Auditor should read logs but NOT delete
    const auditorClient = ...
    ```
- [ ] Did you re-run `supabase/queries/rls_safety_check.sql`?
