# Account email templates

`templates.mjs` is the shared source for all 13 Supabase authentication and security messages. It uses a fluid table layout, inline styles, a 600px maximum card, 16px body text, descriptive buttons, and system fonts. It loads no external images, fonts, trackers or scripts.

Generate an HTML body by importing `templates` and `renderEmail` in Node and passing the matching template to `renderEmail`. The returned string is the exact HTML to paste into Supabase Authentication → Emails → the matching template → Source. Copy its `subject` into Subject, inspect Preview, then save the **content** form. Security templates have a separate notification-enabled form: updating content must not change that switch.

All 13 subjects and bodies were saved in the hosted Bible project in November 2026. Password-change and email-change notifications remain enabled; other security notifications remain disabled. Preparing their content does not enable phone, OAuth or MFA features. These are account-service emails, not automatic friend-message or verse-sharing notifications.

## Verification

Run `npm run check`. The email regression check covers the complete flow set, correct per-flow placeholders, one heading, safe website links, and absence of scripts/tracking content. Supabase's Preview was checked for each message; the saved recovery template was reopened to check persistence. Inbox rendering can vary across clients; an actual Gmail/iOS/Outlook inbox check is still useful.

Keep `{{ .ConfirmationURL }}` intact for action emails, and `{{ .Token }}` for reauthentication. Do not hardcode real tokens, reset links, recipient details or credentials in this repository. Security notification variables are scoped to their message type. Subjects intentionally omit codes and personal addresses.

The button and fallback link use the same Supabase-generated confirmation URL. The templates do not change callback behavior or token expiration. Security messages link to the real site/support page and explain how to respond to an unrecognized change. The footer gives the support and privacy links without claiming instant responses.

Editing GitHub alone does not deploy templates to hosted Supabase, and Vercel builds do not apply them. Review and save future template changes in the Supabase dashboard; no production account or email is created by tests. SMTP credentials stay in Supabase.

Reference: https://supabase.com/docs/guides/auth/auth-email-templates
