export function validPath(path) {
  return typeof path === 'string' && /^(available_(translations|commentaries|datasets)|[A-Za-z0-9_-]+\/books|[A-Za-z0-9_-]+\/[A-Z0-9]{3}\/[1-9][0-9]{0,2}|c\/[a-z0-9-]+\/[A-Z0-9]{3}\/[1-9][0-9]{0,2}|d\/(bsb-interlinear|open-cross-ref)\/[A-Z0-9]{3}\/[1-9][0-9]{0,2}|d\/stepbible-lexicon\/lexicon\/[GH][0-9]{4}[a-z]?)\.json$/.test(path);
}
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({error:'Method not allowed'});
  const path = req.query.path;
  if (!validPath(path)) return res.status(400).json({error:'Invalid Bible resource'});
  try {
    const response = await fetch('https://bible.helloao.org/api/' + path, {signal:AbortSignal.timeout(18000)});
    if (!response.ok) return res.status(response.status === 404 ? 404 : 502).json({error:response.status === 404 ? 'This resource does not cover this passage.' : 'The Bible provider is temporarily unavailable.'});
    const data = await response.json();
    res.setHeader('Cache-Control','public, s-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json(data);
  } catch { return res.status(502).json({error:'Unable to reach the Bible provider. Please try again.'}); }
}
