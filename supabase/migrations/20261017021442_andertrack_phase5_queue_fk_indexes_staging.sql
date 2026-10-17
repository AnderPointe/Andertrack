-- Phase 5 follow-up: cover foreign keys found by staging performance advisor.
CREATE INDEX IF NOT EXISTS at_dispatch_requests_org_assignment_fk_idx
 ON public.at_dispatch_requests(organization_id,assignment_id);
CREATE INDEX IF NOT EXISTS at_dispatch_requests_handled_by_fk_idx
 ON public.at_dispatch_requests(handled_by);