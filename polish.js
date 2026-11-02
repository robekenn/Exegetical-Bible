export function setupPolish(doc=document,win=window){
 const splash=doc.getElementById('appLoading'),shell=doc.getElementById('appShell'),connection=doc.getElementById('connectionStatus');let finished=false;
 const finish=()=>{if(finished)return;finished=true;win.clearTimeout(timer);if(splash)splash.hidden=true;if(shell){shell.inert=false;shell.removeAttribute('aria-busy');}};
 const network=()=>{if(connection){connection.hidden=win.navigator.onLine!==false;connection.textContent='You’re offline. Some passages and account saving may be unavailable. Your current page will stay open.';}};
 const timer=win.setTimeout(()=>{finish();const notice=doc.getElementById('startupNotice');if(notice)notice.hidden=false;},12000);
 doc.addEventListener('app-ready',()=>{finish();const notice=doc.getElementById('startupNotice');if(notice)notice.hidden=true;},{once:true});
 win.addEventListener('online',network);win.addEventListener('offline',network);network();
 return {finish};
}
if(typeof document!=='undefined')setupPolish();
