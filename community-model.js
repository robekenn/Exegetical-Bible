export function validUsername(s){return /^[a-z0-9_]{3,24}$/.test(s);}
export function normalizeProfile(p){const username=String(p.username||'').trim().toLowerCase();if(!validUsername(username))throw Error('Choose a username with 3–24 lowercase letters, numbers or underscores.');const display_name=String(p.display_name||'').trim();if(!display_name||display_name.length>60)throw Error('Display name must be 1–60 characters.');const out={username,display_name,bio:String(p.bio||'').trim(),location:String(p.location||'').trim(),interests:String(p.interests||'').trim(),avatar:p.avatar||null,discoverable:Boolean(p.discoverable),terms_version:'2026-11-02',updated_at:new Date().toISOString()};if(out.bio.length>600||out.location.length>80||out.interests.length>200)throw Error('One of your profile fields is too long.');if(out.avatar&&(!/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(out.avatar)||out.avatar.length>=100000))throw Error('Choose a smaller supported profile picture.');return out;}
export function verseLink(v){if(!v||!/^[A-Z0-9]{3}$/.test(v.book)||!Number.isInteger(Number(v.chapter))||!Number.isInteger(Number(v.verse))||v.chapter<1||v.chapter>999||v.verse<1||v.verse>999||!/^[A-Za-z0-9_-]{1,40}$/.test(v.translation||''))return null;return '/?'+new URLSearchParams({book:v.book,chapter:String(v.chapter),verse:String(v.verse),translation:v.translation});}

// Validate the same normalized value used by the save path, before native form validation.
export function bindUsernameField(input){
 const validate=()=>{const value=input.value.trim().toLowerCase();const valid=validUsername(value);input.setCustomValidity(!value||valid?'':'Use 3–24 letters, numbers or underscores, without spaces or @.');input.setAttribute('aria-invalid',String(Boolean(value)&&!valid));};
 input.addEventListener('input',validate);
 input.addEventListener('blur',()=>{input.value=input.value.trim().toLowerCase();validate();});
 validate();
}
