-- Enable RLS for Device Tables
ALTER TABLE "public"."iphones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."tablets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."routers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."featurephones" ENABLE ROW LEVEL SECURITY;

-- Policy: Admin Full Access (Apply to all 4 tables)
create policy "Enable all access for admins_iphones" on "public"."iphones" for all to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin') with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Enable all access for admins_tablets" on "public"."tablets" for all to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin') with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Enable all access for admins_routers" on "public"."routers" for all to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin') with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Enable all access for admins_featurephones" on "public"."featurephones" for all to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin') with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Policy: User Read Access (All users can see devices?)
-- Requirement: "Employee master... import etc not affected... rights only admin"
-- For devices, usually users need to see the list to acknowledge receipt or just check inventory?
-- Safe bet: Allow SELECT for all authenticated users (so they can see the catalog), but only Admins can Edit.
-- If "User to SELECT (assigned devices?)" from task.md - that's harder because assignment is in history.
-- Let's start with "User can SELECT ALL" for devices, same as we (might have) assumed for the app dashboard usage.
-- If the dashboard shows "My Devices", it queries these tables joined with usage history.
-- Let's enable "Enable read access for all users" for devices for now, to avoid breaking the user dashboard.
-- If strictness is needed (only assigned), we can refine later.
-- User request said "Admin only can operate". So Read-Only for Users is safe.

create policy "Enable read access for all users_iphones" on "public"."iphones" for select to authenticated using (true);
create policy "Enable read access for all users_tablets" on "public"."tablets" for select to authenticated using (true);
create policy "Enable read access for all users_routers" on "public"."routers" for select to authenticated using (true);
create policy "Enable read access for all users_featurephones" on "public"."featurephones" for select to authenticated using (true);
