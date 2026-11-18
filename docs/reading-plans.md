# Reading plans: first release

The Plans navigation opens a full-page catalog while retaining the reader and its drafts. Mark, John and selected Psalms are reference-only schedules. No devotional, interpretation, or questions have been generated and attributed to a human author. Approved human-authored material can use the existing session fields in later releases.

## Content and versions

`plan-catalog.js` is the bundled, offline-readable catalog. Its version IDs and session order match the seed in `supabase/migrations/20261118221916_reading_plans_foundation.sql`. Do not edit a published version in place. Add a new version and sessions in an additive migration, then expose that version in the catalog. Preserve the old definition while it has participants. The database rejects edits to published sessions and pins each run to its version. A future publishing interface can replace the bundled catalog with a version-aware catalog endpoint.

The migration models studies, versions, sessions, personal/group/community runs, enrollment, private progress, separate shared responses, and replies. This release exposes personal runs only. Group creation/enrollment, response writes, creator editing and admin publication require their later workflow and moderation implementation; client permissions deliberately do not expose them yet. Scheduled runs store an explicit timezone and start instant; the release helper advances by calendar days in that timezone. Drafts are readable by their author and published content is readable publicly.

## Storage and privacy

Guests save to `exegetical-plans`. Each account uses `exegetical-user-<id>-plans`; account cache cleanup also removes this key on sign-out. Device progress is imported only through an explicit action and never overwrites a plan already in the account. The guest copy remains intact.

Personal run creation is idempotent per owner/version. Each session's completion and reflection share an optimistic revision. Pending edits retain their base revision across reloads. Conflicts preserve both copies for an explicit choice; lost responses that already stored the exact intended value can retry without a false conflict. Reflections remain private even inside a group run. Account changes invalidate old requests and clear the rendered reflection. Explicit sign-out asks before discarding unsynced plan writes.

Account deletion removes the user's enrollments, progress, responses and replies. Run ownership becomes null so deleting a future group leader does not erase other members' private work; the future leader-management workflow must assign a replacement or archive the run.

## Verification and deployment

Run `npm run check` and `npm run build`. Apply the foundation and lookup-index migrations before deploying. `npm run db:migrate` also provisions the foundation if it is absent, using the existing configured database connection.

`tests/plans.test.mjs` covers storage, identity boundaries, retries, conflict choices, explicit import and the catalog/session/reader flow. `tests/sql/reading-plans.sql` uses disposable fixtures in a rolled-back transaction to verify real PostgreSQL RLS, version immutability, release rules and optimistic writes. Run it against an isolated database or a controlled transaction after applying the migration. No fixture should survive.

Check desktop and phone: open Plans, explore a plan, start it, write a reflection, open Scripture, return to the plan, complete a session, reload, filter in-progress/completed plans, and revisit a completed session. Verify a second-device account sees saved work, and an unrelated account cannot read it.
