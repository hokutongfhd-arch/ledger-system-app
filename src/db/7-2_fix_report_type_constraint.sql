-- Phase 7-2: Fix Report Type Constraint
-- 目的: 'summary' および 'detailed' を有効なレポート種別として許可します。

-- 1. 既存の制約を削除
ALTER TABLE audit_reports DROP CONSTRAINT IF EXISTS audit_reports_report_type_check;

-- 2. 新しい制約を追加 (summary, detailed を含める)
ALTER TABLE audit_reports ADD CONSTRAINT audit_reports_report_type_check 
CHECK (report_type IN ('summary', 'detailed', 'periodic', 'on-demand'));

-- 3. ついでに現在の設定を確認
SELECT 
    conname AS constraint_name, 
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint 
WHERE conrelid = 'audit_reports'::regclass;
