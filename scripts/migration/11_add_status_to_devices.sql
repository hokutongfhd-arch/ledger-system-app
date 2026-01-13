-- iPhoneテーブルにstatusカラムを追加
ALTER TABLE iphones ADD COLUMN IF NOT EXISTS status text DEFAULT 'available';
-- 既存データのうち、社員コードが入っているものは「使用中(in-use)」に更新
UPDATE iphones SET status = 'in-use' WHERE employee_code IS NOT NULL AND status = 'available';

-- ガラホテーブルにstatusカラムを追加
ALTER TABLE featurephones ADD COLUMN IF NOT EXISTS status text DEFAULT 'available';
-- 既存データのうち、社員コードが入っているものは「使用中(in-use)」に更新
UPDATE featurephones SET status = 'in-use' WHERE employee_code IS NOT NULL AND status = 'available';

-- モバイルルーターテーブルにstatusカラムを追加
ALTER TABLE routers ADD COLUMN IF NOT EXISTS status text DEFAULT 'available';
-- 既存データのうち、社員コードが入っているものは「使用中(in-use)」に更新
UPDATE routers SET status = 'in-use' WHERE employee_code IS NOT NULL AND status = 'available';

-- コメント：
-- statusには以下の値が入ることを想定しています：
-- 'available' (在庫), 'in-use' (使用中), 'broken' (故障), 'discarded' (廃棄), 'repairing' (修理中), 'backup' (予備機)
 Jones
