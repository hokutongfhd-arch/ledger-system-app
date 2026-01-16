-- Enable RLS for all remaining tables
ALTER TABLE "public"."iphone_usage_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."tablet_usage_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."router_usage_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."featurephone_usage_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."areas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."addresses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."memos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."app_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."audit_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."audit_anomaly_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."device_manuals" ENABLE ROW LEVEL SECURITY;

-- 1. Admin Full Access (Business Data & Config)
-- Usage History, Masters, Memos, Manuals, Audit Rules, Audit Reports (Reports might need deletion?)
-- Let's assume Audit Reports are also log-like and should be immutable? 
-- Usually reports are results. Let's make Reports immutable too just to be safe, or allow Admin to manage?
-- User said "System logs". Let's stick to true "logs".
create policy "Enable all access for admins_iphone_hist" on "public"."iphone_usage_history" for all to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin') with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Enable all access for admins_tablet_hist" on "public"."tablet_usage_history" for all to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin') with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Enable all access for admins_router_hist" on "public"."router_usage_history" for all to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin') with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Enable all access for admins_feature_hist" on "public"."featurephone_usage_history" for all to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin') with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Enable all access for admins_areas" on "public"."areas" for all to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin') with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Enable all access for admins_addresses" on "public"."addresses" for all to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin') with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Enable all access for admins_memos" on "public"."memos" for all to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin') with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Enable all access for admins_manuals" on "public"."device_manuals" for all to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin') with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Enable all access for admins_audit_rules" on "public"."audit_anomaly_rules" for all to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin') with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- 2. Admin Read-Only (Immutable System Logs)
-- Logs, audit_logs, app_logs
create policy "Enable read access for admins_logs" on "public"."logs" for select to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Enable read access for admins_app_logs" on "public"."app_logs" for select to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Enable read access for admins_audit_logs" on "public"."audit_logs" for select to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Enable read access for admins_audit_repl" on "public"."audit_reports" for select to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- 3. User Read Access (Business Data only)
-- History, Masters, Memos, Manuals
create policy "Enable read access for all users_iphone_hist" on "public"."iphone_usage_history" for select to authenticated using (true);
create policy "Enable read access for all users_tablet_hist" on "public"."tablet_usage_history" for select to authenticated using (true);
create policy "Enable read access for all users_router_hist" on "public"."router_usage_history" for select to authenticated using (true);
create policy "Enable read access for all users_feature_hist" on "public"."featurephone_usage_history" for select to authenticated using (true);

create policy "Enable read access for all users_areas" on "public"."areas" for select to authenticated using (true);
create policy "Enable read access for all users_addresses" on "public"."addresses" for select to authenticated using (true);
create policy "Enable read access for all users_memos" on "public"."memos" for select to authenticated using (true);
create policy "Enable read access for all users_manuals" on "public"."device_manuals" for select to authenticated using (true);
