import {findPlan,progressKey,readPlanCache} from './plan-catalog.js';

// Each account has a separate cache. Pending writes retain their base revision across reloads.
export function createPlanStore({account,storage=localStorage,onChange=()=>{},online=()=>navigator.onLine!==false,delay=600,canUse=()=>true}){
 let owner=null,epoch=0,timer=null,running=false,disposed=false;
 let state={runs:{},entries:{},pending:{},conflicts:{},loading:false,error:'',storageError:false};
 const key=id=>id?'exegetical-user-'+id+'-plans':'exegetical-plans';
 const user=()=>account?.getUser()?.id||null;
 const current=(id,version)=>!disposed&&canUse()&&id===user()&&version===epoch;
 function read(id){try{return readPlanCache(JSON.parse(storage.getItem(key(id))));}catch{return readPlanCache(null);}}
 function notify(){if(!disposed)onChange(state);}
 function persist(){
  try{storage.setItem(key(owner),JSON.stringify({format:1,runs:state.runs,entries:state.entries,pending:state.pending}));state.storageError=false;}
  catch{state.storageError=true;}
 }
 function changed(){persist();notify();clearTimeout(timer);timer=setTimeout(flush,delay);}
 function entry(versionId,session){return state.entries[progressKey(versionId,session)]||{versionId,session,completed:false,reflection:'',revision:0};}
 function start(versionId){
  if(!canUse())throw Error('Beta previews are unavailable.');
  if(!findPlan(versionId))throw Error('This plan is unavailable.');
  if(state.loading)throw Error('Your plans are still loading. Try again in a moment.');
  if(!state.runs[versionId]){
   state.runs[versionId]={versionId,id:null,startedAt:new Date().toISOString(),active:true,activityRevision:0,...(owner?{pendingActivity:{active:true,baseRevision:0}}:{})};changed();
  }else if(state.runs[versionId].active===false)setActivity(versionId,true);
  return state.runs[versionId];
 }
 function setActivity(versionId,active){
  if(!canUse())throw Error('Beta previews are unavailable.');
  if(state.loading)throw Error('Your plans are still loading. Try again in a moment.');
  const run=state.runs[versionId];if(!run||run.active===active)return;
  run.active=active;
  if(owner)run.pendingActivity={active,baseRevision:run.pendingActivity?.baseRevision??run.activityRevision??0};
  changed();
 }
 function quit(versionId){setActivity(versionId,false);}
 function hasPending(){return Boolean(owner)&&(Object.keys(state.pending).length>0||Object.values(state.runs).some(run=>!run.id||run.pendingActivity));}
 function update(versionId,session,patch){
  const plan=findPlan(versionId);
  if(!plan?.sessions.some(item=>item.number===session))throw Error('This session is unavailable.');
  if(typeof patch.reflection==='string'&&patch.reflection.length>20000)throw Error('Use up to 20,000 characters for a reflection.');
  if(state.runs[versionId]?.active===false)throw Error('Resume this plan before editing a session.');
  start(versionId);
  const k=progressKey(versionId,session),previous=entry(versionId,session);
  const next={...previous,...(typeof patch.reflection==='string'?{reflection:patch.reflection}:{}),...(typeof patch.completed==='boolean'?{completed:patch.completed}:{}),updatedAt:new Date().toISOString()};
  state.entries[k]=next;
  if(owner)state.pending[k]={baseRevision:state.pending[k]?.baseRevision??previous.revision,entry:{...next}};
  changed();
 }
 async function request(query,id,version){
  const result=await query;
  if(!current(id,version))return null;
  if(result.error)throw result.error;
  return result.data;
 }
 async function flush(){
  clearTimeout(timer);
  if(!canUse()||disposed||running||state.loading||!owner||!online())return;
  const id=owner,version=epoch,client=account.getClient();
  if(!client)return;
  running=true;state.error='';notify();
  try{
   for(const run of Object.values(state.runs)){
    if(run.id)continue;
    const rows=await request(client.rpc('start_personal_reading_plan',{p_version_id:run.versionId}),id,version);
    if(!current(id,version))return;
    if(!rows?.[0]?.id)throw Error('The plan could not be started. Try again.');
    run.id=rows[0].id;persist();
   }
   for(const run of Object.values(state.runs)){
    const pending=run.pendingActivity;if(!pending)continue;
    try{
     const rows=await request(client.rpc('set_personal_reading_plan_active',{p_run_id:run.id,p_active:pending.active,p_revision:pending.baseRevision}),id,version);
     if(!current(id,version))return;
     const saved=rows?.[0];if(!saved)throw Error('The plan status could not be saved. Try again.');
     run.activityRevision=Number(saved.activity_revision);
     if(run.pendingActivity===pending)delete run.pendingActivity;
     else if(run.pendingActivity)run.pendingActivity.baseRevision=run.activityRevision;
    }catch(error){
     if(!current(id,version))return;
     if(error.code!=='40001')throw error;
     const rows=await request(client.from('reading_plan_runs').select('id,is_active,activity_revision').eq('id',run.id).eq('owner_id',id),id,version);
     if(!current(id,version))return;
     if(!rows?.[0])throw Error('This plan is unavailable. Retry syncing.');
     run.active=rows[0].is_active!==false;run.activityRevision=Number(rows[0].activity_revision);delete run.pendingActivity;
     state.error='This plan changed on another device. Its current status has been restored; your reflections are preserved.';
    }
    persist();
   }
   for(const [k,pending]of Object.entries(state.pending)){
    if(state.conflicts[k])continue;
    const local=pending.entry,run=state.runs[local.versionId];
    try{
     const rows=await request(client.rpc('save_reading_plan_progress',{p_run_id:run.id,p_session:local.session,p_completed:local.completed,p_reflection:local.reflection,p_revision:pending.baseRevision}),id,version);
     if(!current(id,version))return;
     const saved=rows?.[0];
     if(!saved)throw Error('The reflection could not be saved. Try again.');
     if(state.pending[k]===pending){delete state.pending[k];state.entries[k]={...local,revision:Number(saved.revision),updatedAt:saved.updated_at};}
     else if(state.pending[k]){state.entries[k].revision=Number(saved.revision);state.pending[k].baseRevision=Number(saved.revision);state.pending[k].entry.revision=Number(saved.revision);}
     persist();
    }catch(error){
     if(!current(id,version))return;
     if(error.code==='40001'){
      const rows=await request(client.from('reading_plan_progress').select('*').eq('run_id',run.id).eq('user_id',id).eq('session_number',local.session),id,version);
      if(!current(id,version))return;
      const remote=rows?.[0];
      // A lost response can mean the previous write succeeded. A retry is then already satisfied.
      if(remote&&remote.completed===local.completed&&remote.reflection===local.reflection){
       if(state.pending[k]===pending){delete state.pending[k];state.entries[k]={...local,revision:Number(remote.revision),updatedAt:remote.updated_at};}
       else if(state.pending[k]){state.entries[k].revision=Number(remote.revision);state.pending[k].baseRevision=Number(remote.revision);state.pending[k].entry.revision=Number(remote.revision);}
       persist();continue;
      }
      state.conflicts[k]=remote?{versionId:local.versionId,session:local.session,completed:remote.completed,reflection:remote.reflection,revision:Number(remote.revision),updatedAt:remote.updated_at}:{versionId:local.versionId,session:local.session,completed:false,reflection:'',revision:0};
     }else throw error;
    }
   }
  }catch(error){if(current(id,version))state.error=error.message||'Could not sync your plans. Try again.';}
  finally{
   if(current(id,version)){running=false;persist();notify();clearTimeout(timer);if(!state.error&&(Object.keys(state.pending).some(k=>!state.conflicts[k])||Object.values(state.runs).some(run=>run.pendingActivity)))timer=setTimeout(flush,delay);}
  }
 }
 async function load(){
  const id=user(),version=++epoch;
  owner=id;clearTimeout(timer);running=false;
  state={...read(id),conflicts:{},loading:Boolean(id),error:'',storageError:false};notify();
  if(!canUse()){state.loading=false;notify();return;}
  if(!id)return;
  const client=account.getClient();
  try{
   if(!online())throw Error('You’re offline. Your device copy is available; reconnect to sync.');
   const runs=await request(client.from('reading_plan_runs').select('id,version_id,created_at,is_active,activity_revision').eq('owner_id',id).eq('mode','personal'),id,version);
   if(!current(id,version))return;
   const rows=await request(client.from('reading_plan_progress').select('*').eq('user_id',id),id,version);
   if(!current(id,version))return;
   const merged=read(id);
   for(const run of runs||[]){
    if(!findPlan(run.version_id))continue;
    const local=merged.runs[run.version_id];
    merged.runs[run.version_id]={versionId:run.version_id,id:run.id,startedAt:run.created_at,active:run.is_active!==false,activityRevision:Number(run.activity_revision)||0,...(local?.pendingActivity?{active:local.active,pendingActivity:local.pendingActivity}:{})};
   }
   // Clean rows follow the account; offline edits stay local until their revision is accepted.
   for(const k of Object.keys(merged.entries))if(!merged.pending[k]&&merged.runs[merged.entries[k].versionId]?.id)delete merged.entries[k];
   for(const row of rows||[]){
    if(!findPlan(row.version_id)||!merged.runs[row.version_id])continue;
    const k=progressKey(row.version_id,row.session_number);
    if(!merged.pending[k])merged.entries[k]={versionId:row.version_id,session:row.session_number,completed:row.completed,reflection:row.reflection,revision:Number(row.revision),updatedAt:row.updated_at};
   }
   state={...merged,conflicts:{},loading:false,error:'',storageError:false};persist();notify();await flush();
  }catch(error){if(current(id,version)){state.loading=false;state.error=error.message||'Could not load your plans. Retry when you’re connected.';notify();}}
 }
 function resolve(versionId,session,choice){
  const k=progressKey(versionId,session),remote=state.conflicts[k];
  if(!remote)return;
  if(choice==='account'){state.entries[k]=remote;delete state.pending[k];}
  else{state.entries[k].revision=remote.revision;state.pending[k]={baseRevision:remote.revision,entry:{...state.entries[k]}};}
  delete state.conflicts[k];changed();
 }
 function guestAvailable(){return owner&&Object.keys(read(null).runs).some(versionId=>!state.runs[versionId]);}
 function importGuest(){
  if(!owner||state.loading)throw Error('Wait for your account plans to load first.');
  const guest=read(null);let count=0;
  for(const run of Object.values(guest.runs)){
   if(state.runs[run.versionId])continue;
   state.runs[run.versionId]={...run,id:null,activityRevision:0,pendingActivity:{active:run.active!==false,baseRevision:0}};count++;
   for(const [k,row]of Object.entries(guest.entries))if(row.versionId===run.versionId){const local={...row,revision:0};state.entries[k]=local;state.pending[k]={baseRevision:0,entry:{...local}};}
  }
  changed();return count;
 }
 function status(){
  if(state.storageError)return 'Could not save on this device. Keep this page open and copy your reflection.';
  if(state.loading)return 'Loading your account plans…';
  if(Object.keys(state.conflicts).length)return 'A session changed on another device. Choose which copy to keep.';
  if(!owner)return 'Saved on this device';
  if(state.error)return state.error;
  if(!online())return 'Offline · changes stay on this device until you reconnect';
  if(running||hasPending())return 'Saving to your account…';
  return 'Saved to your account';
 }
 function refresh(){if(!state.loading&&!running&&!hasPending())load();else flush();}
 return {get state(){return state;},get owner(){return owner;},load,flush,start,quit,hasPending,update,entry,resolve,importGuest,guestAvailable,status,refresh,dispose(){disposed=true;epoch++;clearTimeout(timer);}};
}
