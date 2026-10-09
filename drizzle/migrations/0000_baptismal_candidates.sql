CREATE TABLE public.baptismal_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  middle_name text,
  last_name text NOT NULL,
  gender text,
  birth_date date,
  civil_status text,
  phone text,
  email text,
  address text,
  membership_status text NOT NULL DEFAULT 'active',
  date_joined date,
  baptism_date date,
  ministry text,
  family_id uuid REFERENCES public.families(id) ON DELETE SET NULL,
  family_role text,
  notes text,
  anniversary_date date,
  spiritual_maturity text,
  is_baptized boolean NOT NULL DEFAULT false,
  applied_for_membership boolean NOT NULL DEFAULT false,
  interviewed_for_membership boolean NOT NULL DEFAULT false,
  transferred_at timestamptz,
  transferred_member_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.baptismal_candidates TO authenticated;
GRANT ALL ON public.baptismal_candidates TO service_role;
ALTER TABLE public.baptismal_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View candidates" ON public.baptismal_candidates FOR SELECT TO authenticated USING (public.has_capability(auth.uid(), 'view_members'));
CREATE POLICY "Manage candidates" ON public.baptismal_candidates FOR ALL TO authenticated USING (public.has_capability(auth.uid(), 'manage_members')) WITH CHECK (public.has_capability(auth.uid(), 'manage_members'));
CREATE TRIGGER baptismal_candidates_updated BEFORE UPDATE ON public.baptismal_candidates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.transfer_candidate_to_member(_candidate_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE c public.baptismal_candidates; _new uuid;
BEGIN
  IF NOT public.has_capability(auth.uid(), 'manage_members') THEN RAISE EXCEPTION 'Not allowed'; END IF;
  SELECT * INTO c FROM public.baptismal_candidates WHERE id = _candidate_id AND transferred_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Candidate not found or already transferred'; END IF;
  INSERT INTO public.members (first_name, middle_name, last_name, gender, birth_date, civil_status, phone, email, address, membership_status, date_joined, baptism_date, ministry, family_id, family_role, notes, anniversary_date, spiritual_maturity, created_by)
  VALUES (c.first_name, c.middle_name, c.last_name, c.gender, c.birth_date, c.civil_status, c.phone, c.email, c.address, 'active', COALESCE(c.date_joined, CURRENT_DATE), c.baptism_date, c.ministry, c.family_id, c.family_role, c.notes, c.anniversary_date, c.spiritual_maturity, auth.uid())
  RETURNING id INTO _new;
  UPDATE public.baptismal_candidates SET transferred_at = now(), transferred_member_id = _new WHERE id = c.id;
  RETURN _new;
END; $$;
REVOKE EXECUTE ON FUNCTION public.transfer_candidate_to_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_candidate_to_member(uuid) TO authenticated;