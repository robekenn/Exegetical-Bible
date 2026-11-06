const bounded=(value,min=1)=>Number.isInteger(value)&&value>=min&&value<=999;
const bookId=value=>typeof value==='string'&&/^[A-Z0-9]{3}$/.test(value);
const providerError=()=>Object.assign(Error('The Bible provider returned invalid passage metadata.'),{status:502});

export function checkedBooks(data){
 if(!Array.isArray(data?.books))throw providerError();
 const books=data.books.filter(b=>bookId(b?.id)&&typeof b.name==='string'&&b.name.trim()&&bounded(b.numberOfChapters));
 if(!books.length)throw providerError();
 return {...data,books};
}

export function checkedBibleResource(path,data){
 if(path.endsWith('/books.json'))return checkedBooks(data);
 const match=/\/([A-Z0-9]{3})\/([1-9]\d{0,2})\.json$/.exec(path);
 if(!match)return data;
 const [,book,chapter]=match;
 if(!data?.chapter||data.chapter.number!==Number(chapter)||!Array.isArray(data.chapter.content)||data.book?.id!==book||
  (data.book.numberOfChapters!==undefined&&!bounded(data.book.numberOfChapters))||
  (data.numberOfVerses!==undefined&&!bounded(data.numberOfVerses,0)))throw providerError();
 const seen=new Set();
 const content=data.chapter.content.filter(entry=>{
  if(!entry||typeof entry!=='object')return false;
  const verse=entry.type==='verse'?entry.number:entry.verse;
  if(entry.type!=='verse'&&verse===undefined)return true;
  if(!bounded(verse)||seen.has(verse))return false;
  seen.add(verse);
  return true;
 });
 if(!path.startsWith('c/')&&!path.startsWith('d/')&&!content.some(entry=>entry.type==='verse'))throw providerError();
 return {...data,chapter:{...data.chapter,content}};
}
