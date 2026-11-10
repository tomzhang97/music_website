(function(){
 'use strict';
 const T=IntervalCore,$=id=>document.getElementById(id),$$=s=>Array.from(document.querySelectorAll(s));
 const badges=['①','②','③','④','⑤'];
 const quizDirections={up:'ascending',down:'descending',harmonic:'harmonic'};
 const quizSounds=new Map();
 for(const interval of T.intervals){
  for(const direction of Object.keys(quizDirections)){
   quizSounds.set(`${interval.st}:${direction}`,{interval,direction});
  }
 }
 const S={mode:'passive',size:2,quizSize:2,sequenceEnabled:false,sequence:[{interval:2,direction:'up'},{interval:7,direction:'up'}],pool:new Set(T.intervals.filter(x=>x.st<=12).map(x=>x.st)),looping:false,iteration:0,cycles:0,rawRoot:60,current:null,question:null,active:[],generation:0,raf:0,auto:0,session:new T.QuizSession(),synth:null};
 S.quizGroups={named:['2:up','1:up'],others:['6:up','4:up']};
 const settingIds=['voice','volume','view','ghosts','interval','selection-mode','direction','step2rule','step2interval','step2direction','reference','root-mode','root-note','repetitions','bpm','gap','phrasing','speech','blind','choice-count','auto-advance','quiz-up','quiz-down','quiz-harmonic','quiz-others-source','sequence-style','cell-connection','interval-pause'];
 let toastTimer=0,lastCenter='',dragStart=null,dragMoved=false;
 function toast(message,error=false){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').classList.toggle('error',error);$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,4200);}
 function save(){try{const settings={};settingIds.forEach(id=>settings[id]=$(id).type==='checkbox'?$(id).checked:$(id).value);localStorage.setItem('interval-01-v1',JSON.stringify({settings,size:S.size,quizSize:S.quizSize,quizGroups:S.quizGroups,sequenceEnabled:S.sequenceEnabled,sequence:S.sequence,pool:[...S.pool],stats:{total:S.session.total,correct:S.session.correct,streak:S.session.streak,best:S.session.best,byInterval:S.session.byInterval}}));}catch(_){} }
 function restore(){try{
  const data=JSON.parse(localStorage.getItem('interval-01-v1')||'null');if(!data||typeof data!=='object')return;
  settingIds.forEach(id=>{const el=$(id),v=data.settings?.[id];if(el.type==='checkbox'){if(typeof v==='boolean')el.checked=v;}else if(el.tagName==='SELECT'){if([...el.options].some(o=>o.value===String(v)))el.value=String(v);}else if(Number.isFinite(Number(v))&&v!==null){el.value=String(Math.max(Number(el.min),Math.min(Number(el.max),Number(v))));}});
  if(data.settings?.['sequence-style']==='pairs'&&data.settings?.['interval-pause']===undefined){const previousGap=Number(data.settings.gap);if(Number.isFinite(previousGap)&&previousGap>=0.2&&previousGap<=6)$('interval-pause').value=String(previousGap);}
  if(data.size===3)S.size=3;if(data.quizSize===3)S.quizSize=3;S.sequenceEnabled=data.sequenceEnabled===true;if(data.sequence)S.sequence=T.normalizeSequence(data.sequence);
  if(data.quizSize==='grouped')S.quizSize='grouped';
  for(const group of ['named','others']){
   const saved=data.quizGroups?.[group];
   if(Array.isArray(saved))S.quizGroups[group]=[...new Set(saved.filter(key=>quizSounds.has(key)))];
  }
  S.quizGroups.others=S.quizGroups.others.filter(key=>!S.quizGroups.named.includes(key));
  if(Array.isArray(data.pool)){const valid=data.pool.filter(n=>T.intervals.some(i=>i.st===n));if(valid.length)S.pool=new Set(valid);}
  const st=data.stats;if(st&&Number.isInteger(st.total)&&st.total>=0&&Number.isInteger(st.correct)&&st.correct>=0&&st.correct<=st.total){S.session.total=st.total;S.session.correct=st.correct;S.session.best=Number.isInteger(st.best)&&st.best>=0?st.best:0;S.session.streak=Number.isInteger(st.streak)&&st.streak>=0?st.streak:0;
   if(st.byInterval&&typeof st.byInterval==='object')T.intervals.forEach(i=>{const v=st.byInterval[i.st];if(v&&Number.isInteger(v.total)&&v.total>=0&&Number.isInteger(v.correct)&&v.correct>=0&&v.correct<=v.total)S.session.byInterval[i.st]={total:v.total,correct:v.correct};});
  }
 }catch(_){} }
 function updateAudioStatus(synth){
  if(S.synth!==synth)return;
  if(S.background?.url){const playing=S.background.started&&!$('background-audio').paused;$('audio-led').classList.toggle('on',playing);$('audio-status').textContent=playing?'BACKGROUND AUDIO PLAYING':'LOCK-SCREEN TRACK READY';return;}
  const running=synth.ctx.state==='running';$('audio-led').classList.toggle('on',running);
  $('audio-status').textContent=running?'AUDIO ENGINE CONNECTED':synth.ctx.state==='interrupted'?'AUDIO INTERRUPTED · TAP ENABLE SOUND':'TAP ENABLE SOUND';
  $('enable-audio').textContent=running?'Test sound':'Enable sound';
 }
 async function audio(reconnect=false){
  if(S.synth&&(S.synth.ctx.state==='closed'||reconnect&&S.synth.unlockFailed)){
   const old=S.synth;old.ctx.onstatechange=null;old.stopAll();if(old.ctx.state!=='closed')old.ctx.close().catch(()=>{});S.synth=null;
  }
  if(!S.synth){
   const synth=new StudioSynth();S.synth=synth;synth.volume(Number($('volume').value)/100);let wasRunning=false;
   synth.ctx.onstatechange=()=>{if(S.synth!==synth)return;const running=synth.ctx.state==='running';if(wasRunning&&!running&&!S.background){stop();toast('Audio was interrupted. Tap Enable sound to resume.');}wasRunning=running;updateAudioStatus(synth);};
  }
  const synth=S.synth;await synth.unlock();updateAudioStatus(synth);return synth;
 }
 function failed(error){stop();toast(error.message||'Audio could not start. Tap Enable sound to try again.',true);}
 // Calling the handler immediately preserves Safari's transient user activation.
 const safe=fn=>(...args)=>{try{return Promise.resolve(fn(...args)).catch(failed);}catch(error){failed(error);}};
 function on(id,event,fn){$(id).addEventListener(event,safe(fn));}
 function cancelPlayback(){S.generation++;cancelAnimationFrame(S.raf);disposeBackground();if(S.synth)S.synth.stopAll();if('speechSynthesis'in window)window.speechSynthesis.cancel();S.active=[];$('breath-progress').style.transform='scaleX(0)';$$('.note-chip').forEach(x=>x.classList.remove('active'));return S.generation;}
 function loopButton(){ $('loop').classList.toggle('running',S.looping);$('loop-label').textContent=S.looping?'Stop infinite loop':'Start infinite loop';$('loop').querySelector('.play-icon').textContent=S.looping?'■':'▶';$('transport-led').classList.toggle('on',S.looping);}
 function stop(){clearTimeout(S.auto);S.auto=0;S.looping=false;cancelPlayback();loopButton();$('transport-status').textContent='STANDBY';if(S.current)drawInstruments(S.current.notes,[]);}
 function disposeBackground(){
  const bg=S.background;if(!bg)return;S.background=null;
  const media=$('background-audio');media.pause();media.removeAttribute('src');media.load();if(bg.url)URL.revokeObjectURL(bg.url);$('cycle-count').textContent=String(S.cycles).padStart(4,'0');
  $('background-controls').hidden=true;$('prepare-background').textContent='Prepare lock-screen track';$('background-card').setAttribute('aria-busy','false');$('background-status').textContent='The prepared track repeats automatically. Prepare again for fresh random choices.';
  if(navigator.mediaSession){for(const action of ['play','pause','stop','seekto','seekbackward','seekforward'])try{navigator.mediaSession.setActionHandler(action,null);}catch(_){}try{navigator.mediaSession.metadata=null;navigator.mediaSession.playbackState='none';navigator.mediaSession.setPositionState?.();}catch(_){} }
  if(S.synth)updateAudioStatus(S.synth);else{$('audio-led').classList.remove('on');$('audio-status').textContent='READY WHEN YOU ARE';}
 }
 function invalidateBackground(){if(S.background){stop();toast('Settings changed. Prepare a new lock-screen track.');}}
 function passiveTiming(){return {bpm:Number($('bpm').value),style:$('phrasing').value,pause:Number($('interval-pause').value),gap:Number($('gap').value)};}
 async function playBackground(){
  const bg=S.background,token=S.generation;if(!bg?.url)return;
  try{if(navigator.audioSession)navigator.audioSession.type='playback';}catch(_){}
  try{await $('background-audio').play();}catch(error){if(S.background===bg&&S.generation===token&&!(error.name==='AbortError'&&$('background-audio').paused))throw error;}
 }
 function backgroundPosition(){
  const bg=S.background,media=$('background-audio');if(!bg?.url||!navigator.mediaSession)return;
  try{navigator.mediaSession.playbackState=media.paused?'paused':'playing';if(Number.isFinite(media.duration)&&media.duration>0)navigator.mediaSession.setPositionState?.({duration:media.duration,playbackRate:media.playbackRate,position:Math.max(0,Math.min(media.duration,media.currentTime))});}catch(_){}
 }
 function backgroundSession(){
  const media=$('background-audio'),session=navigator.mediaSession;if(!session)return;
  try{if(window.MediaMetadata)session.metadata=new MediaMetadata({title:$('interval-title').textContent,artist:'INTERVAL / 01',album:'Passive listening'});}catch(_){}
  const seek=seconds=>{media.currentTime=Math.max(0,Math.min(media.duration||0,seconds));};
  const actions={play:safe(playBackground),pause:()=>media.pause(),stop,seekto:e=>seek(e.seekTime),seekbackward:e=>seek(media.currentTime-(e.seekOffset||10)),seekforward:e=>seek(media.currentTime+(e.seekOffset||10))};
  for(const [action,handler]of Object.entries(actions))try{session.setActionHandler(action,handler);}catch(_){}
  backgroundPosition();
 }
 function syncBackground(){
  const bg=S.background,media=$('background-audio');if(!bg?.url||!bg.started||document.hidden)return;
  const time=media.currentTime,segment=bg.track.segments.find(s=>time>=s.start&&time<s.end)||bg.track.segments[0],elapsed=time-segment.start;
  if(bg.segment!==segment){bg.segment=segment;S.current=segment.cycle;renderLCD(segment.cycle);}
  $('cycle-count').textContent=segment.group+' / '+bg.track.groups;
  const indices=media.paused?[]:[...new Set(segment.plan.events.filter(e=>elapsed>=e.at&&elapsed<e.at+e.length).flatMap(e=>e.indices))],signature=segment.start+'|'+indices.join(',');
  if(bg.signature!==signature){bg.signature=signature;S.active=indices;drawInstruments(segment.cycle.notes,indices);$$('.note-chip').forEach(el=>el.classList.toggle('active',indices.includes(Number(el.dataset.noteIndex))));}
  const rest=(segment.plan.rests||[]).find(r=>elapsed>=r.start&&elapsed<r.end),betweenPairs=segment.cycle.sequence?.style==='pairs'&&!segment.cycle.sequence.last;
  $('transport-status').textContent=media.paused?'BACKGROUND PAUSED':rest||elapsed>=segment.plan.duration&&betweenPairs?'PAUSE BETWEEN INTERVALS':elapsed>=segment.plan.duration?'BREATHE':'BACKGROUND LISTENING';
  const part=segment.plan.segments?.find(s=>elapsed>=s.start&&elapsed<s.end)?.index;
  $$('[data-sequence-row]').forEach(row=>row.classList.toggle('playing',!media.paused&&(part!==undefined?Number(row.dataset.sequenceRow)===part:betweenPairs||segment.cycle.sequence?.style==='pairs'?Number(row.dataset.sequenceRow)===segment.cycle.sequence.index:false)));
  const progress=rest?(elapsed-rest.start)/(rest.end-rest.start):elapsed>=segment.plan.duration?(elapsed-segment.plan.duration)/segment.gap:0;$('breath-progress').style.transform=`scaleX(${Math.max(0,Math.min(1,progress))})`;
 }
 function animateBackground(){cancelAnimationFrame(S.raf);const tick=()=>{if(!S.background?.url||$('background-audio').paused)return;syncBackground();S.raf=requestAnimationFrame(tick);};tick();}
 async function prepareBackground(){
  if(S.background?.preparing){stop();return;}
  stop();const token=S.generation,bg={preparing:true,started:false};S.background=bg;
  $('prepare-background').textContent='Cancel preparation';$('background-card').setAttribute('aria-busy','true');$('background-status').textContent='Preparing your drill… keep Safari open until the Play button appears.';
  try{
   const rawRoot=S.rawRoot;S.rawRoot=Number($('root-note').value);
   const deterministic=$('root-mode').value==='fixed'&&(S.sequenceEnabled||$('selection-mode').value==='lock'&&$('direction').value!=='alternate'&&(S.size===2||$('step2rule').value!=='random'));
   let track;try{track=StudioTrack.plan(i=>{const cycle=makePassive(i);return {...cycle,disjoint:isDisjoint(cycle)};},{...passiveTiming(),targetSeconds:deterministic?0:60});}finally{S.rawRoot=rawRoot;}
   const blob=await StudioTrack.render(track,{voice:$('voice').value,volume:Number($('volume').value)/100});
   if(token!==S.generation||S.background!==bg)return;
   bg.preparing=false;bg.track=track;bg.url=URL.createObjectURL(blob);const media=$('background-audio');media.src=bg.url;media.loop=true;media.load();
   try{if(navigator.audioSession)navigator.audioSession.type='playback';}catch(_){}
   $('background-controls').hidden=false;$('play-background').textContent='Play background loop';$('prepare-background').textContent='Prepare new track';$('background-card').setAttribute('aria-busy','false');
   const seconds=Math.ceil(track.duration);bg.description=track.groups+' cycle'+(track.groups===1?'':'s')+' · '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')+' track · repeats';$('background-status').textContent='Ready: '+bg.description+'. Tap Play to start listening.';S.current=track.segments[0].cycle;renderLCD(S.current);drawInstruments(S.current.notes,[]);backgroundSession();backgroundPosition();updateAudioStatus(S.synth);
  }catch(error){if(token===S.generation)throw error;}
 }
 function getConfig(){return {size:S.size,interval:Number($('interval').value),direction:$('direction').value,step2rule:$('step2rule').value,step2interval:Number($('step2interval').value),step2direction:$('step2direction').value,reference:$('reference').value,pool:[...S.pool]};}
 function fitVisible(root,offsets){return T.placeRoot(root,offsets);}
 function makePassive(iteration=0){
  const rootConfig={mode:$('root-mode').value,fixed:Number($('root-note').value),repeats:Number($('repetitions').value)};
  if(S.sequenceEnabled){
   const rows=T.normalizeSequence(S.sequence),position=T.sequencePosition(rows,iteration),pairs=$('sequence-style').value==='pairs';
   const signed=step=>step.interval*(step.direction==='down'?-1:1),offsets=pairs?[0,signed(position.step)]:T.sequenceOffsets(rows);
   const rootIteration=pairs?position.group:iteration;
   if(!pairs||position.index===0)S.rawRoot=T.nextRoot(rootConfig,rootIteration,S.rawRoot);
   const visibleOffsets=pairs?[0,...rows.map(signed)]:offsets;
   const root=rootConfig.mode==='fixed'?S.rawRoot:fitVisible(S.rawRoot,visibleOffsets);
   return {notes:offsets.map(o=>root+o),steps:offsets.slice(1).map((o,i)=>o-offsets[i]),harmonic:false,config:{reference:'chain'},sequence:{...position,style:pairs?'pairs':$('sequence-style').value==='disjoint'?'disjoint':'phrase',count:rows.length}};
  }
  const config=getConfig();if($('selection-mode').value==='rotate')config.interval=[...S.pool].sort((a,b)=>a-b)[iteration%S.pool.size];
  const offsets=T.cellOffsets(config,iteration);S.rawRoot=T.nextRoot(rootConfig,iteration,S.rawRoot);
  const root=rootConfig.mode==='fixed'?S.rawRoot:fitVisible(S.rawRoot,offsets);
  return {notes:offsets.map(o=>root+o),steps:offsets.slice(1).map((o,i)=>o-offsets[i]),harmonic:config.direction==='harmonic',config};
 }
 function renderSequence(){
  $('sequence-count').textContent=S.sequence.length+' / 4 INTERVALS';$('add-interval').disabled=S.sequence.length>=4;
  $('sequence-list').innerHTML=S.sequence.map((row,index)=>`<div class="sequence-row" data-sequence-row="${index}"><span class="section-number">${index+1}</span><div><label class="sr-only" for="sequence-interval-${index}">Sequence interval ${index+1}</label><select id="sequence-interval-${index}" data-sequence-index="${index}" data-sequence-field="interval">${T.intervals.map(i=>`<option value="${i.st}"${i.st===row.interval?' selected':''}>${i.short} · ${i.name}</option>`).join('')}</select></div><div><label class="sr-only" for="sequence-direction-${index}">Sequence direction ${index+1}</label><select id="sequence-direction-${index}" data-sequence-index="${index}" data-sequence-field="direction"><option value="up"${row.direction==='up'?' selected':''}>Up ↑</option><option value="down"${row.direction==='down'?' selected':''}>Down ↓</option></select></div><button type="button" class="sequence-remove" data-remove-sequence="${index}" aria-label="Remove interval ${index+1}"${S.sequence.length===1?' disabled':''}>×</button></div>`).join('');
 }
 async function sequenceChanged(){invalidateBackground();S.iteration=0;refreshControls();save();if(S.looping)await runCycle();else{cancelPlayback();preview();}}
 function isBlind(){return S.mode==='quiz'&&S.question&&!S.session.done&&$('blind').checked;}
 function shownNotes(notes){return isBlind()?notes.slice(0,1):notes;}
 function drawInstruments(notes,active=[]){
  const visible=shownNotes(notes),blinded=isBlind();const fingering=visible.length===1&&S.current?.manualPosition&&S.current.notes[0]===visible[0]?[S.current.manualPosition]:T.solveFingering(visible);
  $$('.piano-key').forEach(key=>{const m=Number(key.dataset.midi),indices=visible.map((n,i)=>n===m?i:-1).filter(i=>i>=0),sounding=indices.some(i=>active.includes(i));key.classList.toggle('context',indices.length>0);key.classList.toggle('sounding',sounding);key.querySelector('.key-badge').textContent=indices.map(i=>badges[i]).join('');key.querySelector('.key-label').textContent=indices.length||m%12===0?T.noteName(m):'';});
  $$('.fret').forEach(key=>{const string=Number(key.dataset.string),fret=Number(key.dataset.fret),indices=fingering.map((p,i)=>p&&p.string===string&&p.fret===fret?i:-1).filter(i=>i>=0),ghost=$('ghosts').checked&&!indices.length&&visible.includes(Number(key.dataset.midi));key.classList.toggle('context',indices.length>0);key.classList.toggle('sounding',indices.some(i=>active.includes(i)));key.classList.toggle('ghost',ghost);const marker=key.querySelector('.fret-marker');marker.hidden=!indices.length&&!ghost;marker.textContent=indices.length?indices.map(i=>badges[i]).join(''):T.noteName(Number(key.dataset.midi));});
  $$('.string-row').forEach((row,i)=>row.classList.toggle('vibrating',fingering.some((p,index)=>p?.string===i&&active.includes(index))));
  const path=fingering.map((p,i)=>p?`${badges[i]} Str ${p.string+1}${['E','B','G','D','A','E'][p.string]} · Fret ${p.fret} (${T.noteName(visible[i])})`:`${badges[i]} ${T.noteName(visible[i])} · outside guitar range`);
  $('fingering-path').textContent=path.join(' → ')+(blinded?' → Answer notes hidden until you answer.':'');
  const focus=active.find(i=>i<visible.length)??0,m=visible[focus];
  $('piano-info').textContent=blinded?`Root ${T.noteName(visible[0])} · answer notes hidden`:m!==undefined?`${T.noteName(m)} · MIDI ${m} · ${T.frequency(m).toFixed(2)} Hz${m<48||m>84?' · outside keyboard range':''}`:'Tap a key to explore its pitch.';
  const p=fingering[focus];$('guitar-info').textContent=blinded?'Root position shown. Trust your ears.':p?`String ${p.string+1} · Fret ${p.fret} · ${T.noteName(m)} · ${T.frequency(m).toFixed(2)} Hz`:'Some pitches are outside frets 0–15. The audio keeps the exact interval.';
  const signature=visible.join(',')+'|'+active.join(',')+'|'+$('view').value;
  if(signature!==lastCenter&&active.length&&!dragStart){lastCenter=signature;centerInstruments(visible,active,fingering);}
 }
 function centerInstruments(notes,active,fingering){
  for(const [id,selector]of [['piano-scroll','.piano-key'],['guitar-scroll','.fret']]){
   const wrap=$(id);if(!wrap.clientWidth)continue;const index=active.find(i=>i<notes.length);if(index===undefined)continue;
   const element=id==='piano-scroll'?wrap.querySelector(`${selector}[data-midi="${notes[index]}"]`):fingering[index]?wrap.querySelector(`${selector}[data-string="${fingering[index].string}"][data-fret="${fingering[index].fret}"]`):null;
   if(!element)continue;const left=element.getBoundingClientRect().left-wrap.getBoundingClientRect().left+wrap.scrollLeft;
   if(left<wrap.scrollLeft+24||left+element.offsetWidth>wrap.scrollLeft+wrap.clientWidth-24)wrap.scrollTo({left:Math.max(0,left-wrap.clientWidth/2+element.offsetWidth/2),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  }
 }
 function buildInstruments(){
  let whites=0;for(let midi=48;midi<=84;midi++){const black=[1,3,6,8,10].includes(midi%12),key=document.createElement('button');key.type='button';key.className='piano-key '+(black?'black':'white');key.style.left=(black?whites*48-14.5:whites*48)+'px';key.dataset.midi=midi;key.setAttribute('aria-label',`${T.noteName(midi)}, MIDI ${midi}, ${T.frequency(midi).toFixed(2)} hertz`);key.innerHTML='<span class="key-badge"></span><span class="key-label"></span>';$('piano').append(key);if(!black)whites++;}
  const head=document.createElement('div');head.className='fret-head';head.innerHTML=Array.from({length:16},(_,i)=>`<span>${i||'OPEN'}</span>`).join('');$('fretboard').append(head);
  T.tuning.forEach((open,string)=>{const row=document.createElement('div');row.className='string-row';row.style.setProperty('--gauge',(0.6+string*0.31)+'px');for(let fret=0;fret<=15;fret++){const key=document.createElement('button');key.className='fret'+(fret===0?' open':'');key.dataset.string=string;key.dataset.fret=fret;key.dataset.midi=open+fret;key.setAttribute('aria-label',`String ${string+1}, ${fret===0?'open':'fret '+fret}, ${T.noteName(open+fret)}`);key.innerHTML=(fret===0?`<span class="string-name">${['E','B','G','D','A','E'][string]}</span>`:'')+'<span class="fret-marker" hidden></span>';row.append(key);}$('fretboard').append(row);});
  [3,5,7,9,12,15].forEach(f=>{const dot=document.createElement('i');dot.className='inlay'+(f===12?' double':'');dot.style.left=(48+(f-0.5)*64)+'px';$('fretboard').append(dot);});
  for(const id of ['piano-scroll','guitar-scroll']){
   $(id).addEventListener('pointerdown',e=>{dragStart={x:e.clientX,y:e.clientY,id};dragMoved=false;});
   $(id).addEventListener('pointermove',e=>{if(dragStart&&Math.hypot(e.clientX-dragStart.x,e.clientY-dragStart.y)>8)dragMoved=true;});
   $(id).addEventListener('click',safe(async e=>{if(dragMoved&&e.detail!==0)return;const key=e.target.closest('[data-midi]');if(key)await audition(Number(key.dataset.midi),id==='guitar-scroll'?{string:Number(key.dataset.string),fret:Number(key.dataset.fret)}:null);}));
  }
  document.addEventListener('pointerup',()=>{dragStart=null;});document.addEventListener('pointercancel',()=>{dragStart=null;dragMoved=true;});
 }
 async function audition(midi,position){stop();const token=cancelPlayback();await audio();if(token!==S.generation)return;S.current={notes:[midi],steps:[],harmonic:false,manualPosition:position};playScheduled([midi],T.phrase([midi],100,'pure'),token,0);if(position){$('guitar-info').textContent=`String ${position.string+1} · Fret ${position.fret} · ${T.noteName(midi)} · ${T.frequency(midi).toFixed(2)} Hz`;}}
 function isDisjoint(cycle){return cycle.sequence?cycle.sequence.style==='disjoint':cycle.notes.length>2&&$('cell-connection').value==='disjoint';}
 function renderLCD(cycle){
  const step=cycle.steps[0]||0,first=T.info(step),cell=cycle.notes.length>2,sequence=cycle.sequence,disjoint=isDisjoint(cycle);
  $('interval-title').textContent=cell?cycle.steps.map(s=>T.info(s).short+(s<0?' ↓':' ↑')).join(sequence?' · ':' + '):first.name;
  $('interval-direction').textContent=sequence?(sequence.style==='pairs'?`INTERVAL ${sequence.index+1} OF ${sequence.count} · ${step<0?'DESCENDING ↓':'ASCENDING ↑'}`:`${sequence.count}-INTERVAL ${disjoint?'DISJOINT PAIRS':'CONTINUOUS PHRASE'}`):cell?(disjoint?'THREE-NOTE DISJOINT CELL · ':'THREE-NOTE CONTINUOUS CELL · ')+(cycle.config?.reference==='root'?'FROM ROOT':'CHAINED'):cycle.harmonic?'HARMONIC INTERVAL ⇅':step<0?'DESCENDING INTERVAL ↓':'ASCENDING INTERVAL ↑';
  $('interval-symbol').innerHTML=(sequence&&cell?sequence.count+'×':cell?'1·2·3':first.short)+`<span>${cell?'LISTEN · CONNECT · REPEAT':(step>=0?'+':'')+step+' SEMITONES'}</span>`;
  $('interval-symbol').closest('.lcd').classList.toggle('sequence-lcd',!!sequence&&cell);
  $('note-sequence').innerHTML=cycle.notes.map((n,i)=>(i?`<span class="step-arrow">${cycle.steps[i-1]<0?'↘':'↗'}<br>${cycle.steps[i-1]>0?'+':''}${cycle.steps[i-1]} st</span>`:'')+`<div class="note-chip" data-note-index="${i}">${badges[i]} ${T.noteName(n)}<small>${T.frequency(n).toFixed(1)} Hz</small></div>`).join('');
  $('ratio-readout').innerHTML=cycle.steps.map(s=>`${Math.pow(2,Math.abs(s)/12).toFixed(4)}× <small>12-TET</small> · ${T.info(s).ratio} <small>REF</small>`).join('<br>');
  $('song-reference').textContent=(step<0?'↘ ':'↗ ')+(step<0?first.down:first.up);$('cycle-count').textContent=String(S.cycles).padStart(4,'0');
  $$('[data-sequence-row]').forEach(row=>row.classList.toggle('playing',!!sequence&&sequence.style==='pairs'&&Number(row.dataset.sequenceRow)===sequence.index));
 }
 function playScheduled(notes,plan,token,gap=0,onFinish){
  const synth=S.synth,start=synth.ctx.currentTime+0.045;let last='',lastPart=-2;S.current={...S.current,notes};
  for(const e of plan.events)for(const i of e.indices)synth.play(notes[i],start+e.at,e.length,e.velocity,$('voice').value);
  drawInstruments(notes,[]);
  function tick(){if(token!==S.generation)return;const elapsed=synth.ctx.currentTime-start;
   const indices=[...new Set(plan.events.filter(e=>elapsed>=e.at&&elapsed<e.at+e.length).flatMap(e=>e.indices))];
   if(indices.join(',')!==last){last=indices.join(',');S.active=indices;drawInstruments(notes,indices);$$('.note-chip').forEach(el=>el.classList.toggle('active',indices.includes(Number(el.dataset.noteIndex))));}
   if(S.mode==='passive'){
    const rest=(plan.rests||[]).find(r=>elapsed>=r.start&&elapsed<r.end);
    $('transport-status').textContent=rest?'PAUSE BETWEEN INTERVALS':elapsed<plan.duration?'LISTENING':gap>0?(plan.gapLabel||'BREATHE'):'STANDBY';
    const progress=rest?(elapsed-rest.start)/(rest.end-rest.start):gap>0?(elapsed-plan.duration)/gap:0;
    $('breath-progress').style.transform=`scaleX(${Math.max(0,Math.min(1,progress))})`;
    if(plan.segments){const part=plan.segments.find(s=>elapsed>=s.start&&elapsed<s.end)?.index??-1;if(part!==lastPart){lastPart=part;$$('[data-sequence-row]').forEach(row=>row.classList.toggle('playing',!!S.current.sequence&&Number(row.dataset.sequenceRow)===part));}}
   }
   if(elapsed>=plan.duration+gap){S.active=[];drawInstruments(notes,[]);if(onFinish)onFinish();else if(S.mode==='passive')$('transport-status').textContent='STANDBY';return;}
   S.raf=requestAnimationFrame(tick);
  }tick();
 }
 function speak(text,token){return new Promise(resolve=>{if(!('speechSynthesis'in window)||!('SpeechSynthesisUtterance'in window)){resolve();return;}
  const utterance=new SpeechSynthesisUtterance(text);utterance.rate=0.88;let finished=false;const done=()=>{if(finished)return;finished=true;clearTimeout(timer);resolve();};const timer=setTimeout(()=>{if(token===S.generation)window.speechSynthesis.cancel();done();},6500);utterance.onend=done;utterance.onerror=done;window.speechSynthesis.speak(utterance);
 });}
 function spoken(cycle){return cycle.steps.map(s=>T.info(s).name+', '+(s<0?'descending':'ascending')).join('. Then ');}
 async function runCycle(once=false){
  const token=cancelPlayback();await audio();if(token!==S.generation)return;
  const cycle=makePassive(S.iteration);S.current=cycle;if(!cycle.sequence||cycle.sequence.style!=='pairs'||cycle.sequence.index===0)S.cycles++;renderLCD(cycle);drawInstruments(cycle.notes,[]);
  if($('speech').value==='before'){$('transport-status').textContent='ANNOUNCING';await speak(spoken(cycle),token);if(token!==S.generation)return;}
  const plan=StudioTrack.phrase({...cycle,disjoint:isDisjoint(cycle)},passiveTiming());
  const betweenPairs=cycle.sequence?.style==='pairs'&&!cycle.sequence.last;plan.gapLabel=betweenPairs?'PAUSE BETWEEN INTERVALS':'BREATHE';
  const morePairs=once&&cycle.sequence?.style==='pairs'&&!cycle.sequence.last;
  const finish=safe(async()=>{if(token!==S.generation)return;if($('speech').value==='after'){$('transport-status').textContent='NAMING THE INTERVAL';await speak(spoken(cycle),token);if(token!==S.generation)return;}
   if(morePairs){S.iteration++;await runCycle(true);}else if(!once&&S.looping){S.iteration++;await runCycle();}else{$('transport-status').textContent='STANDBY';}
  });
  playScheduled(cycle.notes,plan,token,betweenPairs?Number($('interval-pause').value):once?0:Number($('gap').value),finish);
 }
 async function startLoop(){stop();S.looping=true;S.iteration=0;S.rawRoot=Number($('root-note').value);loopButton();await runCycle();}
 function refreshControls(){
  $('classic-settings').hidden=S.sequenceEnabled;$('sequence-settings').hidden=!S.sequenceEnabled;
  const showPause=S.sequenceEnabled?S.sequence.length>1&&['disjoint','pairs'].includes($('sequence-style').value):S.size===3&&$('cell-connection').value==='disjoint';$('interval-pause-field').hidden=!showPause;$('interval-pause-value').textContent=Number($('interval-pause').value).toFixed(1)+' s';
  $('cell-settings').hidden=S.size!==3;$('rotation-help').hidden=$('selection-mode').value!=='rotate';$('interval').disabled=$('selection-mode').value==='rotate';$('custom-step2').hidden=['repeat','mirror'].includes($('step2rule').value);$('step2interval').disabled=$('step2rule').value==='random';
  $$('[data-size]').forEach(b=>{const active=b.dataset.size==='sequence'?S.sequenceEnabled:!S.sequenceEnabled&&Number(b.dataset.size)===S.size;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
  $$('[data-quiz-size]').forEach(b=>{const active=b.dataset.quizSize===String(S.quizSize);b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
  const grouped=S.quizSize==='grouped';
  const randomOthers=$('quiz-others-source').value==='random';
  $('grouped-quiz-settings').hidden=!grouped;
  $('quiz-custom-others').hidden=randomOthers;
  $('quiz-random-others').hidden=!randomOthers;
  $('quiz-add-other').hidden=randomOthers;
  $('quiz-directions').hidden=grouped&&!randomOthers;
  $('quiz-directions-label').textContent=grouped?'Random Others directions':'Allowed directions';
  $('quiz-choice-count').hidden=grouped;
  $('harmonic').hidden=S.question?Boolean(S.question.group):grouped;
  $('instruments').className='instruments '+($('view').value==='piano'?'piano-only':$('view').value==='guitar'?'guitar-only':'');
  $('bpm-value').textContent=$('bpm').value;$('beat-ms').textContent=Math.round(60000/Number($('bpm').value))+' ms / beat';$('gap-value').textContent=Number($('gap').value).toFixed(1)+' s';$('volume-value').textContent=$('volume').value+'%';
  $$('[data-bpm]').forEach(b=>b.classList.toggle('selected',b.dataset.bpm===$('bpm').value));
 }
 function preview(){if(S.looping)return;S.rawRoot=Number($('root-note').value);S.current=makePassive(0);renderLCD(S.current);drawInstruments(S.current.notes,[]);}
 function setMode(mode){stop();S.mode=mode;const quiz=mode==='quiz';$('passive-panel').hidden=quiz;$('quiz-panel').hidden=!quiz;for(const name of ['passive','quiz']){const active=name===mode;$(name+'-tab').classList.toggle('active',active);$(name+'-tab').setAttribute('aria-selected',String(active));$(name+'-tab').tabIndex=active?0:-1;}
  $('mode-hint').textContent=quiz?'Listen first. Trust the distance.':'A small daily ritual. A sharper musical ear.';
  if(quiz&&S.question){S.current=S.question;drawInstruments(S.question.notes,[]);}else if(!quiz)preview();else{S.current={notes:[],steps:[]};drawInstruments([],[]);$('fingering-path').textContent='ANSWER NOTES STAY HIDDEN UNTIL YOU ANSWER.';}
 }
 function renderPool(){
  $('pool').innerHTML=T.intervals.map(i=>`<button class="pool-pad${S.pool.has(i.st)?' selected':''}${i.st>12?' compound':''}" data-pool-note="${i.st}" aria-pressed="${S.pool.has(i.st)}" aria-label="${i.name}, ${i.st} semitones"><b>${i.short}</b><span>${i.name}</span></button>`).join('');$('pool-count').textContent=S.pool.size+' INTERVAL'+(S.pool.size===1?'':'S')+' ENABLED';
  const presets=poolPresets();$$('[data-pool]').forEach(b=>b.classList.toggle('selected',presets[b.dataset.pool].length===S.pool.size&&presets[b.dataset.pool].every(x=>S.pool.has(x))));
 }
 function poolPresets(){return {all:[1,2,3,4,5,6,7,8,9,10,11,12],major:[2,4,5,7,9,11,12],pillars:[4,5,7,12],small:[1,2,3,4,5],wide:[7,8,9,10,11,12],consonant:[3,4,5,7,8,9,12],dissonant:[1,2,6,10,11]};}
 function quizSoundName(key){
  if(key==='others')return 'Others';
  const {interval,direction}=quizSounds.get(key);
  return `${interval.name} ${quizDirections[direction]}`;
 }
 function renderQuizGroups(){
  for(const [group,id,heading] of [['named','quiz-named-sounds','Named answers'],['others','quiz-other-sounds','Others']]){
   $(id).innerHTML=S.quizGroups[group].map(key=>{
    const name=quizSoundName(key);
    return `<li><span>${name}</span><button type="button" data-quiz-remove="${group}" data-sound="${key}" aria-label="Remove ${name} from ${heading}">×</button></li>`;
   }).join('')||'<li class="hint">No sounds selected.</li>';
  }
 }
 function addQuizSound(group){
  const key=`${$('quiz-sound-interval').value}:${$('quiz-sound-direction').value}`;
  if(S.quizGroups.named.includes(key)||S.quizGroups.others.includes(key)){
   toast(`${quizSoundName(key)} is already in a group.`);
   return;
  }
  S.quizGroups[group].push(key);
  renderQuizGroups();
  save();
 }
 function renderStats(){
  $('score').textContent=S.session.correct+' / '+S.session.total;$('accuracy').innerHTML=(S.session.total?S.session.accuracy:'—')+'<small>%</small>';$('streak').textContent=S.session.streak;$('best').textContent=S.session.best;
  const intervals=T.intervals.filter(x=>S.pool.has(x.st)||S.session.byInterval[x.st]);$('interval-progress').innerHTML=intervals.map(i=>{const row=S.session.byInterval[i.st],pct=row?.total?Math.round(row.correct/row.total*100):0;return `<div class="progress-row"><div><span>${i.short}</span><span>${row?.total?pct+'% · '+row.correct+'/'+row.total:'—'}</span></div><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div></div>`;}).join('');
 }
 async function newQuestion(){
  stop();
  const token=S.generation;
  const directions=Object.keys(quizDirections).filter(direction=>$('quiz-'+direction).checked);
  const pool=[...S.pool];
  let c,group;
  if(S.quizSize==='grouped'){
   const named=S.quizGroups.named;
   const random=$('quiz-others-source').value==='random';
   const candidates=random?pool.flatMap(interval=>directions.map(direction=>`${interval}:${direction}`)):S.quizGroups.others;
   const others=candidates.filter(key=>!named.includes(key));
   if(!named.length){toast('Add at least one named answer.',true);return;}
   if(!others.length){
    toast(random?'No sounds are available for Others. Enable more intervals or directions.':'Add at least one sound to Others.',true);
    return;
   }
   const choices=[...named,'others'];
   const target=T.pick(choices);
   const key=target==='others'?T.pick(others):target;
   const {interval,direction}=quizSounds.get(key);
   c={size:2,interval:interval.st,direction};
   group={choices:T.shuffle(choices),target,key,others};
  }else{
   if(!directions.length){toast('Enable at least one quiz direction.',true);return;}
   const direction=T.pick(directions);
   const melodic=directions.filter(value=>value!=='harmonic');
   c={size:S.quizSize,interval:T.pick(pool),direction,step2rule:'fixed',step2interval:T.pick(pool),
    step2direction:direction==='harmonic'?'up':T.pick(melodic),reference:'chain'};
  }
  await audio();
  if(token!==S.generation)return;
  const offsets=T.cellOffsets(c),root=fitVisible(T.pick([50,52,53,55,57,59,60,62,64]),offsets);
  S.question={notes:offsets.map(o=>root+o),steps:offsets.slice(1).map((o,i)=>o-offsets[i]),harmonic:c.direction==='harmonic',config:c,group};
  S.current=S.question;
  const intervals=S.question.steps.map(Math.abs);
  S.session.begin(group?[group.target]:intervals,intervals);
  $('feedback').hidden=true;$('new-question').textContent='Next question →';$('replay').disabled=false;
  $('harmonic').disabled=false;$('harmonic').hidden=Boolean(group);
  const cell=c.size===3;
  const format=group?'NAMED + OTHERS':cell?'3-NOTE CELL':'2-NOTE INTERVAL';
  $('question-label').textContent='QUESTION '+String(S.session.total+1).padStart(2,'0')+' / '+format;
  $('quiz-title').textContent=cell?'Two steps. One musical thought.':'What interval do you hear?';
  if(group)$('quiz-instruction').textContent='Listen for both the interval and its direction. Choose a named sound or Others.';
  else if(c.direction==='harmonic')$('quiz-instruction').textContent=cell?'The notes sound together. Identify the distance in each step.':'The notes sound together. Identify the distance.';
  else $('quiz-instruction').textContent=cell?'Listen to the three notes and identify each step.':`Listen to the ${quizDirections[c.direction]} pair.`;
  renderChoices();await replayQuestion();
 }
 function renderChoices(){
  const q=S.question;if(!q)return;
  const count=Number($('choice-count').value);
  q.options=q.group?[q.group.choices]:q.steps.map(s=>T.choices([...S.pool],Math.abs(s),count));
  $('quiz-choices').classList.toggle('cell',q.steps.length===2);
  $('quiz-choices').innerHTML=q.options.map((options,step)=>{
   const heading=q.steps.length===2?`STEP ${step+1} · NOTE ${step+1} → ${step+2}`:'NAME THE INTERVAL';
   const buttons=options.map((value,i)=>{
    const content=q.group?`<b>${quizSoundName(value)}</b>`:`<b>${T.info(value).short}</b><span class="choice-name">${T.info(value).name}</span>`;
    return `<button class="choice" data-choice="${value}" data-step="${step}"><span>${content}</span><kbd>${i<9?i+1:'·'}</kbd></button>`;
   }).join('');
   return `<div class="choice-column"><h3 class="choice-heading">${heading}</h3><div class="choice-grid">${buttons}</div></div>`;
  }).join('');
 }
 async function replayQuestion(harmonic=false){if(!S.question){await newQuestion();return;}clearTimeout(S.auto);S.auto=0;const token=cancelPlayback();await audio();if(token!==S.generation)return;S.current=S.question;playScheduled(S.question.notes,T.phrase(S.question.notes,Number($('bpm').value),'pure',harmonic||S.question.harmonic),token);}
 async function answer(step,key){
  const q=S.question;if(!q)return;
  const value=q.group?key:Number(key);
  if(!q.options[step]?.includes(value))return;
  if(S.session.done){
   clearTimeout(S.auto);S.auto=0;
   const root=q.notes[step];
   let signed,harmonic,label;
   if(q.group){
    let soundKey=value;
    if(value==='others')soundKey=q.group.target==='others'?q.group.key:T.pick(q.group.others);
    const {interval,direction}=quizSounds.get(soundKey);
    signed=interval.st*(direction==='down'?-1:1);
    harmonic=direction==='harmonic';
    label=quizSoundName(soundKey);
   }else{
    signed=value*(q.steps[step]<0?-1:1);
    harmonic=q.harmonic;
    label=T.info(value).name;
   }
   const token=cancelPlayback();await audio();if(token!==S.generation)return;
   const notes=[root,root+signed];S.current={notes,steps:[signed]};
   playScheduled(notes,T.phrase(notes,Number($('bpm').value),'pure',harmonic),token);
   toast('Comparing '+label+' from '+T.noteName(root)+'.');
   return;
  }
  if(S.session.answers[step]!==null)return;
  const finished=S.session.answer(step,value);$$(`.choice[data-step="${step}"]`).forEach(b=>{const selected=b.dataset.choice===String(value);b.classList.toggle('chosen',selected);b.setAttribute('aria-pressed',String(selected));});
  if(!finished){$('quiz-instruction').textContent=`Step ${step+1} locked in. Now identify Step ${step===0?2:1}.`;return;}
  const correct=S.session.answers.every((a,i)=>a===S.session.targets[i]);
  cancelPlayback();S.current=S.question;drawInstruments(S.question.notes,[]);
  $$('.choice').forEach(b=>{const col=Number(b.dataset.step),v=b.dataset.choice;const right=v===String(S.session.targets[col]);b.classList.remove('chosen');b.classList.toggle('correct',right);b.classList.toggle('wrong',v===String(S.session.answers[col])&&!right);});
  $('feedback').className='feedback'+(correct?'':' wrong-feedback');$('feedback').hidden=false;
  let explanation='A little more connection, every time.';
  if(q.group){
   const category=q.group.target==='others'?' (Others)':'';
   explanation=`You chose ${quizSoundName(value)}. The sound was ${quizSoundName(q.group.key)}${category}.`;
  }else if(!correct){
   explanation=`Your answer was ${S.session.answers.map(a=>T.info(a).name).join(' + ')}. The interval was ${q.steps.map(s=>T.info(s).name).join(' + ')}.`;
  }
  $('feedback').innerHTML=`<h3>${correct?'✓ You heard it.':'Keep that sound in mind.'}</h3><p>${explanation}</p><div class="feedback-notes">${q.notes.map(T.noteName).join(' → ')}</div><p>${q.steps.map(s=>`${s>0?'+':''}${s} semitones · ${Math.pow(2,Math.abs(s)/12).toFixed(4)}× in 12-TET · ${T.info(s).ratio} reference ratio<br>Song cue: ${s<0?T.info(s).down:T.info(s).up}`).join('<br>')}</p><p>Tap any answer to compare it from the same starting note.</p><button id="handoff">∞ Loop this ${q.steps.length===2?'cell':'interval'} in Passive Listening ↗</button>`;
  $('handoff').addEventListener('click',safe(handoff));$('quiz-title').textContent=correct?'That’s the connection.':'One step closer.';$('quiz-instruction').textContent='The notes are revealed. Compare the sounds, or try the next question.';renderStats();save();
  if(correct&&$('auto-advance').checked)S.auto=setTimeout(safe(newQuestion),2000);
 }
 async function handoff(){
  const q=S.question;if(!q)return;S.sequenceEnabled=false;S.size=q.notes.length;$('selection-mode').value='lock';$('interval').value=Math.abs(q.steps[0]);$('direction').value=q.harmonic?'harmonic':q.steps[0]<0?'down':'up';$('root-mode').value='fixed';
  if(![...$('root-note').options].some(o=>Number(o.value)===q.notes[0])){const o=new Option(T.noteName(q.notes[0]),q.notes[0]);$('root-note').add(o);}$('root-note').value=q.notes[0];
  if(q.steps.length===2){$('step2rule').value='fixed';$('step2interval').value=Math.abs(q.steps[1]);$('step2direction').value=q.steps[1]<0?'down':'up';$('reference').value='chain';}
  $('phrasing').value='pure';$('cell-connection').value='continuous';refreshControls();setMode('passive');save();await startLoop();$('passive-tab').scrollIntoView({behavior:'smooth',block:'start'});
 }
 function initialize(){
  for(const id of ['interval','step2interval','quiz-sound-interval'])$(id).innerHTML=T.intervals.map(i=>`<option value="${i.st}">${i.short} · ${i.name}</option>`).join('');$('interval').value='7';$('step2interval').value='10';
  for(let m=48;m<=72;m++)$('root-note').add(new Option(T.noteName(m),m));$('root-note').value='60';
  restore();if(!['quiz-up','quiz-down','quiz-harmonic'].some(id=>$(id).checked))$('quiz-up').checked=true;
  buildInstruments();renderSequence();renderQuizGroups();refreshControls();renderPool();renderStats();preview();
  const unlockFromGesture=e=>{if(S.background||e.target.closest?.('#background-card'))return;if(e.type==='keydown'&&(e.repeat||e.ctrlKey||e.metaKey||e.altKey||![' ','Enter','r','R'].includes(e.key)))return;audio().catch(()=>{});};
  for(const event of ['touchend','click','keydown'])document.addEventListener(event,unlockFromGesture,{capture:true,passive:true});
  on('enable-audio','click',async()=>{stop();const token=S.generation;const synth=await audio(true);if(token!==S.generation)return;if(Number($('volume').value)===0){toast('Master volume is muted. Raise it to hear the sound test.');return;}synth.play(69,undefined,0.6,0.7,$('voice').value);toast('Sound test: A4 · 440 Hz.');});
  on('loop','click',async()=>{if(S.looping)stop();else await startLoop();});on('once','click',async()=>{stop();S.iteration=0;await runCycle(true);});
  on('prepare-background','click',prepareBackground);on('stop-background','click',stop);
  on('play-background','click',()=>{const media=$('background-audio');if(!S.background?.url)return;if(media.paused)return playBackground();media.pause();});
  on('background-audio','play',()=>{
   if(!S.background?.url||$('background-audio').paused)return;
   S.looping=true;
   loopButton();
   $('play-background').textContent='Pause background loop';
   $('background-status').textContent='Starting audio…';
  });
  on('background-audio','playing',()=>{
   if(!S.background?.url||$('background-audio').paused)return;
   S.background.started=true;
   $('background-status').textContent='Playing: '+S.background.description+'. You can lock the screen or switch apps.';
   if(S.synth?.ctx.state==='running')S.synth.ctx.suspend().catch(()=>{});
   backgroundSession();animateBackground();updateAudioStatus(S.synth);
  });
  on('background-audio','pause',()=>{if(!S.background?.url)return;S.looping=false;loopButton();cancelAnimationFrame(S.raf);$('play-background').textContent='Play background loop';$('background-status').textContent='Paused. Tap Play here or use the lock-screen media controls to resume.';backgroundPosition();syncBackground();updateAudioStatus(S.synth);});
  for(const event of ['timeupdate','loadedmetadata','seeked'])on('background-audio',event,()=>{backgroundPosition();syncBackground();});
  on('background-audio','error',()=>{if(S.background?.url){stop();toast('The prepared track could not play. Prepare it again and tap Play.',true);}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&S.background?.url){syncBackground();if(!$('background-audio').paused)animateBackground();}});
  on('passive-tab','click',()=>setMode('passive'));on('quiz-tab','click',()=>setMode('quiz'));
  for(const id of ['passive-tab','quiz-tab'])on(id,'keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const mode=S.mode==='quiz'?'passive':'quiz';setMode(mode);$(mode+'-tab').focus();}});
  settingIds.forEach(id=>on(id,$(id).type==='range'?'input':'change',async()=>{
   refreshControls();
   if(!['view','ghosts','blind','auto-advance','choice-count'].includes(id)&&!id.startsWith('quiz-'))invalidateBackground();
   if(id==='voice'){const token=S.generation,voice=$('voice').value;const synth=await audio();if(token!==S.generation||$('voice').value!==voice)return;synth.instrument=voice;synth.play(S.current?.notes[0]||60,undefined,0.65,0.7,voice);}
   else if(id==='volume'){if(S.synth)S.synth.volume(Number($('volume').value)/100);}
   else if(['view','ghosts','blind'].includes(id)){if(S.current)drawInstruments(S.current.notes,S.active);}
   else if(id==='auto-advance'&&!$('auto-advance').checked){clearTimeout(S.auto);S.auto=0;}
   else if(id.startsWith('quiz-')){if(!['quiz-up','quiz-down','quiz-harmonic'].some(x=>$(x).checked)){$(id).checked=true;toast('Keep at least one direction enabled.');}}
   else if(!['auto-advance','choice-count'].includes(id)&&S.mode==='passive'){if(S.looping){S.iteration=0;await runCycle();}else{cancelPlayback();preview();}}
   save();
  }));
  $$('[data-size]').forEach(b=>b.addEventListener('click',safe(async()=>{invalidateBackground();S.sequenceEnabled=b.dataset.size==='sequence';if(!S.sequenceEnabled)S.size=Number(b.dataset.size);refreshControls();if(S.looping){S.iteration=0;await runCycle();}else{cancelPlayback();preview();}save();})));
  on('add-interval','click',async()=>{if(S.sequence.length>=4)return;S.sequence.push({interval:7,direction:'up'});renderSequence();await sequenceChanged();});
  $('sequence-list').addEventListener('change',safe(async e=>{const input=e.target;if(!input.dataset.sequenceField)return;const index=Number(input.dataset.sequenceIndex);S.sequence[index][input.dataset.sequenceField]=input.dataset.sequenceField==='interval'?Number(input.value):input.value;await sequenceChanged();}));
  $('sequence-list').addEventListener('click',safe(async e=>{const button=e.target.closest('[data-remove-sequence]');if(!button||S.sequence.length<=1)return;S.sequence.splice(Number(button.dataset.removeSequence),1);renderSequence();await sequenceChanged();}));
  $$('[data-quiz-size]').forEach(b=>b.addEventListener('click',()=>{S.quizSize=b.dataset.quizSize==='grouped'?'grouped':Number(b.dataset.quizSize);refreshControls();save();}));
  on('quiz-add-named','click',()=>addQuizSound('named'));
  on('quiz-add-other','click',()=>addQuizSound('others'));
  on('grouped-quiz-settings','click',e=>{
   const button=e.target.closest('[data-quiz-remove]');
   if(!button)return;
   const {quizRemove:group,sound}=button.dataset;
   S.quizGroups[group]=S.quizGroups[group].filter(key=>key!==sound);
   renderQuizGroups();
   save();
  });
  $$('[data-bpm]').forEach(b=>b.addEventListener('click',safe(async()=>{invalidateBackground();$('bpm').value=b.dataset.bpm;refreshControls();save();if(S.looping)await runCycle();})));
  $$('[data-drill]').forEach(b=>b.addEventListener('click',safe(async()=>{
   if(S.mode!=='passive')setMode('passive');S.sequenceEnabled=false;$('selection-mode').value='lock';
   if(b.dataset.drill==='cell'){S.size=3;$('interval').value='2';$('direction').value='down';$('step2rule').value='fixed';$('step2interval').value='10';$('step2direction').value='up';$('reference').value='chain';}
   else{S.size=2;const [i,d]=b.dataset.drill.split(',').map(Number);$('interval').value=i;$('direction').value=d<0?'down':'up';}
   refreshControls();save();await startLoop();
  })));
  $$('[data-pool]').forEach(b=>b.addEventListener('click',()=>{invalidateBackground();S.pool=new Set(poolPresets()[b.dataset.pool]);renderPool();renderStats();save();}));
  $('pool').addEventListener('click',e=>{const b=e.target.closest('[data-pool-note]');if(!b)return;const n=Number(b.dataset.poolNote);if(S.pool.has(n)){if(S.pool.size===1){toast('Keep at least one interval in your pool.');return;}invalidateBackground();S.pool.delete(n);}else{invalidateBackground();S.pool.add(n);}renderPool();renderStats();save();});
  on('new-question','click',newQuestion);on('replay','click',()=>replayQuestion());on('harmonic','click',()=>replayQuestion(true));
  $('quiz-choices').addEventListener('click',safe(async e=>{const b=e.target.closest('[data-choice]');if(b)await answer(Number(b.dataset.step),b.dataset.choice);}));
  on('reset-score','click',()=>{stop();S.session=new T.QuizSession();S.question=null;S.current={notes:[],steps:[]};$('quiz-choices').innerHTML='';$('feedback').hidden=true;$('new-question').textContent='▶ Start ear quiz';$('replay').disabled=true;$('harmonic').disabled=true;$('quiz-title').textContent='A fresh pair of ears.';$('question-label').textContent='YOUR NEXT SMALL BREAKTHROUGH';$('quiz-instruction').textContent='Listen to the notes, then name the distance between them.';drawInstruments([],[]);refreshControls();renderStats();save();toast('Scores reset. Your practice settings are saved.');});
  on('help-button','click',()=>$('help').showModal());on('close-help','click',()=>$('help').close());on('help-done','click',()=>$('help').close());
  document.addEventListener('keydown',safe(async e=>{
   if(e.key==='Escape'){stop();return;}if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||$('help').open||e.target.matches('input,select,textarea,[contenteditable="true"]'))return;
   if(e.target.closest('button')&&[' ','Enter'].includes(e.key))return;
   if(S.mode==='passive'&&e.code==='Space'){e.preventDefault();S.looping?stop():await startLoop();}
   else if(S.mode==='quiz'){
    if(e.code==='Space'||e.key.toLowerCase()==='r'){e.preventDefault();await replayQuestion();}
    else if(e.key==='Enter'){e.preventDefault();await newQuestion();}
    else if(/^[1-9]$/.test(e.key)&&S.question&&!S.session.done){const step=S.session.answers.findIndex(a=>a===null),buttons=$$(`.choice[data-step="${step}"]`),b=buttons[Number(e.key)-1];if(b)await answer(step,b.dataset.choice);}
   }
  }));
  window.addEventListener('pagehide',()=>{if(!S.background)stop();save();});
  if(!('speechSynthesis'in window)){$('speech').value='off';$('speech').disabled=true;$('speech-hint').textContent='Voice announcements are unavailable in this browser.';}
 }
 initialize();
})();
