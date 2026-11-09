export function setupPassageHighlights({state,save,renderChapter,canEdit,toast,getSelectedRange=()=>null,isSelected=number=>number===state.verse}){
 const root=document.getElementById('passageHighlights');let enabled=false,chapter='';
 const numbers=()=>state.data?.chapter.content.filter(v=>v.type==='verse').map(v=>v.number)||[];
 function decorate(){const identity=state.book+'.'+state.chapter;if(chapter!==identity){chapter=identity;enabled=false;}if(!numbers().length){root.hidden=true;return;}root.hidden=false;root.classList.toggle('is-highlighting',enabled);
 root.innerHTML=`<div class="highlight-heading"><button id="togglePassageHighlights" type="button" aria-pressed="${enabled}" aria-label="${enabled?'Finish highlighting':'Highlight verses'}" title="${enabled?'Finish highlighting':'Highlight verses'}"><svg class="highlighter-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m14 3 7 7-9 9H5v-7l9-9Z"/><path d="m11 6 7 7M5 16l3 3M4 20l-2 2h7"/></svg></button></div>`;
 document.getElementById('togglePassageHighlights').onclick=()=>{
  if(!enabled&&!canEdit())return toast('Load your account before editing highlights.');
  const range=enabled?null:getSelectedRange();
  const selected=range?numbers().filter(number=>number>=range[0]&&number<=range[1]):[];
  if(selected.length){
   const keys=selected.map(number=>`${state.book}.${state.chapter}.${number}`);
   if(keys.some(key=>!state.highlights[key])){
    for(const key of keys)state.highlights[key]=true;
    save('exegetical-highlights',state.highlights);
    renderChapter();
   }
  }else{
   enabled=!enabled;
   decorate();
  }
  document.getElementById('togglePassageHighlights').focus({preventScroll:true});
 };
 decorateVerses();
 }
 function decorateVerses(){
 document.querySelectorAll('[data-verse]').forEach(b=>{const number=Number(b.dataset.verse),highlighted=Boolean(state.highlights[`${state.book}.${state.chapter}.${number}`]);b.classList.toggle('highlighted',highlighted);b.setAttribute('aria-pressed',String(enabled?highlighted:isSelected(number)));b.setAttribute('aria-label',enabled?`${highlighted?'Remove highlight from':'Highlight'} verse ${number}`:`Study ${state.books.find(x=>x.id===state.book)?.name||state.book} ${state.chapter}:${number}`);});
 }
 return {decorate,decorateVerses,consume(number){if(!enabled)return false;if(!canEdit()){toast('Load your account before editing highlights.');return true;}if(!numbers().includes(number))return true;const key=`${state.book}.${state.chapter}.${number}`;if(state.highlights[key])delete state.highlights[key];else state.highlights[key]=true;save('exegetical-highlights',state.highlights);renderChapter();document.querySelector(`[data-verse="${number}"]`)?.focus({preventScroll:true});return true;}};
}
