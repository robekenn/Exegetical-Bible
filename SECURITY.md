# Security review and operations

## Implemented protections
- Supabase verifies API sessions. Admin reads/writes additionally require server-only `ADMIN_USER_IDS`; user-editable profile fields cannot grant access.
- Notes/preferences have owner-only row-level policies in the supplied SQL. Social reads are participant-scoped and writes use guarded RPCs with friend/block checks and database rate limits.
- User/provider content is escaped; ESV HTML is parsed into plain records. Proxy paths are allowlisted; provider timeouts bound requests.
- Explicit successful sign-out clears that user's local app cache after pending notes are synced. Guest records are preserved. In-flight community results are rejected if the account changes.
- CSP, no-sniff, frame denial, HTTPS persistence, capability restrictions and same-origin mutation checks protect the browser/API boundary.
- CI runs tests, builds, production dependency advisories, and high-confidence tracked-file secret checks; Dependabot proposes npm updates.

## Review evidence and limits
The source review found a cached-data-on-sign-out privacy risk and stale community-response handling gap, both addressed in this change. `npm audit` reported zero known advisories in production and development dependencies at review time. This is not a penetration-test certification or a guarantee against unknown vulnerabilities. The secret check covers tracked current source, not all Git history or provider logs.

Live Supabase RLS/auth settings were not independently inspected in this review: no database credential was available in the local runtime. Verify the deployed schema matches `db/schema.sql`, `db/social.sql`, `db/social-hardening.sql`, `db/social-visibility.sql`, and `db/admin.sql`. Do not rerun base migrations blindly; they contain initial CREATE POLICY statements. Existing regression tests use mocks and local DOMs, not production identities.

## Owner configuration
1. Rotate any API key previously pasted into chat (including the ESV key) at its provider, then replace only the server-side Vercel environment variable and redeploy. Never paste service-role keys into chat, source or client variables.
2. Enable MFA on GitHub, Vercel and Supabase operator accounts. Restrict collaborators, protect the main branch, and require the CI checks before merges.
3. In Supabase Auth, enable leaked-password protection where supported, CAPTCHA for public signup/login, appropriate auth rate limits and verified email once outbound email is configured. Use exact production redirect URLs. These are provider settings; frontend password rules alone do not enforce them.
4. Configure database backups and test recovery. Periodically review admins, reports, auth logs, quotas and failed requests. Remove departed admin UIDs and redeploy.
5. Configure distributed rate limits on public `/api/bible` traffic, especially ESV requests that consume a provider quota. This review could not retrieve an active Vercel firewall config, so no custom firewall limit is claimed or silently installed.

## Remaining architectural tradeoffs
This app uses a browser Supabase client with persistent, JavaScript-readable session cookies; they cannot be made HttpOnly while retaining this architecture. A future server-session/BFF migration can reduce token exposure if an XSS vulnerability occurs. Notes and messages are access-controlled but not end-to-end encrypted. Pending notes remain on a device when explicit sign-out is refused because synchronization failed; export/sync them before leaving a shared device. Already-existing cached copies from older sessions are not remotely erased.

Report vulnerabilities privately through the site's support form or directly to the operator; do not post private data or tokens in public GitHub issues.
