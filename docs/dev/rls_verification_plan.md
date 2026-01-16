# RLS Verification Enhancement Plan

## Objective
Strengthen `verify_rls.js` to automatically detect configuration drifts, new unprotected tables, and dangerous policy lapses.

## Enhancement Specification

### 1. New Table Detection (Universal RLS Check)
**Goal**: Ensure ANY new table added to the database automatically fails verification if RLS is not enabled.

**Pseudocode (JS/Logic):**
```javascript
// 1. Fetch all public tables from metadata (pg_class/pg_namespace via RPC or specialized query)
const allTables = await getAllPublicTables(); // e.g., ['users', 'posts', 'comments', 'new_feature']

// 2. Iterate and check RLS status
for (const table of allTables) {
  if (!table.rls_enabled) {
    throw new Error(`CRITICAL: Table '${table.name}' has RLS DISABLED.`);
  }
}
```

### 2. Strict Anon/Public Access Deny
**Goal**: Enforce "Deny All" for anonymous users by default, with whitelist.

**Pseudocode:**
```javascript
const PUBLIC_READ_WHITELIST = ['device_manuals']; // Only this table allows Anon SELECT

for (const table of allTables) {
  // Try Anonymous SELECT
  const { data, error } = await anonClient.from(table).select('*').limit(1);
  
  if (!error && !PUBLIC_READ_WHITELIST.includes(table)) {
     // If we get data OR no error (empty list is ambiguous but usually error 'permission denied' is expected if policy absent)
     // Actually, if RLS is on and no policy allows Anon, it returns empty list (0 rows), NOT error.
     // To detect "Policy exists", we might need to inspect system catalogs or try to INSERT.
     
     // Better approach: Inspect pg_policies via Admin/Service RPC
     const policies = await getPoliciesForTable(table);
     const publicPolicies = policies.filter(p => p.roles.includes('anon') || p.roles.includes('public'));
     
     if (publicPolicies.length > 0) {
       if (table === 'device_manuals' && publicPolicies.every(p => p.cmd === 'SELECT')) {
         // OK
       } else {
         throw new Error(`CRITICAL: Table '${table}' has dangerous PUBLIC policies: ${publicPolicies.map(p => p.name)}`);
       }
     }
  }
}
```

### 3. Log Immutability Check (Delete Policy)
**Goal**: Use Inspection to ensure NO DELETE policy exists for logs.

**Pseudocode:**
```javascript
const LOG_TABLES = ['logs', 'audit_logs', 'app_logs', 'audit_reports'];

for (const table of LOG_TABLES) {
  const policies = await getPoliciesForTable(table);
  const deletePolicies = policies.filter(p => p.cmd === 'DELETE' || p.cmd === 'UPDATE');
  
  if (deletePolicies.length > 0) {
     throw new Error(`CRITICAL: Log Table '${table}' has MUTABLE policies (DELETE/UPDATE)! Manual Review Required.`);
  }
}
```

### 4. Admin Policy Audit
**Goal**: Ensure Admin policies differ from User policies. Simple heuristic check.

**Pseudocode:**
```javascript
// Check if "Select All" exists for Employees table for non-admins
// Simulate "User" login
const userClient = await signInAsUser();
const { data, error } = await userClient.from('employees').select('*'); // Try to fetch ALL

if (data && data.length > 1) {
   // If I see more than 1 record (myself), RLS is likely broken
   throw new Error(`CRITICAL: Regular User can see ${data.length} employees. Leaking PII.`);
}
```

## Implementation Strategy
- Create a new SQL function `get_schema_info` to expose `pg_class` and `pg_policies` safely to the verification script (via Service Role RPC).
- Rewrite `verify_rls.js` to use this schema-driven validation instead of checking hardcoded table lists.
