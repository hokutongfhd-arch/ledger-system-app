-- 社員マスタの閲覧権限を全ユーザーに開放
-- 誰でも（権限関係なく）社員のレコードが見れるように修正します。

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- 既存の閲覧制限ポリシーがある場合は削除
DROP POLICY IF EXISTS "Enable read usage for all users" ON employees;
DROP POLICY IF EXISTS "Enable read access for all" ON employees;
DROP POLICY IF EXISTS "Employees are viewable by everyone" ON employees;
DROP POLICY IF EXISTS "authenticated_read_employees" ON employees;

-- 全ユーザー（認証済みおよび匿名）に対して閲覧を許可
CREATE POLICY "Enable read usage for all users" ON employees
FOR SELECT TO authenticated, anon
USING (true);

-- ロールに対する権限付与
GRANT SELECT ON employees TO authenticated, anon;
