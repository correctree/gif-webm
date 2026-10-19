import test from 'node:test';import assert from 'node:assert/strict';
import {webmArgs,webmAttempts,scaleFilter,convertFresh} from '../src/conversion.js';
const valid=()=>{const data=new Uint8Array(256);data.set([0x1a,0x45,0xdf,0xa3]);return data;};
test('stable WebM uses VP8 alpha, one thread, no lookahead and bounded constant-rate frame sampling',()=>{
 const a=webmArgs({codec:'vp8',size:1024});assert.equal(a[a.indexOf('-c:v')+1],'libvpx');assert.equal(a[a.indexOf('-pix_fmt')+1],'yuva420p');assert.equal(a[a.indexOf('-auto-alt-ref')+1],'0');assert.equal(a[a.indexOf('-lag-in-frames')+1],'0');assert.match(a[a.indexOf('-vf')+1],/^fps=20,/);assert.match(scaleFilter(0),/max\(2/);assert.throws(()=>webmArgs({codec:'vp8',size:1024},NaN));
});
test('VP9 is opt-in and fallbacks preserve alpha while reducing size',()=>{
 assert.deepEqual(webmAttempts('vp9',1024),[{codec:'vp9',size:1024},{codec:'vp8',size:1024},{codec:'vp8',size:512},{codec:'vp8',size:256}]);assert.equal(webmAttempts()[0].codec,'vp8');assert.throws(()=>scaleFilter(-1));
});
test('a trapped worker is terminated before a fresh worker rewrites its own input and succeeds',async()=>{
 const events=[],input=new Uint8Array([1,2,3]);let count=0;
 const result=await convertFresh({input,create:async()=>{const id=++count;events.push('create'+id);return {writeFile:async(name,bytes)=>{assert.deepEqual([...bytes],[1,2,3]);bytes[0]=99;},exec:async()=>{if(id===1)throw new WebAssembly.RuntimeError('memory access out of bounds');return 0;},readFile:async()=>valid(),terminate:()=>events.push('terminate'+id)};}});
 assert.deepEqual(events,['create1','terminate1','create2','terminate2']);assert.deepEqual([...input],[1,2,3]);assert.equal(result.attempt.size,512);assert.equal(result.data.length,256);
});
test('ordinary errors and malformed outputs are not presented as successful conversions',async()=>{
 for(const [code,data]of [[1,valid()],[0,new Uint8Array(2)]]){let terminated=0;await assert.rejects(()=>convertFresh({input:new Uint8Array(),create:async()=>({writeFile:async()=>{},exec:async()=>code,readFile:async()=>data,terminate:()=>terminated++})}));assert.equal(terminated,1);}
});
