import {createBrowserClient,parseCookieHeader,serializeCookieHeader} from '/vendor/supabase.js';
import {persistentCookieOptions} from '/session-options.js';

const form=document.getElementById('feedbackForm');
const status=document.getElementById('feedbackStatus');
const appeal=form.dataset.appeal==='true';
const token=appeal?location.hash.slice(1):null;
const tokenPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
if(appeal&&!tokenPattern.test(token)){
 form.hidden=true;
 status.textContent='Open the private appeal link from your ban notice.';
}

async function accessToken(){
 if(appeal)return null;
 try{
  const config=await fetch('/api/config').then(response=>response.json());
  if(!config.supabaseUrl||!config.supabaseKey)return null;
  const client=createBrowserClient(config.supabaseUrl,config.supabaseKey,{
   cookies:{
    getAll:()=>parseCookieHeader(document.cookie),
    setAll:items=>{for(const {name,value,options}of items)document.cookie=serializeCookieHeader(name,value,persistentCookieOptions(options,location.protocol==='https:'));}
   }
  });
  const {data}=await client.auth.getSession();
  return data.session?.access_token;
 }catch{return null;}
}

form.onsubmit=async event=>{
 event.preventDefault();
 const button=form.querySelector('button[type="submit"]');
 button.disabled=true;
 status.textContent='Sending…';
 try{
  const bearer=await accessToken();
  const response=await fetch('/api/feedback',{
   method:'POST',
   headers:{'Content-Type':'application/json',...(bearer?{Authorization:'Bearer '+bearer}:{})},
   body:JSON.stringify({
    category:appeal?'appeal':form.elements.category.value,
    details:form.elements.details.value,token
   })
  });
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'The request could not be sent.');
  status.textContent=appeal?'Appeal submitted for private review.':'Thank you. Your report was sent privately to the admins.';
  form.reset();
  form.hidden=true;
 }catch(error){
  status.textContent=error.message||'The request could not be sent. Try again.';
 }finally{button.disabled=false;}
};
