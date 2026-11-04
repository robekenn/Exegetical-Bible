import {inject} from '@vercel/analytics';
import {injectSpeedInsights} from '@vercel/speed-insights';
import {telemetryAllowed,sanitizeTelemetry} from './telemetry-model.js';
const allowed=()=>telemetryAllowed({hostname:location.hostname,pathname:location.pathname,storage:localStorage,navigator});
const beforeSend=event=>allowed()?sanitizeTelemetry(event):null;
const toggle=document.getElementById('analyticsChoice');
if(toggle){const update=()=>{try{toggle.textContent=localStorage.getItem('exegetical-analytics-disabled')==='true'?'Enable anonymous usage & performance measurement':'Disable anonymous usage & performance measurement';}catch{toggle.disabled=true;}};update();toggle.onclick=()=>{try{localStorage.setItem('exegetical-analytics-disabled',String(localStorage.getItem('exegetical-analytics-disabled')!=='true'));location.reload();}catch{toggle.textContent='Update your browser storage settings to change this preference.';}};}
if(allowed()){
 inject({mode:'production',debug:false,beforeSend});
 injectSpeedInsights({debug:false,beforeSend,route:location.pathname});
}
