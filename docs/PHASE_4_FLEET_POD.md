# Andertrack Phase 4 — GPS Fleet Overview and Delivery Verification

**Status:** Application UI and database proposals in a pull request; no production migration executed.

## Feature scope

### Dispatcher / Planner
- Read-only OpenStreetMap/Leaflet fleet overview plots only GPS locations returned by Supabase Row Level Security.
- Requires an organization-scoped `driver_location_current` SELECT policy; no anonymous/customer GPS access.
- Markers show unit/vehicle status, last GPS timestamp; stale GPS is flagged after 5 minutes.
- Reuses the Phase 2 assignment refresh (30-second polling); not a navigation or road-routing product.
- The map intentionally displays **no synthetic vehicles** in authenticated mode.

### CDL and Class C Driver
- Both can submit a recipient name, optional notes, and a required delivery photo for a shipment in `in_transit`.
- Evidence is uploaded to a **private** `at-delivery-evidence` bucket using authenticated storage policies and a path containing organization, assignment, and driver ID.
- The server checks the driver, organization, shipment state and object existence before marking delivery complete and logging an audit event.
- Class C courier users also see the package manifest and can scan/enter tracking codes at pickup and delivery. The UI accepts keyboard scanners or manual entry; camera barcode scanning is not included yet.
- The server rejects missing pickup scans, duplicate scans, illegitimate transitions, and deliveries with unfinished manifested packages.
- A shipment without a package manifest can still use receipt/photo proof; a manifest is required for package-level custody tracking.
- Signature pad, signed BOL and refrigerated-temperature evidence are future scope and must not be represented as implemented.

## Database review scripts and order

The connected production Supabase project `xzxxdzmkvophmrnovshs` currently contains **only** `driver_location_current` and `driver_location_events`, with RLS enabled and no policies, and shows **no recorded migrations**. Nothing under `supabase/sql/` has been applied.

1. **Phase 2** — Review `supabase/sql/phase2_schema_review.sql` for identity, organization memberships, RLS and role separation. Convert to a numbered CLI migration and run in a staging Supabase project.
2. **Phase 3** — Review `supabase/sql/phase3_assignment_workflows_review.sql` for private security-definer RPC functions, driver licensing/vehicle eligibility, transaction locking and audit events. Test stage transitions in staging.
3. **Phase 4 package + POD** — Review `supabase/sql/phase4_pod_packages_review.sql` for tenant-safe package tables, private evidence bucket, Storage RLS, scans, confirmation RPC and transactionally recorded audit events.
4. **Phase 4 GPS** — Review `supabase/sql/phase4_gps_dispatch_rls_review.sql` only after confirming that the GPS collector writes `driver_location_current.company_id` as the same UUID used by `at_organizations.id`. Otherwise, adapt the mapping before applying.
5. Run security/performance advisors, RLS tests, and storage policy checks in staging. Obtain explicit production approval, backup and rollback plans before deploy.

**Production migration policy:** Do not copy-paste the review scripts directly into production. Use ordered, version-controlled Supabase migrations after review. No seed accounts or fabricated deliveries should be inserted into production.

## Evidence handling and privacy

- Evidence bucket must remain private. No public download URLs. Restrict files to JPEG/PNG/WebP, max 10 MB.
- Recheck authenticated access and organization/driver assignment on the server. Client-side license/role UI is not the source of truth.
- Metadata `at_delivery_proofs` and `at_assignment_events` are immutable through normal browser permissions.
- Uploaded evidence can be orphaned if the file upload succeeds but the RPC fails. Plan a scheduled **trusted service** cleanup to remove unreferenced objects after a retention window.
- Driver GPS, POD photos, signature/recipient information need defined data retention, access logging, and privacy procedures before full release.
- Object content cannot be presumed genuine based solely on declared MIME type; consider file validation/malware scanning through a trusted backend as upload volume grows.
- OSM standard tile server is suitable only for appropriately limited development use, subject to provider policy. Arrange production-grade maps/tiles before nationwide deployment.

## Staging acceptance tests

- Valid dispatcher sees only location rows for their organization; different tenant and anonymous viewer receive none.
- With no GPS policies/data, fleet panel shows zero markers, not example vehicles or a deceptive healthy connection.
- A Class C driver can scan only packages on their assignment manifest at the appropriate route phase.
- A second pickup/delivery scan fails, and a delivery scan before pickup fails.
- Another driver or a dispatcher cannot call driver-only scan or confirm-delivery RPC.
- Driver cannot mark delivered before `in_transit`, and courier manifests must be fully scanned.
- Uploading to a different assignment or spoofing the storage path is rejected by Storage RLS.
- Delivery evidence remains private, authorized dispatcher can download and another organization cannot.
- POD photo upload + metadata + assignment delivery event is recoverable; failure does not mark the job delivered.
- Concurrent requests cannot create two proofs or inconsistent package updates.
- Verify RLS of all new tables, secure function search paths, grant restrictions, rejected unauthenticated calls, and Supabase advisors.
- Test local mobile browser camera/file picker and keyboard scanner input.
- Confirm production Vite build in GitHub Actions.

## Developer handoff

```text
src/features/live/FleetMap.jsx
src/features/live/DeliveryWorkflow.jsx
src/features/live/LiveWorkspace.jsx
src/live.css
supabase/sql/phase4_pod_packages_review.sql
supabase/sql/phase4_gps_dispatch_rls_review.sql
```

`npm install` then `npm run dev`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in local/deployment environment. Do not commit secrets or use service-role keys in a browser.

## Follow-up milestones

1. Authenticated photo retrieval with audit logging for dispatch.
2. Scanner-camera support and route stop manifests.
3. CDL BOL/seal inspection workflows and HOS/ELD integration.
4. Courier batching, pricing, live ETA and driver compensation.
5. Reliable user onboarding/admin tools and trusted GPS ingestion with location retention.
