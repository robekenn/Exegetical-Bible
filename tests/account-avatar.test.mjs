import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {renderAccountAvatar} from '../account-avatar.js';
test('account pictures update on both layouts, fall back safely, and clear on sign out',()=>{
 const d=new JSDOM('<button id="accountButton">My account</button><button id="mobileAccountButton"><svg></svg><span>Account</span></button>').window.document;
 renderAccountAvatar({id:'1'},{display_name:'Kenneth',avatar:'data:image/webp;base64,YWJj'},d);
 assert.equal(d.querySelectorAll('img.account-avatar').length,2);assert.equal(d.getElementById('accountButton').getAttribute('aria-label'),'My account');
 d.querySelector('img').onerror();assert.equal(d.querySelector('.account-initial').textContent,'K');
 renderAccountAvatar({id:'1'},{display_name:'New name',avatar:'https://tracker.invalid/image'},d);assert.equal(d.querySelectorAll('img').length,0);assert.equal(d.querySelector('.account-initial').textContent,'N');
 renderAccountAvatar({id:'2'},null,d);assert.equal(d.querySelector('.account-initial').textContent,'Y');
 renderAccountAvatar(null,null,d);assert.equal(d.querySelectorAll('.account-avatar').length,0);assert.equal(d.getElementById('accountButton').textContent,'Sign in');assert.equal(d.querySelector('svg').hidden,false);
});
