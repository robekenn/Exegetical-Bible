import {mkdir,writeFile} from 'node:fs/promises';

for(const appeal of [false,true]){
 const slug=appeal?'appeal':'feedback';
 const title=appeal?'Appeal an account ban':'Send feedback or report a bug';
 await mkdir('dist/'+slug,{recursive:true});
 await writeFile('dist/'+slug+'/index.html',`<!doctype html>
<html lang="en">
<head>
 <meta charset="utf-8">
 <meta name="viewport" content="width=device-width,initial-scale=1">
 <meta name="robots" content="noindex">
 <title>${title} · Exegetical</title>
 <link rel="stylesheet" href="/style.css">
 <link rel="stylesheet" href="/admin/admin.css">
</head>
<body>
 <main class="admin-shell feedback-page">
  <a href="/">← Back to Bible</a>
  <h1>${title}</h1>
  <p>${appeal?'Explain what you believe should be reconsidered. If the email block is lifted, you can register again. Deleted account data cannot be restored.':'Tell us what you expected and what happened. For bugs, include the page, device, and steps to reproduce it if you can.'}</p>
  <form id="feedbackForm" data-appeal="${appeal}">
   ${appeal?'':`<label class="label" for="feedbackCategory">Type</label>
    <select id="feedbackCategory" name="category"><option value="feedback">Feedback</option><option value="bug">Bug report</option></select>`}
   <label class="label" for="feedbackDetails">${appeal?'Your appeal':'Details'}</label>
   <textarea id="feedbackDetails" name="details" required minlength="10" maxlength="3000"></textarea>
   <button type="submit" class="primary">${appeal?'Submit appeal':'Send to admins'}</button>
  </form>
  <p id="feedbackStatus" role="status"></p>
  <p><a href="/privacy/">Data &amp; privacy</a>${appeal?'':' · <a href="/contact/">Other requests</a>'}</p>
 </main>
 <script type="module" src="/feedback.js"></script>
</body>
</html>`);
}
