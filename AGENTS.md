# Contributor guidance
- Keep the reading experience calm, accessible, and mobile friendly.
- Use branches and PRs for subsequent changes. Never commit credentials or private notes.
- Preserve source attribution and translation license links. Do not claim availability of unlicensed translations.
- All remote resource requests must use the restricted `/api/bible` proxy; never accept arbitrary upstream URLs.
- Treat Bible/provider content and imported backups as untrusted. Escape content before rendering HTML.
- Never invent Bible text, lexical definitions, or commentary and present it as sourced material.
- Preserve note backups and backward compatibility. Notes are browser-local, not cloud-synced.
- Run `npm run check` and verify relevant end-to-end interactions before delivery.
