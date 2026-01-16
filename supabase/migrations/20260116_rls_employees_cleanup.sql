-- Clean up conflicting/insecure policies
-- RLS policies are additive (OR logic). If one allows access, access is granted.
-- We must remove the broad "public" or "anon" policies to secure the table.

DROP POLICY IF EXISTS "Admins can delete employees" ON "public"."employees";
DROP POLICY IF EXISTS "Admins can insert employees" ON "public"."employees";
DROP POLICY IF EXISTS "Admins can update employees" ON "public"."employees";
DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."employees";
DROP POLICY IF EXISTS "管理者のみ更新可能" ON "public"."employees";
DROP POLICY IF EXISTS "管理者のみ削除可能" ON "public"."employees";
DROP POLICY IF EXISTS "管理者のみ登録可能" ON "public"."employees";
DROP POLICY IF EXISTS "社員マスタの全ユーザー閲覧許可" ON "public"."employees";

-- Ensure the correct policies exist (re-run just in case, though CREATE POLICY usually fails if exists)
-- Using IF NOT EXISTS logic via DO block or just relying on user having run the previous one.
-- Let's just focus on DROP here to clean the slate.
