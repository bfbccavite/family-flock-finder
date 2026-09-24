CREATE POLICY "Account recovery remains server-only"
ON public.account_recovery
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);