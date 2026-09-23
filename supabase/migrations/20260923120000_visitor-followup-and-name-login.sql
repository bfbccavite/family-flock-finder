-- Sunday visitor intake: counselling request, remarks, assigned staff, follow-up status
ALTER TABLE public.first_time_visitors
  ADD COLUMN IF NOT EXISTS wants_counselling BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS remarks TEXT
    CHECK (remarks IS NULL OR char_length(remarks) <= 5000),
  ADD COLUMN IF NOT EXISTS assigned_staff TEXT
    CHECK (assigned_staff IS NULL OR char_length(assigned_staff) <= 200),
  ADD COLUMN IF NOT EXISTS follow_up_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (follow_up_status IN ('pending', 'followed_up', 'met'));

-- Name-based login -----------------------------------------------------------
-- Staff sign in with their full name + password instead of email. The full name
-- is resolved to the account's sign-in email here so authentication still runs
-- against the same auth.users row. Roles, capabilities and admin positions are
-- unchanged: this only maps a display name to the existing login email.
CREATE OR REPLACE FUNCTION public.get_login_email(_full_name TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.email
  FROM public.profiles p
  WHERE p.active
    AND lower(btrim(p.full_name)) = lower(btrim(_full_name))
  ORDER BY p.created_at
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_login_email(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_login_email(TEXT) TO anon, authenticated;
