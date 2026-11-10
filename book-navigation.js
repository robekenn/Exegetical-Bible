const oldTestament=new Set('GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL'.split(' '));
const newTestament=new Set('MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV'.split(' '));
export const testamentOf=id=>newTestament.has(id)?'new':oldTestament.has(id)?'old':'other';
const bibleBookOrder=new Map([...oldTestament,...newTestament].map((book,index)=>[book,index]));
export function compareBibleReferences(a,b){
 return (bibleBookOrder.get(a.book)??Infinity)-(bibleBookOrder.get(b.book)??Infinity)
  ||a.book.localeCompare(b.book)||a.chapter-b.chapter||a.verse-b.verse;
}
const groupNames={old:'Old Testament',new:'New Testament',other:'Other books'};
const aliases={GEN:['ge','genesis'],EXO:['ex','exodus'],LEV:['lv'],NUM:['nu','numbers'],DEU:['dt','deut'],JOS:['josh'],JDG:['judg','judges'],RUT:['ruth'],PSA:['ps','psalm','psalms'],PRO:['pr','prov'],ECC:['eccl'],SNG:['song','songofsongs','songofsolomon','canticles'],ISA:['is'],JER:['jeremiah'],EZK:['ezek','ezekiel'],DAN:['daniel'],MAT:['mt','matt','matthew'],MRK:['mk','mark'],LUK:['lk','luke'],JHN:['jn','joh','john'],ACT:['ac','acts'],ROM:['ro','romans'],'1CO':['1cor','1corinthians'],'2CO':['2cor','2corinthians'],GAL:['ga'],EPH:['ephesians'],PHP:['phil','philippians'],COL:['colossians'],'1TH':['1thess','1thessalonians'],'2TH':['2thess','2thessalonians'],'1TI':['1tim','1timothy'],'2TI':['2tim','2timothy'],TIT:['titus'],PHM:['philemon'],HEB:['hebrews'],JAS:['jam','james'],'1PE':['1pet','1peter'],'2PE':['2pet','2peter'],'1JN':['1john','1jn'],'2JN':['2john','2jn'],'3JN':['3john','3jn'],JUD:['jude'],REV:['re','revelation','revelations']};
const normalize=s=>String(s||'').toLowerCase().replace(/\b(first|second|third)\b/g,s=>({first:'1',second:'2',third:'3'}[s])).replace(/[\s.]/g,'');
const names=b=>[b.name,b.id,...(aliases[b.id]||[])].map(normalize);
export function searchPassage(query,books){
 const q=String(query||'').trim();if(!q)return {books,query:false};
 const exact=books.filter(b=>names(b).includes(normalize(q)));
 if(exact.length===1)return {books:exact,query:true};
 const rangeSyntax=/\d+\s*:\s*\d+\s*[-–—−]/;
 const ref=q.match(/^(.+?)\s*(\d+)\s*(?:(:)\s*(\d+))?(?:\s*[-–—−]\s*(\d*))?$/);
 if(ref){
  const term=normalize(ref[1]),exact=books.filter(b=>names(b).includes(term));
  const matched=exact.length?exact:books.filter(b=>names(b).some(n=>n.startsWith(term)));
  const error=message=>({books:matched,query:true,error:message});
  if(matched.length!==1)return error(rangeSyntax.test(ref[1])?'Enter a range within one chapter, such as John 3:16–18.':matched.length?'Use the full book name to choose a passage.':'Book not found in this translation. Try John 3:16 or Romans 8.');
  const b=matched[0],shorthand=b.numberOfChapters===1&&!ref[3];
  const chapter=shorthand?1:Number(ref[2]),verse=shorthand?Number(ref[2]):Number(ref[4]||1);
  const end=ref[5]===undefined?undefined:Number(ref[5]);
  if(chapter<1||chapter>b.numberOfChapters)return error(`${b.name} has ${b.numberOfChapters} chapters. Choose 1–${b.numberOfChapters}.`);
  if(end!==undefined&&!ref[3]&&!shorthand)return error('Include the starting verse for a range, such as John 3:16–18.');
  if(verse<1||verse>999)return error('Enter a verse number from 1 to 999.');
  if(end!==undefined&&(end<verse||end>999))return error('Enter an ending verse from the starting verse through 999.');
  const label=`${b.name} ${chapter}${ref[3]||shorthand?':'+verse:''}${end>verse?'–'+end:''}`;
  return {books:matched,query:true,target:{book:b.id,chapter,verse,label,...(end>verse?{endVerse:end}:{})}};
 }
 if(rangeSyntax.test(q))return {books:[],query:true,error:'Enter an ending verse number within the same chapter.'};
 const term=normalize(q);return {books:books.filter(b=>names(b).some(n=>n.includes(term))),query:true};
}

export function openSearchPassage(navigate,target){
 return navigate(target.book,target.chapter,target.verse,...(target.endVerse===undefined?[]:[target.endVerse]));
}
export function addVerseTextOption(root,query,search){
 const button=root.ownerDocument.createElement('button');
 button.type='button';
 button.className='passage-search-result';
 button.textContent=`Search verse text for “${query.trim()}”`;
 button.onclick=search;
 root.prepend(button);
}

export function setupBookSidebar({state,esc,navigate,toast,openVerseSearch}){
 const input=document.getElementById('bookFilter'),root=document.getElementById('books'),clear=document.getElementById('clearBookSearch'),status=document.getElementById('bookSearchStatus');let expanded=state.book,lastBook=state.book;
 let cancelVerseSearch;
 const filtered=()=>{const result=searchPassage(input.value,state.books);if(!result.query)result.books=result.books.filter(b=>state.testament==='all'||testamentOf(b.id)===state.testament);return result;};
 const openTarget=target=>openSearchPassage(navigate,target);
 function searchWords(){
  cancelVerseSearch?.();
  status.textContent='';
  cancelVerseSearch=openVerseSearch?.(input.value,root,undefined,state.testament);
 }

 function render(){
  cancelVerseSearch?.();
  cancelVerseSearch=undefined;
  if(lastBook!==state.book){expanded=state.book;lastBook=state.book;}
  const focus=document.activeElement,focusBook=focus?.dataset?.book,focusChapter=focus?.dataset?.sideChapter,result=filtered();clear.hidden=!input.value;
  status.textContent=result.error||(result.target?'Press Enter or choose the passage below.':`${result.books.length} ${result.books.length===1?'book':'books'}${result.query?' · searching all books':''}`);
  let group='';root.innerHTML=(result.target?`<button class="passage-search-result" id="sidebarSearchResult"><small>OPEN PASSAGE</small><strong>${esc(result.target.label)}</strong><span>Read in ${esc(state.translation)} →</span></button>`:'')+result.books.map(b=>{const heading=!result.query&&state.testament==='all'&&groupNames[testamentOf(b.id)]!==group?(group=groupNames[testamentOf(b.id)],`<h3 class="book-group-label">${group}</h3>`):'';return heading+`<div class="sidebar-book"><button data-book="${esc(b.id)}" class="${b.id===state.book?'chosen':''}" aria-expanded="${expanded===b.id}" aria-controls="side-chapters-${esc(b.id)}" ${b.id===state.book?'aria-current="true"':''}><span>${esc(b.name)}<small>${b.numberOfChapters} chapters</small></span><span class="book-chevron" aria-hidden="true">${expanded===b.id?'−':'+'}</span></button><div id="side-chapters-${esc(b.id)}" class="sidebar-chapters" ${expanded===b.id?'':'hidden'}>${expanded===b.id?Array.from({length:b.numberOfChapters},(_,i)=>`<button data-side-book="${esc(b.id)}" data-side-chapter="${i+1}" aria-label="Read ${esc(b.name)} ${i+1}" ${b.id===state.book&&i+1===state.chapter?'aria-current="page"':''}>${i+1}</button>`).join(''):''}</div></div>`;}).join('')||'<div class="book-search-empty"><p>Press Enter or tap the arrow to search verse text.</p></div>';
  root.querySelectorAll('[data-book]').forEach(b=>b.onclick=()=>{expanded=expanded===b.dataset.book?null:b.dataset.book;render();});root.querySelectorAll('[data-side-chapter]').forEach(b=>b.onclick=()=>openTarget({book:b.dataset.sideBook,chapter:Number(b.dataset.sideChapter),verse:1,label:b.getAttribute('aria-label').replace('Read ','')}));
  if(result.query&&!result.target&&!result.error&&result.books.length&&input.value.trim().length>=2&&openVerseSearch)addVerseTextOption(root,input.value,searchWords);
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
   searchWords();
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
 return {render,setTestament(){if(cancelVerseSearch?.setTestament)cancelVerseSearch.setTestament(state.testament);else render();}};
}
