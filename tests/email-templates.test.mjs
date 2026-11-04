import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { templates, renderEmail } from '../emails/templates.mjs';

const variables = {
  'confirm-sign-up': ['ConfirmationURL'],
  'invite-user': ['ConfirmationURL'],
  'magic-link-or-otp': ['ConfirmationURL'],
  'change-email-address': ['ConfirmationURL', 'NewEmail'],
  'reset-password': ['ConfirmationURL'],
  'reauthentication': ['Token'],
  'password-changed': [],
  'email-address-changed': ['OldEmail', 'Email'],
  'phone-number-changed': ['OldPhone', 'Phone'],
  'sign-in-method-linked': ['Provider'],
  'sign-in-method-removed': ['Provider'],
  'mfa-method-added': ['FactorType'],
  'mfa-method-removed': ['FactorType']
};
test('all account email flows preserve supported verification variables and safe destinations', () => {
  assert.deepEqual(templates.map(t => t.id).sort(), Object.keys(variables).sort());
  for (const t of templates) {
    const html = renderEmail(t);
    const used = [...new Set([...html.matchAll(/{{\s*\.(\w+)\s*}}/g)].map(m => m[1]))].sort();
    assert.deepEqual(used, [...variables[t.id]].sort(), t.id);
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    assert.equal(doc.querySelectorAll('h1').length, 1, t.id);
    assert.equal(doc.querySelector('h1').textContent, t.title);
    assert.equal(doc.querySelector('script, img, form, iframe'), null);
    for (const a of doc.querySelectorAll('a')) {
      const href = a.getAttribute('href');
      assert.ok(href === '{{ .ConfirmationURL }}' || href.startsWith('https://exegetical-bible.vercel.app/'), href);
    }
    assert.ok(!t.subject.includes('{{'), 'Keep verification secrets out of subject previews');
    if (t.security) assert.ok(doc.body.textContent.includes("Wasn't you?"));
    dom.window.close();
  }
});
