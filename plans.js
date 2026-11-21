import {planCatalog,findPlan,planProgress,progressKey} from './plan-catalog.js';
import {createPlanStore} from './plan-store.js';

export function setupPlans({account,esc,toast,openPassage,getTranslation,doc=document,win=window,storage=localStorage,canPreview=()=>true}){
 const $=id=>doc.getElementById(id),page=$('plansPage'),workspace=doc.querySelector('.workspace');
 let view={type:'catalog'},filter='all',reading=null;
 const store=createPlanStore({account,storage,canUse:canPreview,onChange:refresh,online:()=>win.navigator.onLine!==false});
 const icon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v17H5zM8 8h8M8 12h6M8 16h4"/></svg>';
 const button=(label,action,extra='')=>`<button type="button" data-plan-action="${action}" ${extra}>${label}</button>`;
 function progress(plan){return planProgress(plan,store.state.entries);}
 function active(plan){return Boolean(store.state.runs[plan.versionId]&&store.state.runs[plan.versionId].active!==false&&!progress(plan).finished);}
 function progressBar(plan){const p=progress(plan);return `<div class="plan-progress-label"><span>${p.completed} of ${p.total} sessions</span><span>${p.percent}%</span></div><progress max="${p.total}" value="${p.completed}" aria-label="${esc(plan.title)} progress">${p.percent}%</progress>`;}
 function statusMarkup(){return '<div id="planSyncNotice" class="plan-sync-notice" role="status"></div>';}
 function metadata(plan){return `<span>${plan.sessions.length} sessions</span><span>${esc(plan.minutes)} each</span><span>At your pace</span>`;}
 function card(plan){
  const saved=Boolean(store.state.runs[plan.versionId]),started=saved&&store.state.runs[plan.versionId].active!==false,p=progress(plan);
  return `<article class="plan-card" data-tone="${plan.tone}"><div class="plan-card-cover" aria-hidden="true"><span>THE BOOK OF</span><strong>${esc(plan.bookName)}</strong><i></i><small>${plan.sessions.length} sessions · Scripture reading</small></div><div class="plan-card-copy"><p class="plan-kicker">${esc(plan.kind)}</p><h3>${esc(plan.title)}</h3><p>${esc(plan.description)}</p><div class="plan-metadata">${metadata(plan)}</div>${saved?progressBar(plan):''}${button(p.finished?'Revisit plan':started?'Continue reading →':saved?'Resume plan →':'Explore plan →',started&&!p.finished?'session':'explore',`data-version="${plan.versionId}" data-session="${p.next}" class="plan-card-open"`)}</div></article>`;
 }
 function catalog(){
  const inProgress=planCatalog.filter(active);
  const recent=inProgress.sort((a,b)=>{
   const latest=plan=>Math.max(Date.parse(store.state.runs[plan.versionId].startedAt)||0,...Object.values(store.state.entries).filter(e=>e.versionId===plan.versionId).map(e=>Date.parse(e.updatedAt)||0));
   return latest(b)-latest(a);
  })[0];
  const list=planCatalog.filter(plan=>filter==='all'&&!active(plan)||filter==='started'&&active(plan)||filter==='finished'&&store.state.runs[plan.versionId]&&progress(plan).finished);
  page.innerHTML=`<div class="plans-shell"><header class="plans-heading"><div><p class="plan-kicker">A RHYTHM OF READING</p><h1>Make time for the Word.</h1><p>Choose a plan. Read at your pace. Return right where you left off.</p></div>${button('← Back to Bible','reader','class="plan-text-button"')}</header>${statusMarkup()}
   ${store.guestAvailable()?`<aside class="plan-device-import"><div><strong>Bring your device progress with you</strong><p>Add plans started while signed out. Plans already in your account stay as they are.</p></div>${button('Add device progress','import','class="plan-secondary"')}</aside>`:''}
   ${recent?`<section class="plan-continue" data-tone="${recent.tone}" aria-label="Continue your study"><div class="plan-continue-icon">${icon}</div><div><p class="plan-kicker">CONTINUE YOUR STUDY</p><h2>${esc(recent.title)}</h2><p>Next: ${esc(recent.sessions[progress(recent).next-1].title)}</p>${progressBar(recent)}</div>${button('Continue →','session',`data-version="${recent.versionId}" data-session="${progress(recent).next}" class="plan-primary"`)}</section>`:''}
   <section aria-labelledby="planCatalogTitle"><div class="plan-catalog-heading"><div><h2 id="planCatalogTitle">Find your next plan</h2><p class="muted">Scripture reading plans · ${store.owner?'Private to your account':'No account needed to begin'}</p></div><div class="plan-filters" role="group" aria-label="Filter plans">${[['all','Available studies'],['started','In progress'],['finished','Completed']].map(([value,label])=>button(label,'filter',`data-filter="${value}" aria-pressed="${filter===value}"`)).join('')}</div></div><div class="plan-catalog-grid">${list.map(card).join('')||`<div class="plan-empty"><h3>${filter==='finished'?'Your finished plans will be here':filter==='started'?'A fresh beginning':'You’re studying them all'}</h3><p>${filter==='finished'?'Finish a plan to revisit its sessions and your reflections here.':filter==='started'?'Choose a plan from Available studies to start your first session.':'Your active plans are in In progress. Finish or quit one to make it available here again.'}</p>${button(filter==='all'?'View in-progress plans':'Browse available studies','filter',`data-filter="${filter==='all'?'started':'all'}" class="plan-secondary"`)}</div>`}</div></section>
   <footer class="plans-catalog-foot"><p>These plans contain passage schedules. Bible text comes from the translation you choose in the reader.</p><p>Devotional studies and shared group plans are being prepared.</p></footer></div>`;
 }
 function overview(plan){
  const p=progress(plan),saved=Boolean(store.state.runs[plan.versionId]),started=saved&&store.state.runs[plan.versionId].active!==false;
  page.innerHTML=`<div class="plans-shell plan-detail"><div class="plan-breadcrumb">${button('← Plans','catalog','class="plan-text-button"')}</div><header class="plan-overview-heading" data-tone="${plan.tone}"><div><p class="plan-kicker">${esc(plan.kind)}</p><h1>${esc(plan.title)}</h1><p>${esc(plan.description)}</p><div class="plan-metadata">${metadata(plan)}</div><p class="plan-author">By ${esc(plan.author)} · Version ${plan.version}</p></div><div class="plan-overview-start">${saved?progressBar(plan):'<p>A little time in Scripture, one session at a time.</p>'}${button(p.finished?'Revisit first session':started?'Continue reading →':saved?'Resume this plan →':'Start this plan →','session',`data-version="${plan.versionId}" data-session="${p.next}" class="plan-primary" ${store.state.loading?'disabled':''}`)}<small>${store.owner?'Your progress and reflections sync to your account.':'Your progress saves in this browser. Sign in anytime to bring it to your account.'}</small>${active(plan)?button('Quit plan','quit',`data-version="${plan.versionId}" class="plan-text-button" ${store.state.loading?'disabled':''}`):''}</div></header>${statusMarkup()}
   <section class="plan-session-list" aria-labelledby="planSessionsTitle"><div class="plan-catalog-heading"><h2 id="planSessionsTitle">Your path through ${esc(plan.bookName)}</h2><span>${plan.sessions.length} sessions</span></div><ol>${plan.sessions.map(session=>{const row=store.entry(plan.versionId,session.number);return `<li>${button(`<span class="plan-session-number ${row.completed?'is-complete':''}" aria-hidden="true">${row.completed?'✓':session.number}</span><span><strong>${esc(session.title)}</strong><small>${row.completed?'Completed':row.reflection?'Reflection saved':'Ready when you are'}</small></span><span aria-hidden="true">→</span>`,'session',`data-version="${plan.versionId}" data-session="${session.number}" aria-label="Session ${session.number}: ${esc(session.title)}${row.completed?', completed':''}"`)}</li>`;}).join('')}</ol></section><p class="plan-source">${esc(plan.credits)}</p></div>`;
 }
 function session(plan,number){
  const item=plan.sessions[number-1],row=store.entry(plan.versionId,number);
  page.innerHTML=`<div class="plans-shell plan-session-page"><div class="plan-breadcrumb">${button('← '+esc(plan.title),'explore',`data-version="${plan.versionId}" class="plan-text-button"`)}<span>Session ${number} of ${plan.sessions.length}</span></div><header class="plan-session-heading"><p class="plan-kicker">READ · REFLECT · RETURN</p><h1>${esc(item.title)}</h1><p>${esc(plan.title)}</p></header><div class="plan-session-progress">${progressBar(plan)}</div>
   <section class="plan-reading-card" aria-labelledby="planReadingTitle"><div class="plan-reading-icon">${icon}</div><div><p class="plan-kicker">TODAY’S READING</p><h2 id="planReadingTitle">${esc(item.title)}</h2><p>Open the passage with commentary, notes, and your usual study tools.</p></div>${button('Read in '+esc(getTranslation())+' →','passage',`data-version="${plan.versionId}" data-session="${number}" class="plan-primary"`)}</section>
   ${item.devotional?`<section class="plan-devotional"><h2>Devotional</h2>${esc(item.devotional).split(/\n+/).map(text=>`<p>${text}</p>`).join('')}</section>`:''}
   ${item.questions.length?`<section class="plan-questions"><h2>Reflect</h2><ol>${item.questions.map(q=>`<li>${esc(q)}</li>`).join('')}</ol></section>`:''}
   <section class="plan-reflection" aria-labelledby="planReflectionTitle"><div class="plan-reflection-heading"><div><h2 id="planReflectionTitle">Space to reflect</h2><p>Optional · Private to ${store.owner?'your account':'this browser'}.</p></div><span class="plan-private-label">${icon} Private</span></div><label class="sr-only" for="planReflection">Your private reflection on ${esc(item.title)}</label><textarea id="planReflection" maxlength="20000" placeholder="Write a thought you want to come back to…" ${store.state.loading?'disabled':''}>${esc(row.reflection)}</textarea><div class="plan-reflection-footer"><small>Saved as you write. Only you can see this.</small><span id="planReflectionCount">${row.reflection.length.toLocaleString()} / 20,000</span></div></section>${statusMarkup()}<div id="planConflict"></div>
   <div class="plan-session-actions">${button(number===plan.sessions.length?'Complete plan ✓':'Complete & continue →','complete',`class="plan-primary" id="planComplete" ${store.state.loading?'disabled':''}`)}${button('Mark incomplete','incomplete','class="plan-text-button" id="planIncomplete" hidden')}${active(plan)?button('Quit plan','quit',`data-version="${plan.versionId}" class="plan-text-button" ${store.state.loading?'disabled':''}`):''}</div><nav class="plan-session-pagination" aria-label="Plan sessions">${button('← Previous','session',`data-version="${plan.versionId}" data-session="${number-1}" ${number===1?'disabled':''}`)}${button('All sessions','explore',`data-version="${plan.versionId}"`)}${button('Next →','session',`data-version="${plan.versionId}" data-session="${number+1}" ${number===plan.sessions.length?'disabled':''}`)}</nav><p class="plan-source">${esc(plan.credits)}</p></div>`;
  $('planReflection').oninput=event=>{store.update(plan.versionId,number,{reflection:event.target.value});$('planReflectionCount').textContent=event.target.value.length.toLocaleString()+' / 20,000';};
  updateSession(plan,number);
 }
 function quitConfirmation(plan){
  page.innerHTML=`<div class="plans-shell plan-quit-confirm"><p class="plan-kicker">YOUR STUDY, YOUR PACE</p><h1>Quit ${esc(plan.title)}?</h1><p>This removes the plan from In progress and puts it back in Available studies.</p><p>Your completed sessions and private reflections will be kept. You can resume where you left off whenever you’re ready.</p><div class="plan-session-actions">${button('Keep studying','cancel-quit','class="plan-primary"')}${button('Quit plan','confirm-quit',`data-version="${plan.versionId}" class="plan-secondary" ${store.state.loading?'disabled':''}`)}</div>${statusMarkup()}</div>`;
 }
 function finished(plan){
  page.innerHTML=`<div class="plans-shell plan-finished"><span class="plan-finish-mark" aria-hidden="true">✓</span><p class="plan-kicker">A MOMENT TO LOOK BACK</p><h1>You’ve completed ${esc(plan.title)}.</h1><p>${plan.sessions.length} sessions, at your own pace. Your reflections are here whenever you want to return.</p>${progressBar(plan)}<div class="plan-session-actions">${button('Revisit your sessions','explore',`data-version="${plan.versionId}" class="plan-primary"`)}${button('Find another plan','catalog','class="plan-secondary"')}</div>${statusMarkup()}</div>`;
 }
 function bind(){page.querySelectorAll('[data-plan-action]').forEach(el=>el.onclick=()=>act(el));}
 function render(focus=false){
  if(view.type==='session'&&store.state.runs[view.versionId]?.active===false)view={type:'overview',versionId:view.versionId};
  const plan=findPlan(view.versionId);
  if(view.type==='session'&&plan)session(plan,view.session);
  else if(view.type==='overview'&&plan)overview(plan);
  else if(view.type==='finished'&&plan)finished(plan);
  else if(view.type==='quit'&&plan)quitConfirmation(plan);
  else catalog();
  bind();updateNotice();
  if(focus){page.querySelector('h1')?.setAttribute('tabindex','-1');page.querySelector('h1')?.focus({preventScroll:true});win.scrollTo({top:0,behavior:'instant'});}
 }
 function updateNotice(){
  const root=$('planSyncNotice');if(!root)return;
  const message=store.status(),retrying=Boolean(store.state.error);
  if(root.dataset.message===message&&root.dataset.retry===String(retrying))return;
  root.dataset.message=message;root.dataset.retry=String(retrying);root.replaceChildren();
  const text=doc.createElement('span');text.textContent=message;root.append(text);
  if(store.state.error){const retry=doc.createElement('button');retry.type='button';retry.textContent='Retry sync';retry.onclick=()=>store.refresh();root.append(retry);}
  root.classList.toggle('needs-attention',Boolean(store.state.error||store.state.storageError||Object.keys(store.state.conflicts).length));
 }
 function updateSession(plan,number){
  const row=store.entry(plan.versionId,number),p=progress(plan);
  const editor=$('planReflection');
  if(editor&&doc.activeElement!==editor&&editor.value!==row.reflection)editor.value=row.reflection;
  if(editor)editor.disabled=store.state.loading;
  const complete=$('planComplete');
  if(complete){complete.disabled=store.state.loading;complete.textContent=row.completed?(number===plan.sessions.length?'Review plan':'Continue →'):(number===plan.sessions.length?'Complete plan ✓':'Complete & continue →');}
  if($('planIncomplete'))$('planIncomplete').hidden=!row.completed;
  const bar=page.querySelector('.plan-session-progress');if(bar)bar.innerHTML=progressBar(plan);
  const conflict=store.state.conflicts[progressKey(plan.versionId,number)],target=$('planConflict');
  const signature=conflict?`${conflict.revision}:${conflict.updatedAt||''}`:'';
  if(target&&target.dataset.signature!==signature){target.dataset.signature=signature;target.innerHTML=conflict?`<section class="plan-conflict-box"><h3>This session changed on another device</h3><p>Your writing is still here. Review the account copy before deciding which version to keep.</p><details><summary>View account copy</summary><p>${esc(conflict.reflection||'No reflection saved.')}</p><small>${conflict.completed?'Marked complete':'Not marked complete'}</small></details><div class="button-row">${button('Keep this device’s copy','keep-local')}${button('Use account copy','keep-account')}</div></section>`:'';target.querySelectorAll('[data-plan-action]').forEach(el=>el.onclick=()=>act(el));}
  if($('planReflectionCount'))$('planReflectionCount').textContent=row.reflection.length.toLocaleString()+' / 20,000';
  updateNotice();return p;
 }
 function refresh(){
  updateReaderBar();
  if(page.hidden)return;
  if(view.type==='session'&&store.state.runs[view.versionId]?.active===false){view={type:'overview',versionId:view.versionId};render(true);}
  else if(view.type==='session'&&$('planReflection'))updateSession(findPlan(view.versionId),view.session);
  else render();
 }
 function markNav(plans){
  doc.querySelector('.skip-link')?.setAttribute('href',plans?'#plansPage':'#reader');
  for(const id of ['readNav','plansNav']){const el=$(id);if(!el)continue;const selected=plans?id==='plansNav':id==='readNav';el.classList.toggle('nav-active',selected);if(selected)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');}
  doc.querySelectorAll('[data-mobile-view]').forEach(el=>{const selected=el.dataset.mobileView===(plans?'plans':'read');el.classList.toggle('active',selected);if(selected)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
 }
 function open(next=view){
  if(!canPreview())return toast('Beta previews are unavailable.');
  doc.dispatchEvent(new win.CustomEvent('close-mobile-study'));
  workspace.hidden=true;page.hidden=false;view=next;markNav(true);render(true);
 }
 function showReader(){page.hidden=true;workspace.hidden=false;markNav(false);updateReaderBar();}
 function updateReaderBar(){
  if(reading&&store.state.runs[reading.versionId]?.active===false)reading=null;
  const bar=$('planReadingBar');if(!bar)return;
  bar.hidden=!reading;
  if(reading){const plan=findPlan(reading.versionId);$('planReadingLabel').textContent=`${plan.title} · Session ${reading.session}`;}
 }
 async function act(el){
  const action=el.dataset.planAction,versionId=el.dataset.version||view.versionId,plan=findPlan(versionId),number=Number(el.dataset.session||view.session);
  try{
   if(action==='quit'){view={type:'quit',versionId,returnTo:{...view}};render(true);return;}
   if(action==='cancel-quit'){view=view.returnTo||{type:'overview',versionId};render(true);return;}
   if(action==='confirm-quit'){
    store.quit(versionId);
    if(reading?.versionId===versionId)reading=null;
    view={type:'catalog'};filter='all';updateReaderBar();render(true);toast('Plan removed from In progress. Your progress and reflections are kept.');return;
   }
   if(action==='reader'){showReader();$('reader').focus({preventScroll:true});return;}
   if(action==='catalog'){view={type:'catalog'};render(true);return;}
   if(action==='filter'){filter=el.dataset.filter;render();page.querySelector(`[data-filter="${filter}"]`)?.focus({preventScroll:true});return;}
   if(action==='import'){const count=store.importGuest();toast(`${count} device ${count===1?'plan added':'plans added'}. Your device copy is preserved.`);return;}
   if(action==='explore'){view={type:'overview',versionId};render(true);return;}
   if(action==='session'){if(!plan?.sessions[number-1])return;store.start(versionId);view={type:'session',versionId,session:number};render(true);return;}
   if(action==='passage'){
    el.disabled=true;
    const opened=await openPassage(plan.sessions[number-1].passages[0]);
    if(opened===false){el.disabled=false;return;}
    reading={versionId,session:number};showReader();win.scrollTo({top:0,behavior:'instant'});return;
   }
   if(action==='incomplete'){store.update(versionId,number,{completed:false});return;}
   if(action==='complete'){
    store.update(versionId,number,{completed:true});
    view=progress(plan).finished?{type:'finished',versionId}:number<plan.sessions.length?{type:'session',versionId,session:number+1}:{type:'overview',versionId};render(true);return;
   }
   if(action==='keep-local'||action==='keep-account'){store.resolve(versionId,number,action==='keep-local'?'device':'account');return;}
  }catch(error){toast(error.message);el.disabled=false;}
 }
 $('plansNav').onclick=()=>open();
 $('mobilePlansButton').onclick=()=>open();
 $('returnToPlan').onclick=()=>open({type:'session',...reading});
 $('planReadingDismiss').onclick=()=>{reading=null;updateReaderBar();};
 $('readNav').addEventListener('click',showReader,{capture:true});
 $('mobileReadButton').addEventListener('click',showReader,{capture:true});
 $('mobileStudyButton').addEventListener('click',showReader,{capture:true});
 doc.addEventListener('study-before-signout',event=>{if(store.hasPending()&&!win.confirm('Your plan progress has not synced yet. Signing out removes this device’s unsynced copy. Cancel to keep it open and retry syncing, or OK to sign out.'))event.preventDefault();});
 doc.addEventListener('beta-before-disable',event=>{if(store.hasPending()){event.preventDefault();store.flush();toast('Wait for your plan changes to sync before turning previews off.');}});
 doc.addEventListener('beta-access-changed',()=>{reading=null;view={type:'catalog'};page.replaceChildren();if(!canPreview())showReader();store.load();});
 doc.addEventListener('study-auth-changed',()=>{reading=null;view={type:'catalog'};page.replaceChildren();store.load();});
 win.addEventListener('online',()=>store.refresh());
 doc.addEventListener('visibilitychange',()=>{if(doc.visibilityState==='visible')store.refresh();});
 win.addEventListener('beforeunload',event=>{if(store.hasPending()){event.preventDefault();event.returnValue='';}});
 store.load();
 return {open,showReader,store};
}
