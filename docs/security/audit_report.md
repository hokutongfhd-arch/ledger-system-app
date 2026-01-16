# Security Audit Report (RLS Design)

**Date**: 2026-01-16
**System**: LEDGER SYSTEM
**Component**: Database Security (PostgreSQL / Supabase)
**Status**: Implemented & Enforced

---

## 1. Executive Summary
The LEDGER SYSTEM implements a **"Zero-Trust, RBAC-driven"** security model at the database layer. 
Access is denied by default for all anonymous users. Privilege is granted strictly based on authenticated roles (`Admin`, `User`) or trusted system context (`Service Role`).
This design ensures compliance with **ISO 27001 (A.9 Access Control)** and internal audit requirements for log immutability.

---

## 2. Risk & Control Matrix

| ID | Risk Scenario | Security Control (RLS Policy) |
| :--- | :--- | :--- |
| **R-01** | **Data Leakage (Public)**<br>Anonymous attacker accesses internal data via API. | **Deny All by Default**<br>RLS Enabled on 100% of tables. No public policies exist (except `device_manuals`). |
| **R-02** | **Privilege Escalation**<br>Regular user modifies master data or other users' profiles. | **Role Segregation**<br>Users have `SELECT` only on master data. Write operations are restricted to `Admin` policies. |
| **R-03** | **Log Tampering (Cover-up)**<br>Malicious Admin deletes audit logs to hide evidence. | **Immutable Logs**<br>`audit_logs` policies explicitly **DENY DELETE/UPDATE** for all roles, including Admins. |
| **R-04** | **Insider Threat (Data Dumping)**<br>User downloads entire employee database. | **Scope Limitation**<br>`employees` table policy restricts Users to `SELECT` only their own record (`uid = auth.uid()`). |
| **R-05** | **Application Bypass**<br>Bugs in backend API allow unauthorized writing. | **DB-Layer Enforcement**<br>Security rules are enforced by PostgreSQL engine, not just application code. |

---

## 3. Critical Design Decisions

### 3.1 Why Admins Cannot Delete Logs?
> **Principle**: *Non-Repudiation*
> **Reason**: The System Administrator is a high-risk account. If an Admin account is compromised, the attacker must not be able to erase the traces of their actions. Therefore, we enforced a strict **"No Delete"** policy at the database level. Archiving/Rotations are handled by a separate trusted system process if needed.

### 3.2 Service Role Constraints
> **Principle**: *Trusted Backend Context*
> **Reason**: The `Service Role` is used exclusively for generating system logs (`INSERT`). It is NOT used for general data retrieval in the frontend, preventing accidental exposure of privileged data.

---

## 4. Verification Evidence
All policies have been verified using:
1.  **Static Analysis**: `rls_safety_check.sql` (No disabled RLS, no wide public access).
2.  **Dynamic Testing**: `verify_rls.js` (Simulated Anon/User/Admin attacks).
