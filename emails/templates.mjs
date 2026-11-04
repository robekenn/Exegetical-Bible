// Supabase account email templates. No user data or credentials belong in this file.
export function renderEmail(t){
const site="https://exegetical-bible.vercel.app";
const p=s=>`<p style="margin:0 0 18px;font:16px/1.65 Arial,Helvetica,sans-serif;color:#34473e;">${s}</p>`;
const button=t.action?`<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td bgcolor="#355e4d" style="border-radius:8px;"><a href="${t.link||"{{ .ConfirmationURL }}"}" style="display:inline-block;padding:15px 24px;border:1px solid #355e4d;border-radius:8px;color:#ffffff;font:bold 16px/1.3 Arial,Helvetica,sans-serif;text-decoration:none;">${t.action}</a></td></tr></table>`:"";
const code=t.code?`<p style="margin:24px 0;padding:20px 12px;border:1px solid #d9e1d6;border-radius:8px;background:#f3f5ef;text-align:center;font:bold 28px/1.4 'Courier New',monospace;letter-spacing:3px;color:#243f33;">{{ .Token }}</p>`:"";
const fallback=t.action&&!t.link?`<p style="margin:20px 0 0;font:13px/1.6 Arial,Helvetica,sans-serif;color:#59685f;">If the button does not work, copy and paste this link into your browser:<br><a href="{{ .ConfirmationURL }}" style="color:#355e4d;word-break:break-all;overflow-wrap:anywhere;">{{ .ConfirmationURL }}</a></p>`:"";
return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${t.title}</title></head>
<body style="margin:0;padding:0;background:#f3f4ee;">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;overflow:hidden;mso-hide:all;">${t.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4ee;"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fffefa;border:1px solid #dfe4da;border-radius:12px;">
<tr><td style="padding:26px 26px 20px;border-bottom:1px solid #e5e8df;"><a href="${site}" style="font:bold 26px Georgia,'Times New Roman',serif;color:#294438;text-decoration:none;">Exegetical Bible</a><p style="margin:8px 0 0;font:11px/1.5 Arial,Helvetica,sans-serif;letter-spacing:2px;color:#59685f;">GO DEEPER IN THE WORD</p></td></tr>
<tr><td style="padding:28px 26px;">
<p style="margin:0 0 12px;font:bold 12px/1.5 Arial,Helvetica,sans-serif;letter-spacing:1px;color:#526c5c;">${t.security?"ACCOUNT SECURITY":"YOUR STUDY ACCOUNT"}</p>
<h1 style="margin:0 0 20px;font:normal 30px/1.2 Georgia,'Times New Roman',serif;color:#243f33;">${t.title}</h1>
${t.paragraphs.map(p).join("\n")}${code}${button}
${t.note?`<div style="margin:24px 0 0;padding:16px;background:#f1f4ed;border-left:3px solid #789479;border-radius:4px;">${p(t.note)}</div>`:""}
${fallback}
</td></tr>
<tr><td style="padding:20px 26px;border-top:1px solid #e5e8df;">${p('Need help? Visit our <a href="'+site+'/contact/" style="color:#355e4d;">support page</a>. Never share your password, verification codes, or sign-in links.')}<p style="margin:0;font:12px/1.6 Arial,Helvetica,sans-serif;color:#657066;">This is an account email from Exegetical Bible.<br><a href="${site}/privacy/" style="color:#526c5c;">Privacy</a> &nbsp;·&nbsp; <a href="${site}" style="color:#526c5c;">Open Exegetical Bible</a></p></td></tr>
</table></td></tr></table></body></html>`;
}

export const templates = [
  {
    "id": "confirm-sign-up",
    "subject": "Confirm your Exegetical Bible account",
    "title": "Welcome to your study space.",
    "preheader": "Confirm your email to finish setting up your account.",
    "paragraphs": [
      "Thanks for joining Exegetical Bible. Confirm your email address to finish creating your account and keep your notes, highlights, and reading preferences together."
    ],
    "action": "Confirm my email",
    "note": "If you did not create an account, you can ignore this email. Do not forward this confirmation link."
  },
  {
    "id": "invite-user",
    "subject": "You're invited to Exegetical Bible",
    "title": "Your study space is waiting.",
    "preheader": "Accept your invitation to create an Exegetical Bible account.",
    "paragraphs": [
      "You have been invited to create an Exegetical Bible account. Read Scripture, explore study resources, and keep your own notes and highlights."
    ],
    "action": "Accept invitation",
    "note": "If you were not expecting this invitation, you can ignore it. Only accept if you want to create an account."
  },
  {
    "id": "magic-link-or-otp",
    "subject": "Your Exegetical Bible sign-in link",
    "title": "Sign in to your study space.",
    "preheader": "Use this one-time link to sign in to Exegetical Bible.",
    "paragraphs": [
      "You requested a sign-in link for Exegetical Bible. Use the button below to sign in. This link is private and can only be used once."
    ],
    "action": "Sign in",
    "note": "If you did not request this email, do not use or share the link. You can ignore this message."
  },
  {
    "id": "change-email-address",
    "subject": "Confirm your Exegetical Bible email change",
    "title": "Confirm your email change.",
    "preheader": "Confirm the request to update your account email.",
    "paragraphs": [
      "A request was made to change your Exegetical Bible account email to <strong style=\"overflow-wrap:anywhere;word-break:break-word;\">{{ .NewEmail }}</strong>.",
      "Confirm this request using the button below. You may also need to confirm it from your other email address."
    ],
    "action": "Confirm email change",
    "note": "Did not request this? Do not confirm the change. Open Exegetical Bible directly and contact support if you need help securing your account."
  },
  {
    "id": "reset-password",
    "subject": "Reset your Exegetical Bible password",
    "title": "Let's get you back in.",
    "preheader": "Choose a new password for your Exegetical Bible account.",
    "paragraphs": [
      "We received a request to reset your Exegetical Bible password. Use the button below to choose a new password."
    ],
    "action": "Reset my password",
    "note": "If you did not request this, you can ignore this email. Your password will stay the same unless you complete the reset. Keep this link private."
  },
  {
    "id": "reauthentication",
    "subject": "Your Exegetical Bible verification code",
    "title": "Verify it's you.",
    "preheader": "Your code for a sensitive account action.",
    "paragraphs": [
      "Use this code in Exegetical Bible to verify your identity and continue the account action you requested.",
      "Enter it only on the Exegetical Bible website. If it has expired, return to the site to request a new code."
    ],
    "code": true,
    "note": "Did not request this? Do not share or use the code. Open the site directly and contact support if you notice unfamiliar account activity."
  },
  {
    "id": "password-changed",
    "subject": "Your Exegetical Bible password was changed",
    "title": "Your password was changed.",
    "preheader": "A security update for your Exegetical Bible account.",
    "security": true,
    "paragraphs": [
      "The password for your Exegetical Bible account was changed.",
      "If you made this change, no further action is needed."
    ],
    "action": "Open Exegetical Bible",
    "link": "https://exegetical-bible.vercel.app/",
    "note": "Wasn't you? Open Exegetical Bible directly, use Forgot password to secure your account, and contact support immediately. Never send anyone your password or reset link."
  },
  {
    "id": "email-address-changed",
    "subject": "Your Exegetical Bible email address was changed",
    "title": "Your email address was changed.",
    "preheader": "Review the email change on your study account.",
    "security": true,
    "paragraphs": [
      "Your account email was changed from <strong style=\"overflow-wrap:anywhere;word-break:break-word;\">{{ .OldEmail }}</strong> to <strong style=\"overflow-wrap:anywhere;word-break:break-word;\">{{ .Email }}</strong>.",
      "If you made this change, use your updated email address the next time you sign in."
    ],
    "action": "Get account help",
    "link": "https://exegetical-bible.vercel.app/contact/",
    "note": "Wasn't you? Contact support immediately through the site. Do not share your password, codes, or sign-in links."
  },
  {
    "id": "phone-number-changed",
    "subject": "Your Exegetical Bible phone number was changed",
    "title": "Your phone number was changed.",
    "preheader": "Review a security update on your account.",
    "security": true,
    "paragraphs": [
      "Your account phone number was changed from <strong style=\"overflow-wrap:anywhere;word-break:break-word;\">{{ .OldPhone }}</strong> to <strong style=\"overflow-wrap:anywhere;word-break:break-word;\">{{ .Phone }}</strong>.",
      "If you made this change, no further action is needed."
    ],
    "action": "Get account help",
    "link": "https://exegetical-bible.vercel.app/contact/",
    "note": "Wasn't you? Contact support immediately and secure your account. Never share verification codes."
  },
  {
    "id": "sign-in-method-linked",
    "subject": "An Exegetical Bible sign-in method was linked",
    "title": "A sign-in method was linked.",
    "preheader": "Review a change to how your account can be accessed.",
    "security": true,
    "paragraphs": [
      "The <strong>{{ .Provider }}</strong> sign-in method was linked to your Exegetical Bible account.",
      "If you linked this method, no further action is needed."
    ],
    "action": "Get account help",
    "link": "https://exegetical-bible.vercel.app/contact/",
    "note": "Wasn't you? Contact support immediately and secure your account. Open the site directly if you are unsure about this message."
  },
  {
    "id": "sign-in-method-removed",
    "subject": "An Exegetical Bible sign-in method was removed",
    "title": "A sign-in method was removed.",
    "preheader": "Review a change to how your account can be accessed.",
    "security": true,
    "paragraphs": [
      "The <strong>{{ .Provider }}</strong> sign-in method was removed from your Exegetical Bible account.",
      "If you removed this method, make sure you still have another way to sign in."
    ],
    "action": "Get account help",
    "link": "https://exegetical-bible.vercel.app/contact/",
    "note": "Wasn't you? Contact support immediately and secure your account. Open the site directly if you are unsure about this message."
  },
  {
    "id": "mfa-method-added",
    "subject": "An Exegetical Bible verification method was added",
    "title": "A verification method was added.",
    "preheader": "Review a change to your account's extra sign-in protection.",
    "security": true,
    "paragraphs": [
      "A <strong>{{ .FactorType }}</strong> verification method was added to your Exegetical Bible account.",
      "If you added this method, no further action is needed."
    ],
    "action": "Get account help",
    "link": "https://exegetical-bible.vercel.app/contact/",
    "note": "Wasn't you? Contact support immediately and secure your account. Never share your verification or recovery codes."
  },
  {
    "id": "mfa-method-removed",
    "subject": "An Exegetical Bible verification method was removed",
    "title": "A verification method was removed.",
    "preheader": "Review a change to your account's extra sign-in protection.",
    "security": true,
    "paragraphs": [
      "A <strong>{{ .FactorType }}</strong> verification method was removed from your Exegetical Bible account.",
      "If you removed this method, review your remaining account protection."
    ],
    "action": "Get account help",
    "link": "https://exegetical-bible.vercel.app/contact/",
    "note": "Wasn't you? Contact support immediately and secure your account. Never share your verification or recovery codes."
  }
];
