-- Migration: Cleanup Duplicate Audit Log Triggers (Fixed)
-- Objective: Remove triggers that insert into `audit_logs` for data manipulation (INSERT/UPDATE/DELETE).
-- These events are already captured in `logs` (Operation Log). `audit_logs` should be reserved for security events.

-- Attempt to drop triggers by common naming conventions found in previous analysis or standard conventions.
-- If they don't exist, these statements will simply do nothing (IF EXISTS).

-- Employees
DROP TRIGGER IF EXISTS "trg_audit_employees" ON "public"."employees";
DROP TRIGGER IF EXISTS "audit_employees" ON "public"."employees";
DROP TRIGGER IF EXISTS "trg_log_to_audit_employees" ON "public"."employees";

-- Devices (IPhones)
DROP TRIGGER IF EXISTS "trg_audit_iphones" ON "public"."iphones";
DROP TRIGGER IF EXISTS "audit_iphones" ON "public"."iphones";
DROP TRIGGER IF EXISTS "trg_audit_iphone" ON "public"."iphones";

-- Devices (Tablets)
DROP TRIGGER IF EXISTS "trg_audit_tablets" ON "public"."tablets";
DROP TRIGGER IF EXISTS "audit_tablets" ON "public"."tablets";
DROP TRIGGER IF EXISTS "trg_audit_tablet" ON "public"."tablets";

-- Devices (Routers)
DROP TRIGGER IF EXISTS "trg_audit_routers" ON "public"."routers";
DROP TRIGGER IF EXISTS "audit_routers" ON "public"."routers";
DROP TRIGGER IF EXISTS "trg_audit_router" ON "public"."routers";

-- Devices (Feature Phones) -> Corrected Table Name: featurephones
DROP TRIGGER IF EXISTS "trg_audit_featurephones" ON "public"."featurephones";
DROP TRIGGER IF EXISTS "audit_featurephones" ON "public"."featurephones";
DROP TRIGGER IF EXISTS "trg_audit_feature_phone" ON "public"."featurephones";
DROP TRIGGER IF EXISTS "audit_feature_phone" ON "public"."featurephones";
-- Also try singular/plural variations just in case triggers were named inconsistently
DROP TRIGGER IF EXISTS "trg_audit_feature_phones" ON "public"."featurephones";

-- Masters (Addresses)
DROP TRIGGER IF EXISTS "trg_audit_addresses" ON "public"."addresses";
DROP TRIGGER IF EXISTS "audit_addresses" ON "public"."addresses";
DROP TRIGGER IF EXISTS "trg_audit_address" ON "public"."addresses";

-- Masters (Areas)
DROP TRIGGER IF EXISTS "trg_audit_areas" ON "public"."areas";
DROP TRIGGER IF EXISTS "audit_areas" ON "public"."areas";
DROP TRIGGER IF EXISTS "trg_audit_area" ON "public"."areas";

-- Note: 'trg_log_...' triggers (e.g., trg_log_employees) are PRESERVED as they populate the 'logs' table (Operation Log).
