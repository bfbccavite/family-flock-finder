-- Password recovery via security questions (no email reset).
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS security_question TEXT,
  ADD COLUMN IF NOT EXISTS security_answer_hash TEXT;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_security_question_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_security_question_check
  CHECK (
    security_question IS NULL OR security_question IN (
      'What is your favorite Bible verse?',
      'What was the name of your first pet?',
      'What is your mother''s maiden name?'
    )
  );

CREATE OR REPLACE FUNCTION public.normalize_security_answer(_answer TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(btrim(COALESCE(_answer, '')))
$$;

CREATE OR REPLACE FUNCTION public.hash_security_answer(_answer TEXT)
RETURNS TEXT
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT extensions.crypt(public.normalize_security_answer(_answer), extensions.gen_salt('bf'))
$$;

REVOKE ALL ON FUNCTION public.hash_security_answer(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hash_security_answer(TEXT) TO service_role;

-- New staff accounts can set a recovery question at creation time.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _role public.app_role;
DECLARE _question TEXT;
DECLARE _answer TEXT;
BEGIN
  _question := NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'security_question', '')), '');
  _answer := NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'security_answer', '')), '');

  INSERT INTO public.profiles (id, full_name, email, phone, active, security_question, security_answer_hash)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, ''),
    NEW.raw_user_meta_data->>'phone',
    COALESCE((NEW.raw_user_meta_data->>'active')::boolean, true),
    _question,
    CASE WHEN _answer IS NULL THEN NULL ELSE public.hash_security_answer(_answer) END
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

CREATE OR REPLACE FUNCTION public.get_security_question(_full_name TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.security_question
  FROM public.profiles p
  WHERE p.active
    AND p.security_question IS NOT NULL
    AND p.security_answer_hash IS NOT NULL
    AND lower(btrim(p.full_name)) = lower(btrim(_full_name))
  ORDER BY p.created_at
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_security_question(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_security_question(TEXT) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.verify_security_answer(_full_name TEXT, _answer TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.active
      AND p.security_answer_hash IS NOT NULL
      AND lower(btrim(p.full_name)) = lower(btrim(_full_name))
      AND p.security_answer_hash = extensions.crypt(
        public.normalize_security_answer(_answer),
        p.security_answer_hash
      )
  )
$$;

REVOKE ALL ON FUNCTION public.verify_security_answer(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_security_answer(TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.set_own_security_recovery(_question TEXT, _answer TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _question IS NULL OR _question NOT IN (
    'What is your favorite Bible verse?',
    'What was the name of your first pet?',
    'What is your mother''s maiden name?'
  ) THEN
    RAISE EXCEPTION 'Choose a valid security question.';
  END IF;
  IF char_length(public.normalize_security_answer(_answer)) < 2 THEN
    RAISE EXCEPTION 'Enter a security answer.';
  END IF;

  UPDATE public.profiles
  SET
    security_question = _question,
    security_answer_hash = public.hash_security_answer(_answer)
  WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.set_own_security_recovery(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_own_security_recovery(TEXT, TEXT) TO authenticated;

-- Staff can read the question, but never the answer hash.
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.profiles FROM authenticated;
GRANT SELECT (
  id, full_name, email, phone, active, last_login_at, created_at, updated_at, security_question
) ON public.profiles TO authenticated;
GRANT INSERT (
  id, full_name, email, phone, active, last_login_at, created_at, updated_at, security_question
) ON public.profiles TO authenticated;
GRANT UPDATE (
  full_name, email, phone, active, last_login_at, updated_at, security_question
) ON public.profiles TO authenticated;
GRANT DELETE ON public.profiles TO authenticated;
