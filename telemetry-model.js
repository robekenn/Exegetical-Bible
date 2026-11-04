const publicPaths=new Set(['/','/terms/','/privacy/','/cookies/','/guidelines/','/accessibility/','/contact/']);
export function telemetryAllowed({hostname,pathname,storage,navigator:nav}){
 try{return hostname==='exegetical-bible.vercel.app'&&publicPaths.has(pathname)&&storage.getItem('exegetical-analytics-disabled')!=='true'&&nav.globalPrivacyControl!==true&&nav.doNotTrack!=='1';}catch{return false;}
}
export function sanitizeTelemetry(event){
 try{const u=new URL(event.url);if(u.origin!=='https://exegetical-bible.vercel.app'||!publicPaths.has(u.pathname))return null;return {...event,url:u.origin+u.pathname,...('route'in event?{route:u.pathname}:{})};}catch{return null;}
}
