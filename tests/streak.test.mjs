import {test} from 'node:test';import assert from 'node:assert/strict';import {mergeStreak,streakStats,localDay} from '../streak.js';
test('streak counts calendar days once, merges devices, and retains yesterday until today is read',()=>{
 const a={ranges:[['2026-10-30','2026-11-01']]},b={ranges:[['2026-11-01','2026-11-02']]};const r=mergeStreak(a,b,'2026-11-02');assert.equal(streakStats(r,'2026-11-02').current,4);assert.equal(streakStats(r,'2026-11-03').current,4);assert.equal(streakStats(r,'2026-11-04').current,0);assert.equal(streakStats(r,'2026-11-04').best,4);assert.equal(streakStats(r,'2026-11-02').today,true);assert.equal(streakStats(r,'2026-11-02').week.filter(d=>d.done).length,4);
 assert.deepEqual(mergeStreak(r,b,'2026-11-02'),r);assert.equal(localDay(new Date(2026,10,2,23,59)),'2026-11-02');
});
test('invalid/future dates do not fabricate progress; long continuous runs stay compact',()=>{const r=mergeStreak({ranges:[['bad','bad'],['2026-02-31','2026-03-03'],['2026-11-04','2026-11-05']]},{},'2026-11-02');assert.deepEqual(r.ranges,[]);assert.equal(streakStats({ranges:[['2020-01-01','2026-11-02']]},'2026-11-02').current>2000,true);});
