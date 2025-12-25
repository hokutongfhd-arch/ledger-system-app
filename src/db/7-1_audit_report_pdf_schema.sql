-- Phase 7-1: 監査レポートPDF管理用のスキーマ拡張
-- 目的: 生成されたPDFの履歴管理と証跡の保存を可能にします。

-- 1. 既存の audit_reports テーブルの拡張
DO $$ 
BEGIN
    -- レポート作成者 (社員コード等)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_reports' AND column_name='generated_by') THEN
        ALTER TABLE audit_reports ADD COLUMN generated_by text;
    END IF;

    -- レポート作成者の名前 (スナップショット)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_reports' AND column_name='generated_by_name') THEN
        ALTER TABLE audit_reports ADD COLUMN generated_by_name text;
    END IF;

    -- PDFデータのパス (Supabase Storage等を使用する場合)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_reports' AND column_name='pdf_path') THEN
        ALTER TABLE audit_reports ADD COLUMN pdf_path text;
    END IF;

    -- チェックサム (改竄検知用)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_reports' AND column_name='checksum') THEN
        ALTER TABLE audit_reports ADD COLUMN checksum text;
    END IF;

    -- period_start / period_end が timestamptz であることを確認
    -- (既存が text の場合は必要に応じてキャストを検討しますが、一旦放置します)
END $$;

-- 2. 操作ログの種別追加 (制約はないが、ルールとして定義)
-- REPORT_GENERATE

-- [注] audit_reports への RLS ポリシーは既存のものを引き継ぎます。
