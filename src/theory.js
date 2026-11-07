/* Musical domain. Classic script by design: works at file:// and opaque origins. */
(function (global) {
 'use strict';
 const intervals = [
  [1,'m2','Minor second','16:15','Jaws theme','Für Elise'],
  [2,'M2','Major second','9:8','Happy Birthday','Yesterday'],
  [3,'m3','Minor third','6:5','Greensleeves','Hey Jude'],
  [4,'M3','Major third','5:4','When the Saints Go Marching In','Swing Low, Sweet Chariot'],
  [5,'P4','Perfect fourth','4:3','Here Comes the Bride','O Come, All Ye Faithful'],
  [6,'TT','Tritone','45:32','Maria · West Side Story','Black Sabbath'],
  [7,'P5','Perfect fifth','3:2','Twinkle, Twinkle, Little Star','The Flintstones theme'],
  [8,'m6','Minor sixth','8:5','The Entertainer','Love Story theme'],
  [9,'M6','Major sixth','5:3','My Bonnie Lies over the Ocean','Nobody Knows the Trouble I’ve Seen'],
  [10,'m7','Minor seventh','9:5','Somewhere · West Side Story','Watermelon Man'],
  [11,'M7','Major seventh','15:8','Take On Me · chorus leap','I Love You · Cole Porter'],
  [12,'P8','Octave','2:1','Somewhere over the Rainbow','Willow Weep for Me'],
  [13,'m9','Minor ninth','32:15','Octave + minor second','Octave + minor second'],
  [14,'M9','Major ninth','9:4','Octave + major second','Octave + major second'],
  [15,'m10','Minor tenth','12:5','Octave + minor third','Octave + minor third'],
  [16,'M10','Major tenth','5:2','Octave + major third','Octave + major third']
 ].map(([st,short,name,ratio,up,down])=>({st,short,name,ratio,up,down}));
 const tuning = [64,59,55,50,45,40]; // string 1 (high E) through 6 (low E)
 const names=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
 const frequency=m=>440*Math.pow(2,(m-69)/12);
 const noteName=m=>names[((m%12)+12)%12]+(Math.floor(m/12)-1);
 const info=s=>intervals.find(i=>i.st===Math.abs(s)) || {st:Math.abs(s),short:s===0?'P1':Math.abs(s)+' st',name:s===0?'Unison':Math.abs(s)+' semitones',ratio:s===0?'1:1':'—',up:'Listen for the distance between the notes.',down:'Listen for the distance between the notes.'};
 const pick=(a,rng=Math.random)=>a[Math.min(a.length-1,Math.floor(rng()*a.length))];
 function shuffle(a,rng=Math.random){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
 function sign(direction,iteration){return direction==='down'||direction==='alternate'&&iteration%2===1?-1:1;}
 function cellOffsets(c,iteration=0,rng=Math.random){
  const first=Number(c.interval)*sign(c.direction,iteration);const out=[0,first];
  if(Number(c.size)===3){let second;
   if(c.step2rule==='repeat') second=first;
   else if(c.step2rule==='mirror') second=-first;
   else second=(c.step2rule==='random'?pick(c.pool?.length?c.pool:[2,3,4,5,7],rng):Number(c.step2interval||7))*sign(c.step2direction,iteration);
   out.push((c.reference==='root'?0:first)+second);
  }return out;
 }
 function normalizeSequence(value){
  const rows=Array.isArray(value)?value.filter(s=>s&&intervals.some(i=>i.st===Number(s.interval))&&['up','down'].includes(s.direction)).slice(0,4).map(s=>({interval:Number(s.interval),direction:s.direction})):[];
  return rows.length?rows:[{interval:7,direction:'up'}];
 }
 function sequenceOffsets(value){const out=[0];for(const step of normalizeSequence(value))out.push(out.at(-1)+step.interval*(step.direction==='down'?-1:1));return out;}
 function sequencePosition(value,iteration=0){const rows=normalizeSequence(value),n=Math.max(0,Math.floor(iteration)||0),index=n%rows.length;return {index,group:Math.floor(n/rows.length),last:index===rows.length-1,step:rows[index],count:rows.length};}
 function fitRoot(root,offsets){return Math.max(48-Math.min(...offsets),Math.min(84-Math.max(...offsets),Math.round(root)));}
 // Relocate by octaves only: clamping would change the musical root progression.
 function placeRoot(root,offsets){
  let best=root,bestCost=Infinity;
  for(let octave=-5;octave<=5;octave++){
   const candidate=root+octave*12;
   const cost=offsets.reduce((sum,o)=>{const n=candidate+o;return sum+4*(Math.max(0,48-n)+Math.max(0,n-84))+Math.max(0,40-n)+Math.max(0,n-79);},0)+Math.abs(candidate-root)*0.01;
   if(cost<bestCost){bestCost=cost;best=candidate;}
  }return best;
 }
 function nextRoot(c,iteration,previous=60,rng=Math.random){
  if(c.mode==='fixed')return Number(c.fixed);
  if(iteration===0)return c.mode==='random'?pick([50,52,53,55,57,59,60,62,64],rng):Number(c.fixed);
  if(iteration%Number(c.repeats||1)!==0)return previous;
  if(c.mode==='random'){let r=pick([50,52,53,55,57,59,60,62,64],rng);if(r===previous)r=r===64?50:r+1;return r;}
  let r=previous+(c.mode==='fourths'?5:c.mode==='down'?-1:1);
  if(r>67)r-=12;if(r<48)r+=12;return r;
 }
 function positions(m){const out=[];tuning.forEach((open,string)=>{const fret=m-open;if(fret>=0&&fret<=15)out.push({string,fret});});return out;}
 function solveFingering(notes){
  const candidates=notes.map(n=>positions(n));let best=null,bestScore=Infinity;
  function visit(i,chosen){if(i===notes.length){
    const frets=chosen.filter(Boolean).map(p=>p.fret),held=frets.filter(f=>f>0);
    const span=held.length?Math.max(...held)-Math.min(...held):0;
    let score=span*8+(frets.length?Math.max(...frets)*0.15:0);
    for(let k=1;k<chosen.length;k++)if(chosen[k]&&chosen[k-1])score+=Math.abs(chosen[k].string-chosen[k-1].string)*1.2+Math.abs(chosen[k].fret-chosen[k-1].fret)*0.45;
    if(score<bestScore){bestScore=score;best=chosen.slice();}return;
   }for(const p of candidates[i].length?candidates[i]:[null])visit(i+1,[...chosen,p]);
  }visit(0,[]);return best||notes.map(()=>null);
 }
 function phrase(notes,bpm=100,style='pure',harmonic=false){
  const beat=60/Number(bpm),events=[];let time=0;
  const add=(indices,at,velocity=0.8,length=beat*0.88)=>events.push({indices,at,velocity,length});
  const all=notes.map((_,i)=>i);
  if(harmonic){add(all,0,0.7,beat*1.6);return {events,duration:beat*1.8};}
  if(style==='cluster'){add(all,0,0.65,beat*1.3);time=beat*1.8;}
  notes.forEach((_,i)=>{add([i],time);time+=style==='swing'?(i%2?0.65:1.35)*beat:beat;});
  if(style==='lock'){time+=beat*0.35;add(all,time,0.65,beat*1.5);time+=beat*1.7;}
  if(style==='echo'){time+=beat*0.55;notes.forEach((_,i)=>{add([i],time,0.34,beat*0.8);time+=beat;});}
  return {events,duration:Math.max(time,...events.map(e=>e.at+e.length))+0.12};
 }
 function disjointPhrase(notes,bpm=100,style='pure',pause=0.7,harmonic=false){
  if(notes.length<2)return {...phrase(notes,bpm,style,harmonic),rests:[],segments:[]};
  const gap=Number.isFinite(Number(pause))?Math.max(0.2,Math.min(6,Number(pause))):0.7;
  const events=[],rests=[],segments=[];let time=0;
  for(let i=0;i<notes.length-1;i++){
   const pair=phrase(notes.slice(i,i+2),bpm,style,harmonic),start=time;
   for(const event of pair.events)events.push({...event,indices:event.indices.map(index=>index+i),at:event.at+start});
   // Account for the synth's 0.36 s release and 0.04 s source-stop margin.
   time+=Math.max(pair.duration,...pair.events.map(event=>event.at+event.length+0.4));
   segments.push({index:i,start,end:time});
   if(i<notes.length-2){rests.push({start:time,end:time+gap});time+=gap;}
  }
  return {events,rests,segments,duration:time};
 }
 function choices(pool,target,count=0,rng=Math.random){
  const others=[...new Set(pool)].filter(x=>x!==target).sort((a,b)=>Math.abs(a-target)-Math.abs(b-target)||a-b);
  return shuffle([target,...others.slice(0,count?Math.max(0,count-1):others.length)],rng);
 }
 class QuizSession {
  constructor(){this.total=0;this.correct=0;this.streak=0;this.best=0;this.byInterval={};this.targets=[];this.answers=[];this.done=false;}
  begin(targets){this.targets=targets;this.answers=targets.map(()=>null);this.done=false;}
  answer(step,value){if(this.done||this.answers[step]!==null)return false;this.answers[step]=value;if(this.answers.some(x=>x===null))return false;
   this.done=true;this.total++;const correct=this.answers.every((x,i)=>x===this.targets[i]);
   this.correct+=Number(correct);this.streak=correct?this.streak+1:0;this.best=Math.max(this.best,this.streak);
   this.targets.forEach((t,i)=>{const row=this.byInterval[t]||(this.byInterval[t]={total:0,correct:0});row.total++;row.correct+=Number(this.answers[i]===t);});return true;
  }
  get accuracy(){return this.total?Math.round(this.correct/this.total*100):0;}
 }
 global.IntervalCore={intervals,tuning,frequency,noteName,info,pick,shuffle,cellOffsets,normalizeSequence,sequenceOffsets,sequencePosition,fitRoot,placeRoot,nextRoot,positions,solveFingering,phrase,disjointPhrase,choices,QuizSession};
})(globalThis);
