import {parseFragment} from 'parse5';
const BASE='https://rest.api.bible/v1/';
let catalogCache;
const fail=(message,status)=>Object.assign(Error(message),{status});
export function plainText(html){const visit=n=>['script','style','noscript'].includes(n.tagName)?'':n.nodeName==='#text'?n.value:(n.childNodes||[]).map(visit).join('');return visit(parseFragment(String(html||''))).trim();}
export function parseBibleHTML(html){
 const output=[];let current;
 const flush=()=>{if(current){current.content=[current.content.join('').replace(/[^\S\n]+/g,' ').replace(/ *\n */g,'\n').trim()];if(current.content[0])output.push(current);current=null;}};
 function visit(n){
  if(['script','style','noscript'].includes(n.tagName))return;
  const attrs=Object.fromEntries((n.attrs||[]).map(a=>[a.name,a.value]));const classes=(attrs.class||'').split(/\s+/);
  if(classes.some(c=>/^(f|fe|x|note)$/.test(c)))return;
  if(classes.some(c=>/^(s[1-5]?|ms[1-3]?|mr|r|d)$/.test(c))){flush();// Heading text is collected without rendering markup.
   const text=node=>node.nodeName==='#text'?node.value:['script','style'].includes(node.tagName)?'':(node.childNodes||[]).map(text).join('');const heading=text(n).trim();if(heading)output.push({type:'heading',content:[heading]});return;}
  if(classes.includes('v')&&attrs['data-number']){flush();const number=Number(attrs['data-number'].split('-')[0]);if(Number.isInteger(number)&&number>0&&number<=999)current={type:'verse',number,content:[]};return;}
  if(n.nodeName==='#text'){if(current)current.content.push(n.value);return;}
  if(n.tagName==='br'&&current)current.content.push('\n');
  for(const child of n.childNodes||[])visit(child);
  if(['p','div'].includes(n.tagName)&&current)current.content.push('\n');
 }
 visit(parseFragment(String(html||'')));flush();return output;
}
async function request(path,budget){
 const key=process.env.API_BIBLE_KEY;if(!key)throw fail('API.Bible translations are not configured yet.',503);
 await budget?.('api-bible');
 const r=await fetch(BASE+path,{headers:{'api-key':key},signal:AbortSignal.timeout(15000),cache:'no-store',redirect:'error'});
 if(!r.ok)throw fail(r.status===401||r.status===403?'API.Bible access is unavailable. The site owner needs to check the API key and translation licenses.':r.status===404?'This translation does not cover this passage.':r.status===429?'API.Bible request limit reached. Please try again later.':'API.Bible is temporarily unavailable.',r.status===404?404:r.status===429?429:503);
 return r.json();
}
export function translationInfo(b){return {id:'AB_'+b.id,shortName:b.abbreviationLocal||b.abbreviation||b.name,name:b.nameLocal||b.name,englishName:b.name,language:b.language?.id,languageEnglishName:b.language?.name,textDirection:b.language?.scriptDirection==='rtl'?'rtl':'ltr',licenseUrl:'https://api.bible/',licenseNotice:plainText(b.copyright),provider:'API.Bible'};}
export async function apiBibleCatalog(budget){
 if(catalogCache&&catalogCache.key===process.env.API_BIBLE_KEY&&catalogCache.expires>Date.now())return catalogCache.data;
 const d=await request('bibles?include-full-details=true',budget);
 if(!Array.isArray(d.data))throw fail('API.Bible returned an invalid translation catalog.',502);
 const data=d.data.filter(b=>/^[a-f0-9]{16}-[0-9]{2}$/.test(b.id)&&b.name);
 catalogCache={key:process.env.API_BIBLE_KEY,expires:Date.now()+300000,data};return data;
}
export async function apiBibleResource(path,budget){
 const catalog=await apiBibleCatalog(budget);
 if(path==='available_api_bible.json')return {translations:catalog.map(translationInfo)};
 const match=/^AB_([a-f0-9]{16}-[0-9]{2})\/(books|([A-Z0-9]{3})\/([1-9][0-9]{0,2}))\.json$/.exec(path);
 const bible=catalog.find(b=>b.id===match?.[1]);if(!bible)throw fail('This API.Bible translation is not available to this site.',404);
 const translation=translationInfo(bible);
 const index=await request(`bibles/${bible.id}/books?include-chapters=true`,budget);
 const books=(index.data||[]).map((b,i)=>({id:b.id,name:b.name,nameLocal:b.nameLong||b.name,order:i+1,numberOfChapters:(b.chapters||[]).filter(c=>/^[1-9][0-9]*$/.test(String(c.number))).length})).filter(b=>/^[A-Z0-9]{3}$/.test(b.id)&&b.numberOfChapters>0&&b.numberOfChapters<=999&&typeof b.name==='string');
 if(match[2]==='books')return {translation,books};
 const book=books.find(b=>b.id===match[3]);const chapter=Number(match[4]);if(!book||chapter>book.numberOfChapters)throw fail('This translation does not cover this passage.',404);
 const d=await request(`bibles/${bible.id}/chapters/${book.id}.${chapter}?content-type=html&include-notes=false&include-titles=true&include-chapter-numbers=false&include-verse-numbers=true&fums-version=3`,budget);
 const content=parseBibleHTML(d.data?.content);if(!content.some(v=>v.type==='verse'))throw fail('No verses were returned for this passage.',502);
 translation.licenseNotice=plainText(d.data.copyright)||translation.licenseNotice;
 if(!translation.licenseNotice)throw fail('This translation is missing its required copyright notice.',502);
 if(!d.meta?.fumsToken)throw fail('API.Bible view reporting is unavailable. Please try another translation.',502);
 return {translation,book,chapter:{number:chapter,content},fumsToken:d.meta.fumsToken};
}

export async function apiBibleSearch(translation,query,page,limit,budget){
 const catalog=await apiBibleCatalog(budget);
 const bible=catalog.find(item=>'AB_'+item.id===translation);
 if(!bible)throw fail('This API.Bible translation is unavailable.',404);
 const offset=(page-1)*limit;
 const params=new URLSearchParams({query,limit:String(limit),offset:String(offset),'fums-version':'3'});
 const response=await request(`bibles/${bible.id}/search?${params}`,budget);
 const data=response.data;
 const token=response.meta?.fumsToken;
 const info=translationInfo(bible);
 const showText=typeof token==='string'&&token.length>0&&Boolean(info.licenseNotice);
 const verses=Array.isArray(data?.verses)?data.verses:[];
 const results=verses.slice(0,limit).flatMap(result=>{
  const match=/^([A-Z0-9]{3})\.([1-9]\d{0,2})\.([1-9]\d{0,2})(?:[-–]\d+)?$/.exec(result.id);
  if(!match)return [];
  return [{
   book:match[1],chapter:Number(match[2]),verse:Number(match[3]),
   reference:String(result.reference||`${match[1]} ${match[2]}:${match[3]}`),
   text:showText?plainText(result.text):''
  }];
 });
 return {
  results,hasMore:offset+verses.length<Number(data?.total),
  licenseNotice:showText?info.licenseNotice:'',licenseUrl:info.licenseUrl,
  textDirection:info.textDirection,fumsToken:showText?token:undefined
 };
}
