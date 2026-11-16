const passagePattern=/^([A-Z0-9]{3})\.([1-9]\d{0,2})\.([1-9]\d{0,2})(?:-([1-9]\d{0,2}))?$/;
export function validPassage(key){
 const match=passagePattern.exec(key);
 return Boolean(match&&(!match[4]||Number(match[4])>Number(match[3])));
}
export function parseNotebookTags(input){
 const tags=new Map();
 for(const tag of input.split(',').map(value=>value.trim()).filter(Boolean)){
  if(tag.length>40||/[\x00-\x1f\x7f]/.test(tag))throw Error('Use up to 40 characters per tag.');
  const key=tag.toLowerCase();
  if(!tags.has(key))tags.set(key,tag);
 }
 if(tags.size>12)throw Error('Use up to 12 tags per entry.');
 return [...tags.values()];
}

export const validNotebookTags=tags=>Array.isArray(tags)&&tags.length<=12&&tags.every(tag=>
 typeof tag==='string'&&tag.length>0&&tag.length<=40&&tag===tag.trim()&&!/[,\x00-\x1f\x7f]/.test(tag))
 &&new Set(tags.map(tag=>tag.toLowerCase())).size===tags.length;
export const validHighlightDetails=value=>Boolean(value&&typeof value.updatedAt==='string'
 &&Number.isFinite(Date.parse(value.updatedAt))&&validNotebookTags(value.tags));
export const newHighlight=()=>({tags:[],updatedAt:new Date().toISOString()});

export function validatePayload(key,note){
 const match=passagePattern.exec(key);
 return validPassage(key)&&note&&typeof note.text==='string'&&note.text.length<=200000
  &&typeof note.bookName==='string'&&note.bookName.length<150&&note.book===match[1]
  &&note.chapter===Number(match[2])&&note.verse===Number(match[3])
  &&(note.tags===undefined||validNotebookTags(note.tags))
  &&(note.highlight===undefined||(note.highlighted===true&&validHighlightDetails(note.highlight)))
  &&(match[4]?note.endVerse===Number(match[4])&&!note.highlighted:note.endVerse===undefined);
}
export function payloadFor(key,notes,highlights){
 const [book,chapter,verses]=key.split('.');
 const [verse,endVerse]=verses.split('-').map(Number);
 const {highlight:oldHighlight,highlighted:oldFlag,...note}=notes[key]||{text:'',book,bookName:book,chapter:Number(chapter),verse,...(endVerse?{endVerse}:{}),updatedAt:new Date(0).toISOString()};
 const highlight=highlights[key];
 return {...note,highlighted:Boolean(highlight),...(validHighlightDetails(highlight)?{highlight}:{})};
}
export function applyStudyPayload(key,payload,notes,highlights){
 const {highlight,highlighted,...note}=payload;
 if(note.text)notes[key]=note;
 else delete notes[key];
 if(highlighted)highlights[key]=highlight||true;
 else delete highlights[key];
}

export function recordsToState(rows){
 const notes={},highlights={};
 for(const row of rows){
  if(validatePayload(row.passage,row.payload))applyStudyPayload(row.passage,row.payload,notes,highlights);
 }
 return {notes,highlights};
}

// Merge background updates without touching navigation, forms or selection.
export function mergeRemoteStudy(rows,{notes,highlights,revisions,pending,editingKey}){
 let changed=false;
 for(const row of rows){
  const {passage,payload}=row;
  const revision=Number(row.revision);
  if(pending.has(passage)||passage===editingKey||revision===(revisions.get(passage)||0)||!validatePayload(passage,payload))continue;
  revisions.set(passage,revision);
  applyStudyPayload(passage,payload,notes,highlights);
  changed=true;
 }
 return changed;
}

// Older copies may lack a tags field. An explicit empty list still removes tags.
export function withExistingTags(entry,existing){
 return entry.tags===undefined&&existing?.tags?{...entry,tags:existing.tags}:entry;
}

export function studyEntryCopyConflicts(existing,incoming){
 return Boolean(existing&&incoming&&(
  existing.text!==incoming.text||
  incoming.tags!==undefined&&JSON.stringify(existing.tags||[])!==JSON.stringify(incoming.tags)
 ));
}
