import {createBrowserClient,parseCookieHeader,serializeCookieHeader} from '/vendor/supabase.js';
import {persistentCookieOptions} from '/session-options.js';

const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const types={abuse:'User report',bug:'Bug report',feedback:'Feedback',appeal:'Ban appeal',privacy:'Privacy',support:'Support',accessibility:'Accessibility'};
const reviewStatuses=['open','reviewing','resolved','dismissed'];
let client,view='reports',page=0,version=0,accountId=null,selectedBan='',search='';
const status=message=>{$('adminStatus').textContent=message;};
const timestamp=value=>esc(new Date(value).toLocaleString());

function lock(message){
 version++;
 $('adminContent').hidden=true;
 $('reportList').replaceChildren();
 $('reportDetail').replaceChildren();
 $('userFilter').reset();
 search='';
 selectedBan='';
 status(message);
}
async function request(query={},body){
 const {data}=await client.auth.getSession();
 const token=data.session?.access_token;
 if(!token){lock('Sign in on the Bible site, then return here.');throw Error('Sign in required.');}
 const response=await fetch('/api/admin?'+new URLSearchParams(query),{
  method:body?'POST':'GET',
  headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},
  body:body?JSON.stringify(body):undefined,cache:'no-store'
 });
 const result=await response.json();
 if(!response.ok){
  if(response.status===401||(!body&&response.status===403))lock(result.error);
  throw Error(result.error);
 }
 return result;
}
function showView(next,{ban='',user=''}={}){
 view=next;
 page=0;
 selectedBan=ban;
 search=user;
 $('userSearch').value=user;
 document.querySelectorAll('[data-admin-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.adminView===view)));
 $('inboxFilters').hidden=view!=='reports';
 $('userFilter').hidden=view!=='users';
 $('clearBanFilter').hidden=view!=='bans'||!ban;
 return list();
}

async function list(){
 const requestVersion=++version;
 status('Loading…');
 $('reportList').replaceChildren();
 $('reportDetail').replaceChildren();
 $('previousReports').disabled=true;
 $('nextReports').disabled=true;
 try{
  const query={view,page};
  if(view==='reports')Object.assign(query,{status:$('statusFilter').value,category:$('categoryFilter').value});
  if(view==='users')query.search=search;
  if(view==='bans'&&selectedBan)query.ban=selectedBan;
  const data=await request(query);
  if(requestVersion!==version)return;
  $('adminContent').hidden=false;
  status(view==='users'&&!data.mailConfigured?'Ban notices need email setup before accounts can be banned.':'');
  $('pageLabel').textContent='Page '+(page+1);
  $('previousReports').disabled=page===0;
  $('nextReports').disabled=!(data.hasMore??data.reports?.length===25);
  if(view==='reports'){
   cards(data.reports,row=>types[row.category]||row.category,row=>row.status,row=>row.details.slice(0,130),row=>detail(row.id));
  }else if(view==='users'){
   cards(data.rows,row=>row.display_name||row.username||row.email||row.id,row=>row.role,row=>row.email,
    row=>userDetail(row,data.owner,data.mailConfigured));
  }else if(view==='bans'){
   cards(data.rows,row=>row.email,row=>row.lifted_at?'Lifted':'Active',row=>'Email: '+row.email_status,
    row=>banDetail(row,data.mailConfigured));
  }else{
   $('reportList').innerHTML=data.rows.map(row=>`<article class="review-event">
    <strong>${esc(row.action)}</strong> · ${timestamp(row.created_at)}
    <p>Actor: ${esc(row.actor)}<br>Target: ${esc(row.target)}</p>
    ${row.reason?`<p>${esc(row.reason)}</p>`:''}
   </article>`).join('')||'<p>No moderation actions yet.</p>';
  }
 }catch(error){
  if(requestVersion===version)status(error.message);
 }
}

function cards(rows,title,subtitle,description,open){
 const root=$('reportList');
 root.innerHTML=rows.map((row,index)=>`<button class="report-card" type="button" data-item="${index}">
  <strong>${esc(title(row))} · ${esc(subtitle(row))}</strong>
  <small>${timestamp(row.created_at)}</small><p>${esc(description(row))}</p>
 </button>`).join('')||'<p>No items in this view.</p>';
 root.querySelectorAll('[data-item]').forEach(button=>button.onclick=()=>{
  root.querySelectorAll('[aria-current]').forEach(item=>item.removeAttribute('aria-current'));
  button.setAttribute('aria-current','true');
  open(rows[Number(button.dataset.item)]);
 });
}
function bindAction(form,run){
 const actionVersion=version;
 form.onsubmit=async event=>{
  event.preventDefault();
  const button=form.querySelector('button[type="submit"]');
  button.disabled=true;
  try{await run(()=>actionVersion===version);}
  catch(error){if(actionVersion===version)status(error.message);}
  finally{button.disabled=false;}
 };
}
async function detail(id){
 const requestVersion=++version;
 $('reportDetail').innerHTML='<p>Loading submission…</p>';
 try{
  const {report,history}=await request({id});
  if(requestVersion!==version)return;
  $('reportDetail').innerHTML=`<h2>${esc(types[report.category]||report.category)}</h2>
   <p class="muted">${esc(report.id)}</p>
   <p>Submitted by ${esc(report.reporter||'Guest or deleted account')}${report.subject?`<br>Reported user: ${esc(report.subject)}`:''}</p>
   ${report.subject?'<button type="button" id="findReportedUser">Find reported user</button>':''}
   ${report.ban_id?'<button type="button" id="findAppealedBan">View ban</button>':''}
   <h3>Details</h3><pre>${esc(report.details)}</pre>
   ${report.evidence?`<h3>Message evidence</h3><pre>${esc(JSON.stringify(report.evidence,null,2))}</pre>`:''}
   <form id="reviewForm">
    <label class="label" for="reviewStatus">Status</label>
    <select id="reviewStatus">${reviewStatuses.map(item=>`<option ${item===report.status?'selected':''}>${item}</option>`).join('')}</select>
    <label class="label" for="reviewNote">Internal decision note</label>
    <textarea id="reviewNote" required maxlength="2000"></textarea>
    <button class="primary" type="submit">Save review</button>
   </form>
   <h3>Review history</h3>
   ${history.map(item=>`<article class="review-event"><strong>${esc(item.status)}</strong> · ${timestamp(item.created_at)}<p>${esc(item.note)}</p><small>Admin ID: ${esc(item.actor||'Deleted account')}</small></article>`).join('')||'<p>No reviews yet.</p>'}`;
  if(report.subject)$('findReportedUser').onclick=()=>showView('users',{user:report.subject});
  if(report.ban_id)$('findAppealedBan').onclick=()=>showView('bans',{ban:report.ban_id});
  bindAction($('reviewForm'),async current=>{
   await request({}, {report_id:id,status:$('reviewStatus').value,note:$('reviewNote').value});
   if(!current())return;
   await list();
   if(view==='reports')await detail(id);
   status('Review saved.');
  });
 }catch(error){if(requestVersion===version)$('reportDetail').textContent=error.message;}
}
function userDetail(user,owner,mailConfigured){
 const requestVersion=++version;
 const protectedAccount=user.role==='owner'||user.id===accountId;
 const roleAction=user.role==='admin'?'demote':'promote';
 $('reportDetail').innerHTML=`<h2>${esc(user.display_name||user.username||user.email||user.id)}</h2>
  <p>${esc(user.email)} · ${esc(user.role)}</p><p class="muted">${esc(user.id)}</p>
  ${owner&&!protectedAccount?`<button type="button" id="changeRole">${roleAction==='promote'?'Promote to admin':'Remove admin role'}</button>`:''}
  ${!protectedAccount&&user.role==='member'&&mailConfigured?`
   <form id="banUserForm">
    <h3>Ban and delete account</h3>
    <p>This permanently deletes the account and blocks its email. The reason below will be emailed with an appeal link.</p>
    <label class="label" for="banReason">Reason for the user</label>
    <textarea id="banReason" required minlength="10" maxlength="2000"></textarea>
    <label class="label" for="banConfirmation">Type BAN to confirm</label>
    <input id="banConfirmation" required pattern="BAN" autocomplete="off">
    <button type="submit" class="danger">Ban and delete</button>
   </form>`:''}`;
 if($('changeRole'))$('changeRole').onclick=async event=>{
  if(!confirm(roleAction==='promote'?'Give this user access to private reports and moderation tools?':'Remove this user’s admin access?'))return;
  event.currentTarget.disabled=true;
  try{
   await request({}, {action:roleAction,target:user.id});
   if(requestVersion===version){await list();status('Role updated.');}
  }catch(error){
   if(requestVersion===version){status(error.message);$('changeRole').disabled=false;}
  }
 };
 if($('banUserForm'))bindAction($('banUserForm'),async current=>{
  const result=await request({}, {action:'ban',target:user.id,reason:$('banReason').value,confirmation:$('banConfirmation').value});
  if(!current())return;
  await showView('bans');
  status(result.emailStatus==='sent'?'Account deleted. Ban notice sent.':'Account deleted. Check the Bans view to retry the notice.');
 });
}
function banDetail(ban,mailConfigured){
 const requestVersion=++version;
 $('reportDetail').innerHTML=`<h2>${esc(ban.email)}</h2>
  <p>${ban.lifted_at?'Lifted '+timestamp(ban.lifted_at):'Active ban'}</p>
  <h3>Reason sent to the user</h3><pre>${esc(ban.reason)}</pre>
  <p>Email status: ${esc(ban.email_status)}</p>
  ${!ban.lifted_at&&ban.email_status!=='sent'&&mailConfigured?'<button type="button" id="retryBanEmail">Retry notice</button>':''}
  ${ban.lifted_at?'':`<form id="liftBanForm">
   <h3>Lift email block</h3><p>The person can register again. The deleted account cannot be restored.</p>
   <label class="label" for="liftReason">Internal decision note</label>
   <textarea id="liftReason" required minlength="10" maxlength="2000"></textarea>
   <button type="submit">Lift ban</button>
  </form>`}`;
 if($('retryBanEmail'))$('retryBanEmail').onclick=async event=>{
  const button=event.currentTarget;
  button.disabled=true;
  try{
   const result=await request({}, {action:'retry_email',target:ban.id});
   if(requestVersion===version){await list();status(result.emailStatus==='sent'?'Notice sent.':'Notice has not been sent. Check email setup and try again.');}
  }catch(error){if(requestVersion===version)status(error.message);}
  finally{button.disabled=false;}
 };
 if($('liftBanForm'))bindAction($('liftBanForm'),async current=>{
  await request({}, {action:'lift',target:ban.id,reason:$('liftReason').value});
  if(current()){await list();status('Email block lifted.');}
 });
}

document.querySelectorAll('[data-admin-view]').forEach(button=>button.onclick=()=>showView(button.dataset.adminView));
for(const id of ['statusFilter','categoryFilter'])$(id).onchange=()=>{page=0;list();};
$('userFilter').onsubmit=event=>{event.preventDefault();search=$('userSearch').value.trim();page=0;list();};
$('refreshReports').onclick=list;
$('clearBanFilter').onclick=()=>showView('bans');
$('previousReports').onclick=()=>{page=Math.max(0,page-1);list();};
$('nextReports').onclick=()=>{page++;list();};
try{
 const config=await fetch('/api/config').then(response=>response.json());
 if(!config.supabaseUrl||!config.supabaseKey)throw Error('Accounts unavailable.');
 client=createBrowserClient(config.supabaseUrl,config.supabaseKey,{
  cookies:{
   getAll:()=>parseCookieHeader(document.cookie),
   setAll:items=>{for(const {name,value,options}of items)document.cookie=serializeCookieHeader(name,value,persistentCookieOptions(options,location.protocol==='https:'));}
  }
 });
 client.auth.onAuthStateChange((event,session)=>{
  if(!session){accountId=null;lock('Signed out. Sign in on the Bible site to continue.');}
  else if(accountId&&accountId!==session.user.id){accountId=session.user.id;lock('Account changed. Refresh to verify admin access.');}
  else accountId=session.user.id;
 });
 await list();
}catch(error){status(error.message);}
