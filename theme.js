(() => {
 const syncAccount=document.currentScript.hasAttribute('data-sync-account');
 const displayKey='exegetical-display-dark';
 const guestKey='exegetical-dark';
 const read=key=>{
  try{return JSON.parse(localStorage.getItem(key));}catch{return null;}
 };
 function show(dark){
  document.body.classList.toggle('dark',dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#1d2924':'#284e43');
 }

 // Set the cached theme before the page content or loading screen paints.
 show((read(displayKey)??read(guestKey))===true);
 const hasSessionCookie=document.cookie.split(';').some(cookie=>/^sb-[\w-]+-auth-token(?:\.\d+)?=/.test(cookie.trim()));
 if(!syncAccount||!hasSessionCookie)return;

 async function sync(){
  const response=await fetch('/api/config');
  if(!response.ok)return;
  const {supabaseUrl,supabaseKey}=await response.json();
  if(!supabaseUrl||!supabaseKey)return;
  const [{createBrowserClient,parseCookieHeader,serializeCookieHeader},{persistentCookieOptions}]=await Promise.all([
   import('/vendor/supabase.js'),import('/session-options.js')
  ]);
  const client=createBrowserClient(supabaseUrl,supabaseKey,{
   auth:{detectSessionInUrl:false},
   cookies:{
    getAll:()=>parseCookieHeader(document.cookie),
    setAll:items=>{
     for(const {name,value,options}of items){
      document.cookie=serializeCookieHeader(name,value,persistentCookieOptions(options,location.protocol==='https:'));
     }
    }
   }
  });
  const {data:{session}}=await client.auth.getSession();
  if(!session)return;
  const id=session.user.id;
  const {data,error}=await client.from('study_preferences').select('settings').eq('user_id',id).maybeSingle();
  if(error)return;
  const {data:{session:current}}=await client.auth.getSession();
  if(current?.user.id!==id)return;
  const pending=read('exegetical-user-'+id+'-pending-preferences');
  const dark=pending?.dark??data?.settings?.dark;
  if(typeof dark!=='boolean')return;
  show(dark);
  try{localStorage.setItem(displayKey,JSON.stringify(dark));}catch{}
 }
 sync().catch(()=>{}); // The device theme still works offline.
})();
