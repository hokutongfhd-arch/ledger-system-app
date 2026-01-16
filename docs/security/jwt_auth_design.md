# Design Decision: Admin Role Lookup Strategy

## Context
We need to determine if a user has `Admin` privileges to enforce RLS policies.
There are two primary approaches in Supabase:
1.  **Database Lookup (Current)**: `EXISTS (SELECT 1 FROM employees ...)`
2.  **JWT Claims (Future Candidate)**: `(auth.jwt() ->> 'role') = 'admin'`

---

## Analysis

| Feature | Database Lookup (Current) | JWT Custom Claims (Future) |
| :--- | :--- | :--- |
| **Consistency** | **High** (Real-time). Revocation is instant. | **Medium**. Lags until token refresh (up to 1hr). |
| **Performance** | **Medium**. Requires Join/Subquery on every request. | **High**. CPU-only check, zero DB I/O. |
| **Complexity** | **Low**. Uses existing table structure. | **High**. Requires Auth Hook or Trigger to sync claims. |
| **Security Risk** | Low. Standard SQL logic. | Medium. Token theft implies prolonged access. |

---

## Decision
**We chose "Database Lookup" for the initial phase.**

### Rationale
1.  **Safety First**: Immediate revocation is critical for Admin accounts. If an Admin is fired, their access must stop *instantly*, not when the JWT expires.
2.  **Simplicity**: We already have an `employees` table. Synchronizing this state to `auth.users` metadata introduces distributed state complexity (race conditions, sync failures).
3.  **Scale**: With < 1000 users, the overhead of a primary key lookup (`employees.auth_id`) is negligible (microseconds).

---

## Migration Triggers (When to switch?)
We will switch to **JWT Claims** ONLY if:
1.  **Performance**: We observe measurable latency (>100ms) attributable solely to RLS subqueries under high load.
2.  **Architecture**: We split the Auth server from the DB completely (Microservices).

### Migration Plan (Draft)
1.  Implement a Postgres Trigger on `employees` table.
2.  On `INSERT/UPDATE` of `authority`, call Supabase Admin API to update `raw_app_meta_data`.
3.  Update RLS Policy:
    ```sql
    -- FROM
    USING (public.is_admin())
    -- TO
    USING (auth.jwt() ->> 'app_role' = 'admin')
    ```
