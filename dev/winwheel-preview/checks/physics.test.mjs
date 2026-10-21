import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advance, collidePeg, dropTrajectory, STEP } from '../../../src/entrypoints/module_winwheel.unlisted/physics.ts';
const bumpers=[{x:170,y:180,r:30,boost:110},{x:330,y:180,r:30,boost:110},{x:250,y:270,r:34,boost:110}];
const pachinko=[{x:160,y:180,r:22,boost:70},{x:340,y:180,r:22,boost:70},{x:250,y:270,r:26,boost:70}];
for(let row=0;row<9;row++)for(let col=0;col<(row%2?9:8);col++){
 const x=(row%2?45:68)+col*46,y=80+row*30;
 if(!pachinko.slice(0,3).some(b=>Math.hypot(x-b.x,y-b.y)<b.r+18))pachinko.push({x,y,r:3.8});
}
test('gravity accelerates and collisions reflect without penetrating the obstacle',()=>{
 const b={x:0,y:0,vx:0,vy:0,r:10};advance(b,520);assert.ok(b.vy>0&&b.y>0);
 Object.assign(b,{x:19,y:0,vx:-100,vy:0});assert.ok(collidePeg(b,{x:0,y:0,r:10}));assert.equal(b.x,20);assert.ok(b.vx>0);
});
for(const [name,pegs,pinball] of [['pinball',bumpers,true],['pachinko',pachinko,false]])test(`${name}: 100 seeded runs reach the collector continuously`,()=>{
 for(let seed=1;seed<=100;seed++){
  let rng=seed;const random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/2**32};
  const samples=dropTrajectory(pegs,pinball,random),last=samples.at(-1);
  assert.ok(last.y>=470&&Math.abs(last.x-250)<22);
  if(pinball){assert.ok(samples.filter(s=>s.flipper!==undefined).length>=3);assert.ok(samples.filter(s=>s.hit>=0).length>=5);}
  for(let i=1;i<samples.length;i++){
    const a=samples[i-1],b=samples[i];assert.ok(Number.isFinite(b.x)&&Number.isFinite(b.y));
    assert.ok(Math.hypot(b.x-a.x,b.y-a.y)<20,'No teleportation');
    assert.ok(b.x>=41&&b.x<=459&&b.y>=43&&b.y<490,'Inside the cabinet');
  }
 }
});
test('pinball plays a rally: several bumper hits and powered flipper returns before draining',()=>{
 const samples=dropTrajectory(bumpers,true);
 assert.ok(samples.filter(s=>s.flipper!==undefined).length>=3,'At least three flipper returns');
 assert.ok(samples.filter(s=>s.hit>=0).length>=5,'At least five actual bumper collisions');
});
