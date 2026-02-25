-- DB主導設計による整合性保証マイグレーション
-- 日付: 2026-02-25

--------------------------------------------------------------------------------
-- 0. 共通関数の作成
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

--------------------------------------------------------------------------------
-- 1. 全テーブルへのカラム追加・インデックス作成・トリガー設定
--------------------------------------------------------------------------------

DO $$
DECLARE
    t_name TEXT;
    tables TEXT[] := ARRAY['employees', 'addresses', 'areas', 'tablets', 'iphones', 'featurephones', 'routers'];
BEGIN
    FOREACH t_name IN ARRAY tables LOOP
        -- version カラム追加
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1', t_name);
        -- updated_at カラム追加
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()', t_name);
        
        -- (id, version) 複合インデックス作成
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (id, version)', 'idx_' || t_name || '_id_version', t_name);
        
        -- updated_at 自動更新トリガー設定
        EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', t_name);
        EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_modified_column()', t_name);
    END LOOP;
END $$;

--------------------------------------------------------------------------------
-- 2. 一意制約（UNIQUE）の追加
--------------------------------------------------------------------------------

-- employees
CREATE UNIQUE INDEX IF NOT EXISTS uk_employees_employee_code ON employees (employee_code);
CREATE UNIQUE INDEX IF NOT EXISTS uk_employees_email ON employees (email);

-- addresses (営業所)
CREATE UNIQUE INDEX IF NOT EXISTS uk_addresses_address_code ON addresses (address_code);
CREATE UNIQUE INDEX IF NOT EXISTS uk_addresses_no ON addresses (no);

-- areas
CREATE UNIQUE INDEX IF NOT EXISTS uk_areas_area_code ON areas (area_code);

-- tablets
CREATE UNIQUE INDEX IF NOT EXISTS uk_tablets_terminal_code ON tablets (terminal_code);

-- iphones
CREATE UNIQUE INDEX IF NOT EXISTS uk_iphones_phone_number ON iphones (phone_number);
CREATE UNIQUE INDEX IF NOT EXISTS uk_iphones_management_number ON iphones (management_number);

-- featurephones
CREATE UNIQUE INDEX IF NOT EXISTS uk_featurephones_phone_number ON featurephones (phone_number);
CREATE UNIQUE INDEX IF NOT EXISTS uk_featurephones_management_number ON featurephones (management_number);

-- routers
CREATE UNIQUE INDEX IF NOT EXISTS uk_routers_no ON routers (no);
CREATE UNIQUE INDEX IF NOT EXISTS uk_routers_terminal_code ON routers (terminal_code);
CREATE UNIQUE INDEX IF NOT EXISTS uk_routers_sim_number ON routers (sim_number);


--------------------------------------------------------------------------------
-- 3. RPC関数の作成 (SECURITY DEFINER + search_path)
--------------------------------------------------------------------------------

-- Employee 更新用 RPC
CREATE OR REPLACE FUNCTION update_employee_safe(
    p_id UUID,
    p_version INTEGER,
    p_employee_code TEXT,
    p_name TEXT,
    p_name_kana TEXT,
    p_email TEXT,
    p_gender TEXT,
    p_birthday DATE,
    p_join_date DATE,
    p_area_code TEXT,
    p_address_code TEXT,
    p_authority TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_affected INTEGER;
BEGIN
    -- 権限チェック (Admin または本人)
    IF NOT (
        (SELECT (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin') OR
        EXISTS (SELECT 1 FROM employees WHERE id = p_id AND auth_id = auth.uid())
    ) THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;

    UPDATE employees 
    SET 
        employee_code = p_employee_code,
        name = p_name,
        name_kana = p_name_kana,
        email = p_email,
        gender = p_gender,
        birthday = p_birthday,
        join_date = p_join_date,
        area_code = p_area_code,
        address_code = p_address_code,
        authority = p_authority,
        version = version + 1
    WHERE id = p_id AND version = p_version;

    GET DIAGNOSTICS v_affected = ROW_COUNT;
    RETURN v_affected > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 他のテーブル向けの汎用的な更新 RPC も必要に応じて作成するが、
-- まずは代表的な employees から。
