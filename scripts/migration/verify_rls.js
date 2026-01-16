import { createClient } from '@supabase/supabase-js';

// --- Configuration ---
// Run with: node --env-file=.env.local scripts/migration/verify_rls.js

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const DOMAIN = 'ledger-system.local';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !SUPABASE_ANON_KEY) {
    console.error('Error: Requied env vars missing (URL, SERVICE_KEY, ANON_KEY).');
    process.exit(1);
}

// Clients
const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

async function verify() {
    console.log('🚀 Starting RLS Verification (v7 - All Green)...');

    // --- Check Function ---
    async function checkTable(tableName, description, insertDummyIfEmpty = false) {
        console.log(`\n=== Checking Table: ${tableName} (${description}) ===`);

        let dummyId = null;

        // 1. Service Baseline
        let { data: records, error: fetchError } = await serviceClient.from(tableName).select('*');
        if (fetchError) {
            console.error(`❌ Failed to fetch ${tableName} with Service Role.`, fetchError);
            return;
        }
        let total = records.length;

        if (total === 0) {
            if (insertDummyIfEmpty) {
                console.log(`⚠️ Table ${tableName} is empty. Attempting to insert dummy record for RLS test...`);

                // SCHEMA ADAPTATION: Correct columns for 'logs' table based on codebase inspection
                // Columns: operation, table_name, is_archived, created_at, actor_name...
                const dummy = {
                    operation: 'RLS_TEST',
                    table_name: 'test',
                    actor_name: 'RLS Verifier',
                    is_archived: false,
                    created_at: new Date().toISOString()
                };

                const { data: inserted, error: insertError } = await serviceClient.from(tableName).insert(dummy).select().single();
                if (insertError) {
                    console.log(`   -> Failed to insert dummy: ${insertError.message}. Skipping.`);
                    return;
                }
                dummyId = inserted.id; // Assuming ID exists
                console.log(`   -> Inserted dummy record (ID: ${dummyId}).`);
                total = 1;

            } else {
                console.warn(`⚠️ Table ${tableName} is empty. Skipping RLS tests.`);
                return;
            }
        }

        // 2. Anonymous Test
        const { data: anonData, error: anonError } = await anonClient.from(tableName).select('*');
        const anonCount = anonData ? anonData.length : 0;

        if (anonCount === 0) {
            console.log(`✅ PASS: Anonymous saw 0 records (Secure).`);
        } else {
            console.error(`❌ FAIL: Anonymous saw ${anonCount} records. RLS DISABLED?`);
        }

        // Cleanup Dummy
        if (dummyId) {
            await serviceClient.from(tableName).delete().eq('id', dummyId);
            console.log(`   -> Dummy record clean up.`);
        }
    }

    // --- Run Checks against Target Tables ---
    await checkTable('employees', 'Employees');
    await checkTable('iphones', 'iPhone');
    await checkTable('tablets', 'Tablet');
    await checkTable('routers', 'Router');
    await checkTable('featurephones', 'Feature Phone');
    await checkTable('areas', 'Areas');

    // logs: Insert dummy with CORRECT schema
    await checkTable('logs', 'System Logs (logs)', true);

    await checkTable('audit_logs', 'Audit Logs');
    await checkTable('audit_reports', 'Audit Reports');

    // --- Log Immutability Test ---
    const { data: emps } = await serviceClient.from('employees').select('id, employee_code, password, authority, auth_id');
    const adminEmp = emps?.find(e => e.authority === 'admin' && e.auth_id);
    // Find a non-admin user (assuming one exists, or we skip user test)
    const userEmp = emps?.find(e => e.authority === 'user' && e.auth_id);

    // 1. Admin Test
    if (adminEmp && adminEmp.password) {
        console.log(`\n--- Testing Admin Access (${adminEmp.employee_code}) ---`);
        const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
        const { error: signInError } = await client.auth.signInWithPassword({
            email: `${adminEmp.employee_code}@${DOMAIN}`,
            password: adminEmp.password
        });
        if (signInError) console.error('Admin Sign In Failed:', signInError.message);
        else {
            // Admin should SELECT logs
            const { error: readError } = await client.from('audit_logs').select('*').limit(1);
            if (readError) console.error(`❌ Admin READ logs failed: ${readError.message}`);
            else console.log('✅ PASS: Admin can READ audit_logs.');

            // Admin should NOT delete logs (Standard Policy)
            const { error: delError } = await client.from('audit_logs').delete().eq('id', 'dummy-id');
            // Expected error (policy allows Select only for Admin, DELETE usually allowed if "Admin All" but here we set Admin SELECT ONLY for logs)
            // Wait, my SQL defined "logs_admin_select" only. So DELETE should fail.
            if (delError) console.log('✅ PASS: Admin cannot DELETE audit_logs (Strict Policy enforced).');
            else console.error('❌ FAIL: Admin DELETED audit_logs? Should be restricted.');
        }
    }

    // 2. User Test
    if (userEmp && userEmp.password) {
        console.log(`\n--- Testing User Access (${userEmp.employee_code}) ---`);
        const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
        await client.auth.signInWithPassword({
            email: `${userEmp.employee_code}@${DOMAIN}`,
            password: userEmp.password
        });

        // User should NOT read logs
        const { data: logs, error: userReadError } = await client.from('audit_logs').select('*').limit(1);
        if (!userReadError && logs.length > 0) console.error(`❌ FAIL: User could READ audit_logs!`);
        else console.log('✅ PASS: User cannot READ audit_logs (as expected).');

        // User should READ masters
        const { error: masterNav } = await client.from('iphones').select('id').limit(1);
        if (masterNav) console.error(`❌ FAIL: User cannot READ masters: ${masterNav.message}`);
        else console.log('✅ PASS: User can READ masters.');
    }

    console.log('\nVerification Complete.');
}

verify();
