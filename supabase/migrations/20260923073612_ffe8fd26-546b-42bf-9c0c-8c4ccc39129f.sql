CREATE TABLE public.first_time_visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complete_name TEXT NOT NULL CHECK (char_length(complete_name) BETWEEN 1 AND 150),
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  birth_date DATE,
  address TEXT CHECK (address IS NULL OR char_length(address) <= 1000),
  contact_number TEXT CHECK (contact_number IS NULL OR char_length(contact_number) <= 40),
  religion TEXT CHECK (religion IS NULL OR char_length(religion) <= 100),
  discovery_source TEXT CHECK (discovery_source IS NULL OR char_length(discovery_source) <= 500),
  wants_to_know_christ BOOLEAN NOT NULL DEFAULT false,
  wants_bible_study BOOLEAN NOT NULL DEFAULT false,
  wants_prayer BOOLEAN NOT NULL DEFAULT false,
  recorded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.first_time_visitors TO authenticated;
GRANT ALL ON public.first_time_visitors TO service_role;
ALTER TABLE public.first_time_visitors ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.role_capabilities(_role public.app_role)
RETURNS TEXT[] LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _role
    WHEN 'super_admin' THEN ARRAY['manage_users','manage_settings','view_audit_log','manage_members','view_members','manage_attendance','view_attendance','manage_visitation','view_visitation','manage_visitors','view_visitors','view_reports']
    WHEN 'secretary' THEN ARRAY['manage_members','view_members','manage_attendance','view_attendance','view_visitation','manage_visitors','view_visitors','view_reports']
    WHEN 'assistant_secretary' THEN ARRAY['manage_members','view_members','manage_attendance','view_attendance','manage_visitors','view_visitors','view_reports']
    WHEN 'ushering' THEN ARRAY['manage_attendance','view_attendance','manage_visitors','view_visitors']
    WHEN 'visitation' THEN ARRAY['view_members','manage_visitation','view_visitation','view_visitors']
    WHEN 'pastor_elder' THEN ARRAY['view_members','view_attendance','view_visitation','view_visitors','view_reports']
    ELSE ARRAY[]::TEXT[]
  END
$$;

CREATE POLICY "View first-time visitors" ON public.first_time_visitors
  FOR SELECT TO authenticated
  USING (public.has_capability(auth.uid(), 'view_visitors'));
CREATE POLICY "Manage first-time visitors" ON public.first_time_visitors
  FOR ALL TO authenticated
  USING (public.has_capability(auth.uid(), 'manage_visitors'))
  WITH CHECK (public.has_capability(auth.uid(), 'manage_visitors'));

CREATE TRIGGER first_time_visitors_updated
  BEFORE UPDATE ON public.first_time_visitors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX first_time_visitors_visit_date_idx
  ON public.first_time_visitors (visit_date DESC);
CREATE INDEX first_time_visitors_created_at_idx
  ON public.first_time_visitors (created_at DESC);