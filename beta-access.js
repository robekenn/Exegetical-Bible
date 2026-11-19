// Role and preview preference come from the server. Failure always hides beta UI.
export function setupBetaAccess({account,toast,doc=document,win=window,fetcher=fetch}){
 let enabled=false,eligible=false,epoch=0;
 const user=()=>account.getUser()?.id||null;
 function apply(value){eligible=value.eligible===true;enabled=eligible&&value.enabled===true;
  for(const id of ['plansNav','mobilePlansButton'])doc.getElementById(id).hidden=!enabled;
  bind();doc.dispatchEvent(new win.CustomEvent('beta-access-changed'));
 }
 async function request(setting){if(setting===false&&!doc.dispatchEvent(new win.CustomEvent('beta-before-disable',{cancelable:true})))return;const owner=user(),version=++epoch;if(!owner){apply({});return;}
  try{const {data}=await account.getClient().auth.getSession();if(owner!==user()||version!==epoch)return;
   const response=await fetcher(setting===undefined?'/api/admin?beta=1':'/api/admin',{method:setting===undefined?'GET':'POST',cache:'no-store',headers:{Authorization:'Bearer '+data.session?.access_token,...(setting===undefined?{}:{'Content-Type':'application/json'})},...(setting===undefined?{}:{body:JSON.stringify({action:'beta_preview',enabled:setting})})});
   const result=await response.json();if(owner!==user()||version!==epoch)return;if(!response.ok)throw Error(result.error||'Could not verify beta access.');
   if(result.enabled!==enabled||result.eligible!==eligible)apply(result);else bind();
  }catch(error){if(owner===user()&&version===epoch){apply({});if(setting!==undefined)toast(error.message);}}
 }
 function bind(){const button=doc.getElementById('betaPreview');if(!button)return;button.hidden=!eligible;if(!eligible)return;
  const title=enabled?'Beta previews: on':'Beta previews: off';const subtitle=enabled?'Switch off to use the regular experience':'Switch on to try features in development';
  if(button.querySelector('strong').textContent!==title)button.querySelector('strong').textContent=title;
  if(button.querySelector('small').textContent!==subtitle)button.querySelector('small').textContent=subtitle;
  button.setAttribute('aria-pressed',String(enabled));button.onclick=async()=>{button.disabled=true;await request(!enabled);if(button.isConnected)button.disabled=false;};
 }
 new win.MutationObserver(bind).observe(doc.getElementById('modalBody'),{childList:true,subtree:true});
 doc.addEventListener('study-auth-changed',()=>{epoch++;apply({});request();});
 doc.addEventListener('visibilitychange',()=>{if(doc.visibilityState==='visible')request();});
 win.setInterval(()=>{if(doc.visibilityState==='visible')request();},60000);
 request();return {get enabled(){return enabled;}};
}
