import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const paths=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const patterns=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/gh[pousr]_[A-Za-z0-9]{30,}/,/github_pat_[A-Za-z0-9_]{40,}/,/sb_secret_[A-Za-z0-9_-]{20,}/,/Authorization:\s*(?:Token|Bearer)\s+[A-Za-z0-9_.-]{30,}/,/postgres(?:ql)?:\/\/[^\s:<]+:[^\s@<>]+@/];
const failures=[];for(const path of paths){if(path=== 'scripts/check-secrets.mjs')continue;if(/(^|\/)\.env(\.|$)/.test(path)&&!path.endsWith('.example')){failures.push(path);continue;}if(!/\.(?:js|mjs|json|md|yml|yaml|html|sql)$/.test(path))continue;const value=readFileSync(path,'utf8');if(patterns.some(p=>p.test(value)))failures.push(path);}
if(failures.length){console.error('Possible committed secrets (values withheld):',failures.join(', '));process.exit(1);}console.log('Tracked source secret checks passed.');
