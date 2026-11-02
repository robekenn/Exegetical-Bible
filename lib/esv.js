export const ESV_NOTICE='Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved. The ESV text may not be quoted in any publication made available to the public by a Creative Commons license. The ESV may not be translated into any other language. Users may not copy or download more than 500 verses of the ESV Bible or more than one half of any book of the ESV Bible.';
export function parseESV(text){return [...text.matchAll(/\[(\d+)\]\s*([\s\S]*?)(?=\[\d+\]|$)/g)].map(m=>({type:'verse',number:Number(m[1]),content:[m[2].trim()]}));}
export async function esvChapter(book,chapter){
 if(!process.env.ESV_API_KEY){const e=Error('ESV needs a Crossway API key configured by the site owner.');e.status=503;throw e;}
 const u=new URL('https://api.esv.org/v3/passage/text/');
 for(const [k,v]of Object.entries({q:`${book.name} ${chapter}`,'include-passage-references':'false','include-verse-numbers':'true','include-first-verse-numbers':'true','include-footnotes':'false','include-headings':'false','include-short-copyright':'false','include-copyright':'false','include-selahs':'true','indent-poetry':'false','line-length':'0'}))u.searchParams.set(k,v);
 const r=await fetch(u,{headers:{Authorization:'Token '+process.env.ESV_API_KEY},signal:AbortSignal.timeout(15000)});
 if(!r.ok){const e=Error(r.status===429?'ESV request limit reached. Please try again later.':'The ESV service is unavailable.');e.status=r.status===429?429:502;throw e;}
 const d=await r.json();const content=parseESV(d.passages?.join('\n')||'');if(!content.length)throw Error('No ESV verses returned for this chapter.');
 return {translation:{id:'ESV',shortName:'ESV',name:'English Standard Version (ESV)',englishName:'English Standard Version (ESV)',textDirection:'ltr',licenseUrl:'https://www.esv.org/',licenseNotice:ESV_NOTICE},book,chapter:{number:Number(chapter),content}};
}
