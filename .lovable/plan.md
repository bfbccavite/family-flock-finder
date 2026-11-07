# Personalized Visitor Outreach Recommendations

## Build
- Add an authenticated staff action for generating tailored next-step recommendations from a visitor’s intake details and saved follow-up notes.
- Keep model access and prompt processing on the server; require an active signed-in staff session and validate inputs before calling AI Gateway.
- Add a focused recommendation panel to the visitor follow-up experience with loading, success, and recoverable error states.
- Use the current visitor record and follow-up fields without changing existing intake, login, or staff permissions.

## Technical details
- Use `@lovable.dev/ai-gateway` with the workspace default text model and its supported surface; generate and inspect SDK types before implementing.
- Pass only relevant visitor data, avoid unnecessary sensitive details, and treat AI output as suggestions for staff review rather than automated actions.
