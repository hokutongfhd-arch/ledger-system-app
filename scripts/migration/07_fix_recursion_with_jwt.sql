-- Fix: Replace is_admin with non-recursive check using JWT
-- The previous DB-lookup implementation caused infinite recursion with RLS.
-- Since we verified metadata is now synced, using JWT is safer and faster.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Check 'role' in app_metadata.
  -- coalesce ensures it returns false instead of null if property is missing.
  RETURN COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-apply policies to be sure (though function replacement is enough if signature matches)
-- Just in case we need to refresh the plan.
NOTIFY pgrst, 'reload schema';
