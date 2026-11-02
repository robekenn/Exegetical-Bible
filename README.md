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
Node 22 or later. No third-party runtime dependencies or API keys required.

```sh
npm run dev
npm run check
```
Open http://localhost:3000. The small local development server implements the same API handler used by Vercel.

## Deployment
Vercel project: `exegetical-bible`, connected to `robekenn/Exegetical-Bible`. Framework preset: Other. No build command or output directory required. Static root files are served directly; `api/bible.js` is a Node serverless function. No environment secrets needed. Git pushes deploy through the Vercel GitHub connection when enabled.

## Data and licensing
All data is fetched from https://bible.helloao.org/api/ using a restricted same-origin proxy with edge caching and an upstream timeout. The upstream catalog changes over time. No copyrighted translation is unlocked or represented as available without its publisher's license. NIV, ESV and other restricted translations require a separately licensed future integration.

Bible text and commentary copyright notices/license links remain visible in the app. Translations may have differing book coverage, versification, or licensing conditions. A missing resource displays an explicit retryable error rather than substituted text.

The Berean Standard Bible and Berean interlinear tables are public domain: https://berean.bible/terms.htm. Interlinear word glosses come from the Berean text, independently of the reading translation. Hebrew/Greek definitions: STEPBible.org / Tyndale House, Cambridge, Translators Brief Lexicons (TBESH/TBESG), CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/), via https://github.com/STEPBible/STEPBible-Data. AO Lab adapted these datasets into its API format. Source license metadata is returned unmodified by the proxy.

Commentary entries are section-based: the panel identifies the starting verse rather than implying exact verse coverage. Interpretive perspectives vary by author. The interlinear represents one source text, not an exhaustive critical apparatus.

## Notes and privacy
Notes, highlights and preferences are stored in localStorage in the current browser, with no accounts or cloud synchronization. Use My notebook → Export backup to retain or move them. Import validates note shape, merges notes, and asks before replacing conflicting notes. Clearing browser data removes local notes. The app reports storage failures. There is no analytics or third-party tracking.

## Verification
`npm run check` checks JavaScript syntax and tests the API resource allowlist and method validation. Test both OT Hebrew and NT Greek, commentary source changes, translation selection, comparison, note reload, export/import, mobile layout and provider errors before releases.
