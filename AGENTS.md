# Contributor guidance
- Keep the reading experience calm, accessible, and mobile friendly.
- Use branches and PRs for subsequent changes. Never commit credentials or private notes.
- Preserve source attribution and translation license links. Do not claim availability of unlicensed translations.
- All remote resource requests must use the restricted `/api/bible` proxy; never accept arbitrary upstream URLs.
- Treat Bible/provider content and imported backups as untrusted. Escape content before rendering HTML.
- Never invent Bible text, lexical definitions, or commentary and present it as sourced material.
- Preserve note backups and backward compatibility. Guest notes are browser-local; account notes sync through Supabase with owner-only RLS. Keep guest and account caches isolated.
- Run `npm run check` and verify relevant end-to-end interactions before delivery.
- Update `changelog/index.html` in every PR with user-facing changes. Add short bullets under the release date in America/Los_Angeles, newest dates first. Reuse the same entry for releases on the same day and omit days with no user-facing changes.
