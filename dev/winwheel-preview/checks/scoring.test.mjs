import {test} from 'node:test';
import assert from 'node:assert/strict';
import {impactAwards} from '../../../src/entrypoints/module_winwheel.unlisted/scoring.ts';
test('every percentage 0..100 is the exact sum of physical collision awards',()=>{
 for(let score=0;score<=100;score++)for(let count=1;count<=30;count++){
  const impacts=Array.from({length:count},(_,i)=>({frame:i*40,target:i%3,x:100,y:100}));
  const awards=impactAwards(impacts,score);
  assert.equal(awards.reduce((sum,a)=>sum+a.points,0),score);
  assert.equal(awards.at(-1).total,score);
  assert.ok(awards.every(a=>a.points>=0&&Number.isInteger(a.points)&&a.total<=score));
  assert.ok(awards.every((a,i)=>a.frame===impacts[i].frame));
 }
});
test('resting on a bumper cannot continuously earn points; no impact cannot earn points',()=>{
 const hits=[0,1,2,3,40].map(frame=>({frame,target:0,x:0,y:0}));
 assert.equal(impactAwards(hits,42).length,2);
 assert.throws(()=>impactAwards([],42),/physical impact/);
 assert.deepEqual(impactAwards([],0),[]);
});
