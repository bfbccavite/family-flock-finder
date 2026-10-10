CREATE OR REPLACE FUNCTION public.role_capabilities(_role app_role)
 RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$
  SELECT CASE _role
    WHEN 'super_admin' THEN ARRAY['manage_users','manage_settings','view_audit_log','manage_members','view_members','manage_attendance','view_attendance','manage_visitation','view_visitation','manage_visitors','view_visitors','view_reports','manage_bible_study_rules']
    WHEN 'secretary' THEN ARRAY['manage_members','view_members','manage_attendance','view_attendance','view_visitation','manage_visitors','view_visitors','view_reports','manage_bible_study_rules']
    WHEN 'assistant_secretary' THEN ARRAY['manage_members','view_members','manage_attendance','view_attendance','manage_visitors','view_visitors','view_reports','manage_bible_study_rules']
    WHEN 'ushering' THEN ARRAY['manage_attendance','view_attendance','manage_visitors','view_visitors']
    WHEN 'visitation' THEN ARRAY['view_members','manage_visitation','view_visitation','view_visitors']
    WHEN 'pastor_elder' THEN ARRAY['view_members','view_attendance','view_visitation','view_visitors','view_reports','manage_bible_study_rules']
    ELSE ARRAY[]::TEXT[]
  END
$function$;

CREATE TABLE public.bible_study_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  required_sessions integer NOT NULL DEFAULT 12 CHECK (required_sessions BETWEEN 1 AND 52),
  min_tenure_months integer NOT NULL DEFAULT 3 CHECK (min_tenure_months BETWEEN 0 AND 36),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.bible_study_settings TO authenticated;
GRANT ALL ON public.bible_study_settings TO service_role;
ALTER TABLE public.bible_study_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view bible study rules" ON public.bible_study_settings FOR SELECT TO authenticated USING (public.is_active_staff(auth.uid()));
CREATE POLICY "Leaders edit bible study rules" ON public.bible_study_settings FOR UPDATE TO authenticated
  USING (public.has_capability(auth.uid(), 'manage_bible_study_rules')) WITH CHECK (public.has_capability(auth.uid(), 'manage_bible_study_rules'));
INSERT INTO public.bible_study_settings (id) VALUES (1);
CREATE TRIGGER bible_study_settings_updated BEFORE UPDATE ON public.bible_study_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.bible_study_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id uuid REFERENCES public.first_time_visitors(id) ON DELETE SET NULL,
  first_name text NOT NULL,
  middle_name text,
  last_name text NOT NULL,
  gender text,
  birth_date date,
  civil_status text,
  phone text,
  email text,
  address text,
  religion text,
  anniversary_date date,
  notes text,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  sessions_attended integer[] NOT NULL DEFAULT '{}',
  promoted_at timestamptz,
  promoted_candidate_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bible_study_participants TO authenticated;
GRANT ALL ON public.bible_study_participants TO service_role;
ALTER TABLE public.bible_study_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View bible study" ON public.bible_study_participants FOR SELECT TO authenticated USING (public.has_capability(auth.uid(), 'view_visitors') OR public.has_capability(auth.uid(), 'view_members'));
CREATE POLICY "Manage bible study" ON public.bible_study_participants FOR ALL TO authenticated USING (public.has_capability(auth.uid(), 'manage_visitors')) WITH CHECK (public.has_capability(auth.uid(), 'manage_visitors'));
CREATE TRIGGER bible_study_participants_updated BEFORE UPDATE ON public.bible_study_participants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX bible_study_participants_start_idx ON public.bible_study_participants (start_date DESC);

CREATE OR REPLACE FUNCTION public.promote_participant_to_candidate(_participant_id uuid)
 RETURNS uuid LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE p public.bible_study_participants; s public.bible_study_settings; _new uuid;
BEGIN
  IF NOT public.has_capability(auth.uid(), 'manage_members') THEN RAISE EXCEPTION 'Not allowed'; END IF;
  SELECT * INTO p FROM public.bible_study_participants WHERE id = _participant_id AND promoted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Participant not found or already promoted'; END IF;
  SELECT * INTO s FROM public.bible_study_settings WHERE id = 1;
  IF cardinality(p.sessions_attended) < s.required_sessions OR p.start_date > (CURRENT_DATE - make_interval(months => s.min_tenure_months))::date THEN
    RAISE EXCEPTION 'Participant is not yet eligible for the baptismal class';
  END IF;
  INSERT INTO public.baptismal_candidates (first_name, middle_name, last_name, gender, birth_date, civil_status, phone, email, address, anniversary_date, notes, date_joined, created_by)
  VALUES (p.first_name, p.middle_name, p.last_name, p.gender, p.birth_date, p.civil_status, p.phone, p.email, p.address, p.anniversary_date, p.notes, CURRENT_DATE, auth.uid())
  RETURNING id INTO _new;
  UPDATE public.bible_study_participants SET promoted_at = now(), promoted_candidate_id = _new WHERE id = p.id;
  RETURN _new;
END; $function$;
REVOKE EXECUTE ON FUNCTION public.promote_participant_to_candidate(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.promote_participant_to_candidate(uuid) TO authenticated;