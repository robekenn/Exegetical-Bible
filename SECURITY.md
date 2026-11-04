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

## Account-email follow-up (November 2026)
The operator confirmed Gmail password-reset delivery after replacing rejected SMTP credentials. Custom SMTP uses `smtp.gmail.com:465`; the App Password remains only in Supabase. Password-change and email-address-change notification emails are enabled. Confirmation and secure email change remain enabled, along with secure password change and a 12-character minimum for new passwords. Exact production callback URLs are configured.

Reading preferences now retain an account-specific pending copy until the server confirms saving. Requests are serialized, retry after reconnect, and participate in saving feedback and sign-out protection. Tests cover concurrent changes and failed retries. These tests do not certify email deliverability or live database isolation.

The dashboard reported no advisor issues, but that is not an independent RLS audit. The current Free plan has no managed backups; leaked-password protection requires Pro. CAPTCHA and custom edge rate limits remain unconfigured. No paid upgrade, credential rotation, production export or restore was performed.

## Backup and recovery checklist
Source code in GitHub and an individual's notebook export are not a complete database backup. Choose either managed daily backups on a paid Supabase plan or an operator-run encrypted off-site backup process. Follow the current [Supabase backup guide](https://supabase.com/docs/guides/platform/backups) and [CLI backup/restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

Before calling backups operational:
1. Select a private encrypted destination and retention policy. Keep database credentials and recovery keys outside source control; never upload plaintext database dumps as GitHub artifacts or Library files.
2. Export roles, schema and data using the documented Supabase process. Verify Auth identities, application records, grants, policies, functions and triggers are covered; do not assume a default schema dump contains them all. Back up Storage objects separately if used.
3. Record project, timestamp, tool version, encrypted archive checksum and completion/failure status without user records or secrets in logs. Restrict access and confirm a backup actually exists.
4. Restore to an isolated non-production project with outbound email disabled. Verify row counts, notes/highlights, preferences, profiles, friend relationships, messages, reports and admin audit history. Check owner/participant isolation and anonymous denial using disposable test identities.
5. Record the restore result and recovery time. Repeat after schema changes and periodically. Never test by overwriting production.

Until the first verified backup and isolated restore succeed, disaster recovery remains incomplete. The project has not selected or provisioned a backup destination or a schedule.
