import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {googleAvatarUrl,googleProviderAvailable,signInWithGoogle,importGooglePicture} from '../google-auth.js';
import {renderAccountAvatar} from '../account-avatar.js';
import {telemetryAllowed,sanitizeTelemetry} from '../telemetry-model.js';

const google=url=>({id:'g',identities:[{provider:'google',identity_data:{picture:url,full_name:'Google Name'}}]});
test('Google photos are restricted to Google identity hosts and preserve saved avatar choices',()=>{
 const url='https://lh3.googleusercontent.com/a/photo=s256';
 assert.equal(googleAvatarUrl(google(url)),url);
 for(const bad of ['http://lh3.googleusercontent.com/photo','https://lh3.googleusercontent.com.evil.test/p','https://evil.test/p','https://u:p@lh3.googleusercontent.com/p','data:image/svg+xml,bad'])assert.equal(googleAvatarUrl(google(bad)),null);
 assert.equal(googleAvatarUrl({user_metadata:{avatar_url:url},identities:[{provider:'email'}]}),null);
 const d=new JSDOM('<button id="accountButton"></button>').window.document;
 renderAccountAvatar(google(url),null,d);assert.equal(d.querySelector('img').src,url);assert.equal(d.querySelector('img').referrerPolicy,'no-referrer');
 renderAccountAvatar(google(url),{avatar:null,display_name:'Removed'},d);assert.equal(d.querySelector('img'),null);
 renderAccountAvatar(google(url),{avatar:'data:image/webp;base64,YWJj'},d);assert.equal(d.querySelector('img').src,'data:image/webp;base64,YWJj');
 renderAccountAvatar(null,null,d);assert.equal(d.querySelector('img'),null);
});
test('OAuth uses the Supabase callback flow and public provider availability fails closed',async()=>{
 let args;await signInWithGoogle({auth:{signInWithOAuth:async a=>{args=a;return {data:{}};}}},'https://exegetical-bible.vercel.app');
 assert.equal(args.provider,'google');assert.equal(args.options.redirectTo,'https://exegetical-bible.vercel.app/auth/callback');assert.equal(args.options.scopes,'openid email profile');assert.equal(args.options.queryParams.prompt,'select_account');
 const config={supabaseUrl:'https://project.supabase.co',supabaseKey:'publishable'};
 assert.equal(await googleProviderAvailable(config,async(url,options)=>{assert.equal(url,config.supabaseUrl+'/auth/v1/settings');assert.equal(options.headers.apikey,'publishable');return {ok:true,json:async()=>({external:{google:true}})};}),true);
 assert.equal(await googleProviderAvailable(config,async()=>({ok:false})),false);
 assert.equal(await googleProviderAvailable(config,async()=>{throw Error('offline')}),false);
});
test('Google image import uses anonymous CORS and produces only a bounded WebP copy',async()=>{
 const oldImage=globalThis.Image,oldDocument=globalThis.document;let image,draw;
 globalThis.Image=class{constructor(){image=this;this.naturalWidth=600;this.naturalHeight=400;}set src(value){this.url=value;queueMicrotask(()=>this.onload());}};
 const canvas={getContext:()=>({drawImage:(...a)=>draw=a}),toDataURL:()=>'data:image/webp;base64,YWJj'};
 globalThis.document={createElement:()=>canvas};
 try{assert.equal(await importGooglePicture(google('https://lh3.googleusercontent.com/p')),'data:image/webp;base64,YWJj');assert.equal(image.crossOrigin,'anonymous');assert.equal(image.referrerPolicy,'no-referrer');assert.equal(canvas.width,256);assert.equal(canvas.height,256);assert.deepEqual(draw.slice(1),[100,0,400,400,0,0,256,256]);await assert.rejects(importGooglePicture(google('https://evil.test/p')),/No supported/);}finally{globalThis.Image=oldImage;globalThis.document=oldDocument;}
});
test('measurement excludes private routes, callback tokens, non-production visits and opt-outs',()=>{
 const base={hostname:'exegetical-bible.vercel.app',pathname:'/',storage:{getItem:()=>null},navigator:{}};
 assert.equal(telemetryAllowed(base),true);
 for(const pathname of ['/admin/','/auth/callback','/not-a-public-page'])assert.equal(telemetryAllowed({...base,pathname}),false);
 assert.equal(telemetryAllowed({...base,hostname:'preview.vercel.app'}),false);
 assert.equal(telemetryAllowed({...base,navigator:{globalPrivacyControl:true}}),false);
 assert.equal(telemetryAllowed({...base,navigator:{doNotTrack:'1'}}),false);
 assert.equal(telemetryAllowed({...base,storage:{getItem:()=>'true'}}),false);
 const clean=sanitizeTelemetry({type:'vital',url:'https://exegetical-bible.vercel.app/?email=private&book=JHN#access_token=secret',route:'unsafe?value'});
 assert.equal(clean.url,'https://exegetical-bible.vercel.app/');assert.equal(clean.route,'/');
 assert.equal(sanitizeTelemetry({url:'https://exegetical-bible.vercel.app/auth/callback#access_token=secret'}),null);
 assert.equal(sanitizeTelemetry({url:'https://other.test/'}),null);
});
