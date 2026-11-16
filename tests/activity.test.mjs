import {test} from 'node:test';
import assert from 'node:assert/strict';
import {activityStatus} from '../activity.js';

test('missing activity stays private and active labels expire after five minutes',()=>{
 const now=Date.parse('2026-11-16T22:00:00Z');
 assert.equal(activityStatus(null,now),null);
 assert.deepEqual(activityStatus('2026-11-16T21:55:00Z',now),{label:'Active now',active:true});
 assert.deepEqual(activityStatus('2026-11-16T21:54:59Z',now),{label:'Active 5 minutes ago',active:false});
 assert.equal(activityStatus('2026-11-16T21:00:00Z',now).label,'Active 1 hour ago');
});
