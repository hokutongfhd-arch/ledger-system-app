-- 社員マスタの無限ループ（再帰）問題を解消する修正SQL
-- 原因：同じテーブル内で権限チェックを行うポリシーが「無限ループ」を引き起こし、500エラーとなっていました。
-- 解決策：管理者チェックを専用の関数(SECURITY DEFINER)に切り出すことで、ループを回避します。

-- 1. 管理者判定のための関数を作成（無限ループ防止）
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.employees
    WHERE auth_id = auth.uid()
    AND authority = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 権限リセットと再構築
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- 既存の混乱している可能性のあるポリシーをすべて削除
DO $$
DECLARE pol record;
BEGIN
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'employees' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON employees', pol.policyname);
    END LOOP;
END $$;

-- 閲覧権限：全員（認証済みユーザーおよび匿名ユーザー）
CREATE POLICY "社員マスタの全ユーザー閲覧許可" 
ON employees FOR SELECT 
TO authenticated, anon 
USING (true);

-- 編集権限：管理者のみ
-- 関数を使用することで、自分自身のテーブルを再帰的にチェックするのを防ぎます
CREATE POLICY "管理者のみ登録可能" ON employees FOR INSERT TO authenticated WITH CHECK (check_is_admin());
CREATE POLICY "管理者のみ更新可能" ON employees FOR UPDATE TO authenticated USING (check_is_admin()) WITH CHECK (check_is_admin());
CREATE POLICY "管理者のみ削除可能" ON employees FOR DELETE TO authenticated USING (check_is_admin());

-- ロールに対する権限付与
GRANT SELECT ON employees TO authenticated, anon;
GRANT ALL ON employees TO authenticated;
