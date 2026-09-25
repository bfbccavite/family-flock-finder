ALTER TABLE public.first_time_visitors
ADD COLUMN wants_counseling boolean NOT NULL DEFAULT false,
ADD COLUMN urgent_outreach boolean NOT NULL DEFAULT false,
ADD COLUMN found_facebook boolean NOT NULL DEFAULT false,
ADD COLUMN found_google boolean NOT NULL DEFAULT false,
ADD COLUMN referred_by text,
ADD COLUMN companion_of text,
ADD COLUMN discovery_other text,
ADD COLUMN gender text,
ADD COLUMN spiritual_maturity text,
ADD COLUMN anniversary_date date,
ADD COLUMN spiritual_needs_met boolean,
ADD COLUMN contacted_by text,
ADD COLUMN contacted_by_other text,
ADD COLUMN follow_up_result text;

ALTER TABLE public.members
ADD COLUMN anniversary_date date,
ADD COLUMN spiritual_maturity text;

CREATE TABLE public.visitor_follow_up_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id uuid NOT NULL REFERENCES public.first_time_visitors(id) ON DELETE CASCADE,
  activity_date timestamptz NOT NULL DEFAULT now(),
  activity_type text NOT NULL,
  details text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.visitor_follow_up_activities TO authenticated;
GRANT ALL ON public.visitor_follow_up_activities TO service_role;

ALTER TABLE public.visitor_follow_up_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View visitor follow-up activities"
ON public.visitor_follow_up_activities
FOR SELECT TO authenticated
USING (public.has_capability(auth.uid(), 'view_visitors'));

CREATE POLICY "Manage visitor follow-up activities"
ON public.visitor_follow_up_activities
FOR ALL TO authenticated
USING (public.has_capability(auth.uid(), 'manage_visitors'))
WITH CHECK (public.has_capability(auth.uid(), 'manage_visitors'));

CREATE INDEX visitor_follow_up_activities_date_idx
ON public.visitor_follow_up_activities (activity_date DESC);

CREATE INDEX visitor_follow_up_activities_visitor_idx
ON public.visitor_follow_up_activities (visitor_id);

CREATE OR REPLACE FUNCTION public.set_visitor_urgent_outreach()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.urgent_outreach := NEW.wants_to_know_christ OR NEW.wants_bible_study OR NEW.wants_prayer OR NEW.wants_counseling;
  RETURN NEW;
END; $function$;

CREATE TRIGGER first_time_visitors_urgent_outreach
BEFORE INSERT OR UPDATE OF wants_to_know_christ, wants_bible_study, wants_prayer, wants_counseling
ON public.first_time_visitors
FOR EACH ROW EXECUTE FUNCTION public.set_visitor_urgent_outreach();

CREATE OR REPLACE FUNCTION public.log_visitor_follow_up_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.spiritual_needs_met IS DISTINCT FROM NEW.spiritual_needs_met
     OR OLD.contacted_by IS DISTINCT FROM NEW.contacted_by
     OR OLD.contacted_by_other IS DISTINCT FROM NEW.contacted_by_other
     OR OLD.follow_up_result IS DISTINCT FROM NEW.follow_up_result THEN
    INSERT INTO public.visitor_follow_up_activities (visitor_id, activity_type, details, recorded_by)
    VALUES (
      NEW.id,
      'follow_up_updated',
      concat_ws(' · ',
        CASE WHEN NEW.spiritual_needs_met IS NULL THEN NULL ELSE 'Needs met: ' || CASE WHEN NEW.spiritual_needs_met THEN 'Yes' ELSE 'No' END END,
        CASE WHEN NEW.contacted_by IS NOT NULL THEN 'Contacted by: ' || NEW.contacted_by END,
        NULLIF(NEW.follow_up_result, '')
      ),
      auth.uid()
    );
  END IF;
  RETURN NEW;
END; $function$;

CREATE TRIGGER first_time_visitors_follow_up_activity
AFTER UPDATE OF spiritual_needs_met, contacted_by, contacted_by_other, follow_up_result
ON public.first_time_visitors
FOR EACH ROW EXECUTE FUNCTION public.log_visitor_follow_up_activity();