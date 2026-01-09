-- Phase 10-1: 監査ログ(audit_logs)へのアーカイブ用カラム追加
-- 目的: アーカイブ機能で必要な is_archived カラムが不足していたため追加します。

DO $$ 
BEGIN
    -- is_archived カラムの追加
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='is_archived') THEN
        ALTER TABLE audit_logs ADD COLUMN is_archived BOOLEAN DEFAULT false;
    END IF;

    -- archived_at カラムの追加
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='archived_at') THEN
        ALTER TABLE audit_logs ADD COLUMN archived_at TIMESTAMPTZ;
    END IF;
END $$;

-- インデックス作成（パフォーマンス向上のため）
CREATE INDEX IF NOT EXISTS idx_audit_logs_is_archived ON audit_logs(is_archived);
