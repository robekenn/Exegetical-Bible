// Keep privileged navigation absent until the server verifies this session.
export async function revealAdminButton(button,client,isCurrent,fetcher=fetch){
 button.hidden=true;
 try{const {data}=await client.auth.getSession();const token=data.session?.access_token;if(!token||!isCurrent())return;
 const response=await fetcher('/api/admin?access=1',{headers:{Authorization:'Bearer '+token},cache:'no-store'});const result=await response.json();
 if(response.ok&&result.admin===true&&button.isConnected&&isCurrent())button.hidden=false;
 }catch{/* Missing access or connectivity keeps the button hidden. */}
}
