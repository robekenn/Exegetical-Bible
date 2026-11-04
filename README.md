# Exegetical Bible

A responsive, reading-first Bible study app built for Kenneth Robertson. A three-column desktop workspace becomes a stacked reader and study panel on phones.

## Features
- Entire live Free Use Bible API translation catalog, searchable by title, language, and abbreviation (1,505 translations at initial release).
- Book/chapter navigation, next/previous chapters, shareable passage URLs, remembered reading position.
- Verse-linked historical commentaries (Matthew Henry, John Gill, Calvin, and others).
- Hebrew/Greek interlinear with transliteration, English gloss, Strong's identifiers, grammar, and click-through STEPBible definitions.
- Compare the selected verse with another translation.
- Personal verse notes, highlights, searchable notebook, JSON backup export/import with conflict confirmation.
- Light/dark themes, adjustable type size, focused reading mode, keyboard accessible controls.

## Local development
Node 22 or later. Install dependencies with `npm install` first. Open Bible resources need no key; account sync requires Supabase.

```sh
npm run dev
npm run check
```
Open http://localhost:3000. The small local development server implements the same API handler used by Vercel.

## Deployment
Vercel project: `exegetical-bible`, connected to `robekenn/Exegetical-Bible`. Framework preset: Other. Build command: `npm run build`. Output directory: `dist`. `api/bible.js` is a Node serverless function. Supabase variables are provisioned by its Vercel integration. Git pushes deploy through the Vercel GitHub connection when enabled.

## Data and licensing
All data is fetched from https://bible.helloao.org/api/ using a restricted same-origin proxy with edge caching and an upstream timeout. The upstream catalog changes over time. No copyrighted translation is unlocked or represented as available without its publisher's license. NIV, ESV and other restricted translations require a separately licensed future integration.

Bible text and commentary copyright notices/license links remain visible in the app. Translations may have differing book coverage, versification, or licensing conditions. A missing resource displays an explicit retryable error rather than substituted text.

The Berean Standard Bible and Berean interlinear tables are public domain: https://berean.bible/terms.htm. Interlinear word glosses come from the Berean text, independently of the reading translation. Hebrew/Greek definitions: STEPBible.org / Tyndale House, Cambridge, Translators Brief Lexicons (TBESH/TBESG), CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/), via https://github.com/STEPBible/STEPBible-Data. AO Lab adapted these datasets into its API format. Source license metadata is returned unmodified by the proxy.

Commentary entries are section-based: the panel identifies the starting verse rather than implying exact verse coverage. Interpretive perspectives vary by author. The interlinear represents one source text, not an exhaustive critical apparatus.

## Accounts and privacy
Supabase email/password accounts support sign-up, confirmation, login, password recovery, and sign-out. Each account stores its notes/highlights separately from guest data. An explicit account action copies guest notes. Reading position, translation, theme and size sync as preferences. Notes use per-passage revisions; conflicting edits on another device require a choice rather than silently overwriting content. Pending writes are retained in an account-specific device cache and retried on reconnect. Account saving must finish before sign-out. Guest notes remain usable without an account.

`db/schema.sql` enables owner-only row-level security on both account tables. The save RPC runs with the caller's permissions and derives ownership from `auth.uid()`. Anonymous users cannot access account data. `/api/config` exposes only the project's public URL and publishable key. Service keys never enter the browser bundle. Production usage/performance measurement uses Vercel Web Analytics and Speed Insights; private routes and URL parameters are excluded. See the privacy notice and measurement controls.

The initial schema was applied in a transaction and owner-only reads/writes plus anonymous access denial were verified with rolled-back fixtures. Normal deployment builds only bundle static assets; they do not migrate the database or create test users. `npm run db:migrate` is an explicit maintenance operation, separate from deployment. The verification helper scripts are intended for a separate test project and are not run automatically against production.

## Required configuration
Connect Supabase using the Vercel Marketplace. Explicit database migration uses `POSTGRES_URL_NON_POOLING` (or `POSTGRES_URL`) with Supabase’s published CA certificate and full TLS validation. The browser uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or the equivalent Supabase variables), returned by `/api/config`.

In Supabase Authentication URL Configuration, set the Site URL to https://exegetical-bible.vercel.app and allow https://exegetical-bible.vercel.app/auth/callback. Add the local development callback when needed. Leave email confirmation enabled. Supabase's default email sender is intended for testing and may restrict recipients; configure a production SMTP provider for arbitrary users and reliable confirmation/recovery delivery. Do not disable confirmation as a substitute.

For local development, set `.env.local` with this project's own environment values; never commit it. `npm run dev` builds the static app without applying migrations; database setup is a separate explicit operation. `npm run check` runs syntax and unit checks.

## ESV integration
Official Crossway API integration uses server-only `ESV_API_KEY`, configured directly in Vercel. Obtain a key at https://api.esv.org/docs/ by creating an API application and accepting Crossway's terms. The ESV option appears only when the key exists. A deployment is required after setting it.

ESV requests pass only a validated book/chapter to Crossway. ESV responses use `private, no-store` and bypass the browser application cache. The app retains only the current rendered passage rather than accumulating ESV chapters or exporting ESV Bible text. Every passage displays the required ESV copyright notice and link. Official usage limits and noncommercial-use conditions apply: https://api.esv.org/. No ESV text is included in this repository or note backups.

## Verification
`npm run check` covers the Bible proxy allowlist, public configuration boundary, ESV parsing/missing-key behavior and note payload restoration. Database isolation was verified during initial setup with rolled-back fixtures. Full email-confirmation, password-login and recovery tests need a test account and configured email delivery. Browser verification should cover sign-up/email confirmation, login, notes, refresh, cross-device changes, sign-out, recovery, OT Hebrew and NT Greek, commentary, comparison and mobile layout.

## Profiles, friends and messages
Profiles contain a unique username, display name, optional bio, general location, interests and a 256px WebP picture. Exact-username discovery is opt-in; there is no public directory. Accepted friends see profile details. Private notes remain owner-only. Profile photos are resized in the browser and the original metadata/file is not uploaded.

Apply `db/social.sql`, then `db/social-hardening.sql` and `db/social-visibility.sql` as explicit, transaction-wrapped migrations. They create owner/participant RLS, accepted-friend-only message RPCs, exact-handle lookup, recipient-only request acceptance, blocks, reports and rate limits. No production test users or messages are created by builds or migrations. Reports include a snapshot of reported-message evidence and are available to the reporter and authorized operators through the database. An operator should review the `community_reports` table routinely; there is no automated email delivery or moderation dashboard yet.

Messages are plaintext in the database, not end-to-end encrypted. Conversation view shows the latest 100 messages; the account export retrieves the complete accessible history. Message removal is a tombstone; unfriending preserves conversation history, blocking prevents new contact, and deleting an account cascades to its app records and messages for both participants. Reports retain text/evidence with account links removed. Only user-initiated controls send requests or messages.

The account deletion endpoint verifies the caller's token with Supabase Auth, enforces same-origin POST and a typed DELETE confirmation, then deletes exactly that authenticated account with a server-only admin key. Keys and private records never enter the static bundle.

## Persistent sessions and quiet synchronization
The Supabase SSR browser client stores sessions in Secure/SameSite=Lax cookies on HTTPS, with a rolling 30-day maximum age. Browser refresh-token handling remains in the supported Supabase client. An existing local-storage session is migrated to cookies when possible. These browser-readable auth cookies are not HttpOnly; the app does not claim otherwise. Clearing cookies, private browsing, session revocation or provider policies can still require sign-in again.

Background study synchronization merges only changed records. It does not reapply reading preferences, navigate, reload a chapter or recreate the study panel. Focused note edits and pending changes are protected. The UI updates only note markers/highlights and an unfocused selected-note field. Messages poll while their conversation is open and update only the message list, preserving the compose field and scroll position unless near the end.

## Policy pages
`/terms/`, `/privacy/`, `/cookies/`, `/guidelines/`, `/accessibility/` and `/contact/` are built from `scripts/legal.mjs`. They describe implemented behavior rather than promising certified compliance. Accounts/community are for ages 16+. Signup and profile forms request acceptance of the current terms and link the notices. Contact/report forms route to a private database queue; public GitHub issues are reserved for non-sensitive bugs. The operator must maintain truthful notices and handle incoming reports/privacy requests.

## Phone layout
At widths up to 760px, the app uses a dedicated five-tab bottom bar (Read, Study, Notebook, Friends, Account), a sticky passage toolbar and a full-screen searchable book/chapter picker. Tapping a verse opens the study drawer over the reader; close it to return to the same reading position. The drawer traps keyboard focus and closes with Escape or its close button. Draft fields remain mounted while switching between reading and study.

Account, notebook, profile and conversation dialogs use full-screen phone panels. Controls are larger, form text avoids iOS input zoom, and padding accounts for device safe areas. Visual viewport height helps panels fit above a mobile keyboard. Desktop retains the three-column workspace. The automated phone interaction test checks drawer controls, draft preservation, book filtering and chapter navigation without creating user data.


## Admin portal setup
Open `/admin/` after signing in to your usual Bible account. The account menu also links to it. The server checks Supabase Auth and a server-only allowlist on every request; ordinary members cannot access reports or review history.

1. In Supabase SQL Editor, run `db/admin.sql` once. It adds report statuses and an append-only review history, with no browser-accessible policies for that history. Review updates and audit events commit together.
2. In Supabase Authentication → Users, copy your account's **User UID** (not your email).
3. In Vercel project Settings → Environment Variables, add `ADMIN_USER_IDS` for Production containing that UID. For multiple admins, separate UIDs with commas. Do not prefix the variable with NEXT_PUBLIC.
4. Redeploy the latest production deployment so the new variable takes effect. Sign in at the Bible site and open `/admin/`.

Filter open/in-review/resolved/dismissed reports, inspect evidence, and record a decision note. This covers abuse reports and support/privacy/accessibility requests. Statuses do not themselves ban accounts, delete messages, or notify users. Internal review notes are not returned to reporters. Removing a UID from the allowlist and redeploying revokes portal access. Keep admin accounts secure; never grant access based on user-editable profile fields.


## Security
See [SECURITY.md](SECURITY.md) for implemented protections, review limits, credential rotation, account hardening and incident reporting. Explicit sign-out clears the signed-in account’s local application cache after pending notes sync.


## Gmail account email delivery
Supabase sends confirmation/reset emails; the website does not need an SMTP password in Vercel or source code.

In Supabase Authentication → Emails → SMTP Settings, use sender `exegeticalbible@gmail.com`, sender name `Exegetical Bible`, host `smtp.gmail.com`, port `465`, and username `exegeticalbible@gmail.com`. The account owner must enable Google 2-Step Verification, create an App Password named for Supabase, enter it directly into the Supabase Password field, then save. Never use or share the normal Google password. Do not put the App Password in GitHub/chat. Setup is incomplete until a real confirmation/reset email reaches the intended inbox; no automated email test or new production account is created by builds.

The production Site URL is `https://exegetical-bible.vercel.app` and the primary redirect is `/auth/callback`. Confirm email is enabled in Supabase. Keep password-policy settings and frontend signup/recovery requirements aligned (12 characters for new passwords; existing sign-in stays compatible).

Reading-preference writes are queued and serialized, with a device copy retained until the account confirms a save. Saving feedback includes failed/offline preference writes and retries on reconnection or return to the page. Pending preferences prevent sign-out from discarding a streak or reading-position change.

## Google sign-in and profile pictures
The auth dialog offers Continue with Google using Supabase OAuth and the existing persistent-session callback. Availability comes from Supabase's public Auth settings; the button stays disabled with an explanation until Google is configured. The application requests only openid, email and profile scopes, never Gmail/Drive access. Existing email sign-in and recovery continue to work.

Owner setup:
1. In Google Auth Platform, configure the app branding/audience and create a Web application OAuth client. Use your own support email and the site's privacy/terms URLs. Publish the consent configuration as needed for general users; Testing mode may limit access to listed test users.
2. Authorized JavaScript origin: `https://exegetical-bible.vercel.app`.
3. Authorized redirect URI: `https://kafceboizdzwvwmecgat.supabase.co/auth/v1/callback` (Supabase's callback, not the website callback).
4. Enter the Client ID and Client Secret directly in Supabase Authentication → Sign In / Providers → Google, enable Google and save. Keep nonce checking on and leave Allow users without an email off. Credentials must be created/entered by the owner; do not paste them into chat or commit them.
5. Refresh the website and test Google sign-in, cancellation, returning sessions and an existing email account. Verify the resulting account identity before testing with valuable study data; the app does not merge different accounts itself.

A new profile uses the signed-in Google identity's photo as its default. Only HTTPS image URLs on lh3–lh6.googleusercontent.com are allowed, sent without a referrer. Existing saved pictures (including an explicitly removed picture) take precedence. Use Google picture in Profile to replace one. Saving a new profile converts the Google photo to the same 256px WebP format as uploaded photos, so friends receive the stored copy under existing RLS rules. A conversion failure is explained and allows choosing/uploading another picture. No schema change is needed.

## Vercel measurement
Official `@vercel/analytics` and `@vercel/speed-insights` packages are bundled into a same-origin module. The main reader and public policy pages include it; the admin page does not. Production host is allowlisted. Auth callbacks and unknown/private paths never initialize measurement. Before-send filtering removes query strings/fragments (including passage parameters) and rejects private paths. No custom events or account identifiers are attached. GPC, Do Not Track and the Cookies page's per-browser opt-out prevent initialization; filters recheck preferences before sending.

The privacy and storage notices describe the updated behavior. View results in the project's Vercel Analytics and Speed Insights tabs after visits and performance events arrive. No paid Plus upgrade is required or enabled by this change. Content blockers, privacy preferences, quotas and browser support can prevent collection. Google OAuth end-to-end verification remains pending until the owner configures credentials.
