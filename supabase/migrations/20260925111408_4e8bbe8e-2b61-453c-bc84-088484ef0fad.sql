CREATE TABLE public.account_recovery (
  user_id uuid PRIMARY KEY,
  normalized_full_name text NOT NULL UNIQUE,
  auth_email text NOT NULL,
  security_question text NOT NULL,
  answer_salt text NOT NULL,
  answer_hash text NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.account_recovery TO service_role;

ALTER TABLE public.account_recovery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account recovery remains server-only"
ON public.account_recovery
FOR ALL TO authenticated
USING (false)
WITH CHECK (false);

CREATE TRIGGER account_recovery_updated
BEFORE UPDATE ON public.account_recovery
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.account_recovery (
  user_id,
  normalized_full_name,
  auth_email,
  security_question,
  answer_salt,
  answer_hash
)
SELECT
  p.id,
  lower(regexp_replace(btrim(p.full_name), '\s+', ' ', 'g')),
  u.email,
  'Recovery question not set',
  encode(gen_random_bytes(16), 'hex'),
  encode(digest(gen_random_bytes(32), 'sha256'), 'hex')
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.full_name <> '' AND u.email IS NOT NULL
ON CONFLICT DO NOTHING;