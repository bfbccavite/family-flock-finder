# BFBC visitor tracking and UI refresh

## Build
- Add the official BFBC logo as a hosted app asset and matching favicon, then use it in the public header, signed-in header, sidebar, and dashboard.
- Apply the selected Aqua & Meadow palette with Outfit headings, Figtree body text, compact navigation, clear page hierarchy, and responsive layouts.
- Keep existing member visitation records unchanged and relabel navigation clearly as “Member Visitations.”

## Sunday Visitor Intake
- Add a dedicated first-time visitor data model with complete name, visit date, birth date, address, phone, religion, discovery source, and the three spiritual next-step selections.
- Protect visitor records with staff-role access: ushering and authorized record managers can encode visitors; reporting roles can read visitor reports.
- Build a fast Sunday intake page with validated fields, date pickers defaulting the visit date to today, checkboxes, saving feedback, and a recent-intakes list.

## Visitor Reports
- Add a dedicated report page listing all first-time visitors.
- Include visit-date filtering, total visitors this month, prayer-request count, and a discovery-source breakdown.
- Add dashboard visitor metrics and direct links to intake and reports where each staff role has access.

## Quality and verification
- Add unique page titles, descriptions, social metadata, and the branded favicon.
- Verify permissions, database reads/writes, desktop and mobile layouts, visitor intake submission, date filtering, analytics, and existing member visitation behavior.

## Technical details
- Use a Lovable Cloud migration with explicit grants, row-level security, indexes, and updated capability mapping.
- Keep the browser data layer consistent with the existing query/mutation patterns and invalidate visitor/report/dashboard caches after saves.
- Use semantic theme tokens rather than page-specific hardcoded colors.
