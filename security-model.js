// A response issued under an old session must never reach the next account's UI.
export async function sessionResult(request,getUser){const owner=getUser()?.id;const result=await request;if(owner!==getUser()?.id)throw Error('Account changed. Reopen this page.');if(result.error)throw Error(result.error.message);return result.data;}
// Explicit sign-out is allowed only once pending notes are synced by the caller.
export function clearAccountCache(storage,owner){if(!owner)return;const prefix='exegetical-user-'+owner+'-';for(let i=storage.length-1;i>=0;i--){const key=storage.key(i);if(key?.startsWith(prefix))storage.removeItem(key);}}
