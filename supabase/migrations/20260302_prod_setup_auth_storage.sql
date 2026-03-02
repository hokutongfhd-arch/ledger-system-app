-- -----------------------------------------------------------------------------
-- 本番環境移行用: Authentication/Users と Storage/Files/manuals の設定マイグレーション
-- -----------------------------------------------------------------------------

-- ==========================================
-- 1. Storage/Files/manuals の設定
-- ==========================================

-- 'manuals' バケットを作成（既に存在する場合はスキップ）
-- セキュリティのため、publicアクセスはfalse（認証必須）とします。
INSERT INTO storage.buckets (id, name, public)
VALUES ('manuals', 'manuals', false)
ON CONFLICT (id) DO NOTHING;

-- RLS（Row Level Security）を有効化
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 既存のポリシーをクリア（再実行可能にするため）
DROP POLICY IF EXISTS "manuals_admin_all" ON storage.objects;
DROP POLICY IF EXISTS "manuals_user_select" ON storage.objects;

-- 管理者（admin）向けのフルアクセス（アップロード・更新・削除など）ポリシー
-- public.is_admin() を利用して管理者を判定します。
CREATE POLICY "manuals_admin_all" ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'manuals' AND public.is_admin())
  WITH CHECK (bucket_id = 'manuals' AND public.is_admin());

-- 一般ログインユーザー（authenticated）向けの読み取り専用ポリシー
-- 認証済みユーザーであればダウンロード/閲覧を許可します。
CREATE POLICY "manuals_user_select" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'manuals');

-- ==========================================
-- 2. Authentication/Users の設定について
-- ==========================================
-- Supabaseの auth.users テーブルや認証プロバイダ（メール/パスワードなど）の設定は、
-- 原則として Supabase Dashboard の UI （Authentication > Providers等）で設定します。
--
-- ただし、本番環境の初期セットアップとして「システム管理者」などの
-- 初期ユーザーを作成する必要がある場合は、アプリケーション側からのサインアップ、
-- もしくはSupabaseのAdmin API/Dashboard経由で手動作成することを推奨します。
--
-- ※ マイグレーションファイルに直接パスワードを含む auth.users へのINSERTを記述するのは
--    セキュリティリスクとなるため、インフラ/CIのスクリプトで環境変数を用いて
--    初期ユーザーを作成するアプローチが一般的です。
