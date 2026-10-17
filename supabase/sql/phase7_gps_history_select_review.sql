-- Andertrack Phase 7: GPS HISTORY READ POLICY — REVIEW ONLY.
-- DO NOT EXECUTE DIRECTLY IN PRODUCTION.
-- Requirement: at_organization_members.organization_id maps to
-- driver_location_events.company_id and RLS is already enabled.
-- This creates no policy for anonymous, driver or public history access.
-- It does not configure GPS ingestion or retention.
BEGIN;
ALTER TABLE public.driver_location_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dispatch reads GPS history in own organization"
ON public.driver_location_events
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.at_organization_members m
  WHERE m.organization_id = driver_location_events.company_id
    AND m.user_id = (SELECT auth.uid())
    AND m.role IN ('admin', 'dispatcher')
));

-- A SELECT grant may already exist. This does not permit rows without RLS.
GRANT SELECT ON public.driver_location_events TO authenticated;
COMMIT;

-- After staging approval: impersonation tests for admin/dispatcher,
-- driver, anon and cross-tenant sessions; confirm no history outside company.
-- Review collection, retention, consent, and audit policies before production.
