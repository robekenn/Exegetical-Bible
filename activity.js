const heartbeatMs=60_000;
export const activityWindowMs=5*heartbeatMs;

export function activityStatus(lastSeen,now=Date.now()){
 const time=Date.parse(lastSeen);
 if(!Number.isFinite(time))return null;
 const age=Math.max(0,now-time);
 if(age<=activityWindowMs)return {label:'Active now',active:true};
 const [unit,size]=age<3_600_000?['minute',heartbeatMs]:age<86_400_000?['hour',3_600_000]:['day',86_400_000];
 const count=Math.floor(age/size);
 return {label:`Active ${count} ${unit}${count===1?'':'s'} ago`,active:false};
}

export function trackStudyActivity({getUser,getClient}){
 let lastInput=Date.now(),lastSent=0,owner=null,sending=null;
 function send(){
  if(document.visibilityState!=='visible'||navigator.onLine===false)return;
  const id=getUser()?.id,client=getClient();
  if(!id||!client)return;
  if(id!==owner){owner=id;lastSent=0;sending=null;}
  const now=Date.now();
  if(sending||now-lastInput>heartbeatMs||now-lastSent<heartbeatMs)return;
  lastSent=now;
  const request=Promise.resolve(client.rpc('record_study_activity'));
  sending=request;
  void request.catch(()=>{}).finally(()=>{if(sending===request)sending=null;});
 }
 function interact(){lastInput=Date.now();send();}
 for(const event of ['pointerdown','keydown','scroll'])window.addEventListener(event,interact,{passive:true});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')interact();});
 document.addEventListener('study-auth-changed',()=>{
  if(getUser()?.id===owner)return;
  owner=null;lastSent=0;sending=null;
  interact();
 });
 window.addEventListener('online',interact);
 window.setInterval(send,heartbeatMs);
 send();
}
