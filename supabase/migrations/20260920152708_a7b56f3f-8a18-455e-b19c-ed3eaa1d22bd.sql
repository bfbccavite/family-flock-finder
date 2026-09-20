REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_capability(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_active_staff(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.role_capabilities(public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.touch_last_login() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_capability(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_staff(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.role_capabilities(public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.touch_last_login() TO authenticated;