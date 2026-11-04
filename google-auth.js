export function googleAvatarUrl(user){
 const identity=user?.identities?.find(i=>i.provider==='google');
 if(!identity)return null;
 const value=identity.identity_data?.avatar_url||identity.identity_data?.picture;
 try{const u=new URL(value);return u.protocol==='https:'&&/^lh[3-6]\.googleusercontent\.com$/.test(u.hostname)&&!u.username&&!u.password&&!u.port?u.href:null;}catch{return null;}
}
export function googleDisplayName(user){const i=user?.identities?.find(i=>i.provider==='google');return String(i?.identity_data?.full_name||i?.identity_data?.name||'').trim().slice(0,60);}
export async function googleProviderAvailable(config,request=fetch){
 if(!config.supabaseUrl||!config.supabaseKey)return false;
 try{const r=await request(config.supabaseUrl+'/auth/v1/settings',{headers:{apikey:config.supabaseKey},signal:AbortSignal.timeout(4000)});if(!r.ok)return false;return (await r.json()).external?.google===true;}catch{return false;}
}
export function signInWithGoogle(client,origin){
 return client.auth.signInWithOAuth({provider:'google',options:{redirectTo:origin+'/auth/callback',scopes:'openid email profile',queryParams:{prompt:'select_account'}}});
}
// Import only the signed-in Google identity's photo, then retain the existing small WebP storage format.
export function importGooglePicture(user){
 const url=googleAvatarUrl(user);if(!url)return Promise.reject(Error('No supported Google profile picture is available.'));
 return new Promise((resolve,reject)=>{const image=new Image();image.crossOrigin='anonymous';image.referrerPolicy='no-referrer';const timer=setTimeout(()=>{image.src='';reject(Error('Google picture took too long to load. Try uploading a photo instead.'));},8000);
 image.onerror=()=>{clearTimeout(timer);reject(Error('Could not load your Google picture. Try uploading a photo instead.'));};
 image.onload=()=>{clearTimeout(timer);try{if(!image.naturalWidth||image.naturalWidth*image.naturalHeight>25000000)throw Error('Unsupported picture size.');const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const size=Math.min(image.naturalWidth,image.naturalHeight);canvas.getContext('2d').drawImage(image,(image.naturalWidth-size)/2,(image.naturalHeight-size)/2,size,size,0,0,256,256);const data=canvas.toDataURL('image/webp',.8);if(!/^data:image\/webp;base64,/.test(data)||data.length>=100000)throw Error('Picture could not be converted.');resolve(data);}catch{reject(Error('Could not import your Google picture. Try uploading a photo instead.'));}};image.src=url;});
}
