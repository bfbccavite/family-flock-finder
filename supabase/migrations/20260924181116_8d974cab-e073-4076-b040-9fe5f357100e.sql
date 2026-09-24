ALTER TABLE public.account_recovery
ADD COLUMN failed_attempts integer NOT NULL DEFAULT 0,
ADD COLUMN locked_until timestamptz,
ADD COLUMN last_attempt_at timestamptz;