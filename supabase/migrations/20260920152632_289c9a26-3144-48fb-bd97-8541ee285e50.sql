-- Roles ---------------------------------------------------------------
CREATE TYPE public.app_role AS ENUM (
  'super_admin','secretary','assistant_secretary','ushering','visitation','pastor_elder'
);

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Helpers -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.role_capabilities(_role public.app_role)
RETURNS TEXT[] LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _role
    WHEN 'super_admin' THEN ARRAY['manage_users','manage_settings','view_audit_log','manage_members','view_members','manage_attendance','view_attendance','manage_visitation','view_visitation','view_reports']
    WHEN 'secretary' THEN ARRAY['manage_members','view_members','manage_attendance','view_attendance','view_visitation','view_reports']
    WHEN 'assistant_secretary' THEN ARRAY['manage_members','view_members','manage_attendance','view_attendance','view_reports']
    WHEN 'ushering' THEN ARRAY['manage_attendance','view_attendance']
    WHEN 'visitation' THEN ARRAY['view_members','manage_visitation','view_visitation']
    WHEN 'pastor_elder' THEN ARRAY['view_members','view_attendance','view_visitation','view_reports']
    ELSE ARRAY[]::TEXT[]
  END
$$;

CREATE OR REPLACE FUNCTION public.has_capability(_user_id UUID, _capability TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _user_id
      AND p.active
      AND _capability = ANY (public.role_capabilities(ur.role))
  )
$$;

CREATE OR REPLACE FUNCTION public.is_active_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND active)
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, ''),
    NEW.raw_user_meta_data->>'phone',
    COALESCE((NEW.raw_user_meta_data->>'active')::boolean, true)
  )
  ON CONFLICT (id) DO NOTHING;

  BEGIN
    _role := (NEW.raw_user_meta_data->>'role')::public.app_role;
  EXCEPTION WHEN others THEN _role := NULL;
  END;

  IF _role IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_last_login()
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.profiles SET last_login_at = now() WHERE id = auth.uid()
$$;

-- Profile / role policies ---------------------------------------------
CREATE POLICY "Staff can view profiles" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_active_staff(auth.uid()));
CREATE POLICY "Staff can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Admins manage profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (public.has_capability(auth.uid(), 'manage_users'))
  WITH CHECK (public.has_capability(auth.uid(), 'manage_users'));

CREATE POLICY "Staff can view roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_active_staff(auth.uid()));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_capability(auth.uid(), 'manage_users'))
  WITH CHECK (public.has_capability(auth.uid(), 'manage_users'));

-- Church settings -----------------------------------------------------
CREATE TABLE public.church_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  church_name TEXT NOT NULL DEFAULT 'Bethel Fundamental Baptist Church',
  abbreviation TEXT NOT NULL DEFAULT 'BFBC',
  address TEXT NOT NULL DEFAULT '',
  logo_url TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Manila',
  default_service TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.church_settings TO authenticated;
GRANT ALL ON public.church_settings TO service_role;
ALTER TABLE public.church_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view settings" ON public.church_settings
  FOR SELECT TO authenticated USING (public.is_active_staff(auth.uid()));
CREATE POLICY "Admins manage settings" ON public.church_settings
  FOR ALL TO authenticated
  USING (public.has_capability(auth.uid(), 'manage_settings'))
  WITH CHECK (public.has_capability(auth.uid(), 'manage_settings'));
CREATE TRIGGER church_settings_updated BEFORE UPDATE ON public.church_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.church_settings (id) VALUES (1);

-- Families ------------------------------------------------------------
CREATE TABLE public.families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_name TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.families TO authenticated;
GRANT ALL ON public.families TO service_role;
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View families" ON public.families
  FOR SELECT TO authenticated USING (public.has_capability(auth.uid(), 'view_members'));
CREATE POLICY "Manage families" ON public.families
  FOR ALL TO authenticated
  USING (public.has_capability(auth.uid(), 'manage_members'))
  WITH CHECK (public.has_capability(auth.uid(), 'manage_members'));
CREATE TRIGGER families_updated BEFORE UPDATE ON public.families
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Members -------------------------------------------------------------
CREATE TABLE public.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  gender TEXT,
  birth_date DATE,
  civil_status TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  membership_status TEXT NOT NULL DEFAULT 'active',
  date_joined DATE,
  baptism_date DATE,
  ministry TEXT,
  family_id UUID REFERENCES public.families(id) ON DELETE SET NULL,
  family_role TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.members TO authenticated;
GRANT ALL ON public.members TO service_role;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View members" ON public.members
  FOR SELECT TO authenticated USING (public.has_capability(auth.uid(), 'view_members'));
CREATE POLICY "Manage members" ON public.members
  FOR ALL TO authenticated
  USING (public.has_capability(auth.uid(), 'manage_members'))
  WITH CHECK (public.has_capability(auth.uid(), 'manage_members'));
CREATE TRIGGER members_updated BEFORE UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX members_last_name_idx ON public.members (last_name, first_name);
CREATE INDEX members_family_idx ON public.members (family_id);

-- Visitations ---------------------------------------------------------
CREATE TABLE public.visitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  visit_type TEXT NOT NULL DEFAULT 'home',
  status TEXT NOT NULL DEFAULT 'completed',
  visited_by TEXT,
  outcome TEXT,
  notes TEXT,
  prayer_requests TEXT,
  follow_up_date DATE,
  recorded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visitations TO authenticated;
GRANT ALL ON public.visitations TO service_role;
ALTER TABLE public.visitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View visitations" ON public.visitations
  FOR SELECT TO authenticated USING (public.has_capability(auth.uid(), 'view_visitation'));
CREATE POLICY "Manage visitations" ON public.visitations
  FOR ALL TO authenticated
  USING (public.has_capability(auth.uid(), 'manage_visitation'))
  WITH CHECK (public.has_capability(auth.uid(), 'manage_visitation'));
CREATE TRIGGER visitations_updated BEFORE UPDATE ON public.visitations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX visitations_member_idx ON public.visitations (member_id, visit_date DESC);
CREATE INDEX visitations_followup_idx ON public.visitations (follow_up_date);