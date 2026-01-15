-- SECURITY DEFINER関数を使用して無限再帰を回避する管理者チェック
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM employees
    WHERE auth_id = auth.uid()
      AND authority = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 既存のINSERTポリシーを削除（存在する場合）
DROP POLICY IF EXISTS "Enable insert for admins" ON employees;
DROP POLICY IF EXISTS "Admins can insert employees" ON employees;

-- 新しいINSERTポリシーを作成
CREATE POLICY "Admins can insert employees"
ON employees FOR INSERT
WITH CHECK (
  is_admin() OR 
  -- 初期セットアップ用のアカウントID許可（必要であれば）
  auth.uid() = '00000000-0000-0000-0000-000000000000' 
);

-- SELECTポリシーも念のため確認・更新（無限再帰回避）
DROP POLICY IF EXISTS "Enable read access for all users" ON employees;
CREATE POLICY "Enable read access for all users"
ON employees FOR SELECT
USING (true);

-- UPDATEポリシー
DROP POLICY IF EXISTS "Admins can update employees" ON employees;
CREATE POLICY "Admins can update employees"
ON employees FOR UPDATE
USING (is_admin());

-- DELETEポリシー
DROP POLICY IF EXISTS "Admins can delete employees" ON employees;
CREATE POLICY "Admins can delete employees"
ON employees FOR DELETE
USING (is_admin());
