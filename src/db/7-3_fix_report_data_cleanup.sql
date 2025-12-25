-- Phase 7-3: Fix Report Type Constraint (Data Cleanup Version)
-- 目的: 既存の不整合データを修正した上で制約を再適用します。

-- 1. 既存の不整合なデータを 'summary' に強制的に更新する
-- (現在許可されていない値が入っているために制約追加が失敗しているため)
UPDATE audit_reports 
SET report_type = 'summary' 
WHERE report_type NOT IN ('summary', 'detailed', 'periodic', 'on-demand') 
   OR report_type IS NULL;

-- 2. 既存の制約を削除（念のため）
ALTER TABLE audit_reports DROP CONSTRAINT IF EXISTS audit_reports_report_type_check;

-- 3. 新しい制約を追加
ALTER TABLE audit_reports ADD CONSTRAINT audit_reports_report_type_check 
CHECK (report_type IN ('summary', 'detailed', 'periodic', 'on-demand'));

-- 4. 結果の確認
SELECT report_type, count(*) FROM audit_reports GROUP BY report_type;
