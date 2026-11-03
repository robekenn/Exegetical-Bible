import {parseFragment} from 'parse5';
export const ESV_NOTICE='Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved. The ESV text may not be quoted in any publication made available to the public by a Creative Commons license. The ESV may not be translated into any other language. Users may not copy or download more than 500 verses of the ESV Bible or more than one half of any book of the ESV Bible.';
export function parseESV(text){return [...text.matchAll(/\[(\d+)\]\s*([\s\S]*?)(?=\[\d+\]|$)/g)].map(m=>({type:'verse',number:Number(m[1]),content:[m[2].trim()]}));}
// Parse provider markup into plain text records; never send upstream HTML to the reader.
export function parseESVHTML(html){
 const output=[];let current=null;
 const text=node=>node.nodeName==='#text'?node.value:(node.childNodes||[]).map(text).join('');
 const flush=()=>{if(current){current.content=[current.content.join('').replace(/[^\S\n]+/g,' ').replace(/ *\n */g,'\n').trim()];if(current.content[0])output.push(current);current=null;}};
 function visit(node){
  const tag=node.tagName;
  if(['script','style','noscript'].includes(tag))return;
  if(/^h[3-6]$/.test(tag||'')){flush();const title=text(node).trim();if(title)output.push({type:'heading',content:[title]});return;}
  const classes=node.attrs?.find(a=>a.name==='class')?.value.split(/\s+/)||[];
  if(classes.includes('verse-num')){flush();const number=Number(text(node).trim());if(Number.isInteger(number)&&number>0)current={type:'verse',number,content:[]};return;}
  if(node.nodeName==='#text'){if(current)current.content.push(node.value);return;}
  if(tag==='br'&&current)current.content.push('\n');
  for(const child of node.childNodes||[])visit(child);
  if(['p','div'].includes(tag)&&current)current.content.push('\n');
 }
 visit(parseFragment(html));flush();return output;
}
export async function esvChapter(book,chapter){
 if(!process.env.ESV_API_KEY){const e=Error('ESV needs a Crossway API key configured by the site owner.');e.status=503;throw e;}
 const u=new URL('https://api.esv.org/v3/passage/html/');
 for(const [k,v]of Object.entries({q:`${book.name} ${chapter}`,'include-passage-references':'false','include-verse-numbers':'true','include-first-verse-numbers':'true','include-footnotes':'false','include-headings':'true','include-chapter-numbers':'false','include-book-titles':'false','include-footnote-body':'false','include-crossrefs':'false','include-short-copyright':'false','include-copyright':'false','include-selahs':'true','indent-poetry':'false','line-length':'0'}))u.searchParams.set(k,v);
 const r=await fetch(u,{headers:{Authorization:'Token '+process.env.ESV_API_KEY},signal:AbortSignal.timeout(15000)});
 if(!r.ok){const e=Error(r.status===429?'ESV request limit reached. Please try again later.':'The ESV service is unavailable.');e.status=r.status===429?429:502;throw e;}
 const d=await r.json();const content=parseESVHTML(d.passages?.join('\n')||'');if(!content.some(v=>v.type==='verse'))throw Error('No ESV verses returned for this chapter.');
 return {translation:{id:'ESV',shortName:'ESV',name:'English Standard Version (ESV)',englishName:'English Standard Version (ESV)',textDirection:'ltr',licenseUrl:'https://www.esv.org/',licenseNotice:ESV_NOTICE},book,chapter:{number:Number(chapter),content}};
}
