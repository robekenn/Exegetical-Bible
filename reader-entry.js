const {pathname,hash}=location;
const recovery=new URLSearchParams(hash.slice(1)).get('type')==='recovery';

if((pathname==='/auth/callback'||pathname==='/')&&recovery){
 // Keep recovery credentials away from the reader's persistent auth client.
 location.replace('/reset-password/'+hash);
}else{
 await import('./polish.js');
 void import('./vendor/telemetry.js');
 await import('./app.js');
}
