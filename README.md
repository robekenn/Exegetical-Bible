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

`db/schema.sql` enables owner-only row-level security on both account tables. The save RPC runs with the caller's permissions and derives ownership from `auth.uid()`. Anonymous users cannot access account data. `/api/config` exposes only the project's public URL and publishable key. Service keys never enter the browser bundle. No analytics.

The Vercel build applies the initial schema in a transaction, then verifies owner-only reads/writes and anonymous access denial with temporary fixtures that are rolled back. Subsequent builds preserve existing schema/data.

## Required configuration
Connect Supabase using the Vercel Marketplace. The build uses `POSTGRES_URL_NON_POOLING` (or `POSTGRES_URL`). The browser uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or the equivalent Supabase variables), returned by `/api/config`.

In Supabase Authentication URL Configuration, set the Site URL to https://exegetical-bible.vercel.app and allow https://exegetical-bible.vercel.app/auth/callback. Add the local development callback when needed. Leave email confirmation enabled. Supabase's default email sender is intended for testing and may restrict recipients; configure a production SMTP provider for arbitrary users and reliable confirmation/recovery delivery. Do not disable confirmation as a substitute.

For local development, set `.env.local` with this project's own environment values; never commit it. `npm run dev` builds the static app without applying migrations; Vercel deployment builds apply the schema. `npm run check` runs syntax and unit checks.

## ESV integration
Official Crossway API integration uses server-only `ESV_API_KEY`, configured directly in Vercel. Obtain a key at https://api.esv.org/docs/ by creating an API application and accepting Crossway's terms. The ESV option appears only when the key exists. A deployment is required after setting it.

ESV requests pass only a validated book/chapter to Crossway. ESV responses use `private, no-store` and bypass the browser application cache. The app retains only the current rendered passage rather than accumulating ESV chapters or exporting ESV Bible text. Every passage displays the required ESV copyright notice and link. Official usage limits and noncommercial-use conditions apply: https://api.esv.org/. No ESV text is included in this repository or note backups.

## Verification
`npm run check` covers the Bible proxy allowlist, public configuration boundary, ESV parsing/missing-key behavior and note payload restoration. Build-time database checks exercise RLS with different user identities and leave no test records. Browser verification should cover sign-up/email confirmation, login, notes, refresh, cross-device changes, sign-out, recovery, OT Hebrew and NT Greek, commentary, comparison and mobile layout.
