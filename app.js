import {setupBookSidebar} from './book-navigation.js';
import {setupForegroundScroll} from './foreground-scroll.js';
import {setupPassageHighlights} from './passage-highlights.js';
import {setupStreak} from './streak.js';
import {setupMobile} from './mobile.js';
import {createCommunity} from './community.js';
import {createAccount} from './account.js';
let account=null;
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const flatten=v=>typeof v==='string'?v:Array.isArray(v)?v.filter(part=>part?.noteId===undefined).map(flatten).join(' '):v?.text??(v?.content?flatten(v.content):'');
const inlineVerse=content=>flatten(content).replace(/\s*[\r\n]+\s*/g,' ').trim();
const cache=new Map();
async function api(path){if(!path.startsWith('ESV/')&&!path.startsWith('AB_')&&path!=='available_api_bible.json'&&cache.has(path))return cache.get(path);const r=await fetch('/api/bible?path='+encodeURIComponent(path),{signal:AbortSignal.timeout(20000)});const d=await r.json();if(!r.ok){const error=Error(d.error||'Unable to load this resource.');error.status=r.status;throw error;}if(!path.startsWith('ESV/')&&!path.startsWith('AB_')&&path!=='available_api_bible.json')cache.set(path,d);return d;}
let apiBibleError='';
function reportBibleView(data){
 if(!data?.fumsToken)return;
 window.fumsData=window.fumsData||[];
 window.fums=window.fums||function(){window.fumsData.push(arguments);};
 if(!document.getElementById('apiBibleTracker')){const script=document.createElement('script');script.id='apiBibleTracker';script.src='https://pkg.api.bible/fumsV3.min.js';script.async=true;document.head.append(script);}
 window.fums('trackView',data.fumsToken);
}
const favoriteKey='exegetical-favorite-translations';
const savedFavorites=stored(favoriteKey,[]);
const favorites=new Set(Array.isArray(savedFavorites)?savedFavorites.filter(id=>typeof id==='string'):[]);
function refreshFavoriteControls(){
 $('translationList')?.dispatchEvent(new Event('favorites-changed'));
}
function setFavorites(ids){
 favorites.clear();
 ids.forEach(id=>favorites.add(id));
 refreshFavoriteControls();
}
function toggleFavorite(id){
 const selected=!favorites.has(id);
 if(account?.isUser()){
  return account.changeFavorite(id,selected);
 }
 if(selected)favorites.add(id);
 else favorites.delete(id);
 try{localStorage.setItem(favoriteKey,JSON.stringify([...favorites]));}
 catch{toast('Favorites could not be saved on this device.');}
 return true;
}
function matchesTranslation(t,query){
 return [t.id,t.shortName,t.name,t.englishName,t.language,t.languageEnglishName]
  .some(value=>String(value??'').toLowerCase().includes(query));
}
function editionDisplayName(t){
 const name=t.englishName||t.name;
 const similar=state.translations.filter(other=>(other.englishName||other.name)===name);
 if(similar.length<2)return name;
 const listing={
  'AB_317e03834065a236-01':'API.Bible public-domain listing',
  'AB_bba9f40183526463-01':'API.Bible Berean committee listing'
 }[t.id];
 if(listing)return `${name} (${listing})`;
 const details=[t.name!==name?t.name:null,t.provider||(t.id==='BSB'?'AO Lab':null)].filter(Boolean).join(' · ');
 const duplicate=similar.some(other=>other.id!==t.id&&other.name===t.name&&other.provider===t.provider);
 return `${name} (${details||t.shortName||t.id}${duplicate?' · '+t.id:''})`;
}
function compareEditionLabel(id,shortName){
 const edition=state.translations.find(t=>t.id===id);
 if(edition&&state.translations.some(t=>t.id!==id&&(t.shortName||t.id)===shortName))return editionDisplayName(edition);
 return shortName;
}
function favoriteLabel(t){
 return (favorites.has(t.id)?'Remove from favorites: ':'Add to favorites: ')+(t.englishName||t.name);
}
function stored(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
let storageOK=true;
function save(key,value){try{localStorage.setItem(account?.cacheKey(key)||key,JSON.stringify(value));if(key==='exegetical-notes'||key==='exegetical-highlights')account?.changed();if(['exegetical-position','exegetical-dark','exegetical-size'].includes(key))account?.preferencesChanged();return true;}catch{storageOK=false;toast('Storage unavailable. Export your notes before closing this page.');return false;}}
const last=stored('exegetical-position',{});
const url=new URL(location.href);if(url.hash.includes('error_description=')){const params=new URLSearchParams(url.hash.slice(1));setTimeout(()=>toast(params.get('error_description')||'The sign-in link could not be used.'),500);history.replaceState(null,'',url.pathname+url.search);}
const explicitPassage=['book','chapter','verse','endVerse','translation'].some(name=>url.searchParams.has(name));
function linkedVerse(name){
 const value=url.searchParams.get(name);
 return /^[1-9]\d{0,2}$/.test(value||'')?Number(value):undefined;
}
const linkedStart=linkedVerse('verse'),linkedEnd=linkedVerse('endVerse');
const linkedRange=linkedStart?[linkedStart,linkedEnd>=linkedStart?linkedEnd:linkedStart]:null;
const state={book:url.searchParams.get('book')||last.book||'JHN',chapter:Number(url.searchParams.get('chapter')||last.chapter)||1,verse:linkedStart||1,translation:url.searchParams.get('translation')||last.translation||'BSB',tab:'commentary',commentary:'matthew-henry',books:[],translations:[],commentaries:[],data:null,testament:'all',notes:stored('exegetical-notes',{}),highlights:stored('exegetical-highlights',{}),compare:'ENGWEBP'};
let loadId=0,studyId=0,wordId=0,toastTimer;
const book=()=>state.books.find(b=>b.id===state.book);
const ref=()=>`${book()?.name||state.book} ${state.chapter}:${state.verse}`;
const verses=()=>state.data?.chapter.content.filter(v=>v.type==='verse')||[];
function toast(t){$('toast').textContent=t;$('toast').style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').style.display='none',4000);}
function modal(title,html){document.dispatchEvent(new CustomEvent('study-modal-open'));$('modalTitle').textContent=title;$('modalBody').innerHTML=html;if(!$('modal').open)$('modal').showModal();}
$('closeModal').onclick=()=>$('modal').close();
$('modal').addEventListener('click',e=>{if(e.target===$('modal')){const r=$('modal').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('modal').close();}});
function showError(target,error,retry){target.innerHTML=`<div class="resource-error" role="alert"><h3>This resource couldn’t open.</h3><p>${esc(error.name==='TimeoutError'?'The request took too long. Check your connection and try again.':error.message)}</p><button class="retry primary">Try again ↻</button><p class="muted"><a href="/contact/">Get help</a></p></div>`;target.querySelector('.retry').onclick=retry;}
function renderBooks(){bookNavigation?.render();}
function selectors(){ $('bookSelect').innerHTML=state.books.map(b=>`<option value="${esc(b.id)}">${esc(b.name)}</option>`).join('');$('bookSelect').value=state.book;const b=book();$('chapterSelect').innerHTML=Array.from({length:b?.numberOfChapters||1},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('');$('chapterSelect').value=state.chapter;renderBooks();}
async function getBooks(){const d=await api(`${state.translation}/books.json`);state.books=d.books;if(!book())state.book=state.books[0].id;state.chapter=Math.max(1,Math.min(state.chapter,book().numberOfChapters));selectors();}
function position(){save('exegetical-position',{book:state.book,chapter:state.chapter,translation:state.translation});const u=new URL(location.href);u.searchParams.set('book',state.book);u.searchParams.set('chapter',state.chapter);const [first,last]=activeRange();u.searchParams.set('verse',first);if(last>first)u.searchParams.set('endVerse',last);else u.searchParams.delete('endVerse');u.searchParams.set('translation',state.translation);history.replaceState(null,'',u);}
async function navigate(b,c,verse,end=verse,prepared=null){state.book=b;state.chapter=c;state.verse=verse??1;selectors();await loadChapter(verse===undefined?null:[verse,end],prepared,false,verse!==undefined);}
async function loadChapter(range=null,prepared=null,cleared=false,reveal=false){selectedRange=null;selectionCleared=cleared;resetVerseTap();state.data=null;$('passageHighlights').hidden=true;const id=++loadId;++studyId;$('chapterText').setAttribute('aria-busy','true');$('chapterText').innerHTML='<div class="passage-skeleton" role="status" aria-label="Loading passage"><span class="sr-only">Opening the passage…</span>'+Array.from({length:9},()=>'<div class="skeleton-line" aria-hidden="true"></div>').join('')+'</div>';$('studyBody').innerHTML='<p class="loading">Loading study resources…</p>';$('chapterTitle').innerHTML=`${esc(book()?.name||state.book)} <span>${state.chapter}</span>`;$('bookSubtitle').textContent=['MAT','MRK','LUK','JHN'].includes(state.book)?'THE GOSPEL ACCORDING TO':'THE BOOK OF';$('previous').disabled=true;$('next').disabled=true;try{const d=prepared||await api(`${state.translation}/${state.book}/${state.chapter}.json`);if(id!==loadId)return;state.data=d;if(!verses().some(v=>v.number===state.verse))state.verse=verses().find(v=>Array.isArray(range)&&inRange(v.number,range))?.number||verses()[0]?.number||1;if(Array.isArray(range)&&range[0]<range[1]&&inRange(state.verse,range))selectedRange=range;const t=d.translation;$('translationName').textContent=t.englishName||t.name;$('translationButton').textContent=(t.shortName||t.id)+' ▾';$('chapterText').dir=t.textDirection||'ltr';$('translationCredit').innerHTML=`${esc(t.name)} · <a href="${safeURL(t.licenseUrl||t.website)}" target="_blank" rel="noopener noreferrer">Translation source & license ↗</a>${t.licenseNotice?'<br>'+esc(flatten(t.licenseNotice)):''}`;$('chapterPosition').textContent=`Chapter ${state.chapter} of ${book().numberOfChapters}`;const idx=state.books.indexOf(book());$('previous').disabled=idx===0&&state.chapter===1;$('next').disabled=idx===state.books.length-1&&state.chapter===book().numberOfChapters;renderChapter();reportBibleView(d);position();renderStudy();if(reveal)revealPassage(range);}catch(e){if(id!==loadId)return;state.data=null;showError($('chapterText'),e,()=>loadChapter(range,null,cleared,reveal));$('studyBody').textContent='Open a passage to begin studying.';}finally{if(id===loadId)$('chapterText').removeAttribute('aria-busy');}}
function revealPassage(range,notify=true){
 const available=verses().filter(v=>inRange(v.number,range));
 const number=available[0]?.number??state.verse;
 $('chapterText').querySelector(`[data-verse="${number}"]`)?.scrollIntoView?.({block:'center',behavior:'instant'});
 if(!notify)return;
 if(!available.length)toast('The requested verse or range is unavailable in this edition. Showing the chapter instead.');
 else if(available.length<range[1]-range[0]+1)toast('This edition omits some requested verse numbers.');
}
let selectedRange=null,selectionCleared=false;
let lastVerseTap=null;
function resetVerseTap(){
 lastVerseTap=null;
}
const activeRange=()=>selectedRange||[state.verse,state.verse];
const passageLabel=()=>{const [first,last]=activeRange();return first===last?ref():`${book()?.name||state.book} ${state.chapter}:${first}–${last}`;};
const inRange=(number,[first,last]=activeRange())=>number>=first&&number<=last;
const highlightedVerse=number=>Boolean(state.highlights[`${state.book}.${state.chapter}.${number}`]);
const DOUBLE_TAP_MS=350;
const noteKey=(book,chapter,first,last=first)=>`${book}.${chapter}.${first}${last>first?'-'+last:''}`;
const activeNoteKey=()=>noteKey(state.book,state.chapter,...activeRange());
const noteVerseLabel=note=>note.endVerse?`${note.verse}–${note.endVerse}`:String(note.verse);
const noteStarts=()=>new Set(Object.keys(state.notes).map(key=>key.split('-')[0]));

function highlightRange(number){
 const available=new Set(verses().map(v=>v.number));
 const isHighlighted=n=>available.has(n)&&highlightedVerse(n);
 let first=number,last=number;
 if(isHighlighted(number)){
  while(isHighlighted(first-1))first--;
  while(isHighlighted(last+1))last++;
 }
 return [first,last];
}

function openPassageStudy(){
 if(document.querySelector('.workspace').dataset.study==='closed'&&matchMedia('(min-width: 761px)').matches)$('toggleStudyPanel').click();
 document.dispatchEvent(new CustomEvent('open-mobile-study'));
}

function activateVerse(number,open){
 selectionCleared=false;
 const range=selectedRange;
 if(open){
  selectedRange=range&&range[0]!==range[1]&&inRange(number,range)?range:highlightRange(number);
 }else if(!range||!inRange(number,[range[0]-1,range[1]+1])){
  selectedRange=[number,number];
 }else{
  selectedRange=[Math.min(number,range[0]),Math.max(number,range[1])];
 }
 state.verse=number;
 updateVerseSelection();
 position();
 renderStudy();
 if(open)openPassageStudy();
}

function deselectVerse(number){
 if(!selectedRange||!inRange(number))return;
 const [first,last]=selectedRange;
 if(first===last){
  selectedRange=null;
  selectionCleared=true;
 }else{
  // Keep one continuous passage. An interior tap keeps the longer remaining side.
  selectedRange=number-first>=last-number?[first,number-1]:[number+1,last];
  if(!inRange(state.verse))state.verse=selectedRange[0];
 }
 updateVerseSelection();
 position();
 renderStudy();
}

function updateVerseSelection(){
 $('chapterText').querySelectorAll('[data-verse]').forEach(button=>{
  const selected=!selectionCleared&&inRange(Number(button.dataset.verse));
  button.classList.toggle('selected',selected);
  if(!highlightTools)button.setAttribute('aria-pressed',String(selected));
 });
 highlightTools?.decorateVerses();
}

function safeURL(s){try{const u=new URL(s);return ['https:','http:'].includes(u.protocol)?esc(u.href):'#';}catch{return '#';}}
function translatorNotes(chapter){
 const byId=new Map(),byVerse=new Map();
 for(const note of Array.isArray(chapter.footnotes)?chapter.footnotes:[]){
  if(!Number.isInteger(note?.noteId)||typeof note.text!=='string'||!note.text.trim())continue;
  byId.set(note.noteId,note.text.trim());
  const ref=note.reference;
  if(ref?.chapter===chapter.number&&Number.isInteger(ref.verse)){
   if(!byVerse.has(ref.verse))byVerse.set(ref.verse,[]);
   byVerse.get(ref.verse).push(note.noteId);
  }
 }
 return verse=>{
  const inline=Array.isArray(verse.content)?verse.content.map(part=>part?.noteId):[];
  return [...new Set([...inline,...(byVerse.get(verse.number)||[])])].map(id=>byId.get(id)).filter(Boolean);
 };
}

function openTranslatorNotes(verse,notes){
 const edition=state.data.translation;
 const label=`${book()?.name||state.book} ${state.chapter}:${verse}`;
 const source=edition.licenseUrl||edition.website;
 modal('Translator notes',`<section class="translator-notes">
  <h3>${esc(label)}</h3>
  <p class="muted">${esc(edition.name||edition.shortName||state.translation)}</p>
  <ol>${notes.map(text=>`<li>${esc(text)}</li>`).join('')}</ol>
  ${source||edition.licenseNotice?`<p class="attribution">${source?`<a href="${safeURL(source)}" target="_blank" rel="noopener noreferrer">Translation source &amp; license ↗</a>`:''}${edition.licenseNotice?'<br>'+esc(flatten(edition.licenseNotice)):''}</p>`:''}
 </section>`);
}

function renderChapter(){
 if(!state.data)return;
 const starts=noteStarts();
 const notesFor=translatorNotes(state.data.chapter);
 const notesByVerse=new Map();
 $('chapterText').innerHTML=state.data.chapter.content.map(v=>{
  if(v.type==='heading')return `<h3>${esc(flatten(v.content))}</h3>`;
  if(v.type!=='verse'||!Number.isInteger(v.number)||v.number<1||v.number>999)return '';
  const k=`${state.book}.${state.chapter}.${v.number}`;
  const verse=`<button type="button" class="verse ${state.highlights[k]?'highlighted':''}" data-verse="${v.number}" aria-label="${esc(book()?.name||state.book)} ${state.chapter}:${v.number}" aria-keyshortcuts="Shift+Enter"><sup>${v.number}</sup>${esc(flatten(v.content))}${starts.has(k)?'<span class="note-dot" aria-label="Has note">✎</span>':''}</button>`;
  const notes=notesFor(v);
  if(!notes.length)return verse;
  notesByVerse.set(v.number,notes);
  return `<div class="verse-with-translator-notes">${verse}<button type="button" class="translator-note-marker" data-translator-notes="${v.number}" aria-haspopup="dialog" aria-label="${notes.length} translator ${notes.length===1?'note':'notes'} for ${esc(book()?.name||state.book)} ${state.chapter}:${v.number}"><span aria-hidden="true">†${notes.length>1?`<small>${notes.length}</small>`:''}</span></button></div>`;
 }).join('');
 $('chapterText').querySelectorAll('[data-translator-notes]').forEach(button=>{
  button.onclick=()=>{
   resetVerseTap();
   const verse=Number(button.dataset.translatorNotes);
   openTranslatorNotes(verse,notesByVerse.get(verse));
  };
 });
 highlightTools?.decorate();
 updateVerseSelection();
}

$('chapterText').addEventListener('click',event=>{
 const button=event.target.closest('[data-verse]');
 if(!button||!state.data)return;
 const number=Number(button.dataset.verse);
 if(highlightTools?.consume(number)){resetVerseTap();return;}
 const now=performance.now();
 const pointerClick=event.detail>0||event.pointerType==='touch';
 const open=pointerClick&&lastVerseTap?.number===number&&now-lastVerseTap.time<=DOUBLE_TAP_MS;
 if(open){
  // A double tap studies the range before the first tap trimmed it.
  if(lastVerseTap.previousRange)selectedRange=lastVerseTap.previousRange;
  resetVerseTap();
  activateVerse(number,true);
  return;
 }
 const previousRange=selectedRange&&inRange(number)?selectedRange:null;
 lastVerseTap=pointerClick?{number,time:now,previousRange}:null;
 if(previousRange)deselectVerse(number);
 else activateVerse(number,false);
});
$('chapterText').addEventListener('keydown',event=>{
 const button=event.target.closest('[data-verse]');
 if(!button||event.key!=='Enter'||!event.shiftKey||event.repeat)return;
 event.preventDefault();
 resetVerseTap();
 activateVerse(Number(button.dataset.verse),true);
});

const studyTabs=[...document.querySelectorAll('[data-tab]')];
function selectStudyTab(t){
 state.tab=t;
 studyTabs.forEach(button=>{
  const selected=button.dataset.tab===t;
  button.setAttribute('aria-selected',String(selected));
  button.tabIndex=selected?0:-1;
 });
 $('studyBody').setAttribute('aria-labelledby','study-tab-'+t);
}
function tab(t){selectStudyTab(t);renderStudy();}
studyTabs.forEach((button,index)=>{
 button.onclick=()=>tab(button.dataset.tab);
 button.onfocus=()=>studyTabs.forEach(item=>item.tabIndex=item===button?0:-1);
 button.onkeydown=event=>{
  const targets={ArrowLeft:(index+studyTabs.length-1)%studyTabs.length,ArrowRight:(index+1)%studyTabs.length,Home:0,End:studyTabs.length-1};
  if(!Object.hasOwn(targets,event.key))return;
  event.preventDefault();
  studyTabs[targets[event.key]].focus();
 };
});
studyTabs[0].parentElement.addEventListener('focusout',event=>{
 if(!event.currentTarget.contains(event.relatedTarget)){
  studyTabs.forEach(button=>button.tabIndex=button.dataset.tab===state.tab?0:-1);
 }
});
async function renderCommentary(root,quote,id){
 const selected=state.commentary,chapter=state.chapter,bookId=state.book;
 const restoreFocus=document.activeElement?.id==='commentarySelect';
 root.innerHTML=`<label class="label" for="commentarySelect">COMMENTARY LIBRARY</label><select id="commentarySelect" aria-describedby="commentaryHelp">${state.commentaries.map(c=>`<option value="${esc(c.id)}" ${c.id===selected?'selected':''}>${esc(c.name)}</option>`).join('')}</select><p id="commentaryHelp" class="muted">You can switch commentaries at any time. Coverage varies by author.</p>${quote}<div id="commentaryContent" aria-busy="true"><p class="loading" role="status">Opening commentary…</p></div>`;
 if(restoreFocus)$('commentarySelect').focus({preventScroll:true});
 $('commentarySelect').onchange=e=>{state.commentary=e.target.value;renderStudy();};
 const content=$('commentaryContent');
 try{
  const d=await api(`c/${selected}/${bookId}/${chapter}.json`);
  if(id!==studyId)return;
  if(!Array.isArray(d.chapter?.content)||!d.commentary)throw Error('This commentary returned incomplete information. Try again or choose another commentary.');
  const entries=d.chapter.content.filter(v=>v.type==='verse');
  const [first,last]=activeRange();
  const sections=entries.filter((entry,index)=>entry.number<=last&&(entries[index+1]?.number??Infinity)>first);
  const body=sections.map(entry=>`<div class="source-label">SECTION STARTING AT VERSE ${entry.number}</div><div class="commentary-text">${esc(flatten(entry.content))}</div>`).join('');
  content.innerHTML=`<div class="source-label">${esc(d.commentary.name)}</div><h3>Understanding the passage</h3>${body||'<p>No commentary is available for this passage in this work.</p>'}<p class="attribution">Historical commentary reflects its author’s interpretation. Section-based notes may discuss several verses. <a target="_blank" rel="noopener noreferrer" href="${safeURL(d.commentary.licenseUrl)}">Source license ↗</a></p>`;
 }catch(error){
  if(id!==studyId)return;
  if(error.status===404){content.innerHTML=`<div class="commentary-unavailable" role="status"><h3>No coverage for this chapter</h3><p>${esc(state.commentaries.find(c=>c.id===selected)?.name||'This commentary')} does not cover ${esc(book()?.name||bookId)} ${chapter} in the available source.</p><p>Choose another commentary above to keep studying.</p><button id="chooseAnotherCommentary">Choose another commentary ↑</button></div>`;$('chooseAnotherCommentary').onclick=()=>$('commentarySelect').focus();}
  else showError(content,error,()=>renderStudy());
 }finally{content.removeAttribute('aria-busy');}
}
const passageText=entries=>entries.map(v=>`${entries.length>1?v.number+' ':''}${inlineVerse(v.content)}`).join(' ');
const comparisonRangeLabel=(first,last)=>first===last?String(first):`${first}–${last}`;
function comparisonVerseLabel(passage){
 const numbers=passage.map(v=>v.number);
 return numbers.length&&numbers.length===numbers.at(-1)-numbers[0]+1
  ?comparisonRangeLabel(numbers[0],numbers.at(-1)):numbers.join(', ');
}
function comparisonReference(from,to,bookId,chapter,first,last){
 if(from===to)return {chapter,first,last,verified:true};
 // Verified against the ESV and AO Lab Louis Segond 1910 Psalm 51 texts.
 if(bookId==='PSA'&&chapter===51){
  if(from==='ESV'&&to==='fra_lsg'&&last<=19)return {chapter,first:first+2,last:last+2,verified:true};
  if(from==='fra_lsg'&&to==='ESV'&&first>=3&&last<=21)return {chapter,first:first-2,last:last-2,verified:true};
 }
 return {chapter,first,last,verified:false};
}
let relatedOrigin;
const relatedBack=$('relatedBack');
function closeStudyForRelatedJump(){
 if(document.body.classList.contains('mobile-study-open'))$('mobileCloseStudy').click();
}
function focusReadingVerse(){
 $('chapterText').querySelector('[data-verse="'+state.verse+'"]')?.focus({preventScroll:true});
}
if(relatedBack)relatedBack.onclick=async()=>{
 const origin=relatedOrigin;
 if(!origin)return;
 relatedOrigin=null;
 relatedBack.hidden=true;
 closeStudyForRelatedJump();
 state.translation=origin.translation;
 state.books=origin.books;
 await navigate(origin.book,origin.chapter,...origin.range);
 if(state.data&&state.book===origin.book&&state.chapter===origin.chapter)focusReadingVerse();
};

function relatedTargets(data,passage){
 const hasNumberedTitle=state.translation==='fra_lsg'&&state.book==='PSA'&&state.chapter===51;
 const sources=new Set(passage.filter(v=>!hasNumberedTitle||v.number>=3)
  .map(v=>comparisonReference(state.translation,'ESV',state.book,state.chapter,v.number,v.number).first));
 const targets=new Map();
 for(const entry of data.chapter.content){
  if(!sources.has(entry.verse)||!Array.isArray(entry.references))continue;
  for(const reference of entry.references){
   if(!reference)continue;
   const {book,chapter,verse,endVerse=verse,score}=reference;
   if(!/^[A-Z0-9]{3}$/.test(book)||![chapter,verse,endVerse].every(n=>Number.isInteger(n)&&n>=1&&n<=999)||endVerse<verse)continue;
   if(book===state.book&&chapter===state.chapter&&[...sources].some(n=>n>=verse&&n<=endVerse))continue;
   const key=noteKey(book,chapter,verse,endVerse),rank=Number.isFinite(score)?score:0;
   if(!targets.has(key)||rank>targets.get(key).rank)targets.set(key,{book,chapter,verse,endVerse,rank});
  }
 }
 return [...targets.values()].sort((a,b)=>b.rank-a.rank);
}

async function renderRelated(root,quote,passage,id){
 let data;
 try{data=await api(`d/open-cross-ref/${state.book}/${state.chapter}.json`);}
 catch(error){
  if(error.status!==404)throw error;
 }
 if(id!==studyId)return;
 const targets=data?relatedTargets(data,passage):[];
 const currentEdition=state.translation;
 const currentBooks=state.books;
 let fallbackBooks;
 if(currentEdition!=='BSB'&&targets.some(target=>!currentBooks.some(b=>b.id===target.book))){
  try{fallbackBooks=(await api('BSB/books.json')).books;}catch{}
  if(id!==studyId)return;
 }
 const bookName=(books,id)=>books.find(b=>b.id===id)?.name||id;
 root.innerHTML=quote+`<section class="related-passages" aria-label="Related passages">
  <h3>Related passages</h3>
  <p class="muted">Open a reference to preview it here. Verse numbering may vary by translation.</p>
  <div id="relatedList"></div>
  <button type="button" id="relatedMore" hidden>Show more references</button>
  <p class="attribution">Cross-references from <a href="https://www.openbible.info/labs/cross-references/" target="_blank" rel="noopener noreferrer">OpenBible.info</a> via AO Lab, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>. Results are filtered for your selection and ranked by source score.</p>
 </section>`;
 const list=$('relatedList'),more=$('relatedMore');
 if(!targets.length){list.innerHTML='<p>No cross-references are available for this selection.</p>';return;}
 let shown=0;
 function showMore(){
  const start=shown;
  for(const target of targets.slice(start,start+8)){
   const {book,chapter,verse,endVerse}=target;
   const row=document.createElement('details');
   row.className='related-reference';
   row.innerHTML=`<summary>${esc(bookName(currentBooks.some(b=>b.id===book)?currentBooks:fallbackBooks||currentBooks,book))} ${chapter}:${comparisonRangeLabel(verse,endVerse)}</summary><div class="related-preview" aria-live="polite"></div>`;
   list.append(row);
   const preview=row.querySelector('.related-preview');
   let loading=false,loaded=false;
   async function lookup(edition,books){
    if(!books.some(b=>b.id===book&&b.numberOfChapters>=chapter))return;
    const match=comparisonReference('ESV',edition,book,chapter,verse,endVerse);
    try{
     const chapterData=await api(`${edition}/${book}/${chapter}.json`);
     const matches=chapterData.chapter.content.filter(v=>v.type==='verse'&&inRange(v.number,[match.first,match.last]));
     if(matches.length)return {chapterData,matches,edition,books,range:[match.first,match.last]};
    }catch(error){if(error.status!==404)throw error;}
   }
   async function load(){
    if(loading||loaded)return;
    loading=true;
    preview.textContent='Loading passage…';
    try{
     let result=await lookup(currentEdition,currentBooks);
     if(!result&&currentEdition!=='BSB'){
      fallbackBooks??=(await api('BSB/books.json')).books;
      result=await lookup('BSB',fallbackBooks);
     }
     if(id!==studyId)return;
     loaded=true;
     if(!result){preview.textContent='This passage is unavailable to preview.';return;}
     const {chapterData,matches,edition,books,range}=result;
     const translation=chapterData.translation;
     preview.innerHTML=`<p class="source-label">${esc(bookName(books,book))} ${chapter}:${esc(comparisonVerseLabel(matches))} · ${esc(translation.shortName||edition)}</p>
      ${edition!==currentEdition?'<p class="muted">Unavailable in your current translation. Showing BSB.</p>':''}
      <blockquote class="quote" dir="${translation.textDirection==='rtl'?'rtl':'ltr'}">${esc(passageText(matches))}</blockquote>
      <p class="attribution">${translation.licenseNotice?esc(flatten(translation.licenseNotice))+' · ':''}<a href="${safeURL(translation.licenseUrl||translation.website)}" target="_blank" rel="noopener noreferrer">Translation source &amp; license ↗</a></p>
      <button type="button" class="primary">Open in reader</button>`;
     preview.querySelector('button').onclick=async()=>{
      if(id!==studyId)return;
      relatedOrigin??={book:state.book,chapter:state.chapter,range:activeRange(),translation:state.translation,books:state.books};
      relatedBack.hidden=false;
      closeStudyForRelatedJump();
      state.translation=edition;
      state.books=books;
      await navigate(book,chapter,...range,chapterData);
      if(state.data&&state.book===book&&state.chapter===chapter)focusReadingVerse();
     };
     reportBibleView(chapterData);
    }catch(error){if(id===studyId)showError(preview,error,load);}
    finally{loading=false;}
   }
   row.ontoggle=()=>{if(row.open)load();};
  }
  shown=list.children.length;
  more.hidden=shown>=targets.length;
  if(start)list.children[start]?.querySelector('summary').focus();
 }
 more.onclick=showMore;
 showMore();
}

async function renderStudy(){const id=++studyId;++wordId;const root=$('studyBody');$('studyRef').textContent=passageLabel();const passage=verses().filter(v=>inRange(v.number));if(!passage.length)return;
 const picker=passage.length>1&&state.tab==='language'?`<label class="label" for="studyFocusVerse">ORIGINAL LANGUAGE FOR</label><select id="studyFocusVerse">${passage.map(v=>`<option value="${v.number}" ${v.number===state.verse?'selected':''}>Verse ${v.number}</option>`).join('')}</select>`:'';
 const quote=`<blockquote class="quote">${esc(passageText(passage))}</blockquote>`;
 if(state.tab!=='commentary')root.innerHTML=quote+picker+'<p class="loading">Finding context…</p>';try{if(state.tab==='commentary'){await renderCommentary(root,quote,id);}
else if(state.tab==='language'){const d=await api(`d/bsb-interlinear/${state.book}/${state.chapter}.json`);if(id!==studyId)return;const words=d.chapter.content.find(v=>v.verse===state.verse)?.words||[];root.innerHTML=quote+picker+`<div class="source-label">BEREAN INTERLINEAR · ${words[0]?.language==='hebrew'?'HEBREW':'GREEK'}</div><h3>Behind the words</h3><p class="muted">Select an original-language word for its definition and grammar. Glosses follow the Berean text; they aren’t a word-for-word mapping to every translation.</p><div class="word-grid" ${words[0]?.language==='hebrew'?'dir="rtl"':''}>${words.map((w,i)=>`<button class="word" data-word="${i}"><b>${esc(w.text)}</b><small dir="ltr">${esc(w.transliteration)}</small><span dir="ltr">${esc(w.gloss||'—')}</span></button>`).join('')}</div><div id="definition" aria-live="polite"></div><p class="attribution">Interlinear: Berean Bible, public domain. Definitions: <a href="https://github.com/STEPBible/STEPBible-Data" target="_blank" rel="noopener noreferrer">STEPBible / Tyndale House, Cambridge</a>, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>. Data formatted by AO Lab.</p>`;root.querySelectorAll('[data-word]').forEach(b=>b.onclick=()=>loadWord(words[Number(b.dataset.word)],id));}
else if(state.tab==='notes'){renderNotes(quote);}
else if(state.tab==='related'){await renderRelated(root,quote,passage,id);}
else if(state.tab==='compare'){
 const card=(label,text,dir='ltr')=>`<article class="translation-compare-card"><small>${esc(label)}</small><div dir="${dir==='rtl'?'rtl':'ltr'}">${esc(text)}</div></article>`;
 const primary=state.data.translation;
 const credit=(edition,fallback)=>{
  const url=edition.licenseUrl||edition.website;
  const notice=edition.licenseNotice;
  if(!url&&!notice)return '';
  return `<p class="attribution"><strong>${esc(edition.shortName||edition.name||fallback)}</strong>${url?` · <a href="${safeURL(url)}" target="_blank" rel="noopener noreferrer">Source &amp; license ↗</a>`:''}${notice?'<br>'+esc(flatten(notice)):''}</p>`;
 };
 root.innerHTML=`<div class="compare-navigation"><button id="comparePrevious" aria-label="Previous verse">←</button><strong>${esc(passageLabel())}</strong><button id="compareNext" aria-label="Next verse">→</button></div>
  <div class="compare-translation-controls"><span>Compare with</span><button type="button" id="compareTranslationButton" class="version-pill"></button></div>
  <form id="compareReferenceForm" class="compare-reference-form">
   <label class="label" for="compareReference">Comparison reference in ${esc(book()?.name||state.book)}</label>
   <div class="button-row"><input id="compareReference" maxlength="15" placeholder="Chapter:verse or range"><button type="submit">Apply</button><button type="button" id="resetCompareReference">Reset</button></div>
   <p id="compareReferenceStatus" class="muted" role="status"></p>
  </form>
  <div class="comparison-pair">${card(`${compareEditionLabel(state.translation,primary.shortName||state.translation)} · ${book()?.name||state.book} ${state.chapter}:${comparisonVerseLabel(passage)}`,passageText(passage),primary.textDirection)}<div id="comparison" aria-live="polite"></div></div>
  <footer class="comparison-credits" aria-label="Translation sources">${credit(primary,state.translation)}<div id="comparisonCredit"></div></footer>`;
 const compareButton=$('compareTranslationButton');
 function updateCompareLabel(){
  const edition=state.translations.find(t=>t.id===state.compare);
  compareButton.textContent=compareEditionLabel(state.compare,edition?.shortName||edition?.name||state.compare)+' ▾';
 }
 updateCompareLabel();
 compareButton.onclick=()=>chooseTranslation('compare',edition=>{
  if(id!==studyId)return;
  state.compare=edition;
  updateCompareLabel();
  manualReference=null;
  compare();
 });
 const [first,last]=activeRange();
 const previous=verses().filter(v=>v.number<first).at(-1),next=verses().find(v=>v.number>last);
 for(const [button,target]of [['comparePrevious',previous],['compareNext',next]]){
  $(button).disabled=!target;
  $(button).onclick=()=>{
   selectedRange=null;
   resetVerseTap();
   selectionCleared=false;
   state.verse=target.number;
   updateVerseSelection();
   position();
   renderStudy();
  };
 }
 let request=0,manualReference=null;
 const referenceInput=$('compareReference'),referenceStatus=$('compareReferenceStatus');
 $('compareReferenceForm').onsubmit=event=>{
  event.preventDefault();
  const match=/^([1-9]\d{0,2}):([1-9]\d{0,2})(?:\s*[-–]\s*([1-9]\d{0,2}))?$/.exec(referenceInput.value.trim());
  if(!match||Number(match[3]||match[2])<Number(match[2])){
   referenceStatus.textContent='Enter a chapter and verse or range, such as 51:3 or 51:3–5.';
   return;
  }
  manualReference={chapter:Number(match[1]),first:Number(match[2]),last:Number(match[3]||match[2])};
  compare();
 };
 $('resetCompareReference').onclick=()=>{manualReference=null;compare();};
 async function compare(){
  const token=++request,edition=state.compare,bookId=state.book;
  const target=manualReference||comparisonReference(state.translation,edition,bookId,state.chapter,first,last);
  referenceInput.value=`${target.chapter}:${comparisonRangeLabel(target.first,target.last)}`;
  referenceStatus.textContent=manualReference?'Showing your chosen reference.':target.verified?
   (target.first!==first?'Verse numbering differs in these editions. Showing the matching passage.':''):
   'Verse alignment is unverified for these editions. Check the text and adjust the comparison reference if needed.';
  $('comparison').innerHTML='<p class="loading">Opening translation…</p>';
  $('comparisonCredit').replaceChildren();
  try{
   const data=await api(`${edition}/${bookId}/${target.chapter}.json`);
   if(id!==studyId||token!==request)return;
   const matches=data.chapter.content.filter(v=>v.type==='verse'&&inRange(v.number,[target.first,target.last]));
   const t=data.translation;
   const actual=comparisonVerseLabel(matches);
   const label=`${compareEditionLabel(edition,t.shortName||t.name)} · ${data.book?.name||book()?.name||bookId} ${target.chapter}:${actual||comparisonRangeLabel(target.first,target.last)}`;
   $('comparison').innerHTML=card(label,matches.length?passageText(matches):'This passage is not available in this translation.',t.textDirection);
   if(matches.length&&matches.length<target.last-target.first+1)referenceStatus.textContent+=' This edition omits some requested verse numbers.';
   if(matches.length&&edition!==state.translation)$('comparisonCredit').innerHTML=credit(t,edition);
   if(matches.length)reportBibleView(data);
  }catch(error){
   if(id!==studyId||token!==request)return;
   if(error.status===404)$('comparison').textContent='This chapter is unavailable in the comparison edition. Choose a different reference or translation.';
   else showError($('comparison'),error,compare);
  }
 }

 await compare();}}catch(e){if(id!==studyId)return;showError(root,e,renderStudy);}}
$('studyBody').addEventListener('change',event=>{
 if(event.target.id!=='studyFocusVerse')return;
 state.verse=Number(event.target.value);
 position();
 renderStudy();
 $('studyFocusVerse')?.focus({preventScroll:true});
});
async function loadWord(w,parent){const id=++wordId;const root=$('definition');root.innerHTML='<p class="loading">Opening lexicon…</p>';try{if(!w.strongs)throw Error('No dictionary identifier is supplied for this word.');const d=await api(`d/stepbible-lexicon/lexicon/${w.strongs}.json`);if(id!==wordId||parent!==studyId)return;const senses=d.entry?.senses||[];root.innerHTML=`<div class="lexicon"><div class="source-label">${esc(w.strongs)} · ${esc(w.parsingFull||w.parsing)}</div>${senses.map(s=>`<h3>${esc(s.lemma)} <small>${esc(s.transliteration)}</small></h3><b>${esc(s.gloss)}</b><p>${esc(s.definition)}</p>`).join('')||'<p>No definition available.</p>'}</div>`;}catch(e){if(id===wordId&&parent===studyId)showError(root,e,()=>loadWord(w,parent));}}
function renderNotes(quote){
 const root=$('studyBody'),k=activeNoteKey();
 const [first,last]=activeRange(),range=first!==last;
 const passage=verses().filter(v=>inRange(v.number));
 const allHighlighted=passage.every(v=>highlightedVerse(v.number));
 root.innerHTML=`<div class="study-tool-intro"><h3>Your thoughts on the Word.</h3><p class="muted">Private notes for ${esc(passageLabel())}. Saved as you type.</p></div>
 <details class="note-passage"><summary>Read the selected passage</summary>${quote}</details>
 <div class="note-prompts"><button type="button" data-note-prompt="Observation">Observe</button><button type="button" data-note-prompt="Interpretation">Understand</button><button type="button" data-note-prompt="Application">Apply</button></div>
 <label for="noteText" class="label">Observation, interpretation, application, or a question to revisit.</label>
 <textarea id="noteText" data-note-key="${esc(k)}" maxlength="200000" class="study-note-editor" placeholder="What stands out? What does it mean? How will you respond?">${esc(state.notes[k]?.text||'')}</textarea>
 <p class="save-status" id="saveStatus">${esc(account?.status()||'Saved on this device.')}</p>
 <div class="button-row"><button id="highlightVerse">${allHighlighted?'Remove highlight':range?'Highlight verses':'Highlight verse'}</button><button id="copyVerse">Copy ${range?'passage':'verse'}</button><button id="sendVerseToFriend">Send to friend</button></div>
 <details class="note-more"><summary>More note options</summary><button id="deleteNote" class="danger">Delete this note</button></details>
 <p class="muted">${account?.isUser()?'Private to your account. Notes and highlights sync across devices.':'Guest notes stay in this browser. Sign in to save them to an account.'} Export a backup from My notebook.</p>`;
 const editor=$('noteText');
 const canEdit=()=>!account||account.canEdit();
 editor.disabled=!canEdit();
 function saveNote(){
  const ok=save('exegetical-notes',state.notes);
  noteCount();
  renderChapter();
  return ok;
 }
 root.querySelectorAll('[data-note-prompt]').forEach(button=>button.onclick=()=>{
  if(!canEdit())return;
  const addition=(editor.value.trim()?'\n\n':'')+button.dataset.notePrompt+':\n';
  if(editor.value.length+addition.length>200000)return;
  editor.value+=addition;
  editor.dispatchEvent(new Event('input'));
  editor.focus();
  editor.setSelectionRange(editor.value.length,editor.value.length);
 });
 editor.oninput=()=>{
  if(!canEdit())return;
  const text=editor.value;
  if(text.trim())state.notes[k]={text,book:state.book,bookName:book().name,chapter:state.chapter,verse:first,...(range?{endVerse:last}:{}),updatedAt:new Date().toISOString()};
  else delete state.notes[k];
  $('saveStatus').textContent=saveNote()?(account?.status()||'Saved on this device.'):'Could not save. Export a backup before leaving.';
 };
 $('highlightVerse').onclick=()=>{
  if(!canEdit())return toast('Load your account before editing.');
  for(const verse of passage){
   const highlightKey=noteKey(state.book,state.chapter,verse.number);
   if(allHighlighted)delete state.highlights[highlightKey];
   else state.highlights[highlightKey]=true;
  }
  save('exegetical-highlights',state.highlights);
  renderChapter();
  renderNotes(quote);
  $('highlightVerse').focus({preventScroll:true});
 };
 $('copyVerse').onclick=async()=>{
  try{
   await navigator.clipboard.writeText(`${passageLabel()} (${state.translation})\n${passageText(passage)}`);
   toast(range?'Passage copied.':'Verse copied.');
  }catch{toast('Clipboard unavailable in this browser.');}
 };
 $('sendVerseToFriend').onclick=()=>document.dispatchEvent(new CustomEvent('share-study-verse'));
 $('deleteNote').onclick=()=>{
  if(!canEdit()||!state.notes[k])return;
  if(confirm('Delete this note? Export a backup first if you need to keep it.')){
   delete state.notes[k];
   saveNote();
   renderNotes(quote);
  }
 };
}
function noteCount(){$('noteCount').textContent=Object.keys(state.notes).length;}
$('bookFilter').oninput=renderBooks;
document.querySelectorAll('[data-testament]').forEach(b=>b.onclick=()=>{state.testament=b.dataset.testament;document.querySelectorAll('[data-testament]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});renderBooks();});
$('bookSelect').onchange=e=>navigate(e.target.value,1);
$('chapterSelect').onchange=e=>navigate(state.book,Number(e.target.value));
function move(dir){const b=book();if(!b)return;const c=state.chapter+dir;if(c>=1&&c<=b.numberOfChapters)navigate(state.book,c);else{const next=state.books[state.books.indexOf(b)+dir];if(next)navigate(next.id,dir>0?1:next.numberOfChapters);}window.scrollTo({top:0,behavior:'smooth'});}
$('previous').onclick=()=>move(-1);$('next').onclick=()=>move(1);
function setupDesktopPanels(){
 const workspace=document.querySelector('.workspace');
 const wide=matchMedia('(min-width: 901px)');
 const desktop=matchMedia('(min-width: 761px)');
 const key='exegetical-desktop-panels';
 const saved=stored(key,{});
 const choices={books:saved.books,study:saved.study,previous:saved.previous};
 const isOpen=panel=>typeof choices[panel]==='boolean'?choices[panel]:panel==='study'||wide.matches;
 const closeBoth=$('closeSidePanels');
 const controls={
  books:$('toggleBooksPanel'),
  study:$('toggleStudyPanel')
 };
 function render(){
  for(const [panel,toggle] of Object.entries(controls)){
   const expanded=isOpen(panel);
   workspace.dataset[panel]=expanded?'open':'closed';
   $(toggle.getAttribute('aria-controls')).inert=desktop.matches&&!expanded;
   const label=(expanded?'Close ':'Open ')+(panel==='books'?'Books':'Study');
   toggle.setAttribute('aria-expanded',String(expanded));
   toggle.setAttribute('aria-label',label);
   toggle.title=label;
  }
  const expanded=isOpen('books')||isOpen('study');
  const label=expanded?'Close side panels':'Reopen side panels';
  closeBoth.setAttribute('aria-expanded',String(expanded));
  closeBoth.setAttribute('aria-label',label);
  closeBoth.title=label;
 }
 function change(next){
  workspace.dataset.panelMotion='';
  Object.assign(choices,next);
  try{localStorage.setItem(key,JSON.stringify(choices));}catch{}
  render();
 }
 for(const [panel,toggle] of Object.entries(controls)){
  toggle.onclick=()=>change({[panel]:!isOpen(panel),previous:undefined});
 }
 closeBoth.onclick=()=>{
  const books=isOpen('books'),study=isOpen('study');
  if(books||study){
   change({books:false,study:false,previous:{books,study}});
  }else{
   const previous=choices.previous;
   change({books:previous?.books!==false,study:previous?.study!==false,previous:undefined});
  }
 };
 wide.addEventListener('change',render);
 desktop.addEventListener('change',render);
 render();
}

function applyReaderTheme(dark){
 document.body.classList.toggle('dark',dark);
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#1d2924':'#284e43');
 try{localStorage.setItem('exegetical-display-dark',JSON.stringify(dark));}catch{}
}
$('theme').onclick=()=>{
 const dark=!document.body.classList.contains('dark');
 applyReaderTheme(dark);
 save('exegetical-dark',dark);
};
document.addEventListener('study-auth-changed',event=>{
 if(!event.detail.id)applyReaderTheme(stored('exegetical-dark',false)===true);
});
document.documentElement.style.setProperty('--reading-size',stored('exegetical-size',20)+'px');
$('settings').onclick=()=>{modal('Make yourself at home',`<p class="muted">Set a comfortable reading size.</p><label class="label" for="fontSize">Scripture text size</label><input id="fontSize" type="range" min="16" max="30" value="${stored('exegetical-size',20)}"><div class="button-row"><button id="themeSetting">Switch light / dark</button><button id="sharePassage">Copy passage link</button><a href="/feedback/">Feedback or bug report</a></div>`);$('fontSize').oninput=e=>{document.documentElement.style.setProperty('--reading-size',e.target.value+'px');save('exegetical-size',Number(e.target.value));};$('themeSetting').onclick=()=>$('theme').click();$('sharePassage').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);toast('Passage link copied.');}catch{toast('Copy the link from your address bar.');}};};
let translationRequest=0;
async function switchReadingTranslation(translation,editionName,root){
 const request=++translationRequest,revision=loadId;
 const isCurrent=()=>request===translationRequest&&revision===loadId&&root.isConnected&&$('modal').open;
 const status=$('translationSwitchStatus');
 const choices=$('translationSwitchChoices');
 choices.replaceChildren();
 status.textContent='Checking passage availability…';
 try{
  const {books}=await api(`${translation}/books.json`);
  if(!isCurrent())return;
  const target=books.find(b=>b.id===state.book);
  const currentBook=state.book,chapter=state.chapter;
  const [first,last]=activeRange();
  const chapterPath=`${translation}/${currentBook}/${chapter}.json`;
  let data;
  if(target&&chapter<=target.numberOfChapters){
   try{data=await api(chapterPath);}
   catch(error){if(error.status!==404)throw error;}
   if(!isCurrent())return;
  }
  const available=new Set(data?.chapter.content.filter(v=>v.type==='verse').map(v=>v.number));
  const covered=[...available].filter(n=>inRange(n,[first,last]));
  if(!covered.length){
   status.textContent=`${editionName} does not cover ${passageLabel()}. You can choose another translation or open a different passage in this edition.`;
   if(!books.length)return;
   const bookSelect=document.createElement('select'),chapterSelect=document.createElement('select'),open=document.createElement('button');
   bookSelect.setAttribute('aria-label','Book in '+editionName);
   chapterSelect.setAttribute('aria-label','Chapter in '+editionName);
   for(const b of books)bookSelect.add(new Option(b.name,b.id));
   if(target)bookSelect.value=target.id;
   function chapters(){
    chapterSelect.replaceChildren();
    const count=books.find(b=>b.id===bookSelect.value).numberOfChapters;
    for(let n=1;n<=count;n++)chapterSelect.add(new Option(String(n),String(n)));
   }
   bookSelect.onchange=chapters;
   chapters();
   open.type='button';
   open.textContent='Open selected chapter';
   open.onclick=()=>{
    if(!isCurrent())return;
    $('modal').close();
    state.translation=translation;
    state.books=books;
    navigate(bookSelect.value,Number(chapterSelect.value));
   };
   choices.append(bookSelect,chapterSelect,open);
   return;
  }
  const range=selectedRange,cleared=selectionCleared;
  const partial=covered.length<last-first+1;
  state.translation=translation;
  state.books=books;
  $('modal').close();
  selectors();
  await loadChapter(range,data,cleared);
  if(partial&&state.translation===translation&&state.book===currentBook&&state.chapter===chapter){
   toast('This edition omits some selected verse numbers. Your original passage note is still available.');
  }
 }catch(error){if(isCurrent())status.textContent=error.message;}
}

function chooseTranslation(mode='reader',onCompare){
 const comparing=mode==='compare';
 const selected=comparing?state.compare:state.translation;
 const returnToStudy=comparing&&document.body.classList.contains('mobile-study-open');

 const languages=[...new Map(state.translations.map(t=>[t.language,t.languageEnglishName||t.language]))]
  .filter(([id])=>id).sort((a,b)=>String(a[1]).localeCompare(String(b[1])));
 modal(comparing?'Choose a comparison translation':'Choose a translation',`<input id="pickerTranslationSearch" class="full-input" placeholder="Search translation, language, or abbreviation…" aria-label="Search translations"><label class="label" for="translationLanguage">Language</label><select id="translationLanguage" class="full-input"><option value="">All languages</option>${languages.map(([id,name])=>`<option value="${esc(id)}">${esc(name)}</option>`).join('')}</select>${apiBibleError?`<p class="muted" role="status">${esc(apiBibleError)}</p>`:''}<p id="translationSwitchStatus" class="muted" role="status"></p><div id="translationSwitchChoices" class="button-row"></div><div id="translationList"></div>`);
 if(returnToStudy)$('modal').addEventListener('close',()=>{
  if(!$('modal').open&&state.tab==='compare')document.dispatchEvent(new CustomEvent('open-mobile-study'));
 },{once:true});
 let limit=100;
 const root=$('translationList');
 const row=t=>`<div class="translation-row"><button type="button" class="translation-option" data-translation="${esc(t.id)}"${t.id===selected?' aria-current="true"':''}>${esc(editionDisplayName(t))} <small>${esc(t.languageEnglishName||t.language)} · ${esc(t.shortName||t.id)}${t.provider&&editionDisplayName(t)===(t.englishName||t.name)?' · '+esc(t.provider):''}${t.id===selected?(comparing?' · Comparing now':' · Reading now'):''}</small></button>${comparing?'':`<button type="button" class="translation-favorite" data-favorite="${esc(t.id)}" aria-pressed="${favorites.has(t.id)}" aria-label="${esc(favoriteLabel({...t,englishName:editionDisplayName(t)}))}">${favorites.has(t.id)?'★':'☆'}</button>`}</div>`;
 function render(){
  const q=$('pickerTranslationSearch').value.trim().toLowerCase();
  const language=$('translationLanguage').value;
  const matches=state.translations.filter(t=>(!language||t.language===language)&&matchesTranslation(t,q));
  const pinned=matches.filter(t=>favorites.has(t.id));
  const others=matches.filter(t=>!favorites.has(t.id));
  root.innerHTML=(pinned.length?`<h3 class="label">Favorites</h3>${pinned.map(row).join('')}`:'')
   +(others.length?`<h3 class="label">Translations</h3>${others.slice(0,limit).map(row).join('')}`:'')
   +(others.length>limit?'<button type="button" id="moreTranslations">Show more translations</button>':'')
   +(!matches.length?'<p class="muted">No matching translations.</p>':'');
  root.querySelectorAll('[data-favorite]').forEach(button=>button.onclick=()=>{
   const id=button.dataset.favorite;
   if(!toggleFavorite(id))return;
   render();
   const replacement=[...root.querySelectorAll('[data-favorite]')].find(item=>item.dataset.favorite===id);
   (replacement||$('pickerTranslationSearch')).focus({preventScroll:true});
  });
  root.querySelectorAll('[data-translation]').forEach(button=>button.onclick=async()=>{
   if(comparing){
    $('modal').close();
    onCompare(button.dataset.translation);
    return;
   }
   if(button.dataset.translation===state.translation){$('modal').close();return;}
   const edition=state.translations.find(t=>t.id===button.dataset.translation);
   await switchReadingTranslation(edition.id,editionDisplayName(edition),root);
  });
  const more=$('moreTranslations');
  if(more)more.onclick=()=>{
   const previous=limit;
   limit+=100;
   render();
   const id=others[previous]?.id;
   [...root.querySelectorAll('[data-translation]')].find(button=>button.dataset.translation===id)?.focus();
  };
 }
 const reset=()=>{limit=100;render();};
 root.addEventListener('favorites-changed',render);
 $('pickerTranslationSearch').oninput=reset;
 $('translationLanguage').onchange=reset;
 render();
 $('pickerTranslationSearch').focus();
}
$('translationButton').onclick=()=>chooseTranslation();
function openVerseSearch(query,root,beforeOpen=()=>{}){
 const supported=state.translations.filter(t=>/^(BSB|ESV|AB_[a-f0-9]{16}-[0-9]{2})$/.test(t.id));
 const current=supported.find(t=>t.id===state.translation);
 const edition=current||supported.find(t=>t.id==='BSB')||supported[0];
 if(!edition)return toast('Wait for the Bible to finish opening.');
 root.innerHTML=`<section class="inline-verse-search" aria-label="Verse search results">
  <label class="label">Search in
   <select class="full-input" data-search-edition>${supported.map(t=>`<option value="${esc(t.id)}"${t.id===edition.id?' selected':''}>${esc(t.shortName||t.id)} · ${esc(t.name)}</option>`).join('')}</select>
  </label>
  <p class="muted" role="status"></p>
  <div data-search-results></div>
 </section>`;
 const panel=root.firstElementChild;
 const select=panel.querySelector('[data-search-edition]');
 const status=panel.querySelector('[role="status"]');
 const results=panel.querySelector('[data-search-results]');
 const dialog=panel.closest('dialog');
 const isCurrent=()=>panel.isConnected&&(!dialog||dialog.open);
 let controller,opening=false;
 function clearResults(){
  controller?.abort();
  results.replaceChildren();
  status.textContent='';
 }
 select.onchange=()=>run(1);
 async function openResult(result,translation){
  if(opening)return;
  opening=true;
  try{
   const books=translation===state.translation?state.books:(await api(`${translation}/books.json`)).books;
   if(!isCurrent())return;
   const book=books.find(book=>book.id===result.book);
   if(!book||result.chapter>book.numberOfChapters)throw Error('This result is unavailable in that edition.');
   state.translation=translation;
   state.books=books;
   beforeOpen();
   await navigate(result.book,result.chapter,result.verse);

  }catch(error){
   if(isCurrent())status.textContent=error.message;
  }finally{opening=false;}
 }
 async function run(page){
  const q=query.trim(),translation=select.value;
  if(q.length<2){status.textContent='Enter at least two characters.';return;}
  clearResults();
  const active=new AbortController();
  controller=active;
  status.textContent='Searching verses…';
  try{
   const params=new URLSearchParams({path:'search.json',q,translation,page:String(page)});
   const response=await fetch('/api/bible?'+params,{signal:AbortSignal.any([active.signal,AbortSignal.timeout(22000)])});
   const data=await response.json();
   if(active.signal.aborted||!isCurrent())return;
   if(!response.ok)throw Error(data.error||'Search could not finish.');
   const hits=data.results;
   status.textContent=hits.length?`Page ${page} · ${hits.length} ${hits.length===1?'result':'results'}`:'No matching verses. Try different words.';
   results.innerHTML=hits.map((hit,index)=>`<button type="button" class="verse-search-result" data-verse-result="${index}">
    <strong>${esc(hit.reference)}</strong>${hit.text?`<span dir="${data.textDirection==='rtl'?'rtl':'ltr'}">${esc(hit.text)}</span>`:''}
   </button>`).join('')+(hits.length?`<p class="attribution"><a href="${safeURL(data.licenseUrl)}" target="_blank" rel="noopener noreferrer">Translation source & license ↗</a>${data.licenseNotice?'<br>'+esc(data.licenseNotice):''}</p>`:'')
   +`<div class="button-row">${page>1?'<button type="button" data-search-previous>← Previous results</button>':''}${data.hasMore?'<button type="button" data-search-next>Next results →</button>':''}</div>`;
   results.querySelectorAll('[data-verse-result]').forEach(button=>button.onclick=()=>openResult(hits[Number(button.dataset.verseResult)],translation));
   const previous=results.querySelector('[data-search-previous]');
   const next=results.querySelector('[data-search-next]');
   if(previous)previous.onclick=()=>run(page-1);
   if(next)next.onclick=()=>run(page+1);
   if(page>1)results.querySelector('[data-verse-result]')?.focus();
   if(hits.some(hit=>hit.text))reportBibleView(data);
  }catch(error){
   if(!active.signal.aborted&&isCurrent()){
    status.textContent=error.name==='TimeoutError'?'Search timed out. Try again.':error.message;
   }
  }
 }
 run(1);
 return ()=>controller?.abort();
}

const backupLimit=5_000_000;
function notebookBackupParts(notes,highlights,exportedAt,limit=backupLimit){
 const encode=new TextEncoder(),bytes=text=>encode.encode(text).length;
 const header=JSON.stringify({format:'exegetical-backup',version:1,exportedAt}).slice(0,-1)+',"notes":{';
 const separator='},"highlights":{',tail='}}';
 const base=bytes(header+separator+tail);
 const parts=[];
 let group=[[],[]],size=base;
 function flush(){
  parts.push(header+group[0].join(',')+separator+group[1].join(',')+tail);
  group=[[],[]];
  size=base;
 }
 for(const [index,records] of [notes,highlights].entries()){
  for(const [key,value] of Object.entries(records)){
   const entry=JSON.stringify(key)+':'+JSON.stringify(value),length=bytes(entry);
   if(base+length>limit)throw Error('A notebook entry is too large to back up.');
   if(size+length+(group[index].length?1:0)>limit)flush();
   size+=length+(group[index].length?1:0);
   group[index].push(entry);
  }
 }
 flush();
 return parts;
}
function exportNotes(){
 try{
  const exportedAt=new Date().toISOString();
  const parts=notebookBackupParts(state.notes,state.highlights,exportedAt);
  const name='exegetical-notes-'+exportedAt.slice(0,10);
  function download(index){
   const blob=new Blob([parts[index]],{type:'application/json'});
   const a=document.createElement('a');
   a.href=URL.createObjectURL(blob);
   a.download=name+(parts.length>1?`-part-${index+1}-of-${parts.length}`:'')+'.json';
   a.click();
   setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }
  if(parts.length===1){download(0);return;}
  modal('Download notebook backup',`<p>Your notebook is split into ${parts.length} files. Download every part, then import each file individually to restore the full notebook.</p><div class="button-row">${parts.map((_,i)=>`<button type="button" data-backup-part="${i}">Download part ${i+1}</button>`).join('')}</div>`);
  $('modalBody').querySelectorAll('[data-backup-part]').forEach(button=>button.onclick=()=>download(Number(button.dataset.backupPart)));
 }catch(error){toast(error.message);}
}
function highlightedPassages(highlights){
 const verses=Object.entries(highlights).flatMap(([key,highlighted])=>{
  const match=highlighted===true&&/^([A-Z0-9]{3})\.([1-9]\d{0,2})\.([1-9]\d{0,2})$/.exec(key);
  return match?[{book:match[1],chapter:Number(match[2]),first:Number(match[3])}]:[];
 });
 const order=new Map(state.books.map((book,index)=>[book.id,index]));
 verses.sort((a,b)=>(order.get(a.book)??Infinity)-(order.get(b.book)??Infinity)
  ||a.book.localeCompare(b.book)||a.chapter-b.chapter||a.first-b.first);
 const passages=[];
 for(const verse of verses){
  const previous=passages.at(-1);
  if(previous?.book===verse.book&&previous.chapter===verse.chapter&&previous.last+1===verse.first){
   previous.last=verse.first;
  }else{
   passages.push({...verse,last:verse.first});
  }
 }
 return passages;
}

// Drafts stay in this tab and are scoped to the active account or guest.
const highlightDrafts=new Map();
function highlightNoteForm(card,passage,refreshNotes){
 const panel=card.querySelector('[data-note-editor]');
 if(!panel.hidden){panel.querySelector('textarea')?.focus();return;}
 if(account&&!account.canEdit())return toast('Load your account before editing.');
 panel.hidden=false;
 panel.innerHTML=`<form class="highlight-note-form">
  <label>Note <textarea name="text" maxlength="200000" required></textarea></label>
  <div class="button-row"><button type="submit" class="primary">Save note</button><button type="button" data-cancel-note>Cancel</button></div>
  <p class="muted" role="status"></p>
 </form>`;
 const form=panel.querySelector('form'),text=form.elements.text;
 const message=form.querySelector('[role="status"]');
 const owner=account?.getUser()?.id;
 const key=noteKey(passage.book,passage.chapter,passage.first,passage.last);
 const draftKey=JSON.stringify([owner??null,key]);
 const draft=highlightDrafts.get(draftKey);
 let original=draft?.original??state.notes[key]?.text??'';
 text.value=draft?.text??original;
 text.oninput=()=>{
  if(text.value===original)highlightDrafts.delete(draftKey);
  else highlightDrafts.set(draftKey,{original,text:text.value});
 };
 function close(){
  panel.replaceChildren();
  panel.hidden=true;
  card.querySelector('[data-add-highlight-note]').focus();
 }
 form.querySelector('[data-cancel-note]').onclick=()=>{
  highlightDrafts.delete(draftKey);
  close();
 };
 form.onsubmit=event=>{
  event.preventDefault();
  if(account?.getUser()?.id!==owner||account&&!account.canEdit()){
   message.textContent='Your account changed. Reopen the notebook before saving.';
   return;
  }
  if((state.notes[key]?.text||'')!==original){
   message.textContent='This note changed on another device. Copy your draft, then cancel and reopen the editor.';
   return;
  }
  if(!text.value.trim()){message.textContent='Enter a note before saving.';return;}
  state.notes[key]={text:text.value,book:passage.book,bookName:passage.name,chapter:passage.chapter,verse:passage.first,...(passage.last>passage.first?{endVerse:passage.last}:{}),updatedAt:new Date().toISOString()};
  const saved=save('exegetical-notes',state.notes);
  noteCount();
  renderChapter();
  if(state.tab==='notes'&&key===activeNoteKey())renderStudy();
  refreshNotes();
  if(saved){highlightDrafts.delete(draftKey);close();toast('Note saved.');}
  else{
   original=text.value;
   highlightDrafts.set(draftKey,{original,text:text.value});
   message.textContent='Could not save on this device. Export a backup before leaving.';
  }
 };
 text.focus();
}

function renderHighlightCards(list,passages){
 const translation=state.translation;
 const chapterRequests=new Map();
 const reported=new Set();
 list.innerHTML=passages.map((passage,index)=>`<article class="notebook-entry notebook-highlight" data-highlight-card="${index}">
  <h3>${esc(passage.label)}</h3>
  <div class="notebook-highlight-text" data-highlight-text aria-live="polite"><p class="muted">Loading verse text…</p></div>
  <div class="notebook-highlight-notes" data-highlight-notes></div>
  <div class="button-row highlight-card-actions">
   <button type="button" data-add-highlight-note aria-label="Add or edit a note for ${esc(passage.label)}">Note</button>
   <button type="button" data-highlight-passage aria-label="Jump to ${esc(passage.label)}">Read ↗</button>
  </div>
  <div data-note-editor hidden></div>
 </article>`).join('');
 list.querySelectorAll('[data-highlight-card]').forEach(card=>{
  const passage=passages[Number(card.dataset.highlightCard)];
  const chapterKey=`${translation}/${passage.book}/${passage.chapter}.json`;
  const text=card.querySelector('[data-highlight-text]');
  const notes=card.querySelector('[data-highlight-notes]');
  const current=()=>card.isConnected&&$('modal').open;
  function refreshNotes(){
   const entries=Object.values(state.notes)
    .filter(note=>note.text&&note.book===passage.book&&note.chapter===passage.chapter&&note.verse<=passage.last&&(note.endVerse??note.verse)>=passage.first)
    .sort((a,b)=>a.verse-b.verse)
    .map(note=>`<div><strong>${note.endVerse?'Verses':'Verse'} ${esc(noteVerseLabel(note))}</strong><p>${esc(note.text)}</p></div>`);
   notes.innerHTML=entries.length?'<h4>Notes</h4>'+entries.join(''):'';
   notes.hidden=!entries.length;
  }
  refreshNotes();
  card.querySelector('[data-add-highlight-note]').onclick=()=>highlightNoteForm(card,passage,refreshNotes);
  async function readHighlight(study=false){
   const book=state.books.find(book=>book.id===passage.book);
   if(!book||passage.chapter>book.numberOfChapters){
    toast('This passage is unavailable in your current translation.');
    return;
   }
   $('modal').close();
   await navigate(passage.book,passage.chapter,passage.first,passage.last);
   if(study&&state.data&&state.book===passage.book&&state.chapter===passage.chapter&&inRange(state.verse,[passage.first,passage.last]))openPassageStudy();
  }
  card.querySelector('[data-highlight-passage]').onclick=()=>readHighlight();
  let lastTap=-Infinity;
  card.addEventListener('click',event=>{
   if(event.target.closest('button,a,input,select,textarea,label,form'))return;
   const now=performance.now();
   if(now-lastTap<=DOUBLE_TAP_MS){
    lastTap=-Infinity;
    readHighlight(true);
   }else lastTap=now;
  });
  async function load(){
   text.innerHTML='<p class="muted">Loading verse text…</p>';
   if(!chapterRequests.has(chapterKey)){
    chapterRequests.set(chapterKey,api(chapterKey).catch(error=>{
     chapterRequests.delete(chapterKey);
     throw error;
    }));
   }
   try{
    const data=await chapterRequests.get(chapterKey);
    if(!current())return;
    const verses=data.chapter.content.filter(v=>v.type==='verse'&&v.number>=passage.first&&v.number<=passage.last);
    if(!verses.length){
     text.innerHTML='<p class="muted">These verses are unavailable in the current translation.</p>';
     return;
    }
    const t=data.translation;
    text.innerHTML=`<div dir="${t.textDirection==='rtl'?'rtl':'ltr'}">${verses.map(v=>`<p><sup>${esc(v.number)}</sup> ${esc(inlineVerse(v.content))}</p>`).join('')}</div>
     ${verses.length<passage.last-passage.first+1?'<p class="muted">Some verse numbers differ in this translation.</p>':''}
     <p class="attribution">${esc(t.shortName||t.name||translation)} · <a href="${safeURL(t.licenseUrl||t.website)}" target="_blank" rel="noopener noreferrer">Source &amp; license</a>${t.licenseNotice?'<br>'+esc(flatten(t.licenseNotice)):''}</p>`;
    if(!reported.has(chapterKey)){reported.add(chapterKey);reportBibleView(data);}
   }catch(error){
    if(!current())return;
    text.innerHTML=error.status===404?'<p class="muted">This passage is unavailable in the current translation.</p>':'<p class="muted">Verse text could not load.</p><button type="button">Retry verse text</button>';
    const retry=text.querySelector('button');
    if(retry)retry.onclick=load;
   }
  }
  load();
 });
}

let notebookView='notes';
const normalizeNoteSearch=text=>text.trim().toLowerCase().replace(/(\d)\s*[-–—−]\s*(?=\d)/g,'$1–');
function notebook(){
 modal('My notebook',`<div class="notebook-views" role="group" aria-label="Notebook view">
  <button type="button" data-notebook-view="notes">Notes</button>
  <button type="button" data-notebook-view="highlights">Highlights</button>
 </div>
 <div class="button-row"><button id="exportNotes">Export backup</button><button id="importNotes">Import backup</button><input id="importFile" type="file" accept="application/json,.json" hidden></div>
 <input id="noteSearch" class="full-input" type="search"><div id="noteList"></div>`);
 const search=$('noteSearch'),list=$('noteList');
 const controls=$('modalBody').querySelectorAll('[data-notebook-view]');
 let highlightPage=0,searchTimer;
 const pageSize=8;
 function render(){
  const viewingHighlights=notebookView==='highlights';
  const label=viewingHighlights?'Search highlights':'Search notes';
  search.placeholder=label+'…';
  search.setAttribute('aria-label',label);
  controls.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.notebookView===notebookView)));
  const q=normalizeNoteSearch(search.value);
  if(viewingHighlights){
   const names=new Map(Object.values(state.notes).map(note=>[note.book,note.bookName]));
   const passages=highlightedPassages(state.highlights).map(passage=>{
    const name=state.books.find(book=>book.id===passage.book)?.name||names.get(passage.book)||passage.book;
    const range=passage.first===passage.last?String(passage.first):`${passage.first}–${passage.last}`;
    return {...passage,name,label:`${name} ${passage.chapter}:${range}`};
   }).filter(passage=>`${passage.label} ${passage.book}`.toLowerCase().includes(q));
   if(!passages.length){
    list.innerHTML=`<p class="muted">${q?'No matching highlights.':'No highlights yet.'}</p>`;
    return;
   }
   const start=highlightPage*pageSize;
   renderHighlightCards(list,passages.slice(start,start+pageSize));
   if(passages.length>pageSize){
    list.insertAdjacentHTML('beforeend',`<div class="button-row">
     <button type="button" data-highlight-page="-1"${start===0?' disabled':''}>Previous</button>
     <span>Page ${highlightPage+1} of ${Math.ceil(passages.length/pageSize)}</span>
     <button type="button" data-highlight-page="1"${start+pageSize>=passages.length?' disabled':''}>Next</button>
    </div>`);
    list.querySelectorAll('[data-highlight-page]').forEach(button=>button.onclick=()=>{
     highlightPage+=Number(button.dataset.highlightPage);
     render();
     search.focus();
    });
   }
   return;
  }
  const entries=Object.entries(state.notes).sort((a,b)=>(b[1].updatedAt||'').localeCompare(a[1].updatedAt||''));
  list.innerHTML=entries.filter(([,note])=>normalizeNoteSearch(`${note.text} ${note.bookName} ${note.chapter}:${noteVerseLabel(note)}`).includes(q))
   .map(([key,note])=>`<article class="notebook-entry"><button type="button" data-note="${esc(key)}">${esc(note.bookName)} ${esc(note.chapter)}:${esc(noteVerseLabel(note))} ↗</button><p>${esc(note.text)}</p><small class="muted">${esc(new Date(note.updatedAt).toLocaleDateString())}</small></article>`).join('')
   ||`<p class="muted">${q?'No matching notes.':'No notes yet.'}</p>`;
  list.querySelectorAll('[data-note]').forEach(button=>button.onclick=async()=>{
   const note=state.notes[button.dataset.note];
   if(!state.books.some(book=>book.id===note.book&&note.chapter<=book.numberOfChapters)){
    toast('This passage is unavailable in your current translation.');
    return;
   }
   $('modal').close();
   selectStudyTab('notes');
   await navigate(note.book,note.chapter,note.verse,note.endVerse);
   if(state.data&&state.book===note.book&&state.chapter===note.chapter)openPassageStudy();
  });
 }
 controls.forEach(button=>button.onclick=()=>{
  if(notebookView===button.dataset.notebookView)return;
  clearTimeout(searchTimer);
  notebookView=button.dataset.notebookView;
  search.value='';
  highlightPage=0;
  render();
 });
 search.oninput=()=>{
  clearTimeout(searchTimer);
  highlightPage=0;
  if(notebookView==='highlights'){
   searchTimer=setTimeout(()=>{if(list.isConnected&&$('modal').open)render();},200);
  }else render();
 };
 render();
 $('exportNotes').onclick=exportNotes;$('importNotes').onclick=()=>$('importFile').click();$('importFile').onchange=async e=>{try{if(account&&!account.canEdit())throw Error('Load your account before importing.');const owner=account?.getUser()?.id;const file=e.target.files[0];if(!file)return;if(file.size>backupLimit)throw Error('Please choose a backup smaller than 5 MB.');const d=JSON.parse(await file.text());if(account?.getUser()?.id!==owner||(account&&!account.canEdit()))throw Error('Account changed. Reopen the notebook before importing.');if(d.format!=='exegetical-backup'||d.version!==1||!d.notes||typeof d.notes!=='object'||Array.isArray(d.notes))throw Error('This is not a valid Exegetical backup.');const imported={};for(const [k,n]of Object.entries(d.notes)){if(!/^[A-Z0-9]{3}\.[1-9]\d{0,2}\.[1-9]\d{0,2}(?:-[1-9]\d{0,2})?$/.test(k)||!n||typeof n.text!=='string'||n.text.length>200000||typeof n.bookName!=='string'||!Number.isInteger(n.chapter)||!Number.isInteger(n.verse)||(n.endVerse!==undefined&&(!Number.isInteger(n.endVerse)||n.endVerse<=n.verse))||noteKey(n.book,n.chapter,n.verse,n.endVerse)!==k||typeof n.updatedAt!=='string'||!Number.isFinite(Date.parse(n.updatedAt)))throw Error('The backup contains invalid notes.');imported[k]=n;}let conflicts=Object.keys(imported).filter(k=>state.notes[k]&&state.notes[k].text!==imported[k].text);if(conflicts.length&&!confirm(`This backup replaces ${conflicts.length} existing note(s). Continue?`))return;state.notes={...state.notes,...imported};if(d.highlights&&typeof d.highlights==='object')for(const [k,v]of Object.entries(d.highlights))if(/^[A-Z0-9]{3}\.[1-9]\d{0,2}\.[1-9]\d{0,2}$/.test(k)&&v===true)state.highlights[k]=true;save('exegetical-notes',state.notes);save('exegetical-highlights',state.highlights);noteCount();renderChapter();renderStudy();notebook();toast('Backup imported.');}catch(error){toast(error.message||'Could not import this backup.');}};}
document.addEventListener('study-auth-changed',()=>{
 highlightDrafts.clear();
 if(!$('noteList'))return;
 if($('modal').open)$('modal').close();
 $('modalBody').replaceChildren();
});
$('notebookNav').onclick=notebook;$('readNav').onclick=()=>{$('reader').scrollIntoView({behavior:'smooth'});};
$('sources').onclick=()=>modal('Rooted in good sources',`<div class="modal-copy"><p><b>Bible translations and commentaries</b><br>Provided by the <a href="https://bible.helloao.org" target="_blank" rel="noopener noreferrer">Free Use Bible API, AO Lab</a>. Each translation and commentary retains its own source and license, linked within the reader. Availability and versification vary.</p><p><b>API.Bible translations</b><br>Additional editions are supplied through <a href="https://api.bible/" target="_blank" rel="noopener noreferrer">API.Bible</a> according to this site’s licensed access. Copyright notices accompany the text. Its required FUMS service reports Scripture views using anonymous device/session identifiers. See the <a href="/privacy/">privacy notice</a>.</p><p><b>Original languages</b><br>The Berean Bible interlinear is public domain. Brief Hebrew and Greek lexicons are from <a href="https://github.com/STEPBible/STEPBible-Data" target="_blank" rel="noopener noreferrer">STEPBible.org / Tyndale House, Cambridge</a>, under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>, adapted into the API format by AO Lab.</p><p>A dictionary gives a word’s range of meaning. Context determines how it is used in a particular passage. Historical commentaries reflect their authors’ perspectives.</p><p><b>ESV copyright</b><br>Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved. The ESV text may not be quoted in any publication made available to the public by a Creative Commons license. The ESV may not be translated into any other language. Users may not copy or download more than 500 verses of the ESV Bible or more than one half of any book of the ESV Bible. <a href="https://www.esv.org/" target="_blank" rel="noopener noreferrer">ESV.org</a></p><p><b>Your notes</b><br>Sign in to save private notes, highlights, reading position, translation, and appearance to your account using Supabase. Database rules restrict records to their owner. Guest notes stay in this browser until you choose to copy them into an account. Account notes are cached separately by user on this device; sign out on shared devices. Export a backup at any time.</p><p><a href="https://github.com/robekenn/Exegetical-Bible" target="_blank" rel="noopener noreferrer">View the project on GitHub ↗</a></p></div>`);
async function init(){noteCount();try{const [translations,commentaries,features,apiBibles]=await Promise.all([api('available_translations.json'),api('available_commentaries.json'),fetch('/api/config').then(r=>r.json()),api('available_api_bible.json').catch(e=>{apiBibleError=e.message;return {translations:[]};})]);translations.translations=[...translations.translations,...apiBibles.translations];if(features.esvEnabled)translations.translations.unshift({id:'ESV',name:'English Standard Version',englishName:'English Standard Version',shortName:'ESV',language:'eng',languageEnglishName:'English'});state.translations=translations.translations.sort((a,b)=>(a.language==='eng'?0:1)-(b.language==='eng'?0:1)||(a.englishName||a.name).localeCompare(b.englishName||b.name));state.commentaries=commentaries.commentaries;if(!state.translations.some(t=>t.id===state.translation))state.translation='BSB';await getBooks();await loadChapter(linkedRange,null,false,Boolean(linkedRange));}catch(e){showError($('chapterText'),e,init);}}
let bookNavigation;
let streak,highlightTools;
async function applyAccountPreferences(p){
 streak.merge(p.streak||{});
 if(typeof p.dark==='boolean')applyReaderTheme(p.dark);
 if(p.size>=16&&p.size<=30)document.documentElement.style.setProperty('--reading-size',p.size+'px');
 if(explicitPassage||!state.translations.some(t=>t.id===p.translation))return;
 const revision=loadId,editionRequest=translationRequest,currentVerse=state.verse;
 const books=await api(`${p.translation}/books.json`);
 if(revision!==loadId||editionRequest!==translationRequest||currentVerse!==state.verse)return;
 const target=books.books.find(b=>b.id===p.book)||books.books.find(b=>b.id===state.book);
 if(!target)return;
 state.translation=p.translation;
 state.books=books.books;
 await navigate(target.id,Math.max(1,Math.min(Number(p.chapter)||1,target.numberOfChapters)));
}
let startupLinkRevision;
const startupInput=new AbortController();
if(linkedRange){
 for(const type of ['pointerdown','wheel','touchstart','keydown']){
  window.addEventListener(type,()=>startupInput.abort(),{capture:true,passive:true,signal:startupInput.signal});
 }
}
function finishStartup(){
 document.dispatchEvent(new CustomEvent('app-ready'));
 // Account hydration can change line wrapping or replace the chapter DOM after the first jump.
 if(linkedRange&&state.data&&startupLinkRevision===loadId&&!startupInput.signal.aborted){
  revealPassage(linkedRange,false);
 }
 startupInput.abort();
}
async function start(){
 bookNavigation=setupBookSidebar({state,esc,navigate,toast,openVerseSearch});
 setupForegroundScroll();
 highlightTools=setupPassageHighlights({state,save,renderChapter,isSelected:number=>!selectionCleared&&inRange(number),canEdit:()=>!account||account.canEdit(),toast});
 streak=setupStreak({modal,toast,read:stored,write:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch{}},changed:()=>account?.preferencesChanged(),canRead:()=>Boolean(state.data)&&(!account||account.canEdit())});
 setupMobile({state,modal,esc,navigate,toast,openVerseSearch});
 setupDesktopPanels();
 await init();
 startupLinkRevision=loadId;
 account=await createAccount({state,esc,modal,toast,refresh:(options={})=>{noteCount();if(options.background){const starts=noteStarts();document.querySelectorAll('[data-verse]').forEach(el=>{const k=state.book+'.'+state.chapter+'.'+el.dataset.verse;el.classList.toggle('highlighted',Boolean(state.highlights[k]));let dot=el.querySelector('.note-dot');if(starts.has(k)&&!dot){dot=document.createElement('span');dot.className='note-dot';dot.textContent='✎';dot.setAttribute('aria-label','Has note');el.append(dot);}else if(!starts.has(k)&&dot)dot.remove();});const editor=$('noteText');if(editor&&document.activeElement!==editor)editor.value=state.notes[editor.dataset.noteKey]?.text||'';return;}renderChapter();renderStudy();},
 localRead:stored,localWrite:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true;}catch{return false;}},
 applyFavorites:setFavorites,
 exportBackup:exportNotes,
 getPreferences:()=>({streak:streak.snapshot(),book:state.book,chapter:state.chapter,translation:state.translation,dark:document.body.classList.contains('dark'),size:Number(getComputedStyle(document.documentElement).getPropertyValue('--reading-size').replace('px',''))||20}),
 applyPreferences:applyAccountPreferences
 });
 if(account.config.esvEnabled&&!state.translations.some(t=>t.id==='ESV'))state.translations.unshift({id:'ESV',name:'English Standard Version',englishName:'English Standard Version',shortName:'ESV',language:'eng',languageEnglishName:'English'});
 createCommunity({account,state,esc,modal,toast,openVerse:async v=>{if(state.translations.some(t=>t.id===v.translation)){state.translation=v.translation;await getBooks();}if(state.books.some(b=>b.id===v.book))navigate(v.book,Math.min(Number(v.chapter),state.books.find(b=>b.id===v.book).numberOfChapters),Number(v.verse));else toast('This book is not available in the selected translation.');}});
 renderStudy();
}
start().catch(e=>showError($('chapterText'),e,()=>location.reload())).finally(finishStartup);
