-- 社員マスタの権限リセットと再構築
-- 修正内様：
-- 1. 全てのユーザー（権限関係なく、未ログイン含む）が社員レコードを閲覧できるようにします。
-- 2. 新規登録、更新、削除は管理者（authority = 'admin'）のみが実行できるように制限します。

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- 既存のすべてのポリシーを削除してクリーンな状態にする
DO $$
DECLARE pol record;
BEGIN
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'employees' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON employees', pol.policyname);
    END LOOP;
END $$;

-- 1. 閲覧権限：全員（認証済みユーザーおよび匿名ユーザー）
CREATE POLICY "社員マスタの全ユーザー閲覧許可" 
ON employees FOR SELECT 
TO authenticated, anon 
USING (true);

-- 2. 編集権限：管理者のみ
-- 条件：認証済みであり、employeesテーブル内での自身のauthorityが'admin'であること
CREATE POLICY "管理者のみ編集可能" 
ON employees FOR ALL 
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM employees
        WHERE auth_id = auth.uid()
        AND authority = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM employees
        WHERE auth_id = auth.uid()
        AND authority = 'admin'
    )
);

-- ロールに対する権限付与
GRANT SELECT ON employees TO authenticated, anon;
GRANT ALL ON employees TO authenticated;
