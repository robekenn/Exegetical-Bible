import {apiBibleSearch} from './api-bible.js';
import {ESV_NOTICE} from './esv.js';

const AO='https://bible.helloao.org/api/BSB/';
const pageSize=12;
let bsbIndex;

const words=text=>text.normalize('NFKC').toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu)||[];
const fail=(message,status)=>Object.assign(Error(message),{status});

export function searchInput(params){
 const {translation,q,page='1'}=params;
 const query=typeof q==='string'?q.trim().replace(/\s+/g,' '):'';
 if(query.length<2||query.length>120||!words(query).length){
  throw fail('Enter 2 to 120 characters to search for verses.',400);
 }
 if(typeof page!=='string'||!/^([1-9]|[1-4][0-9]|50)$/.test(page)){
  throw fail('This page of verse results is unavailable.',400);
 }
 if(typeof translation!=='string'||!/^(BSB|ESV|AB_[a-f0-9]{16}-[0-9]{2})$/.test(translation)){
  throw fail('Choose a translation that supports verse search.',400);
 }
 return {translation,query,page:Number(page)};
}

async function read(url,headers){
 const response=await fetch(url,{headers,signal:AbortSignal.timeout(14000),cache:'no-store',redirect:'error'});
 if(!response.ok)throw fail(response.status===429?'Search request limit reached. Try again later.':'Verse search is temporarily unavailable.',response.status===429?429:502);
 return response.json();
}

function loadBSBIndex(){
 if(bsbIndex&&bsbIndex.expires>Date.now())return bsbIndex.promise;
 const index={expires:Date.now()+3600000};
 index.promise=read(AO+'complete.simple.json').then(data=>{
  const verses=[];
  for(const book of data.books){
   for(const {chapter} of book.chapters){
    for(const verse of chapter.content){
     if(verse.type!=='verse'||typeof verse.text!=='string')continue;
     verses.push({
      book:book.id,chapter:chapter.number,verse:verse.number,
      reference:`${book.name} ${chapter.number}:${verse.number}`,
      text:verse.text,normalized:' '+words(verse.text).join(' ')+' '
     });
    }
   }
  }
  if(!verses.length)throw Error('Empty Bible index');
  return verses;
 }).catch(error=>{
  if(bsbIndex===index)bsbIndex=null;
  throw error;
 });
 bsbIndex=index;
 return index.promise;
}

async function searchBSB(query,page){
 const tokens=words(query);
 const terms=[...new Set(tokens)].map(word=>' '+word+' ');
 const phrase=' '+tokens.join(' ')+' ';
 const exact=[],other=[];
 for(const verse of await loadBSBIndex()){
  if(verse.normalized.includes(phrase))exact.push(verse);
  else if(terms.every(term=>verse.normalized.includes(term)))other.push(verse);
 }
 const matches=exact.concat(other);
 return {
  results:matches.slice((page-1)*pageSize,page*pageSize).map(({normalized,...result})=>result),
  hasMore:matches.length>page*pageSize,
  licenseUrl:'https://berean.bible/'
 };
}

async function searchESV(query,page){
 const key=process.env.ESV_API_KEY;
 if(!key)throw fail('ESV search is unavailable. Choose another translation.',503);
 const params=new URLSearchParams({q:query,page:String(page),'page-size':String(pageSize)});
 const [data,index]=await Promise.all([
  read('https://api.esv.org/v3/passage/search/?'+params,{Authorization:'Token '+key}),
  read(AO+'books.json')
 ]);
 const books=new Map(index.books.map(book=>[book.name.toLowerCase(),book.id]));
 books.set('psalm','PSA');
 books.set('song of solomon','SNG');
 books.set('song of songs','SNG');
 const results=(data.results||[]).flatMap(result=>{
  const match=/^(.+?) ([1-9]\d{0,2}):([1-9]\d{0,2})(?:[-–]\d+)?$/.exec(result.reference);
  const book=match&&books.get(match[1].toLowerCase());
  return book?[{book,chapter:Number(match[2]),verse:Number(match[3]),reference:result.reference,text:String(result.content||'')}]:[];
 });
 return {results,hasMore:page<Number(data.total_pages),licenseNotice:ESV_NOTICE,licenseUrl:'https://www.esv.org/'};
}

export async function verseSearch({translation,query,page},budget){
 if(translation==='ESV')await budget?.('esv');
 const result=await (translation==='BSB'?searchBSB(query,page):translation==='ESV'?searchESV(query,page):apiBibleSearch(translation,query,page,pageSize,budget));
 return {...result,hasMore:page<50&&result.hasMore};
}
