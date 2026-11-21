// Chapter arrows and deliberate, one-finger horizontal pulls share the reader's navigation.
export function setupChapterNavigation(doc=document,win=window,phone=win.matchMedia('(max-width: 760px)')){
 const reader=doc.querySelector('.reading-content'),text=doc.getElementById('chapterText');
 const previous=doc.getElementById('previous'),next=doc.getElementById('next');
 if(!reader||!text||!previous||!next)return;
 for(const [id,source] of [['chapterPrevious',previous],['chapterNext',next]]){
  const button=doc.getElementById(id);if(!button)continue;
  const sync=()=>button.disabled=source.disabled;sync();
  new win.MutationObserver(sync).observe(source,{attributes:true,attributeFilter:['disabled']});
  button.onclick=()=>source.click();
 }
 let gesture=null,suppressUntil=0;
 // Unsupported browsers (including iPhone Safari) have no programmable vibration API.
 // A rejected request can be retried on release, after touch activation is available.
 function pulse(){try{return typeof win.navigator.vibrate==='function'&&win.navigator.vibrate(24)===true;}catch{return false;}}
 const selection=()=>!!win.getSelection()?.toString();
 const available=dir=>!(dir>0?next:previous).disabled&&text.getAttribute('aria-busy')!=='true';
 const blocked=()=>!phone.matches||doc.body.classList.contains('mobile-study-open')||!!doc.querySelector('dialog[open]')||selection();
 function reset(){gesture=null;text.style.removeProperty('--chapter-pull');text.classList.remove('chapter-pulling');}
 reader.addEventListener('touchstart',event=>{
  reset();if(event.touches.length!==1||blocked())return;
  const touch=event.touches[0];
  if(touch.clientX<24||touch.clientX>win.innerWidth-24||event.target.closest('input,textarea,select,a,.chapter-nav,button:not(.verse)'))return;
  gesture={x:touch.clientX,y:touch.clientY,id:touch.identifier,locked:false,ready:false,dir:0,hapticAttempted:false,hapticSent:false};
 },{passive:true});
 reader.addEventListener('touchmove',event=>{
  if(!gesture)return;
  if(event.touches.length!==1||blocked()){reset();return;}
  const touch=event.touches[0];if(touch.identifier!==gesture.id){reset();return;}
  const dx=touch.clientX-gesture.x,dy=touch.clientY-gesture.y;
  if(!gesture.locked){
   if(Math.max(Math.abs(dx),Math.abs(dy))<12)return;
   if(Math.abs(dx)<Math.abs(dy)*1.6){reset();return;}
   gesture.locked=true;
  }
  if(event.cancelable)event.preventDefault();
  suppressUntil=Date.now()+500;
  const dir=dx<0?1:-1,allowed=available(dir),ready=allowed&&Math.abs(dx)>=80;
  if(ready&&!gesture.hapticAttempted){gesture.hapticAttempted=true;gesture.hapticSent=pulse();}
  gesture.dir=dir;gesture.ready=ready;
  text.classList.add('chapter-pulling');text.style.setProperty('--chapter-pull',(allowed?Math.max(-48,Math.min(48,dx*.35)):dx*.08)+'px');
 },{passive:false});
 reader.addEventListener('touchend',event=>{
  if(!gesture)return;
  if(![...event.changedTouches].some(t=>t.identifier===gesture.id))return;
  const {ready,dir,locked}=gesture;
  const commit=ready&&event.touches.length===0&&!blocked()&&available(dir);
  if(locked){if(event.cancelable)event.preventDefault();suppressUntil=Date.now()+500;}
  if(commit&&!gesture.hapticSent)pulse();
  reset();if(commit)(dir>0?next:previous).click();
 },{passive:false});
 reader.addEventListener('touchcancel',reset,{passive:true});
 reader.addEventListener('click',event=>{if(!event.target.closest('#previous,#next')&&Date.now()<suppressUntil){event.preventDefault();event.stopImmediatePropagation();}},true);
 phone.addEventListener('change',reset);
 win.addEventListener('blur',reset);
}
