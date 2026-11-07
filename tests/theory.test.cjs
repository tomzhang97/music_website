const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ctx = vm.createContext({ console });
if (fs.existsSync('src/theory.js')) vm.runInContext(fs.readFileSync('src/theory.js','utf8'), ctx);
const T = ctx.IntervalCore || {};
const arr = x => Array.from(x);
test('A4 uses concert tuning and middle C has the correct octave', () => {
 assert.equal(T.frequency?.(69),440); assert.equal(T.noteName?.(60),'C4'); assert.ok(Math.abs(T.frequency(60)-261.625565)<0.001);
});
test('chained cells preserve signed steps and root-reference cells derive the audible second step', () => {
 assert.deepEqual(arr(T.cellOffsets({size:3,interval:2,direction:'down',step2rule:'fixed',step2interval:10,step2direction:'up',reference:'chain'})),[0,-2,8]);
 assert.deepEqual(arr(T.cellOffsets({size:3,interval:2,direction:'down',step2rule:'fixed',step2interval:10,step2direction:'up',reference:'root'})),[0,-2,10]);
 assert.deepEqual(arr(T.cellOffsets({size:3,interval:5,direction:'down',step2rule:'mirror',reference:'chain'})),[0,-5,0]);
 assert.deepEqual(arr(T.cellOffsets({size:3,interval:5,direction:'down',step2rule:'repeat',reference:'chain'})),[0,-5,-10]);
});
test('alternate direction changes each cycle, random step stays in the selected pool', () => {
 assert.deepEqual(arr(T.cellOffsets({size:2,interval:7,direction:'alternate'},1)),[0,-7]);
 assert.deepEqual(arr(T.cellOffsets({size:3,interval:2,direction:'up',step2rule:'random',step2direction:'down',pool:[3],reference:'chain'},0,()=>0)),[0,2,-1]);
});
test('root fitting preserves extreme compound distances inside piano range', () => {
 assert.equal(T.fitRoot(72,[0,16,32]),52); assert.equal(T.fitRoot(48,[0,-16,-32]),80);
});
test('root traversal honors repetition, fourths, up/down and fixed modes', () => {
 assert.equal(T.nextRoot({mode:'fourths',fixed:60,repeats:2},0,60),60);
 assert.equal(T.nextRoot({mode:'fourths',fixed:60,repeats:2},1,60),60);
 assert.equal(T.nextRoot({mode:'fourths',fixed:60,repeats:2},2,60),65);
 assert.equal(T.nextRoot({mode:'up',fixed:60,repeats:1},1,60),61);
 assert.equal(T.nextRoot({mode:'down',fixed:60,repeats:1},1,60),59);
 assert.equal(T.nextRoot({mode:'fixed',fixed:57,repeats:1},9,60),57);
});
test('fingering returns exact pitches and a compact hand position', () => {
 const f=T.solveFingering([60,62,67]); assert.equal(f.length,3);
 f.forEach((p,i)=>assert.equal([64,59,55,50,45,40][p.string]+p.fret,[60,62,67][i]));
 assert.ok(Math.max(...f.map(x=>x.fret))-Math.min(...f.map(x=>x.fret))<=4);
 assert.equal(T.solveFingering([84])[0],null);
});
test('all cadence styles order notes and chords and leave a positive duration', () => {
 const pure=T.phrase([60,64],100,'pure'); assert.equal(pure.events.length,2); assert.equal(pure.events[1].at,0.6);
 const lock=T.phrase([60,64,67],100,'lock'); assert.deepEqual(arr(lock.events.at(-1).indices),[0,1,2]);
 const cluster=T.phrase([60,64],100,'cluster'); assert.equal(cluster.events[0].indices.length,2);
 const echo=T.phrase([60,64],100,'echo'); assert.ok(echo.events[2].velocity<echo.events[0].velocity);
 const swing=T.phrase([60,64,67],100,'swing'); assert.ok(swing.events[1].at>swing.events[2].at-swing.events[1].at);
 for (const style of ['pure','lock','cluster','echo','swing']) assert.ok(T.phrase([60,64],200,style).duration>0);
});
test('choice grids include the target once, even when the pool is smaller than requested', () => {
 assert.deepEqual(arr(T.choices([2,4,7,12],4,4,()=>0.5)).sort((a,b)=>a-b),[2,4,7,12]);
 assert.equal(T.choices([2],2,8).length,1); assert.equal(T.choices([1,2,3,4,5,6,7,8,9],4,4).length,4);
});
test('quiz scoring records a question once and requires both answers for cell credit', () => {
 const q=new T.QuizSession(); q.begin([2,10]); assert.equal(q.answer(0,2),false); assert.equal(q.total,0);
 assert.equal(q.answer(1,7),true); assert.equal(q.total,1); assert.equal(q.correct,0); assert.equal(q.byInterval[2].correct,1); assert.equal(q.byInterval[10].correct,0);
 q.answer(1,10); assert.equal(q.total,1); q.begin([7]); q.answer(0,7); assert.equal(q.streak,1); assert.equal(q.best,1); assert.equal(q.accuracy,50);
});
test('placing transposed roots preserves pitch class instead of clipping at a visualizer boundary',()=>{
 assert.equal(T.placeRoot?.(65,[0,16]),53);
 const roots=[50,52,59,60].map(r=>T.placeRoot(r,[0,16,32]));
 assert.equal(roots[0],50);assert.equal(roots[1],52);assert.equal(roots[2],47);assert.equal(roots[3],48);
});
test('four configurable steps form a signed five-note phrase',()=>{
 const steps=[{interval:2,direction:'up'},{interval:5,direction:'down'},{interval:10,direction:'up'},{interval:7,direction:'down'}];
 assert.deepEqual(arr(T.sequenceOffsets?.(steps)||[]),[0,2,-3,7,0]);
});
test('sequence normalization keeps one to four valid intervals with no invalid pitches',()=>{
 assert.deepEqual(Array.from(T.normalizeSequence?.(null)||[],s=>[s.interval,s.direction]),[[7,'up']]);
 assert.equal(T.normalizeSequence?.(Array(8).fill({interval:4,direction:'up'}))?.length,4);
 assert.deepEqual(Array.from(T.normalizeSequence?.([{interval:NaN,direction:'up'},{interval:7,direction:'invalid'},{interval:16,direction:'down'}])||[],s=>[s.interval,s.direction]),[[16,'down']]);
});
test('pair sequence advances in order and transposes only after the last configured pair',()=>{
 const steps=[{interval:2,direction:'down'},{interval:7,direction:'up'},{interval:5,direction:'down'},{interval:12,direction:'up'}];
 assert.deepEqual([0,1,2,3,4,5].map(i=>{const s=T.sequencePosition?.(steps,i);return s?[s.index,s.group,s.last]:null;}),[[0,0,false],[1,0,false],[2,0,false],[3,0,true],[0,1,false],[1,1,false]]);
});
test('disjoint cells repeat the shared note instead of restarting from the original root',()=>{
 const p=T.disjointPhrase?.([60,62,64],120,'pure',0.7);
 assert.deepEqual(p?arr(p.events).flatMap(e=>arr(e.indices).map(i=>[60,62,64][i])):[],[60,62,62,64]);
 assert.equal(p.rests.length,1);assert.ok(Math.abs(p.rests[0].end-p.rests[0].start-0.7)<1e-9);
 assert.ok(p.events[2].at>=p.events[1].at+p.events[1].length+0.4+0.7-1e-9);
});
test('four disjoint intervals articulate adjacent pairs and contain three configurable pauses',()=>{
 const notes=[60,62,57,67,60],p=T.disjointPhrase?.(notes,200,'pure',1.2);
 assert.deepEqual(p?arr(p.events).flatMap(e=>arr(e.indices).map(i=>notes[i])):[],[60,62,62,57,57,67,67,60]);
 assert.equal(p.rests.length,3);p.rests.forEach(r=>assert.ok(Math.abs(r.end-r.start-1.2)<1e-9));
 assert.ok(p.duration>=p.events.at(-1).at+p.events.at(-1).length+0.4-1e-9);
});
test('disjoint cadence maps harmonic locks and echoes to each pair without adding a final pause',()=>{
 for(const [style,count] of [['pure',4],['lock',8],['cluster',8],['echo',8],['swing',4]]){
  const p=T.disjointPhrase?.([60,62,64],100,style,0.5);assert.equal(p?.events.flatMap(e=>Array.from(e.indices)).length,count,style);assert.equal(p.rests.length,1);assert.ok(p.duration>p.rests[0].end);
 }
 const harmonic=T.disjointPhrase([60,62,64],100,'pure',0.5,true);assert.deepEqual(arr(harmonic.events[0].indices),[0,1]);assert.deepEqual(arr(harmonic.events[1].indices),[1,2]);
});
