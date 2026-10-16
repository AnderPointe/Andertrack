-- Applied and verified on separate Andertrack Staging project only.
-- Do not deploy to production without explicit user approval.
-- Phase 4 GPS read policy — REVIEW ONLY, DO NOT APPLY BLINDLY.
-- Connected Supabase project currently has only driver_location_current/events,
-- both RLS-enabled and with no policies. This script assumes that
-- driver_location_current.company_id is the same UUID as at_organizations.id.
-- Confirm that identity mapping with your GPS ingestion service in staging first.
-- Requires approved Phase 2 organization/member schema deployment.
REVOKE ALL ON TABLE public.driver_location_current FROM anon;
GRANT SELECT ON TABLE public.driver_location_current TO authenticated;
ALTER TABLE public.driver_location_current ENABLE ROW LEVEL SECURITY;

-- Only verified organization dispatchers/admins may view a company's live GPS.
-- Do NOT grant location access to unauthenticated customers or other carriers.
CREATE POLICY "Dispatcher reads GPS in own organization"
ON public.driver_location_current FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.at_organization_members m
    WHERE m.organization_id = driver_location_current.company_id
      AND m.user_id = (SELECT auth.uid())
      AND m.role IN ('admin','dispatcher')
  )
);

-- No client-side GPS INSERT/UPDATE/DELETE policy is added.
-- Production location ingestion must use a separately authorized, rate-limited
-- and audited server endpoint. Location event history remains inaccessible
-- until retention and privacy controls are reviewed.