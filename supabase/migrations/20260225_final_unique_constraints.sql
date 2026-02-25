-- 最終整合性強化 Migration (物理削除前提)

-- 1. iphones
ALTER TABLE iphones ADD CONSTRAINT iphones_management_number_key UNIQUE (management_number);
ALTER TABLE iphones ADD CONSTRAINT iphones_phone_number_key UNIQUE (phone_number);

-- 2. featurephones
ALTER TABLE featurephones ADD CONSTRAINT featurephones_management_number_key UNIQUE (management_number);
ALTER TABLE featurephones ADD CONSTRAINT featurephones_phone_number_key UNIQUE (phone_number);

-- 3. tablets
ALTER TABLE tablets ADD CONSTRAINT tablets_terminal_code_key UNIQUE (terminal_code);

-- 4. routers
ALTER TABLE routers ADD CONSTRAINT routers_terminal_code_key UNIQUE (terminal_code);
ALTER TABLE routers ADD CONSTRAINT routers_sim_number_key UNIQUE (sim_number);

-- 5. areas
ALTER TABLE areas ADD CONSTRAINT areas_area_name_key UNIQUE (area_name);

-- 6. addresses
ALTER TABLE addresses ADD CONSTRAINT addresses_address_code_key UNIQUE (address_code);
-- ※ office_name は重複許容のため追加しない
