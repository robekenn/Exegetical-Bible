import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import {compareBibleReferences,testamentOf} from '../book-navigation.js';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const source=(await readFile(new URL('../app.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
async function reader(path,run){
 const dom=new JSDOM(html,{url:'https://example.test/'+path,runScripts:'outside-only'});
 const doc=dom.window.document,context=dom.getInternalVMContext();
 Object.assign(context,{compareBibleReferences,testamentOf});
 const dialog=doc.getElementById('modal');
 dialog.showModal=()=>{dialog.open=true;};
 dialog.close=()=>{dialog.open=false;};
 const evaluate=code=>vm.runInContext(code,context);
 evaluate(source.slice(0,source.lastIndexOf('start().catch')));
 try{await run(evaluate,doc,dom.window);}finally{dom.window.close();}
}

test('an explicit passage wins over account position while theme and text size sync',async()=>{
 for(const [url,expected] of [['?book=PSA&chapter=119&verse=105&translation=BSB','PSA.119.105.BSB'],['','JHN.3.1.ESV']]){
  await reader(url,async(evaluate,doc)=>{
   const actual=await evaluate(`
    streak={merge(){}};
    state.translations=[{id:'BSB'},{id:'ESV'}];
    api=async()=>({books:[{id:'JHN',name:'John',numberOfChapters:21}]});
    navigate=async (b,c,v=1)=>Object.assign(state,{book:b,chapter:c,verse:v});
    applyAccountPreferences({book:'JHN',chapter:3,translation:'ESV',dark:true,size:24})
     .then(()=>[state.book,state.chapter,state.verse,state.translation].join('.'));
   `);
   assert.equal(actual,expected);
   assert.ok(doc.body.classList.contains('dark'));
   assert.equal(doc.documentElement.style.getPropertyValue('--reading-size'),'24px');
  });
 }
});

test('translation changes handle missing books and chapters, and retain range notes with partial coverage',async()=>{
 await reader('',async(evaluate,doc)=>{
  evaluate(`
   const genesis={id:'GEN',name:'Genesis',numberOfChapters:50};
   const matthew={id:'MAT',name:'Matthew',numberOfChapters:28};
   const contents=nums=>nums.map(number=>({type:'verse',number,content:['verse '+number]}));
   state.books=[genesis]; state.book='GEN'; state.chapter=30; state.verse=1;
   state.translations=[{id:'BSB',name:'Berean'},{id:'NT',name:'New Testament'},{id:'SHORT',name:'Abridged'},{id:'PART',name:'Partial'},{id:'FULL',name:'Full'}];
   state.data={chapter:{content:contents([1,2,3])}};
   state.tab='notes'; selectedRange=[1,3];
   state.notes['GEN.30.1-3']={text:'My original range note'};
   api=async path=>{
    if(path==='NT/books.json')return {books:[matthew]};
    if(path==='SHORT/books.json')return {books:[{...genesis,numberOfChapters:29}]};
    if(path.endsWith('/books.json'))return {books:[genesis]};
    return {translation:{name:'Edition'},chapter:{content:contents(path.startsWith('PART')?[2,3]:[1,2,3])}};
   };
   chooseTranslation();
  `);
  const turn=()=>new Promise(resolve=>setImmediate(resolve));
  for(const id of ['NT','SHORT']){
   doc.querySelector(`[data-translation="${id}"]`).click();
   await turn();
   assert.match(doc.getElementById('translationSwitchStatus').textContent,/does not cover Genesis 30:1–3/);
   assert.equal(evaluate('state.translation'),'BSB');
   assert.equal(evaluate('state.chapter'),30);
   assert.ok(doc.getElementById('translationSwitchChoices').querySelector('button'));
  }
  doc.querySelector('[data-translation="PART"]').click();
  await turn();
  assert.equal(doc.getElementById('studyRef').textContent,'Genesis 30:1–3');
  assert.equal(doc.getElementById('noteText').value,'My original range note');
  assert.match(doc.getElementById('toast').textContent,/omits some/);
  evaluate('chooseTranslation()');
  doc.querySelector('[data-translation="FULL"]').click();
  await turn();
  assert.equal(doc.querySelectorAll('.verse.selected').length,3);
  assert.equal(doc.getElementById('noteText').value,'My original range note');
  evaluate('chooseTranslation()');
  doc.querySelector('[data-translation="NT"]').click();
  await turn();
  doc.getElementById('translationSwitchChoices').querySelector('button').click();
  await turn();
  assert.equal(evaluate('state.book'),'MAT');
  assert.equal(evaluate('state.chapter'),1);
 });
});

test('Compare maps the verified Psalm 51 offset both ways and allows an explicit reference when uncertain',async()=>{
 await reader('',async(evaluate,doc,win)=>{
  await evaluate(`
   state.books=[{id:'PSA',name:'Psalms'}]; state.book='PSA'; state.chapter=51; state.verse=1;
   state.translation='ESV'; state.compare='fra_lsg'; state.tab='compare';
   state.data={translation:{shortName:'ESV'},chapter:{content:[{type:'verse',number:1,content:['Mercy plea']}]}};
   api=async path=>({translation:{shortName:'LSG'},chapter:{content:[
    {type:'verse',number:1,content:['Psalm heading']},{type:'verse',number:3,content:['Prière de miséricorde']}
   ]}});
   renderStudy();
  `);
  assert.match(doc.querySelector('.comparison-pair').textContent,/ESV · Psalms 51:1.*LSG · Psalms 51:3/s);
  assert.doesNotMatch(doc.getElementById('comparison').textContent,/Psalm heading/);
  assert.equal(evaluate("comparisonReference('fra_lsg','ESV','PSA',51,3,5).last"),3);
  await evaluate("state.translation='BSB';renderStudy()");
  assert.match(doc.getElementById('compareReferenceStatus').textContent,/unverified/);
  doc.getElementById('compareReference').value='51:3';
  doc.getElementById('compareReferenceForm').dispatchEvent(new win.Event('submit',{cancelable:true}));
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(doc.getElementById('comparison').textContent,/Psalms 51:3/);
 });

});

test('Study tabs use manual keyboard activation and commentary focus survives an unavailable resource',async()=>{
 await reader('',async(evaluate,doc,win)=>{
  const original=doc.getElementById('study-tab-language'),notes=doc.getElementById('study-tab-notes');
  original.focus();
  original.dispatchEvent(new win.KeyboardEvent('keydown',{key:'ArrowRight',cancelable:true}));
  assert.equal(doc.activeElement,notes);
  assert.equal(notes.getAttribute('aria-selected'),'false');
  notes.click();
  assert.equal(doc.getElementById('studyBody').getAttribute('aria-labelledby'),notes.id);
  await evaluate(`
   state.books=[{id:'JHN',name:'John'}]; state.data={chapter:{content:[{type:'verse',number:1,content:['Text']}]}};
   state.commentaries=[{id:'matthew-henry',name:'Henry'},{id:'missing',name:'Missing'}];
   api=async()=>{throw Object.assign(new Error('Unavailable'),{status:404});};
   tab('commentary');
  `);
  const select=doc.getElementById('commentarySelect');
  select.focus();
  select.value='missing';
  select.dispatchEvent(new win.Event('change'));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(doc.activeElement,doc.getElementById('commentarySelect'));
  assert.match(doc.getElementById('commentaryContent').textContent,/No coverage/);
 });
});

test('canonical testament and duplicate edition labels are independent of provider order and shared names',async()=>{
 assert.equal(testamentOf('MAT'),'new');
 assert.equal(testamentOf('REV'),'new');
 assert.equal(testamentOf('MAL'),'old');
 assert.equal(testamentOf('TOB'),'other');
 await reader('',async(evaluate,doc)=>{
  evaluate(`
   state.translations=['BSB','AB_317e03834065a236-01','AB_bba9f40183526463-01'].map(id=>({id,name:'Berean Standard Bible',shortName:'BSB',provider:id==='BSB'?undefined:'API.Bible'}));
   chooseTranslation();
  `);
  const names=()=>Array.from(doc.querySelectorAll('[data-translation]'),x=>x.textContent.trim());
  assert.equal(new Set(names()).size,3);
  const favorites=Array.from(doc.querySelectorAll('[data-favorite]'),x=>x.getAttribute('aria-label'));
  assert.equal(new Set(favorites).size,3);
  evaluate("chooseTranslation('compare',()=>{})");
  assert.equal(new Set(names()).size,3);
 });
});

test('reader muted text meets 4.5:1 contrast on shared light and dark surfaces',async()=>{
 const css=await readFile(new URL('../style.css',import.meta.url),'utf8');
 const luminance=hex=>hex.match(/../g).map((channel,index)=>{
  const s=parseInt(channel,16)/255;
  return (s<=0.04045?s/12.92:((s+0.055)/1.055)**2.4)*[0.2126,0.7152,0.0722][index];
 }).reduce((sum,value)=>sum+value,0);
 for(const selector of [':root','body.dark']){
  const rules=css.split(selector+'{').find((rule,index)=>index===1)?.split('}')[0];
  assert.ok(rules);
  const color=name=>luminance(new RegExp('--'+name+':#([0-9a-f]{6})').exec(rules)[1]);
  for(const surface of ['bg','paper','panel','soft']){
   const [light,dark]=[color('muted'),color(surface)].sort((a,b)=>b-a);
   assert.ok((light+0.05)/(dark+0.05)>=4.5,`${selector} ${surface}`);
  }
 }
});

test('shared passage URLs round-trip their range and reveal the first verse',async()=>{
 const path='?book=PSA&chapter=119&verse=105&endVerse=107&translation=BSB';
 await reader(path,async(evaluate,doc,win)=>{
  const revealed=[];
  win.HTMLElement.prototype.scrollIntoView=function(options){revealed.push([this.dataset.verse,options.block]);};
  await evaluate(`
   state.books=[{id:'PSA',name:'Psalms',numberOfChapters:150}];
   state.tab='notes';
   const result={translation:{id:'BSB',name:'Berean'},chapter:{content:Array.from({length:110},(_,i)=>({type:'verse',number:i+1,content:['Verse']}))}};
   api=async()=>result;
   loadChapter(linkedRange,result,false,true);
  `);
  assert.equal(doc.getElementById('studyRef').textContent,'Psalms 119:105–107');
  assert.deepEqual(revealed,[['105','center']]);
  assert.equal(win.location.search,path);
  await evaluate("navigate('PSA',119,108)");
  assert.equal(new URL(win.location.href).searchParams.has('endVerse'),false);
  assert.deepEqual(revealed.at(-1),['108','center']);
 });
});

test('startup reanchors direct links after preferences load, unless the reader has interacted',async()=>{
 for(const interacted of [false,true]){
  await reader('?book=PSA&chapter=119&verse=105&translation=BSB',async(evaluate,doc,win)=>{
   const jumps=[];
   win.HTMLElement.prototype.scrollIntoView=function(){jumps.push([this.dataset.verse,doc.documentElement.style.getPropertyValue('--reading-size')]);};
   await evaluate(`
    state.books=[{id:'PSA',name:'Psalms',numberOfChapters:150}];
    state.tab='notes';
    streak={merge(){}};
    const result={translation:{id:'BSB',name:'Berean'},chapter:{content:[{type:'verse',number:105,content:['Verse']}]}};
    loadChapter(linkedRange,result,false,true);
    startupLinkRevision=loadId;
   `);
   if(interacted)win.dispatchEvent(new win.Event('wheel'));
   await evaluate("applyAccountPreferences({size:30,dark:true})");
   evaluate('finishStartup()');
   assert.deepEqual(jumps,interacted?[['105','20px']]:[['105','20px'],['105','30px']]);
  });
 }
});

test('related references preview without navigation and return to the source range',async()=>{
 await reader('?book=PSA&chapter=119&verse=105&endVerse=106&translation=BSB',async(evaluate,doc,win)=>{
  await evaluate(`
   const verse=(number,text)=>({type:'verse',number,content:[text]});
   const psalm={translation:{id:'BSB',name:'Berean'},chapter:{content:[verse(105,'Source verse'),verse(106,'Next verse')]}};
   const proverb={translation:{id:'BSB',name:'Berean',licenseUrl:'https://example.test/'},chapter:{content:[verse(23,'Related verse')]}};
   state.books=[{id:'PSA',name:'Psalms',numberOfChapters:150},{id:'PRO',name:'Proverbs',numberOfChapters:31}];
   api=async path=>{
    if(path==='d/open-cross-ref/PSA/119.json')return {chapter:{content:[
     {verse:105,references:[{book:'PRO',chapter:6,verse:23,score:9}]},
     {verse:106,references:[{book:'PRO',chapter:6,verse:23,score:8},{book:'PSA',chapter:119,verse:105,score:20}]}
    ]}};
    if(path==='d/open-cross-ref/PRO/6.json')return {chapter:{content:[]}};
    if(path==='BSB/PRO/6.json')return proverb;
    return psalm;
   };
   selectStudyTab('related');
   loadChapter(linkedRange,psalm);
  `);
  await new Promise(resolve=>setImmediate(resolve));
  const row=doc.querySelector('.related-reference');
  assert.equal(doc.querySelectorAll('.related-reference').length,1);
  assert.match(row.textContent,/Proverbs 6:23/);
  const source=win.location.href;
  row.open=true;
  row.dispatchEvent(new win.Event('toggle'));
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(row.textContent,/Related verse/);
  assert.equal(win.location.href,source);
  await row.querySelector('button').onclick();
  assert.equal(new URL(win.location.href).searchParams.get('book'),'PRO');
  const back=doc.getElementById('relatedBack');
  assert.equal(back.hidden,false);
  await back.onclick();
  assert.deepEqual(Object.fromEntries(new URL(win.location.href).searchParams),Object.fromEntries(new URL(source).searchParams));
  assert.equal(back.hidden,true);
  assert.equal(doc.getElementById('studyRef').textContent,'Psalms 119:105–106');
 });
});

test('translator note markers group matching notes without changing verse text or selection',async()=>{
 await reader('?book=JHN&chapter=1&verse=14&translation=BSB',async(evaluate,doc)=>{
  evaluate(`
   state.books=[{id:'JHN',name:'John'}];
   state.data={translation:{name:'Berean Standard Bible',licenseUrl:'https://berean.bible/'},chapter:{number:1,
    content:[
     {type:'verse',number:13,content:['Unannotated verse.']},
     {type:'verse',number:14,content:['Verse text',{noteId:0},'continues.',{noteId:1},{noteId:0}]}
    ],
    footnotes:[
     {noteId:0,text:'Alternate wording'},
     {noteId:1,text:'<img src=x onerror=alert(1)>',reference:{chapter:1,verse:14}},
     {noteId:2,text:'Reference-only note',reference:{chapter:1,verse:14}}
    ]
   }};
   renderChapter();
  `);
  const verse=doc.querySelector('[data-verse="14"]');
  const marker=doc.querySelector('[data-translator-notes="14"]');
  assert.equal(doc.querySelectorAll('[data-translator-notes]').length,1);
  assert.equal(marker.getAttribute('aria-label'),'3 translator notes for John 1:14');
  assert.equal(evaluate('passageText(verses().filter(v=>v.number===14))'),'Verse text continues.');
  marker.click();
  assert.equal(verse.getAttribute('aria-pressed'),'true');
  assert.match(doc.getElementById('modalBody').textContent,/Berean Standard Bible/);
  assert.deepEqual([...doc.querySelectorAll('.translator-notes li')].map(li=>li.textContent),['Alternate wording','<img src=x onerror=alert(1)>','Reference-only note']);
  assert.equal(doc.querySelector('.translator-notes img'),null);
 });
});

test('large multibyte notebooks export as independently importable parts',async()=>{
 await reader('',async(evaluate,doc,win)=>{
  win.TextEncoder=TextEncoder;
  const parts=evaluate(`
   const notes=Object.fromEntries(Array.from({length:9},(_,i)=>['JHN.1.'+(i+1),{
    book:'JHN',bookName:'John',chapter:1,verse:i+1,text:'文'.repeat(190000),updatedAt:'2026-11-06'
   }]));
   const highlights={'JHN.1.3':true};
   notebookBackupParts(notes,highlights,'2026-11-06');
  `);
  assert.ok(parts.length>1);
  evaluate('notebook()');
  for(const part of parts){
   const input=doc.getElementById('importFile');
   const size=Buffer.byteLength(part);
   assert.ok(size<=5_000_000);
   Object.defineProperty(input,'files',{value:[{size,text:async()=>part}]});
   await input.onchange({target:input});
  }
  assert.equal(evaluate('Object.keys(state.notes).length'),9);
  assert.equal(evaluate("state.notes['JHN.1.9'].text.length"),190000);
  assert.equal(evaluate("state.highlights['JHN.1.3']"),true);
 });
});

test('phone notebook opens the editor for a single-verse note and a range',async()=>{
 await reader('',async(evaluate,doc,win)=>{
  await evaluate(`
   state.books=[{id:'JHN',name:'John',numberOfChapters:21}];
   state.notes={'JHN.1.2':{book:'JHN',bookName:'John',chapter:1,verse:2,text:'Single'},
    'JHN.1.3-4':{book:'JHN',bookName:'John',chapter:1,verse:3,endVerse:4,text:'Range'}};
   api=async()=>({translation:{id:'BSB',name:'Berean'},chapter:{content:[2,3,4].map(number=>({type:'verse',number,content:['Verse']}))}});
   window.matchMedia=()=>({matches:false});
  `);
  let opens=0;
  doc.addEventListener('open-mobile-study',()=>opens++);
  for(const [key,value]of [['JHN.1.2','Single'],['JHN.1.3-4','Range']]){
   evaluate('notebook()');
   await doc.querySelector('[data-note="'+key+'"]').onclick();
   assert.equal(doc.getElementById('noteText').value,value);
  }
  assert.equal(opens,2);
 });
});
