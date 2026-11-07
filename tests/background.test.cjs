const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const scope={};vm.createContext(scope);vm.runInContext(fs.readFileSync('src/theory.js','utf8'),scope);if(fs.existsSync('src/track.js'))vm.runInContext(fs.readFileSync('src/track.js','utf8'),scope);
const json=x=>JSON.parse(JSON.stringify(x));
test('disjoint prepared groups repeat shared endpoints and preserve the separate cycle breath',()=>{
 const p=scope.StudioTrack.plan(()=>({notes:[60,62,64],steps:[2,2],disjoint:true}),{bpm:200,style:'pure',pause:0.7,gap:2,targetSeconds:0});
 assert.deepEqual(json(p.events.map(e=>e.midi)),[60,62,62,64]);assert.equal(p.groups,1);assert.equal(p.segments.length,1);const seg=p.segments[0];assert.ok(Math.abs(seg.plan.rests[0].end-seg.plan.rests[0].start-0.7)<1e-9);assert.ok(Math.abs(p.duration-seg.plan.duration-2)<1e-9);
});
test('same-root pairs finish every group before the prepared track can loop',()=>{
 const called=[];const p=scope.StudioTrack.plan(i=>{called.push(i);const n=i%4;return {notes:[60+5*Math.floor(i/4),62+5*Math.floor(i/4)],steps:[2],sequence:{style:'pairs',index:n,count:4,last:n===3}};},{bpm:200,style:'pure',pause:0.5,gap:1,targetSeconds:2});
 assert.deepEqual(called,[0,1,2,3]);assert.equal(p.groups,1);assert.equal(p.segments.length,4);assert.deepEqual(json(p.segments.map(s=>s.group)),[1,1,1,1]);assert.equal(p.segments[0].gap,0.5);assert.equal(p.segments[3].gap,1);
});
test('prepared tracks bound group count while allowing new roots and complete groups',()=>{
 const p=scope.StudioTrack.plan(i=>({notes:[60+i%12,62+i%12],steps:[2]}),{bpm:200,style:'pure',pause:0.5,gap:0.3,targetSeconds:1000,maxGroups:3});assert.equal(p.groups,3);assert.equal(p.segments.length,3);assert.deepEqual(json(p.events.map(e=>e.midi)),[60,62,61,63,62,64]);
});
test('WAV is PCM16 with correct lengths, finite clamped samples and no external encoder',()=>{
 const bytes=scope.StudioTrack.wav({sampleRate:22050,length:5,getChannelData:()=>new Float32Array([0,1,-1,NaN,2])});const v=new DataView(bytes);const str=(o,n)=>String.fromCharCode(...new Uint8Array(bytes,o,n));assert.equal(str(0,4),'RIFF');assert.equal(str(8,4),'WAVE');assert.equal(v.getUint32(4,true),46);assert.equal(v.getUint16(22,true),1);assert.equal(v.getUint32(24,true),22050);assert.equal(v.getUint32(40,true),10);assert.deepEqual([0,1,2,3,4].map(i=>v.getInt16(44+i*2,true)),[0,32767,-32768,0,32767]);
});
