CREATE OR REPLACE FUNCTION public.touch_last_login()
 RETURNS void
 LANGUAGE sql
 SECURITY INVOKER
 SET search_path TO 'public'
AS $$
  UPDATE public.profiles SET last_login_at = now() WHERE id = auth.uid()
$$;