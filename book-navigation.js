const aliases={GEN:['ge','genesis'],EXO:['ex','exodus'],LEV:['lv'],NUM:['nu','numbers'],DEU:['dt','deut'],JOS:['josh'],JDG:['judg','judges'],RUT:['ruth'],PSA:['ps','psalm','psalms'],PRO:['pr','prov'],ECC:['eccl'],SNG:['song','songofsongs','songofsolomon','canticles'],ISA:['is'],JER:['jeremiah'],EZK:['ezek','ezekiel'],DAN:['daniel'],MAT:['mt','matt','matthew'],MRK:['mk','mark'],LUK:['lk','luke'],JHN:['jn','joh','john'],ACT:['ac','acts'],ROM:['ro','romans'],'1CO':['1cor','1corinthians'],'2CO':['2cor','2corinthians'],GAL:['ga'],EPH:['ephesians'],PHP:['phil','philippians'],COL:['colossians'],'1TH':['1thess','1thessalonians'],'2TH':['2thess','2thessalonians'],'1TI':['1tim','1timothy'],'2TI':['2tim','2timothy'],TIT:['titus'],PHM:['philemon'],HEB:['hebrews'],JAS:['jam','james'],'1PE':['1pet','1peter'],'2PE':['2pet','2peter'],'1JN':['1john','1jn'],'2JN':['2john','2jn'],'3JN':['3john','3jn'],JUD:['jude'],REV:['re','revelation','revelations']};
const normalize=s=>String(s||'').toLowerCase().replace(/\b(first|second|third)\b/g,s=>({first:'1',second:'2',third:'3'}[s])).replace(/[\s.]/g,'');
const names=b=>[b.name,b.id,...(aliases[b.id]||[])].map(normalize);
export function searchPassage(query,books){
 const q=String(query||'').trim();if(!q)return {books,query:false};
 const exact=books.filter(b=>names(b).includes(normalize(q)));
 if(exact.length===1)return {books:exact,query:true};
 const ref=q.match(/^(.+?)\s*(\d+)\s*(?::\s*(\d+))?$/);
 if(ref){const term=normalize(ref[1]);const exact=books.filter(b=>names(b).includes(term));const matched=exact.length?exact:books.filter(b=>names(b).some(n=>n.startsWith(term)));
  if(matched.length===1){const b=matched[0],chapter=Number(ref[2]),verse=ref[3]?Number(ref[3]):1;if(chapter<1||chapter>b.numberOfChapters)return {books:matched,query:true,error:`${b.name} has ${b.numberOfChapters} chapters. Choose 1–${b.numberOfChapters}.`};if(verse<1||verse>999)return {books:matched,query:true,error:'Enter a verse number from 1 to 999.'};return {books:matched,query:true,target:{book:b.id,chapter,verse,label:`${b.name} ${chapter}${ref[3]?':'+verse:''}`}};}
  return {books:matched,query:true,error:matched.length?'Use the full book name to choose a passage.':'Book not found in this translation. Try John 3:16 or Romans 8.'};
 }
 const term=normalize(q);return {books:books.filter(b=>names(b).some(n=>n.includes(term))),query:true};
}

export function setupBookSidebar({state,esc,navigate,toast,openVerseSearch}){
 const input=document.getElementById('bookFilter'),root=document.getElementById('books'),clear=document.getElementById('clearBookSearch'),status=document.getElementById('bookSearchStatus');let expanded=state.book,lastBook=state.book;
 let cancelVerseSearch;
 const filtered=()=>{const result=searchPassage(input.value,state.books);if(!result.query)result.books=result.books.filter(b=>state.testament==='all'||(state.testament==='old'?b.order<=39:b.order>39));return result;};
 async function openTarget(target){await navigate(target.book,target.chapter,target.verse);if(state.data&&state.book===target.book&&state.chapter===target.chapter&&state.verse!==target.verse)toast(`Verse ${target.verse} is not available here. Opened ${target.label.split(':')[0]} instead.`);document.querySelector(`[data-verse="${state.verse}"]`)?.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
 function render(){
  cancelVerseSearch?.();
  if(lastBook!==state.book){expanded=state.book;lastBook=state.book;}
  const focus=document.activeElement,focusBook=focus?.dataset?.book,focusChapter=focus?.dataset?.sideChapter,result=filtered();clear.hidden=!input.value;
  status.textContent=result.error||(result.target?'Press Enter or choose the passage below.':`${result.books.length} ${result.books.length===1?'book':'books'}${result.query?' · searching all books':''}`);
  let group='';root.innerHTML=(result.target?`<button class="passage-search-result" id="sidebarSearchResult"><small>OPEN PASSAGE</small><strong>${esc(result.target.label)}</strong><span>Read in ${esc(state.translation)} →</span></button>`:'')+result.books.map(b=>{const heading=!result.query&&state.testament==='all'&&(b.order<=39?'Old Testament':'New Testament')!==group?(group=b.order<=39?'Old Testament':'New Testament',`<h3 class="book-group-label">${group}</h3>`):'';return heading+`<div class="sidebar-book"><button data-book="${esc(b.id)}" class="${b.id===state.book?'chosen':''}" aria-expanded="${expanded===b.id}" aria-controls="side-chapters-${esc(b.id)}" ${b.id===state.book?'aria-current="true"':''}><span>${esc(b.name)}<small>${b.numberOfChapters} chapters</small></span><span class="book-chevron" aria-hidden="true">${expanded===b.id?'−':'+'}</span></button><div id="side-chapters-${esc(b.id)}" class="sidebar-chapters" ${expanded===b.id?'':'hidden'}>${expanded===b.id?Array.from({length:b.numberOfChapters},(_,i)=>`<button data-side-book="${esc(b.id)}" data-side-chapter="${i+1}" aria-label="Read ${esc(b.name)} ${i+1}" ${b.id===state.book&&i+1===state.chapter?'aria-current="page"':''}>${i+1}</button>`).join(''):''}</div></div>`;}).join('')||'<div class="book-search-empty"><p>Press Enter or tap the arrow to search verse text.</p></div>';
  root.querySelectorAll('[data-book]').forEach(b=>b.onclick=()=>{expanded=expanded===b.dataset.book?null:b.dataset.book;render();});root.querySelectorAll('[data-side-chapter]').forEach(b=>b.onclick=()=>openTarget({book:b.dataset.sideBook,chapter:Number(b.dataset.sideChapter),verse:1,label:b.getAttribute('aria-label').replace('Read ','')}));
  if(result.target)document.getElementById('sidebarSearchResult').onclick=()=>openTarget(result.target);
  if(focusBook)[...root.querySelectorAll('[data-book]')].find(b=>b.dataset.book===focusBook)?.focus({preventScroll:true});else if(focusChapter)[...root.querySelectorAll('[data-side-chapter]')].find(b=>b.dataset.sideChapter===focusChapter)?.focus({preventScroll:true});
 }
 function submit(){
  const result=filtered();
  if(result.target){openTarget(result.target);return;}
  if(result.error){toast(result.error);return;}
  if(result.books.length===1){
   expanded=result.books[0].id;
   render();
   root.querySelector('[data-side-chapter]')?.focus();
   return;
  }
  if(!result.books.length&&input.value.trim().length>=2){
   cancelVerseSearch?.();
   status.textContent='';
   cancelVerseSearch=openVerseSearch?.(input.value,root);
  }
 }
 input.oninput=render;
 input.onkeydown=e=>{
  if(e.key==='Escape'){input.value='';render();}
  if(e.key==='ArrowDown'){e.preventDefault();root.querySelector('select,button')?.focus();}
  if(e.key==='Enter'){e.preventDefault();submit();}
 };
 document.getElementById('submitBookSearch').onclick=submit;
 clear.onclick=()=>{input.value='';render();input.focus();};
 document.addEventListener('keydown',e=>{if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!document.querySelector('dialog[open]')&&!/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)&&!document.activeElement?.isContentEditable&&input.getClientRects().length){e.preventDefault();input.focus();}});
 return {render};
}
