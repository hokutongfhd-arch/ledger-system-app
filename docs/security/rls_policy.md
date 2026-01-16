# RLS Security Policy

## 🔒 Architecture Philosophy
The LEDGER SYSTEM adopts a **"Deny by Default"** strategy using PostgreSQL Row Level Security (RLS).

1.  **Strict Isolation**: Public (Anonymous) users have **NO ACCESS** to system data (except public manuals).
2.  **Role-Based Access**:
    *   **Admin**: Full Control (except Log deletion).
    *   **User**: Read-Only access to Assets/Masters.
    *   **Service**: Backend-only privileges for Logging.
3.  **Immutable Logs**: Audit logs are write-only (INSERT) and cannot be modified even by Admins.

---

## 📊 Permission Matrix

| Table Category | Tables | Anon | User | Admin | Service |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Logs** | `logs`, `app_logs`, `audit_*` | ❌ | ❌ | **SELECT** | **INSERT** |
| **Masters** | `addresses`, `areas`, etc. | ❌ | **SELECT** | **ALL** | - |
| **Assets** | `iphones`, `routers`, etc. | ❌ | **SELECT** | **ALL** | - |
| **Employees** | `employees` | ❌ | **SELECT (Self)** | **ALL** | - |
| **Public** | `device_manuals` | **SELECT** | **SELECT** | **ALL** | - |

---

## ⚠️ Anti-Patterns (Forbidden)
Do **NOT** do the following during development:

1.  ❌ **Granting "Public Select" to everything**:
    *   *Bad*: `CREATE POLICY "Enable read for all" ... USING (true);`
    *   *Good*: Clearly specify role `TO authenticated`.

2.  ❌ **Disabling RLS on new tables**:
    *   All new tables must have `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`.

3.  ❌ **Using "Service Role" in Frontend**:
    *   `supabase-js` client in the browser must NEVER use the Service Role Key.

---

## 🆕 New Table Checklist
When adding a new table (e.g., `feature_requests`):

- [ ] Run `ALTER TABLE public.feature_requests ENABLE ROW LEVEL SECURITY;`
- [ ] Define **Admin Policy** (Select/Insert/Update/Delete).
- [ ] Define **User Policy** (Select? Insert? Own records only?).
- [ ] Verify `verify_rls.js` (Add checks if necessary).
