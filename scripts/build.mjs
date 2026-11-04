import {build} from 'esbuild';
import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('dist/vendor',{recursive:true});
await build({stdin:{contents:"export {createClient} from '@supabase/supabase-js'; export {createBrowserClient,parseCookieHeader,serializeCookieHeader} from '@supabase/ssr';",resolveDir:process.cwd()},outfile:'dist/vendor/supabase.js',bundle:true,format:'esm',minify:true,platform:'browser',target:'es2022'});
for(const p of ['index.html','style.css','app.js','account.js','sync-model.js','community.js','community-model.js','session-options.js','mobile.js','account-avatar.js','account-access.js','polish.js','streak.js','security-model.js','account-menu.js','passage-highlights.js','foreground-scroll.js','preference-sync.js','404.html'])await copyFile(p,'dist/'+p);
console.log('Built static app and bundled Supabase client.');

await import('./legal.mjs');

await mkdir('dist/admin',{recursive:true});
for(const p of ['index.html','admin.js','admin.css'])await copyFile('admin/'+p,'dist/admin/'+p);
