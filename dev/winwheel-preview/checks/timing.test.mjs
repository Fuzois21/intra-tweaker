import {test} from 'node:test';
import assert from 'node:assert/strict';
import {frameLoop} from '../../../src/entrypoints/module_winwheel.unlisted/timing.ts';
const callbacks=new Map();let id=0;
globalThis.requestAnimationFrame=fn=>{callbacks.set(++id,fn);return id};
globalThis.cancelAnimationFrame=id=>callbacks.delete(id);
const tick=time=>{const frame=[...callbacks.values()];callbacks.clear();frame.forEach(fn=>fn(time))};
test('first frame and negative elapsed times never produce invalid progress',async()=>{
 const values=[];const run=frameLoop(100,new AbortController().signal,p=>values.push(Math.pow(p,1.15)));
 tick(10);tick(9);tick(60);tick(110);
 assert.equal(await run,true);assert.deepEqual(values.slice(0,2),[0,0]);assert.ok(values.every(Number.isFinite));assert.equal(values.at(-1),1);
});
test('abort settles and removes all scheduled frames',async()=>{
 const controller=new AbortController();let count=0;const run=frameLoop(100,controller.signal,()=>count++);
 tick(1);controller.abort();assert.equal(await run,false);tick(500);assert.equal(count,1);assert.equal(callbacks.size,0);
});
test('a rendering error rejects instead of leaving an infinite overlay',async()=>{
 const run=frameLoop(100,new AbortController().signal,()=>{throw Error('render error')});tick(1);
 await assert.rejects(run,/render error/);assert.equal(callbacks.size,0);
});
