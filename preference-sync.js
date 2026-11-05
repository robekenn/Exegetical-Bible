export const favoriteStorageKey='exegetical-favorite-translations';

export function favoriteIds(value){
 return Array.isArray(value)?[...new Set(value.filter(id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(id)))]:[];
}

export function applyFavoriteChanges(saved,changes){
 const ids=new Set(favoriteIds(saved));
 for(const [id,selected] of Object.entries(changes||{})){
  if(!favoriteIds([id]).length)continue;
  if(selected===true)ids.add(id);
  else if(selected===false)ids.delete(id);
 }
 return [...ids];
}

// Serialize settings writes, retaining the newest pending snapshot through failures.
export function createPreferenceSync({send,persist,onChange=()=>{},isCurrent=()=>true,initial=null,delay=800}){
 let pending=initial,running=false,error='',timer;
 const notify=()=>onChange();
 async function flush(){clearTimeout(timer);if(running||!pending||!isCurrent())return;running=true;notify();try{while(pending&&isCurrent()){const snapshot=pending;const result=await send(snapshot);if(!isCurrent())return;if(result?.error)throw result.error;error='';if(pending===snapshot){pending=null;persist(null);}}}catch(e){if(isCurrent())error=e.message||'Reading preferences could not sync.';}finally{running=false;if(isCurrent())notify();}}
 return {queue(settings){if(!isCurrent())return;pending=settings;persist(settings);error='';notify();clearTimeout(timer);timer=setTimeout(flush,delay);},flush,get pending(){return pending;},get error(){return error;},dispose(){clearTimeout(timer);}};
}
export function savingStatus({signedIn,ready,conflicts=0,noteError='',notesPending=0,preferencesPending=false,preferencesError='',online=true}){
 if(!signedIn)return {text:'Saved on this device',detail:'Guest notes are stored in this browser.',attention:false,saving:false};
 if(!ready)return {text:'Account not ready',detail:'Your device copy is available. Open Account to retry loading.',attention:true,saving:false};
 if(conflicts)return {text:'Review note changes',detail:'A note changed on another device. Choose which version to keep in Account.',attention:true,saving:false};
 if(!online)return {text:'Offline · saved on device',detail:'Keep this page open. Account saving will retry when you reconnect.',attention:true,saving:false};
 if(noteError||preferencesError)return {text:'Saved on device · retry sync',detail:noteError?'Notes have not reached your account yet. Open Account to retry.':'Reading preferences have not reached your account yet. Open Account to retry.',attention:true,saving:false};
 if(notesPending||preferencesPending)return {text:'Saved on device · syncing…',detail:'Sending your latest changes to your private account.',attention:false,saving:true};
 return {text:'Saved to account',detail:'Notes, highlights and reading preferences are up to date.',attention:false,saving:false};
}
