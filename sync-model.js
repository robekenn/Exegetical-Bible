const passagePattern=/^([A-Z0-9]{3})\.([1-9]\d{0,2})\.([1-9]\d{0,2})(?:-([1-9]\d{0,2}))?$/;
export function validPassage(key){
 const match=passagePattern.exec(key);
 return Boolean(match&&(!match[4]||Number(match[4])>Number(match[3])));
}
export function validatePayload(key,note){
 const match=passagePattern.exec(key);
 return validPassage(key)&&note&&typeof note.text==='string'&&note.text.length<=200000
  &&typeof note.bookName==='string'&&note.bookName.length<150&&note.book===match[1]
  &&note.chapter===Number(match[2])&&note.verse===Number(match[3])
  &&(match[4]?note.endVerse===Number(match[4])&&!note.highlighted:note.endVerse===undefined);
}
export function payloadFor(key,notes,highlights){
 const [book,chapter,verses]=key.split('.');
 const [verse,endVerse]=verses.split('-').map(Number);
 return {...(notes[key]||{text:'',book,bookName:book,chapter:Number(chapter),verse,...(endVerse?{endVerse}:{}),updatedAt:new Date().toISOString()}),highlighted:Boolean(highlights[key])};
}
export function recordsToState(rows){const notes={},highlights={};for(const r of rows){if(!validatePayload(r.passage,r.payload))continue;if(r.payload.text)notes[r.passage]=r.payload;if(r.payload.highlighted)highlights[r.passage]=true;}return {notes,highlights};}
// Merge background updates without touching navigation, forms or selection.
export function mergeRemoteStudy(rows,{notes,highlights,revisions,pending,editingKey}){
 let changed=false;for(const r of rows){if(pending.has(r.passage)||r.passage===editingKey||Number(r.revision)===(revisions.get(r.passage)||0)||!validatePayload(r.passage,r.payload))continue;revisions.set(r.passage,Number(r.revision));if(r.payload.text)notes[r.passage]=r.payload;else delete notes[r.passage];if(r.payload.highlighted)highlights[r.passage]=true;else delete highlights[r.passage];changed=true;}return changed;
}
