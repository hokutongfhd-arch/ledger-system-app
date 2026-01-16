# Security Maturity Checklist (Self-Assessment)

**System**: LEDGER SYSTEM
**Assessor**: Security Architect

---

## ✅ Access Control
- [ ] **No Default Open**: Are all tables RLS enabled? (Yes)
- [ ] **Public Deny**: Is anonymous access blocked for all sensitive data? (Yes)
- [ ] **Least Privilege**: Does "User" role see ONLY what they need (Masters)? (Yes)
- [ ] **Scope Control**: Can users see ONLY their own PII (employees table)? (Yes)

## ✅ Integrity & Logs
- [ ] **Immutability**: Is `DELETE` blocked for `audit_logs` even for Admins? (Yes)
- [ ] **Source Assurance**: Are audit logs written ONLY by Trusted Backend (Service Role)? (Yes)
- [ ] **Coverage**: Do logs cover Login, Data Access, and Errors? (Yes)

## ✅ Operations & Resilience
- [ ] **Code as Policy**: Is RLS defined in SQL (Code), not manual UI clicks? (Yes)
- [ ] **Verification**: Is there an automated script (`verify_rls.js`) to prove security? (Yes)
- [ ] **Recovery**: Is there a documented procedure for Admin Lockout? (Yes)
- [ ] **Drift Detection**: Can we detect if someone manually disables RLS (`rls_safety_check.sql`)? (Yes)

---

## 📊 Maturity Rating
**Current Level: 4 (Managed & Measurable)**
*   Security is strictly defined, automated, and documented.
*   Next Level (5): Real-time drift remediation and AI-driven anomaly detection on logs.
