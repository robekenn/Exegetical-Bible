// Passage schedules only. Devotionals and interpretive questions require approved human authors.
const bookPlan=(id,title,book,bookName,count,description,minutes,tone)=>({
 id,versionId:id+'-v1',version:1,title,bookName,description,minutes,tone,
 author:'Exegetical Bible',kind:'Scripture reading plan',
 credits:'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.',
 sessions:Array.from({length:count},(_,i)=>({number:i+1,title:`${bookName} ${i+1}`,passages:[{book,bookName,chapter:i+1}],devotional:null,questions:[],practice:null}))
});
export const planCatalog=[
 bookPlan('mark','Read through Mark','MRK','Mark',16,'One chapter at a time, from the beginning of Mark to the end. A manageable place to build a reading rhythm.','5–10 min','olive'),
 bookPlan('john','Read through John','JHN','John',21,'Make room for a chapter of John each session, with space to keep your own reflections along the way.','8–12 min','clay'),
 {...bookPlan('psalms','A week in Psalms','PSA','Psalms',7,'Seven selected psalms, one per session. Take a week, or move at a pace that works for you.','2–5 min','gold'),sessions:[1,8,23,46,51,103,139].map((chapter,i)=>({number:i+1,title:`Psalm ${chapter}`,passages:[{book:'PSA',bookName:'Psalm',chapter}],devotional:null,questions:[],practice:null}))}
];
export function findPlan(versionId){return planCatalog.find(plan=>plan.versionId===versionId);}
export function progressKey(versionId,session){return `${versionId}:${session}`;}
export function planProgress(plan,entries){
 const completed=plan.sessions.filter(session=>entries[progressKey(plan.versionId,session.number)]?.completed).length;
 return {completed,total:plan.sessions.length,percent:Math.round(completed/plan.sessions.length*100),next:plan.sessions.find(session=>!entries[progressKey(plan.versionId,session.number)]?.completed)?.number||1,finished:completed===plan.sessions.length};
}
export function validPlanEntry(value){
 const plan=findPlan(value?.versionId);
 return Boolean(plan&&Number.isInteger(value.session)&&plan.sessions.some(s=>s.number===value.session)&&typeof value.completed==='boolean'&&typeof value.reflection==='string'&&value.reflection.length<=20000&&Number.isSafeInteger(value.revision)&&value.revision>=0);
}
export function readPlanCache(raw){
 const clean={runs:{},entries:{},pending:{}};
 if(!raw||raw.format!==1)return clean;
 for(const [key,run] of Object.entries(raw.runs||{})){
  if(findPlan(key)&&run?.versionId===key&&typeof run.startedAt==='string'&&Number.isFinite(Date.parse(run.startedAt)))clean.runs[key]={versionId:key,startedAt:run.startedAt,id:typeof run.id==='string'?run.id:null};
 }
 for(const [key,entry] of Object.entries(raw.entries||{})){
  if(validPlanEntry(entry)&&key===progressKey(entry.versionId,entry.session)&&clean.runs[entry.versionId])clean.entries[key]={...entry};
 }
 for(const [key,pending] of Object.entries(raw.pending||{})){
  if(clean.entries[key]&&Number.isSafeInteger(pending?.baseRevision)&&pending.baseRevision>=0)clean.pending[key]={baseRevision:pending.baseRevision,entry:{...clean.entries[key]}};
 }
 return clean;
}
