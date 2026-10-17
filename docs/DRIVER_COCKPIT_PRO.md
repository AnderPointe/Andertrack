# Driver Cockpit Pro — Advanced interactive operations sandbox

## Scope
Extends the already-deployed Driver Cockpit & HOS, without replacing the live dashboard or allowing fictitious metrics into live driver accounts. All new tools are **demo-only**. Existing live assignment actions and protected delivery proof RPCs remain unchanged.

## Interactive new modules
- **Duty Scenario Lab:** 96 quarter-hour time blocks covering a complete 24-hour example. Select a time, duration (15/30/60/120 min), and one of OFF/SB/D/ON; apply, undo latest edit, reset, review reconstructed status periods and accumulated duty-category totals; export a spreadsheet-formula-safe CSV with **SIMULATED - NOT AN ELD RECORD** in each entry. This is not a certified ELD, log signing, correction, or compliant HOS engine. Existing gauges remain clearly labeled reference examples, not live compliance.
- **Earnings Studio:** scenario sliders for extra stops, per-stop rate, tips and detention minutes. Shows an itemized comparison of original *illustrative* earnings and hypothetical added earnings with proportional mini bars. No payroll entry is created.
- **Cash-Out Sandbox:** two-stage confirmation to practice review/confirm and cancellation. Displays a final "simulated — not paid" status. No payout, balance change, bank API or ledger.
- **IFTA Reconciliation Lab:** edit sample state mileage and compare totals to a sample trip/day distance, highlighting mismatch and allowing reset. Not a certified mileage/fuel tax report.
- **Live Driver Mission Control:** signed-in drivers now also have an *actual-data* summary of own shipment count, active loads, pending offers and completed loads; the currently selected assignment's recorded status determines the next authorized-workflow guidance and a scheduled-delivery deadline indicator. This feature does not use fabricated GPS, predicted ETA or compliance inferences. 
- **ePOD Mission Lab:** local checklist and sample recipient input must be completed before sample delivery button becomes available. A simulated stop credit only affects the screen's example wallet. Real ePOD still requires authorized driver proof and protected Supabase RPC; no fake proof is stored.

## Security and fairness constraints
- No persistent personal health data, driver GPS trace, external AI/LLM decisions, HOS/ELog data or payroll information is created.
- Full cockpit role isolation remains: **only the authenticated driver** can perform actual live assignment status changes / package scans / proof submission through previously validated backend authorization.
- Simulated status controls, sample sensor values and earnings never mix with live operational values.
- Route handoff remains an external mapping link, not a turn-by-turn or truck-safe navigation service.
- This is an enhanced front-end sandbox only. No migrations, SMTP/auth changes, service-role keys, payment credentials or policy changes.

## Quality gates
- Node tests cover precise time-block accounting, edit clipping/invalid input handling, recipient/checklist gating, discrepancy logic, payout scenario totals, CSV formula protection.
- GitHub CI tests and Vite build, Vercel preview.
- Manual QA: responsive 360px/720px/desktop; keyboard time slider, undo, reset, different profiles; demo finish check only once; simulated credits do not persist; request login disabled while staging Supabase email rate limit applies.
- Before any REAL HOS, biometric monitoring, instant payout, IFTA jurisdiction accounting, and onboard navigation: procure certified/appropriate vendor integrations, obtain required permissions and consents, build server audit trails and review driving-safety requirements.
- Keep this PR in preview pending sign-off; no production changes until merged.
