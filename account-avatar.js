import {validProfilePhoto} from './profile-photo.js';
import {googleAvatarUrl,googleDisplayName} from './google-auth.js';
export function renderAccountAvatar(user,profile,root=document){
 for(const id of ['accountButton','mobileAccountButton']){
  const button=root.getElementById(id);if(!button)continue;
  const mobile=id==='mobileAccountButton';
  if(!user){button.classList.remove('has-account-avatar');button.removeAttribute('aria-label');button.removeAttribute('title');if(!mobile)button.textContent='Sign in';else{button.querySelector('.account-avatar')?.remove();const icon=button.querySelector('svg');if(icon){icon.removeAttribute('hidden');icon.style.removeProperty('display');}}continue;}
  button.classList.add('has-account-avatar');button.setAttribute('aria-label','My account');button.title='My account';
  button.querySelector('.account-avatar')?.remove();if(!mobile)button.replaceChildren();else{const icon=button.querySelector('svg');if(icon){icon.setAttribute('hidden','');icon.style.display='none';}}
  const initial=root.createElement('span');initial.className='account-avatar account-initial';initial.setAttribute('aria-hidden','true');initial.textContent=(profile?.display_name?.trim()||profile?.username||googleDisplayName(user)||'You').slice(0,1).toUpperCase();button.prepend(initial);
  const source=profile?.avatar||(profile?null:googleAvatarUrl(user));
  if(validProfilePhoto(source)||source===googleAvatarUrl(user)&&Boolean(source)){
   const img=root.createElement('img');img.className='account-avatar';img.alt='';img.referrerPolicy='no-referrer';img.src=source;img.onerror=()=>img.replaceWith(initial);initial.replaceWith(img);
  }
 }
}
