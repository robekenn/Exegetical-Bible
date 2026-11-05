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
const flatten=v=>typeof v==='string'?v:Array.isArray(v)?v.map(flatten).join(' '):v?.text??(v?.content?flatten(v.content):'');
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
function favoriteLabel(t){
 return (favorites.has(t.id)?'Remove from favorites: ':'Add to favorites: ')+(t.englishName||t.name);
}
function stored(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
let storageOK=true;
function save(key,value){try{localStorage.setItem(account?.cacheKey(key)||key,JSON.stringify(value));if(key==='exegetical-notes'||key==='exegetical-highlights')account?.changed();if(['exegetical-position','exegetical-dark','exegetical-size'].includes(key))account?.preferencesChanged();return true;}catch{storageOK=false;toast('Storage unavailable. Export your notes before closing this page.');return false;}}
const last=stored('exegetical-position',{});
const url=new URL(location.href);if(url.hash.includes('error_description=')){const params=new URLSearchParams(url.hash.slice(1));setTimeout(()=>toast(params.get('error_description')||'The sign-in link could not be used.'),500);history.replaceState(null,'',url.pathname+url.search);}
const state={book:url.searchParams.get('book')||last.book||'JHN',chapter:Number(url.searchParams.get('chapter')||last.chapter)||1,verse:Number(url.searchParams.get('verse'))||1,translation:url.searchParams.get('translation')||last.translation||'BSB',tab:'commentary',commentary:'matthew-henry',books:[],translations:[],commentaries:[],data:null,testament:'all',notes:stored('exegetical-notes',{}),highlights:stored('exegetical-highlights',{}),compare:'ENGWEBP'};
let loadId=0,studyId=0,wordId=0,toastTimer;
const key=()=>`${state.book}.${state.chapter}.${state.verse}`;
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
function position(){save('exegetical-position',{book:state.book,chapter:state.chapter,translation:state.translation});const u=new URL(location.href);u.searchParams.set('book',state.book);u.searchParams.set('chapter',state.chapter);u.searchParams.set('verse',state.verse);u.searchParams.set('translation',state.translation);history.replaceState(null,'',u);}
async function navigate(b,c,v=1){state.book=b;state.chapter=c;state.verse=v;selectors();await loadChapter();}
async function loadChapter(){state.data=null;$('passageHighlights').hidden=true;const id=++loadId;++studyId;$('chapterText').setAttribute('aria-busy','true');$('chapterText').innerHTML='<div class="passage-skeleton" role="status" aria-label="Loading passage"><span class="sr-only">Opening the passage…</span>'+Array.from({length:9},()=>'<div class="skeleton-line" aria-hidden="true"></div>').join('')+'</div>';$('studyBody').innerHTML='<p class="loading">Loading study resources…</p>';$('chapterTitle').innerHTML=`${esc(book()?.name||state.book)} <span>${state.chapter}</span>`;$('bookSubtitle').textContent=book()?.order>=40&&book()?.order<=43?'THE GOSPEL ACCORDING TO':'THE BOOK OF';$('previous').disabled=true;$('next').disabled=true;try{const d=await api(`${state.translation}/${state.book}/${state.chapter}.json`);if(id!==loadId)return;state.data=d;if(!verses().some(v=>v.number===state.verse))state.verse=verses()[0]?.number||1;const t=d.translation;$('translationName').textContent=t.englishName||t.name;$('translationButton').textContent=(t.shortName||t.id)+' ▾';$('chapterText').dir=t.textDirection||'ltr';$('translationCredit').innerHTML=`${esc(t.name)} · <a href="${safeURL(t.licenseUrl||t.website)}" target="_blank" rel="noopener noreferrer">Translation source & license ↗</a>${t.licenseNotice?'<br>'+esc(flatten(t.licenseNotice)):''}`;$('chapterPosition').textContent=`Chapter ${state.chapter} of ${book().numberOfChapters}`;const idx=state.books.indexOf(book());$('previous').disabled=idx===0&&state.chapter===1;$('next').disabled=idx===state.books.length-1&&state.chapter===book().numberOfChapters;renderChapter();reportBibleView(d);position();renderStudy();}catch(e){if(id!==loadId)return;state.data=null;showError($('chapterText'),e,loadChapter);$('studyBody').textContent='Open a passage to begin studying.';}finally{if(id===loadId)$('chapterText').removeAttribute('aria-busy');}}
function safeURL(s){try{const u=new URL(s);return ['https:','http:'].includes(u.protocol)?esc(u.href):'#';}catch{return '#';}}
function renderChapter(){if(!state.data)return;$('chapterText').innerHTML=state.data.chapter.content.map(v=>{if(v.type==='heading')return `<h3>${esc(flatten(v.content))}</h3>`;if(v.type!=='verse')return '';const k=`${state.book}.${state.chapter}.${v.number}`;return `<button class="verse ${v.number===state.verse?'selected':''} ${state.highlights[k]?'highlighted':''}" data-verse="${v.number}" aria-label="Study ${esc(book().name)} ${state.chapter}:${v.number}" aria-pressed="${v.number===state.verse}"><sup>${v.number}</sup>${esc(flatten(v.content))}${state.notes[k]?.text?'<span class="note-dot" aria-label="Has note">✎</span>':''}</button>`;}).join('');document.querySelectorAll('[data-verse]').forEach(b=>b.onclick=()=>{if(highlightTools?.consume(Number(b.dataset.verse)))return;state.verse=Number(b.dataset.verse);renderChapter();position();renderStudy();if(matchMedia('(max-width:760px)').matches)document.dispatchEvent(new CustomEvent('open-mobile-study'));});highlightTools?.decorate();}
function tab(t){state.tab=t;document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===t)));renderStudy();}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>tab(b.dataset.tab));
async function renderCommentary(root,quote,id){
 const selected=state.commentary,chapter=state.chapter,bookId=state.book;
 root.innerHTML=`<label class="label" for="commentarySelect">COMMENTARY LIBRARY</label><select id="commentarySelect" aria-describedby="commentaryHelp">${state.commentaries.map(c=>`<option value="${esc(c.id)}" ${c.id===selected?'selected':''}>${esc(c.name)}</option>`).join('')}</select><p id="commentaryHelp" class="muted">You can switch commentaries at any time. Coverage varies by author.</p>${quote}<div id="commentaryContent" aria-busy="true"><p class="loading" role="status">Opening commentary…</p></div>`;
 $('commentarySelect').onchange=e=>{state.commentary=e.target.value;renderStudy();};
 const content=$('commentaryContent');
 try{
  const d=await api(`c/${selected}/${bookId}/${chapter}.json`);
  if(id!==studyId)return;
  if(!Array.isArray(d.chapter?.content)||!d.commentary)throw Error('This commentary returned incomplete information. Try again or choose another commentary.');
  const entries=d.chapter.content.filter(v=>v.type==='verse');const exact=entries.find(v=>v.number===state.verse);const entry=exact||entries.filter(v=>v.number<=state.verse).at(-1);const upper=entry?entries.find(v=>v.number>entry.number)?.number:null;
  content.innerHTML=`<div class="source-label">${esc(d.commentary.name)} · ${entry?'SECTION STARTING AT VERSE '+entry.number:''}</div><h3>Understanding the passage</h3><div class="commentary-text">${entry?esc(flatten(entry.content)):'No commentary is available for this passage in this work.'}</div><p class="attribution">Historical commentary reflects its author’s interpretation. Section-based notes may discuss several verses${upper?' (through verse '+(upper-1)+')':''}. <a target="_blank" rel="noopener noreferrer" href="${safeURL(d.commentary.licenseUrl)}">Source license ↗</a></p>`;
 }catch(error){
  if(id!==studyId)return;
  if(error.status===404){content.innerHTML=`<div class="commentary-unavailable" role="status"><h3>No coverage for this chapter</h3><p>${esc(state.commentaries.find(c=>c.id===selected)?.name||'This commentary')} does not cover ${esc(book()?.name||bookId)} ${chapter} in the available source.</p><p>Choose another commentary above to keep studying.</p><button id="chooseAnotherCommentary">Choose another commentary ↑</button></div>`;$('chooseAnotherCommentary').onclick=()=>$('commentarySelect').focus();}
  else showError(content,error,()=>renderStudy());
 }finally{content.removeAttribute('aria-busy');}
}
async function renderStudy(){const id=++studyId;++wordId;const root=$('studyBody');$('studyRef').textContent=ref();const verse=verses().find(v=>v.number===state.verse);if(!verse)return;const quote=`<blockquote class="quote">${esc(flatten(verse.content))}</blockquote>`;root.innerHTML=quote+'<p class="loading">Finding context…</p>';try{if(state.tab==='commentary'){await renderCommentary(root,quote,id);}
else if(state.tab==='language'){const d=await api(`d/bsb-interlinear/${state.book}/${state.chapter}.json`);if(id!==studyId)return;const words=d.chapter.content.find(v=>v.verse===state.verse)?.words||[];root.innerHTML=quote+`<div class="source-label">BEREAN INTERLINEAR · ${words[0]?.language==='hebrew'?'HEBREW':'GREEK'}</div><h3>Behind the words</h3><p class="muted">Select an original-language word for its definition and grammar. Glosses follow the Berean text; they aren’t a word-for-word mapping to every translation.</p><div class="word-grid" ${words[0]?.language==='hebrew'?'dir="rtl"':''}>${words.map((w,i)=>`<button class="word" data-word="${i}"><b>${esc(w.text)}</b><small dir="ltr">${esc(w.transliteration)}</small><span dir="ltr">${esc(w.gloss||'—')}</span></button>`).join('')}</div><div id="definition" aria-live="polite"></div><p class="attribution">Interlinear: Berean Bible, public domain. Definitions: <a href="https://github.com/STEPBible/STEPBible-Data" target="_blank" rel="noopener noreferrer">STEPBible / Tyndale House, Cambridge</a>, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>. Data formatted by AO Lab.</p>`;root.querySelectorAll('[data-word]').forEach(b=>b.onclick=()=>loadWord(words[Number(b.dataset.word)],id));}
else if(state.tab==='notes'){renderNotes(quote);}
else if(state.tab==='compare'){
 const card=(label,text,dir='ltr')=>`<article class="translation-compare-card"><small>${esc(label)}</small><div dir="${dir==='rtl'?'rtl':'ltr'}">${esc(text)}</div></article>`;
 const primary=state.data.translation;
 const credit=(edition,fallback)=>{
  const url=edition.licenseUrl||edition.website;
  const notice=edition.licenseNotice;
  if(!url&&!notice)return '';
  return `<p class="attribution"><strong>${esc(edition.shortName||edition.name||fallback)}</strong>${url?` · <a href="${safeURL(url)}" target="_blank" rel="noopener noreferrer">Source &amp; license ↗</a>`:''}${notice?'<br>'+esc(flatten(notice)):''}</p>`;
 };
 root.innerHTML=`<div class="compare-navigation"><button id="comparePrevious" aria-label="Previous verse">←</button><strong>${esc(ref())}</strong><button id="compareNext" aria-label="Next verse">→</button></div>
  <div class="compare-translation-controls"><span>Compare with</span><button type="button" id="compareTranslationButton" class="version-pill"></button></div>
  <div class="comparison-pair">${card(primary.shortName||state.translation,inlineVerse(verse.content),primary.textDirection)}<div id="comparison" aria-live="polite"></div></div>
  <footer class="comparison-credits" aria-label="Translation sources">${credit(primary,state.translation)}<div id="comparisonCredit"></div></footer>`;
 const compareButton=$('compareTranslationButton');
 function updateCompareLabel(){
  const edition=state.translations.find(t=>t.id===state.compare);
  compareButton.textContent=(edition?.shortName||edition?.name||state.compare)+' ▾';
 }
 updateCompareLabel();
 compareButton.onclick=()=>chooseTranslation('compare',edition=>{
  if(id!==studyId)return;
  state.compare=edition;
  updateCompareLabel();
  compare();
 });
 const index=verses().findIndex(v=>v.number===state.verse);$('comparePrevious').disabled=index<=0;$('compareNext').disabled=index>=verses().length-1;
 for(const [button,step]of [['comparePrevious',-1],['compareNext',1]])$(button).onclick=()=>{state.verse=verses()[index+step].number;renderChapter();position();renderStudy();};
 let request=0;
 async function compare(){
  const token=++request,edition=state.compare;
  $('comparison').innerHTML='<p class="loading">Opening translation…</p>';
  $('comparisonCredit').replaceChildren();
  try{
   const data=await api(`${edition}/${state.book}/${state.chapter}.json`);
   if(id!==studyId||token!==request)return;
   const match=data.chapter.content.find(v=>v.type==='verse'&&v.number===state.verse);
   const t=data.translation;
   $('comparison').innerHTML=card(t.shortName||t.name,match?inlineVerse(match.content):'This verse is not available in this translation.',t.textDirection);
   if(match&&edition!==state.translation)$('comparisonCredit').innerHTML=credit(t,edition);
   if(match)reportBibleView(data);
  }catch(error){
   if(id===studyId&&token===request)showError($('comparison'),error,compare);
  }
 }

 await compare();}}catch(e){if(id!==studyId)return;showError(root,e,renderStudy);}}
async function loadWord(w,parent){const id=++wordId;const root=$('definition');root.innerHTML='<p class="loading">Opening lexicon…</p>';try{if(!w.strongs)throw Error('No dictionary identifier is supplied for this word.');const d=await api(`d/stepbible-lexicon/lexicon/${w.strongs}.json`);if(id!==wordId||parent!==studyId)return;const senses=d.entry?.senses||[];root.innerHTML=`<div class="lexicon"><div class="source-label">${esc(w.strongs)} · ${esc(w.parsingFull||w.parsing)}</div>${senses.map(s=>`<h3>${esc(s.lemma)} <small>${esc(s.transliteration)}</small></h3><b>${esc(s.gloss)}</b><p>${esc(s.definition)}</p>`).join('')||'<p>No definition available.</p>'}</div>`;}catch(e){if(id===wordId&&parent===studyId)showError(root,e,()=>loadWord(w,parent));}}
function renderNotes(quote){const root=$('studyBody');const k=key();root.innerHTML=`<div class="study-tool-intro"><h3>Your thoughts on the Word.</h3><p class="muted">Private notes for ${esc(ref())}. Saved as you type.</p></div><details class="note-passage"><summary>Read the selected verse</summary>${quote}</details><div class="note-prompts"><button type="button" data-note-prompt="Observation">Observe</button><button type="button" data-note-prompt="Interpretation">Understand</button><button type="button" data-note-prompt="Application">Apply</button></div><label for="noteText" class="label">Observation, interpretation, application, or a question to revisit.</label><textarea id="noteText" maxlength="200000" class="study-note-editor" placeholder="What stands out? What does it mean? How will you respond?">${esc(state.notes[k]?.text||'')}</textarea><p class="save-status" id="saveStatus">${esc(account?.status()||'Saved on this device.')}</p><div class="button-row"><button id="highlightVerse">${state.highlights[k]?'Remove highlight':'Highlight verse'}</button><button id="copyVerse">Copy verse</button><button id="sendVerseToFriend">Send to friend</button></div><details class="note-more"><summary>More note options</summary><button id="deleteNote" class="danger">Delete this note</button></details><div></div><p class="muted">${account?.isUser()?'Private to your account. Notes and highlights sync across devices.':'Guest notes stay in this browser. Sign in to save them to an account.'} Export a backup from My notebook.</p>`;document.querySelectorAll('[data-note-prompt]').forEach(b=>b.onclick=()=>{if(account&&!account.canEdit())return;const editor=$('noteText');const addition=(editor.value.trim()?'\n\n':'')+b.dataset.notePrompt+':\n';if(editor.value.length+addition.length>200000)return;editor.value+=addition;editor.dispatchEvent(new Event('input'));editor.focus();editor.setSelectionRange(editor.value.length,editor.value.length);});$('noteText').disabled=Boolean(account&&!account.canEdit());$('noteText').oninput=e=>{if(account&&!account.canEdit())return;const text=e.target.value;if(text.trim())state.notes[k]={text,book:state.book,bookName:book().name,chapter:state.chapter,verse:state.verse,updatedAt:new Date().toISOString()};else delete state.notes[k];const ok=save('exegetical-notes',state.notes);$('saveStatus').textContent=ok?(account?.status()||'Saved on this device.'):'Could not save. Export a backup before leaving.';noteCount();renderChapter();};$('highlightVerse').onclick=()=>{if(account&&!account.canEdit())return toast('Load your account before editing.');if(state.highlights[k])delete state.highlights[k];else state.highlights[k]=true;save('exegetical-highlights',state.highlights);renderChapter();renderNotes(quote);};$('copyVerse').onclick=async()=>{try{await navigator.clipboard.writeText(`${ref()} (${state.translation})\n${flatten(verses().find(v=>v.number===state.verse)?.content)}`);toast('Verse copied.');}catch{toast('Clipboard unavailable in this browser.');}};$('sendVerseToFriend').onclick=()=>document.dispatchEvent(new CustomEvent('share-study-verse'));$('deleteNote').onclick=()=>{if(account&&!account.canEdit())return;if(!state.notes[k])return;if(confirm('Delete this note? Export a backup first if you need to keep it.')){delete state.notes[k];save('exegetical-notes',state.notes);noteCount();renderChapter();renderNotes(quote);}};}
function noteCount(){$('noteCount').textContent=Object.keys(state.notes).length;}
$('bookFilter').oninput=renderBooks;
document.querySelectorAll('[data-testament]').forEach(b=>b.onclick=()=>{state.testament=b.dataset.testament;document.querySelectorAll('[data-testament]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});renderBooks();});
$('bookSelect').onchange=e=>navigate(e.target.value,1);
$('chapterSelect').onchange=e=>navigate(state.book,Number(e.target.value));
function move(dir){const b=book();if(!b)return;const c=state.chapter+dir;if(c>=1&&c<=b.numberOfChapters)navigate(state.book,c);else{const next=state.books[state.books.indexOf(b)+dir];if(next)navigate(next.id,dir>0?1:next.numberOfChapters);}window.scrollTo({top:0,behavior:'smooth'});}
$('previous').onclick=()=>move(-1);$('next').onclick=()=>move(1);
function setReaderFocus(enabled){
 document.body.classList.toggle('focus',enabled);
 $('focus').setAttribute('aria-pressed',String(enabled));
}
$('focus').onclick=()=>setReaderFocus(!document.body.classList.contains('focus'));

function setupDesktopPanels(){
 const workspace=document.querySelector('.workspace');
 const wide=matchMedia('(min-width: 901px)');
 const desktop=matchMedia('(min-width: 761px)');
 const key='exegetical-desktop-panels';
 const saved=stored(key,{});
 const choices={books:saved.books,study:saved.study};
 const isOpen=panel=>typeof choices[panel]==='boolean'?choices[panel]:panel==='study'||wide.matches;
 const controls={
  books:$('toggleBooksPanel'),
  study:$('toggleStudyPanel')
 };
 function render(){
  const focused=document.body.classList.contains('focus');
  for(const [panel,toggle] of Object.entries(controls)){
   const open=isOpen(panel);
   workspace.dataset[panel]=open?'open':'closed';
   const expanded=open&&!focused;
   $(toggle.getAttribute('aria-controls')).inert=desktop.matches&&!expanded;
   const label=(expanded?'Close ':'Open ')+(panel==='books'?'Books':'Study');
   toggle.setAttribute('aria-expanded',String(expanded));
   toggle.setAttribute('aria-label',label);
   toggle.title=label;
  }
 }
 function change(panel,open){
  workspace.dataset.panelMotion='';
  choices[panel]=open;
  try{localStorage.setItem(key,JSON.stringify(choices));}catch{}
  if(open)setReaderFocus(false);
  render();
 }
 for(const [panel,toggle] of Object.entries(controls)){
  toggle.onclick=()=>change(panel,document.body.classList.contains('focus')||!isOpen(panel));
 }
 $('focus').addEventListener('click',render);
 $('readNav').addEventListener('click',render);
 wide.addEventListener('change',render);
 desktop.addEventListener('change',render);
 render();
}

$('theme').onclick=()=>{document.body.classList.toggle('dark');save('exegetical-dark',document.body.classList.contains('dark'));};if(stored('exegetical-dark',false))document.body.classList.add('dark');
document.documentElement.style.setProperty('--reading-size',stored('exegetical-size',20)+'px');
$('settings').onclick=()=>{modal('Make yourself at home',`<p class="muted">Set a comfortable reading size.</p><label class="label" for="fontSize">Scripture text size</label><input id="fontSize" type="range" min="16" max="30" value="${stored('exegetical-size',20)}"><div class="button-row"><button id="themeSetting">Switch light / dark</button><button id="sharePassage">Copy passage link</button><a href="/feedback/">Feedback or bug report</a></div>`);$('fontSize').oninput=e=>{document.documentElement.style.setProperty('--reading-size',e.target.value+'px');save('exegetical-size',Number(e.target.value));};$('themeSetting').onclick=()=>$('theme').click();$('sharePassage').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);toast('Passage link copied.');}catch{toast('Copy the link from your address bar.');}};};
function chooseTranslation(mode='reader',onCompare){
 const comparing=mode==='compare';
 const selected=comparing?state.compare:state.translation;
 const returnToStudy=comparing&&document.body.classList.contains('mobile-study-open');

 const languages=[...new Map(state.translations.map(t=>[t.language,t.languageEnglishName||t.language]))]
  .filter(([id])=>id).sort((a,b)=>String(a[1]).localeCompare(String(b[1])));
 modal(comparing?'Choose a comparison translation':'Choose a translation',`<input id="pickerTranslationSearch" class="full-input" placeholder="Search translation, language, or abbreviation…" aria-label="Search translations"><label class="label" for="translationLanguage">Language</label><select id="translationLanguage" class="full-input"><option value="">All languages</option>${languages.map(([id,name])=>`<option value="${esc(id)}">${esc(name)}</option>`).join('')}</select>${apiBibleError?`<p class="muted" role="status">${esc(apiBibleError)}</p>`:''}<div id="translationList"></div>`);
 if(returnToStudy)$('modal').addEventListener('close',()=>{
  if(!$('modal').open&&state.tab==='compare')document.dispatchEvent(new CustomEvent('open-mobile-study'));
 },{once:true});
 let limit=100;
 const root=$('translationList');
 const row=t=>`<div class="translation-row"><button type="button" class="translation-option" data-translation="${esc(t.id)}"${t.id===selected?' aria-current="true"':''}>${esc(t.englishName||t.name)} <small>${esc(t.languageEnglishName||t.language)} · ${esc(t.shortName||t.id)}${t.provider?' · '+esc(t.provider):''}${t.id===selected?(comparing?' · Comparing now':' · Reading now'):''}</small></button>${comparing?'':`<button type="button" class="translation-favorite" data-favorite="${esc(t.id)}" aria-pressed="${favorites.has(t.id)}" aria-label="${esc(favoriteLabel(t))}">${favorites.has(t.id)?'★':'☆'}</button>`}</div>`;
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
   const previous=state.translation;
   state.translation=button.dataset.translation;
   $('modal').close();
   try{await getBooks();loadChapter();}
   catch(e){state.translation=previous;toast(e.message);}
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
   if(state.data&&state.translation===translation&&state.book===result.book&&state.chapter===result.chapter){
    document.querySelector(`[data-verse="${state.verse}"]`)?.scrollIntoView({block:'center'});
    if(state.verse!==result.verse)toast('Opened the chapter because this verse number is unavailable.');
   }
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

function exportNotes(){const blob=new Blob([JSON.stringify({format:'exegetical-backup',version:1,exportedAt:new Date().toISOString(),notes:state.notes,highlights:state.highlights},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='exegetical-notes-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
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

function highlightNoteForm(card,passage,refreshNotes){
 const panel=card.querySelector('[data-note-editor]');
 if(!panel.hidden){panel.querySelector('textarea')?.focus();return;}
 if(account&&!account.canEdit())return toast('Load your account before editing.');
 panel.hidden=false;
 const numbers=Array.from({length:passage.last-passage.first+1},(_,index)=>passage.first+index);
 panel.innerHTML=`<form class="highlight-note-form">
  ${numbers.length>1?`<label>Verse <select name="verse">${numbers.map(n=>`<option value="${n}">${n}</option>`).join('')}</select></label>`:''}
  <label>Note <textarea name="text" maxlength="200000" required></textarea></label>
  <div class="button-row"><button type="submit" class="primary">Save note</button><button type="button" data-cancel-note>Cancel</button></div>
  <p class="muted" role="status"></p>
 </form>`;
 const form=panel.querySelector('form'),text=form.elements.text,select=form.elements.verse;
 const message=form.querySelector('[role="status"]');
 const owner=account?.getUser()?.id;
 let verse=passage.first,original='';
 const noteKey=()=>`${passage.book}.${passage.chapter}.${verse}`;
 function load(){
  verse=select?Number(select.value):passage.first;
  original=state.notes[noteKey()]?.text||'';
  text.defaultValue=original;
  text.value=original;
  message.textContent='';
 }
 if(select)select.onchange=()=>{
  if(text.value!==original&&!confirm('Discard the unsaved changes for this verse?')){
   select.value=String(verse);
   return;
  }
  load();
 };
 function close(){
  panel.replaceChildren();
  panel.hidden=true;
  card.querySelector('[data-add-highlight-note]').focus();
 }
 form.querySelector('[data-cancel-note]').onclick=close;
 form.onsubmit=event=>{
  event.preventDefault();
  if(account?.getUser()?.id!==owner||account&&!account.canEdit()){
   message.textContent='Your account changed. Reopen the notebook before saving.';
   return;
  }
  const key=noteKey();
  if((state.notes[key]?.text||'')!==original){
   message.textContent='This note changed on another device. Copy your draft, then reopen the editor.';
   return;
  }
  if(!text.value.trim()){message.textContent='Enter a note before saving.';return;}
  state.notes[key]={text:text.value,book:passage.book,bookName:passage.name,chapter:passage.chapter,verse,updatedAt:new Date().toISOString()};
  const saved=save('exegetical-notes',state.notes);
  original=text.value;
  text.defaultValue=original;
  noteCount();
  renderChapter();
  if(state.tab==='notes'&&key===`${state.book}.${state.chapter}.${state.verse}`)renderStudy();
  refreshNotes();
  if(saved){close();toast('Note saved.');}
  else message.textContent='Could not save on this device. Export a backup before leaving.';
 };
 load();
 text.focus();
}

function hasHighlightDraft(root){
 return [...root.querySelectorAll('.highlight-note-form textarea')].some(text=>text.value!==text.defaultValue);
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
   const entries=[];
   for(let n=passage.first;n<=passage.last;n++){
    const note=state.notes[`${passage.book}.${passage.chapter}.${n}`];
    if(note?.text)entries.push(`<div><strong>Verse ${n}</strong><p>${esc(note.text)}</p></div>`);
   }
   notes.innerHTML=entries.length?'<h4>Notes</h4>'+entries.join(''):'';
   notes.hidden=!entries.length;
  }
  refreshNotes();
  card.querySelector('[data-add-highlight-note]').onclick=()=>highlightNoteForm(card,passage,refreshNotes);
  card.querySelector('[data-highlight-passage]').onclick=async()=>{
   if(hasHighlightDraft(list)&&!confirm('Leave the notebook and discard unsaved notes?'))return;
   const book=state.books.find(book=>book.id===passage.book);
   if(!book||passage.chapter>book.numberOfChapters){
    toast('This passage is unavailable in your current translation.');
    return;
   }
   $('modal').close();
   await navigate(passage.book,passage.chapter,passage.first);
   if(state.data&&state.book===passage.book&&state.chapter===passage.chapter){
    document.querySelector(`[data-verse="${state.verse}"]`)?.scrollIntoView({block:'center'});
   }
  };
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
function notebook(){
 modal('My notebook',`<div class="notebook-views" role="group" aria-label="Notebook view">
  <button type="button" data-notebook-view="notes">Notes</button>
  <button type="button" data-notebook-view="highlights">Highlights</button>
 </div>
 <div class="button-row"><button id="exportNotes">Export backup</button><button id="importNotes">Import backup</button><input id="importFile" type="file" accept="application/json,.json" hidden></div>
 <input id="noteSearch" class="full-input" type="search"><div id="noteList"></div>`);
 const search=$('noteSearch'),list=$('noteList');
 const controls=$('modalBody').querySelectorAll('[data-notebook-view]');
 let highlightPage=0,displayedQuery='',searchTimer;
 const pageSize=8;
 function render(){
  const viewingHighlights=notebookView==='highlights';
  const label=viewingHighlights?'Search highlights':'Search notes';
  search.placeholder=label+'…';
  search.setAttribute('aria-label',label);
  controls.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.notebookView===notebookView)));
  const q=search.value.trim().toLowerCase();
  displayedQuery=search.value;
  if(viewingHighlights){
   const names=new Map(Object.values(state.notes).map(note=>[note.book,note.bookName]));
   const passages=highlightedPassages(state.highlights).map(passage=>{
    const name=state.books.find(book=>book.id===passage.book)?.name||names.get(passage.book)||passage.book;
    const range=passage.first===passage.last?String(passage.first):`${passage.first}–${passage.last}`;
    return {...passage,name,label:`${name} ${passage.chapter}:${range}`};
   }).filter(passage=>`${passage.label} ${passage.book}`.toLowerCase().includes(q.replace(/-/g,'–')));
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
     if(hasHighlightDraft(list)&&!confirm('Leave this page and discard unsaved notes?'))return;
     highlightPage+=Number(button.dataset.highlightPage);
     render();
     search.focus();
    });
   }
   return;
  }
  const entries=Object.entries(state.notes).sort((a,b)=>(b[1].updatedAt||'').localeCompare(a[1].updatedAt||''));
  list.innerHTML=entries.filter(([,note])=>`${note.text} ${note.bookName} ${note.chapter}:${note.verse}`.toLowerCase().includes(q))
   .map(([key,note])=>`<article class="notebook-entry"><button type="button" data-note="${esc(key)}">${esc(note.bookName)} ${esc(note.chapter)}:${esc(note.verse)} ↗</button><p>${esc(note.text)}</p><small class="muted">${esc(new Date(note.updatedAt).toLocaleDateString())}</small></article>`).join('')
   ||`<p class="muted">${q?'No matching notes.':'No notes yet.'}</p>`;
  list.querySelectorAll('[data-note]').forEach(button=>button.onclick=()=>{
   const note=state.notes[button.dataset.note];
   $('modal').close();
   state.tab='notes';
   document.querySelectorAll('[data-tab]').forEach(tab=>tab.setAttribute('aria-selected',String(tab.dataset.tab==='notes')));
   navigate(note.book,note.chapter,note.verse);
  });
 }
 controls.forEach(button=>button.onclick=()=>{
  if(notebookView===button.dataset.notebookView)return;
  if(hasHighlightDraft(list)&&!confirm('Change views and discard unsaved notes?'))return;
  clearTimeout(searchTimer);
  notebookView=button.dataset.notebookView;
  search.value='';
  highlightPage=0;
  render();
 });
 search.oninput=()=>{
  clearTimeout(searchTimer);
  if(hasHighlightDraft(list)){
   search.value=displayedQuery;
   toast('Save or cancel your note before searching.');
   return;
  }
  highlightPage=0;
  if(notebookView==='highlights'){
   searchTimer=setTimeout(()=>{if(list.isConnected&&$('modal').open&&!hasHighlightDraft(list))render();},200);
  }else render();
 };
 render();
 $('exportNotes').onclick=exportNotes;$('importNotes').onclick=()=>$('importFile').click();$('importFile').onchange=async e=>{try{if(account&&!account.canEdit())throw Error('Load your account before importing.');const file=e.target.files[0];if(!file)return;if(file.size>5_000_000)throw Error('Please choose a backup smaller than 5 MB.');const d=JSON.parse(await file.text());if(d.format!=='exegetical-backup'||d.version!==1||!d.notes||typeof d.notes!=='object'||Array.isArray(d.notes))throw Error('This is not a valid Exegetical backup.');const imported={};for(const [k,n]of Object.entries(d.notes)){if(!/^[A-Z0-9]{3}\.[1-9]\d{0,2}\.[1-9]\d{0,2}$/.test(k)||!n||typeof n.text!=='string'||n.text.length>200000||typeof n.bookName!=='string'||!Number.isInteger(n.chapter)||!Number.isInteger(n.verse)||`${n.book}.${n.chapter}.${n.verse}`!==k||typeof n.updatedAt!=='string'||!Number.isFinite(Date.parse(n.updatedAt)))throw Error('The backup contains invalid notes.');imported[k]=n;}let conflicts=Object.keys(imported).filter(k=>state.notes[k]&&state.notes[k].text!==imported[k].text);if(conflicts.length&&!confirm(`This backup replaces ${conflicts.length} existing note(s). Continue?`))return;state.notes={...state.notes,...imported};if(d.highlights&&typeof d.highlights==='object')for(const [k,v]of Object.entries(d.highlights))if(/^[A-Z0-9]{3}\.[1-9]\d{0,2}\.[1-9]\d{0,2}$/.test(k)&&v===true)state.highlights[k]=true;save('exegetical-notes',state.notes);save('exegetical-highlights',state.highlights);noteCount();renderChapter();renderStudy();notebook();toast('Backup imported.');}catch(error){toast(error.message||'Could not import this backup.');}};}
document.addEventListener('study-auth-changed',()=>{
 if(!$('noteList'))return;
 if($('modal').open)$('modal').close();
 $('modalBody').replaceChildren();
});
$('notebookNav').onclick=notebook;$('readNav').onclick=()=>{setReaderFocus(false);$('reader').scrollIntoView({behavior:'smooth'});};
$('sources').onclick=()=>modal('Rooted in good sources',`<div class="modal-copy"><p><b>Bible translations and commentaries</b><br>Provided by the <a href="https://bible.helloao.org" target="_blank" rel="noopener noreferrer">Free Use Bible API, AO Lab</a>. Each translation and commentary retains its own source and license, linked within the reader. Availability and versification vary.</p><p><b>API.Bible translations</b><br>Additional editions are supplied through <a href="https://api.bible/" target="_blank" rel="noopener noreferrer">API.Bible</a> according to this site’s licensed access. Copyright notices accompany the text. Its required FUMS service reports Scripture views using anonymous device/session identifiers. See the <a href="/privacy/">privacy notice</a>.</p><p><b>Original languages</b><br>The Berean Bible interlinear is public domain. Brief Hebrew and Greek lexicons are from <a href="https://github.com/STEPBible/STEPBible-Data" target="_blank" rel="noopener noreferrer">STEPBible.org / Tyndale House, Cambridge</a>, under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>, adapted into the API format by AO Lab.</p><p>A dictionary gives a word’s range of meaning. Context determines how it is used in a particular passage. Historical commentaries reflect their authors’ perspectives.</p><p><b>ESV copyright</b><br>Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved. The ESV text may not be quoted in any publication made available to the public by a Creative Commons license. The ESV may not be translated into any other language. Users may not copy or download more than 500 verses of the ESV Bible or more than one half of any book of the ESV Bible. <a href="https://www.esv.org/" target="_blank" rel="noopener noreferrer">ESV.org</a></p><p><b>Your notes</b><br>Sign in to save private notes, highlights, reading position, translation, and appearance to your account using Supabase. Database rules restrict records to their owner. Guest notes stay in this browser until you choose to copy them into an account. Account notes are cached separately by user on this device; sign out on shared devices. Export a backup at any time.</p><p><a href="https://github.com/robekenn/Exegetical-Bible" target="_blank" rel="noopener noreferrer">View the project on GitHub ↗</a></p></div>`);
async function init(){noteCount();try{const [translations,commentaries,features,apiBibles]=await Promise.all([api('available_translations.json'),api('available_commentaries.json'),fetch('/api/config').then(r=>r.json()),api('available_api_bible.json').catch(e=>{apiBibleError=e.message;return {translations:[]};})]);translations.translations=[...translations.translations,...apiBibles.translations];if(features.esvEnabled)translations.translations.unshift({id:'ESV',name:'English Standard Version',englishName:'English Standard Version',shortName:'ESV',language:'eng',languageEnglishName:'English'});state.translations=translations.translations.sort((a,b)=>(a.language==='eng'?0:1)-(b.language==='eng'?0:1)||(a.englishName||a.name).localeCompare(b.englishName||b.name));state.commentaries=commentaries.commentaries;if(!state.translations.some(t=>t.id===state.translation))state.translation='BSB';await getBooks();await loadChapter();}catch(e){showError($('chapterText'),e,init);}}
let bookNavigation;
let streak,highlightTools;
async function start(){
 bookNavigation=setupBookSidebar({state,esc,navigate,toast,openVerseSearch});
 setupForegroundScroll();
 highlightTools=setupPassageHighlights({state,save,renderChapter,canEdit:()=>!account||account.canEdit(),toast});
 streak=setupStreak({modal,toast,read:stored,write:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch{}},changed:()=>account?.preferencesChanged(),canRead:()=>Boolean(state.data)&&(!account||account.canEdit())});
 setupMobile({state,modal,esc,navigate,toast,openVerseSearch});
 setupDesktopPanels();
 await init();
 account=await createAccount({state,esc,modal,toast,refresh:(options={})=>{noteCount();if(options.background){document.querySelectorAll('[data-verse]').forEach(el=>{const k=state.book+'.'+state.chapter+'.'+el.dataset.verse;el.classList.toggle('highlighted',Boolean(state.highlights[k]));let dot=el.querySelector('.note-dot');if(state.notes[k]?.text&&!dot){dot=document.createElement('span');dot.className='note-dot';dot.textContent='✎';dot.setAttribute('aria-label','Has note');el.append(dot);}else if(!state.notes[k]?.text&&dot)dot.remove();});const editor=$('noteText');if(editor&&document.activeElement!==editor)editor.value=state.notes[key()]?.text||'';return;}renderChapter();renderStudy();},
 localRead:stored,localWrite:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true;}catch{return false;}},
 applyFavorites:setFavorites,
 getPreferences:()=>({streak:streak.snapshot(),book:state.book,chapter:state.chapter,translation:state.translation,dark:document.body.classList.contains('dark'),size:Number(getComputedStyle(document.documentElement).getPropertyValue('--reading-size').replace('px',''))||20}),
 applyPreferences:async p=>{streak.merge(p.streak||{});if(typeof p.dark==='boolean')document.body.classList.toggle('dark',p.dark);if(p.size>=16&&p.size<=30)document.documentElement.style.setProperty('--reading-size',p.size+'px');if(state.translations.some(t=>t.id===p.translation)){state.translation=p.translation;await getBooks();if(state.books.some(b=>b.id===p.book)){state.book=p.book;state.chapter=Math.max(1,Math.min(Number(p.chapter)||1,book().numberOfChapters));}selectors();await loadChapter();}}
 });
 if(account.config.esvEnabled&&!state.translations.some(t=>t.id==='ESV'))state.translations.unshift({id:'ESV',name:'English Standard Version',englishName:'English Standard Version',shortName:'ESV',language:'eng',languageEnglishName:'English'});
 createCommunity({account,state,esc,modal,toast,openVerse:async v=>{if(state.translations.some(t=>t.id===v.translation)){state.translation=v.translation;await getBooks();}if(state.books.some(b=>b.id===v.book))navigate(v.book,Math.min(Number(v.chapter),state.books.find(b=>b.id===v.book).numberOfChapters),Number(v.verse));else toast('This book is not available in the selected translation.');}});
 renderStudy();
}
start().catch(e=>showError($('chapterText'),e,()=>location.reload())).finally(()=>document.dispatchEvent(new CustomEvent('app-ready')));
