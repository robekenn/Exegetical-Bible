const DAY=86400000;
export const localDay=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const ordinal=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return NaN;const n=Date.parse(s+'T00:00:00Z');return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===s?n/DAY:NaN;};
const dateOf=n=>new Date(n*DAY).toISOString().slice(0,10);
export function mergeStreak(a={},b={},today=localDay()){
 a=a&&typeof a==='object'?a:{};b=b&&typeof b==='object'?b:{};
 const end=ordinal(today),ranges=[...(Array.isArray(a.ranges)?a.ranges:[]),...(Array.isArray(b.ranges)?b.ranges:[])].filter(r=>Array.isArray(r)&&r.length===2).map(([s,e])=>[ordinal(s),Math.min(ordinal(e),end)]).filter(([s,e])=>Number.isFinite(s)&&Number.isFinite(e)&&s<=e).sort((a,b)=>a[0]-b[0]);const merged=[];
 for(const r of ranges){const last=merged.at(-1);if(last&&r[0]<=last[1]+1)last[1]=Math.max(last[1],r[1]);else merged.push([...r]);}
 const best=Math.max(0,...[a.best,b.best].filter(n=>Number.isSafeInteger(n)&&n>=0&&n<100000),...merged.map(([s,e])=>e-s+1));
 return {ranges:merged.slice(-120).map(([s,e])=>[dateOf(s),dateOf(e)]),best};
}
export function streakStats(record,today=localDay()){
 const data=mergeStreak(record,{},today),day=ordinal(today),last=data.ranges.at(-1),active=last&&ordinal(last[1])>=day-1;return {current:active?ordinal(last[1])-ordinal(last[0])+1:0,best:data.best,today:data.ranges.some(([s,e])=>ordinal(s)<=day&&ordinal(e)>=day),week:Array.from({length:7},(_,i)=>{const n=day-6+i;return {day:dateOf(n),done:data.ranges.some(([s,e])=>ordinal(s)<=n&&ordinal(e)>=n)};})};
}
const flame='<svg viewBox="0 0 48 56" aria-hidden="true"><path fill="#e89b43" d="M27 2c3 15-9 17-5 27 4-2 7-6 7-11 11 9 18 20 12 30C30 65 1 54 5 35c2-10 11-14 13-24 3 4 3 8 2 11C29 15 22 10 27 2Z"/><path fill="#ffe3a0" d="M25 29c2 8-8 10-6 18 2 8 14 6 15-2 1-6-5-12-9-16Z"/></svg>';
export function setupStreak({modal,changed,canRead,read,write,toast}){
 let owner=null,record={},elapsed=0,lastTick=Date.now();const key=()=>owner?'exegetical-user-'+owner+'-streak':'exegetical-streak';const root=document.getElementById('readingStreak');
 function snapshot(){return mergeStreak(record);}
 function render(){const s=streakStats(record);root.innerHTML=`${flame}<strong>${s.current}</strong><span class="sr-only">day${s.current===1?'':'s'}</span>`;root.setAttribute('aria-label',`${s.current} day reading streak. ${s.today?'Today counted.':'Read for 30 active seconds to count today.'} View progress`);}
 function persist(){record=snapshot();write(key(),record);render();}
 function merge(remote){record=mergeStreak(record,remote);persist();}
 document.addEventListener('study-auth-changed',e=>{owner=e.detail?.id||null;record=mergeStreak(read(key(),{}));elapsed=0;lastTick=Date.now();render();});
 root.onclick=()=>{const s=streakStats(record);modal('A little each day.',`<div class="streak-celebration">${flame}<h3>${s.current} day${s.current===1?'':'s'} in the Word</h3><p>${s.today?'You made time to read today. Keep growing, one day at a time.':'Spend 30 active seconds with an open passage to count today.'}</p></div><div class="streak-calendar">${s.week.map(d=>`<div><small>${new Date(d.day+'T12:00:00').toLocaleDateString(undefined,{weekday:'short'})}</small><span class="${d.done?'done':''}" aria-label="${d.day}: ${d.done?'read':'not counted'}">${d.done?'✓':'·'}</span></div>`).join('')}</div><p class="muted">Personal best: ${s.best} day${s.best===1?'':'s'}. Days follow your device’s local calendar. Only time with this page visible counts.</p><p class="muted">${owner?'Saved with your account’s reading preferences.':'Saved on this device. Sign in for an account streak.'} Missing a day starts a fresh streak—your personal best stays.</p>`);};
 record=mergeStreak(read(key(),{}));render();
 setInterval(()=>{const now=Date.now(),delta=Math.min(2000,now-lastTick);lastTick=now;render();if(document.visibilityState!=='visible'||!canRead())return;if(streakStats(record).today)return;elapsed+=delta;if(elapsed<30000)return;elapsed=0;const today=localDay();merge({ranges:[[today,today]]});changed();const s=streakStats(record);if([3,7,14,30,50,100,365].includes(s.current))toast(`🔥 ${s.current} days of reading! A new milestone.`);else toast('Today’s reading counted. Keep the flame growing.');},1000);
 return {snapshot,merge};
}
