import {searchInput,verseSearch} from '../lib/verse-search.js';
import {apiBibleResource} from '../lib/api-bible.js';
import {esvChapter} from '../lib/esv.js';
export function validPath(path) {
  return typeof path === 'string' && /^(search|available_(translations|commentaries|datasets|api_bible)|[A-Za-z0-9_-]+\/books|[A-Za-z0-9_-]+\/[A-Z0-9]{3}\/[1-9][0-9]{0,2}|c\/[a-z0-9-]+\/[A-Z0-9]{3}\/[1-9][0-9]{0,2}|d\/(bsb-interlinear|open-cross-ref)\/[A-Z0-9]{3}\/[1-9][0-9]{0,2}|d\/stepbible-lexicon\/lexicon\/[GH][0-9]{4}[a-z]?)\.json$/.test(path);
}
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({error:'Method not allowed'});
  const path = req.query.path;
  if (!validPath(path)) return res.status(400).json({error:'Invalid Bible resource'});
  try {
    if(path==='search.json'){
      res.setHeader('Cache-Control','private, no-store');
      return res.status(200).json(await verseSearch(searchInput(req.query)));
    }
    if(path==='available_api_bible.json'||path.startsWith('AB_')){
      res.setHeader('Cache-Control','private, no-store');
      return res.status(200).json(await apiBibleResource(path));
    }
    if(path.startsWith('ESV/')){
      res.setHeader('Cache-Control','private, no-store');
      const booksResponse=await fetch('https://bible.helloao.org/api/BSB/books.json',{signal:AbortSignal.timeout(15000)});
      if(!booksResponse.ok)throw Error('Book index unavailable');
      const booksData=await booksResponse.json();
      if(path==='ESV/books.json')return res.status(200).json({...booksData,translation:{id:'ESV',name:'English Standard Version'}});
      const [,bookId,file]=path.split('/');const b=booksData.books.find(b=>b.id===bookId);const c=Number(file.replace('.json',''));
      if(!b||c<1||c>b.numberOfChapters)return res.status(404).json({error:'Passage not available.'});
      return res.status(200).json(await esvChapter(b,c));
    }
    const response = await fetch('https://bible.helloao.org/api/' + path, {signal:AbortSignal.timeout(18000)});
    if (!response.ok) return res.status(response.status === 404 ? 404 : 502).json({error:response.status === 404 ? 'This resource does not cover this passage.' : 'The Bible provider is temporarily unavailable.'});
    const data = await response.json();
    res.setHeader('Cache-Control','public, s-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json(data);
  } catch(e) { return res.status(e.status||502).json({error:e.status?e.message:'Unable to reach the Bible provider. Please try again.'}); }
}
