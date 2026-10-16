-- Tested on isolated Andertrack Staging only.
-- Required indexes for foreign key access and cleanup performance.
CREATE INDEX IF NOT EXISTS at_assignment_events_actor_fk_idx ON public.at_assignment_events(actor_user_id);
CREATE INDEX IF NOT EXISTS at_assignment_events_assignment_fk_idx ON public.at_assignment_events(assignment_id);
CREATE INDEX IF NOT EXISTS at_assignments_org_driver_fk_idx ON public.at_assignments(organization_id,driver_user_id);
CREATE INDEX IF NOT EXISTS at_assignments_org_vehicle_fk_idx ON public.at_assignments(organization_id,vehicle_id);
CREATE INDEX IF NOT EXISTS at_delivery_proofs_org_assignment_fk_idx ON public.at_delivery_proofs(organization_id,assignment_id);
CREATE INDEX IF NOT EXISTS at_delivery_proofs_driver_fk_idx ON public.at_delivery_proofs(driver_user_id);
CREATE INDEX IF NOT EXISTS at_driver_profiles_user_fk_idx ON public.at_driver_profiles(user_id);
CREATE INDEX IF NOT EXISTS at_package_events_actor_fk_idx ON public.at_package_events(actor_user_id);
CREATE INDEX IF NOT EXISTS at_package_events_package_fk_idx ON public.at_package_events(package_id);
