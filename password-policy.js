export function passwordFitsProvider(password,message){
 if(new TextEncoder().encode(password).length<=72)return true;
 message.textContent='Choose a password of 72 bytes or fewer. Some characters, including emoji, use more than one byte.';
 return false;
}
