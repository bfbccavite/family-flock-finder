CREATE TABLE public.account_recovery (
  user_id uuid PRIMARY KEY,
  normalized_full_name text NOT NULL UNIQUE,
  auth_email text NOT NULL,
  security_question text NOT NULL,
  answer_salt text NOT NULL,
  answer_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.account_recovery TO service_role;

ALTER TABLE public.account_recovery ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER account_recovery_updated
BEFORE UPDATE ON public.account_recovery
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE UNIQUE INDEX account_recovery_normalized_name_idx
ON public.account_recovery (normalized_full_name);