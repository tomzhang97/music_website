(function(){
 'use strict';
 const T=IntervalCore,$=id=>document.getElementById(id),$$=s=>Array.from(document.querySelectorAll(s));
 const badges=['①','②','③'];
 const S={mode:'passive',size:2,quizSize:2,pool:new Set(T.intervals.filter(x=>x.st<=12).map(x=>x.st)),looping:false,iteration:0,cycles:0,rawRoot:60,current:null,question:null,active:[],generation:0,raf:0,auto:0,session:new T.QuizSession(),synth:null};
 const settingIds=['voice','volume','view','ghosts','interval','selection-mode','direction','step2rule','step2interval','step2direction','reference','root-mode','root-note','repetitions','bpm','gap','phrasing','speech','blind','choice-count','auto-advance','quiz-up','quiz-down','quiz-harmonic'];
 let toastTimer=0,lastCenter='',dragStart=null,dragMoved=false;
 function toast(message,error=false){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').classList.toggle('error',error);$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,4200);}
 function save(){try{const settings={};settingIds.forEach(id=>settings[id]=$(id).type==='checkbox'?$(id).checked:$(id).value);localStorage.setItem('interval-01-v1',JSON.stringify({settings,size:S.size,quizSize:S.quizSize,pool:[...S.pool],stats:{total:S.session.total,correct:S.session.correct,streak:S.session.streak,best:S.session.best,byInterval:S.session.byInterval}}));}catch(_){} }
 function restore(){try{
  const data=JSON.parse(localStorage.getItem('interval-01-v1')||'null');if(!data||typeof data!=='object')return;
  settingIds.forEach(id=>{const el=$(id),v=data.settings?.[id];if(el.type==='checkbox'){if(typeof v==='boolean')el.checked=v;}else if(el.tagName==='SELECT'){if([...el.options].some(o=>o.value===String(v)))el.value=String(v);}else if(Number.isFinite(Number(v))&&v!==null){el.value=String(Math.max(Number(el.min),Math.min(Number(el.max),Number(v))));}});
  if(data.size===3)S.size=3;if(data.quizSize===3)S.quizSize=3;
  if(Array.isArray(data.pool)){const valid=data.pool.filter(n=>T.intervals.some(i=>i.st===n));if(valid.length)S.pool=new Set(valid);}
  const st=data.stats;if(st&&Number.isInteger(st.total)&&st.total>=0&&Number.isInteger(st.correct)&&st.correct>=0&&st.correct<=st.total){S.session.total=st.total;S.session.correct=st.correct;S.session.best=Number.isInteger(st.best)&&st.best>=0?st.best:0;S.session.streak=Number.isInteger(st.streak)&&st.streak>=0?st.streak:0;
   if(st.byInterval&&typeof st.byInterval==='object')T.intervals.forEach(i=>{const v=st.byInterval[i.st];if(v&&Number.isInteger(v.total)&&v.total>=0&&Number.isInteger(v.correct)&&v.correct>=0&&v.correct<=v.total)S.session.byInterval[i.st]={total:v.total,correct:v.correct};});
  }
 }catch(_){} }
 async function audio(){
  if(!S.synth){S.synth=new StudioSynth();S.synth.volume(Number($('volume').value)/100);S.synth.ctx.onstatechange=()=>{$('audio-led').classList.toggle('on',S.synth.ctx.state==='running');$('audio-status').textContent=S.synth.ctx.state==='running'?'AUDIO ENGINE CONNECTED':'TAP TO RESUME AUDIO';};}
  await S.synth.unlock();$('audio-led').classList.add('on');$('audio-status').textContent='AUDIO ENGINE CONNECTED';return S.synth;
 }
 const safe=fn=>(...args)=>Promise.resolve().then(()=>fn(...args)).catch(error=>{stop();toast(error.message||'Audio could not start. Tap a play button to try again.',true);});
 function on(id,event,fn){$(id).addEventListener(event,safe(fn));}
 function cancelPlayback(){S.generation++;cancelAnimationFrame(S.raf);if(S.synth)S.synth.stopAll();if('speechSynthesis'in window)window.speechSynthesis.cancel();S.active=[];$('breath-progress').style.transform='scaleX(0)';$$('.note-chip').forEach(x=>x.classList.remove('active'));return S.generation;}
 function loopButton(){ $('loop').classList.toggle('running',S.looping);$('loop-label').textContent=S.looping?'Stop infinite loop':'Start infinite loop';$('loop').querySelector('.play-icon').textContent=S.looping?'■':'▶';$('transport-led').classList.toggle('on',S.looping);}
 function stop(){clearTimeout(S.auto);S.auto=0;S.looping=false;cancelPlayback();loopButton();$('transport-status').textContent='STANDBY';if(S.current)drawInstruments(S.current.notes,[]);}
 function getConfig(){return {size:S.size,interval:Number($('interval').value),direction:$('direction').value,step2rule:$('step2rule').value,step2interval:Number($('step2interval').value),step2direction:$('step2direction').value,reference:$('reference').value,pool:[...S.pool]};}
 function fitVisible(root,offsets){return T.placeRoot(root,offsets);}
 function makePassive(iteration=0){const config=getConfig();if($('selection-mode').value==='rotate')config.interval=[...S.pool].sort((a,b)=>a-b)[iteration%S.pool.size];
  const offsets=T.cellOffsets(config,iteration);const rootConfig={mode:$('root-mode').value,fixed:Number($('root-note').value),repeats:Number($('repetitions').value)};
  S.rawRoot=T.nextRoot(rootConfig,iteration,S.rawRoot);const root=rootConfig.mode==='fixed'?S.rawRoot:fitVisible(S.rawRoot,offsets);
  return {notes:offsets.map(o=>root+o),steps:offsets.slice(1).map((o,i)=>o-offsets[i]),harmonic:config.direction==='harmonic',config};
 }
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
 async function audition(midi,position){stop();await audio();const token=cancelPlayback();S.current={notes:[midi],steps:[],harmonic:false,manualPosition:position};playScheduled([midi],T.phrase([midi],100,'pure'),token,0);if(position){$('guitar-info').textContent=`String ${position.string+1} · Fret ${position.fret} · ${T.noteName(midi)} · ${T.frequency(midi).toFixed(2)} Hz`;}}
 function renderLCD(cycle){
  const step=cycle.steps[0]||0,first=T.info(step),cell=cycle.notes.length===3;
  $('interval-title').textContent=cell?cycle.steps.map(s=>T.info(s).short+(s<0?' ↓':' ↑')).join(' + '):first.name;
  $('interval-direction').textContent=cell?'THREE-NOTE INTERVAL CELL · '+(cycle.config?.reference==='root'?'FROM ROOT':'CHAINED'):cycle.harmonic?'HARMONIC INTERVAL ⇅':step<0?'DESCENDING INTERVAL ↓':'ASCENDING INTERVAL ↑';
  $('interval-symbol').innerHTML=(cell?'1·2·3':first.short)+`<span>${cell?'LISTEN · CONNECT · REPEAT':(step>=0?'+':'')+step+' SEMITONES'}</span>`;
  $('note-sequence').innerHTML=cycle.notes.map((n,i)=>(i?`<span class="step-arrow">${cycle.steps[i-1]<0?'↘':'↗'}<br>${cycle.steps[i-1]>0?'+':''}${cycle.steps[i-1]} st</span>`:'')+`<div class="note-chip" data-note-index="${i}">${badges[i]} ${T.noteName(n)}<small>${T.frequency(n).toFixed(1)} Hz</small></div>`).join('');
  $('ratio-readout').innerHTML=cycle.steps.map(s=>`${Math.pow(2,Math.abs(s)/12).toFixed(4)}× <small>12-TET</small> · ${T.info(s).ratio} <small>REF</small>`).join('<br>');
  $('song-reference').textContent=(step<0?'↘ ':'↗ ')+(step<0?first.down:first.up);
  $('cycle-count').textContent=String(S.cycles).padStart(4,'0');
 }
 function playScheduled(notes,plan,token,gap=0,onFinish){
  const synth=S.synth,start=synth.ctx.currentTime+0.045;let last='';S.current={...S.current,notes};
  for(const e of plan.events)for(const i of e.indices)synth.play(notes[i],start+e.at,e.length,e.velocity,$('voice').value);
  drawInstruments(notes,[]);
  function tick(){if(token!==S.generation)return;const elapsed=synth.ctx.currentTime-start;
   const indices=[...new Set(plan.events.filter(e=>elapsed>=e.at&&elapsed<e.at+e.length).flatMap(e=>e.indices))];
   if(indices.join(',')!==last){last=indices.join(',');S.active=indices;drawInstruments(notes,indices);$$('.note-chip').forEach(el=>el.classList.toggle('active',indices.includes(Number(el.dataset.noteIndex))));}
   if(S.mode==='passive'){$('transport-status').textContent=elapsed<plan.duration?'LISTENING':gap>0?'BREATHE':'STANDBY';$('breath-progress').style.transform=`scaleX(${gap>0?Math.max(0,Math.min(1,(elapsed-plan.duration)/gap)):0})`;}
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
  const cycle=makePassive(S.iteration);S.current=cycle;S.cycles++;renderLCD(cycle);drawInstruments(cycle.notes,[]);
  if($('speech').value==='before'){$('transport-status').textContent='ANNOUNCING';await speak(spoken(cycle),token);if(token!==S.generation)return;}
  const plan=T.phrase(cycle.notes,Number($('bpm').value),$('phrasing').value,cycle.harmonic);
  const finish=safe(async()=>{if(token!==S.generation)return;if($('speech').value==='after'){$('transport-status').textContent='NAMING THE INTERVAL';await speak(spoken(cycle),token);if(token!==S.generation)return;}
   if(!once&&S.looping){S.iteration++;await runCycle();}else{$('transport-status').textContent='STANDBY';}
  });
  playScheduled(cycle.notes,plan,token,once?0:Number($('gap').value),finish);
 }
 async function startLoop(){stop();S.looping=true;S.iteration=0;S.rawRoot=Number($('root-note').value);loopButton();await runCycle();}
 function refreshControls(){
  $('cell-settings').hidden=S.size!==3;$('rotation-help').hidden=$('selection-mode').value!=='rotate';$('interval').disabled=$('selection-mode').value==='rotate';$('custom-step2').hidden=['repeat','mirror'].includes($('step2rule').value);$('step2interval').disabled=$('step2rule').value==='random';
  $$('[data-size]').forEach(b=>{const active=Number(b.dataset.size)===S.size;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
  $$('[data-quiz-size]').forEach(b=>{const active=Number(b.dataset.quizSize)===S.quizSize;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
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
 function renderStats(){
  $('score').textContent=S.session.correct+' / '+S.session.total;$('accuracy').innerHTML=(S.session.total?S.session.accuracy:'—')+'<small>%</small>';$('streak').textContent=S.session.streak;$('best').textContent=S.session.best;
  const intervals=T.intervals.filter(x=>S.pool.has(x.st)||S.session.byInterval[x.st]);$('interval-progress').innerHTML=intervals.map(i=>{const row=S.session.byInterval[i.st],pct=row?.total?Math.round(row.correct/row.total*100):0;return `<div class="progress-row"><div><span>${i.short}</span><span>${row?.total?pct+'% · '+row.correct+'/'+row.total:'—'}</span></div><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div></div>`;}).join('');
 }
 async function newQuestion(){
  stop();await audio();const directions=['up','down','harmonic'].filter(d=>$('quiz-'+d).checked);if(!directions.length){toast('Enable at least one quiz direction.',true);return;}
  const dir=T.pick(directions),pool=[...S.pool],first=T.pick(pool),second=T.pick(pool),c={size:S.quizSize,interval:first,direction:dir,step2rule:'fixed',step2interval:second,step2direction:dir==='harmonic'?'up':T.pick(directions.filter(d=>d!=='harmonic').length?directions.filter(d=>d!=='harmonic'):['up']),reference:'chain'};
  const offsets=T.cellOffsets(c),root=fitVisible(T.pick([50,52,53,55,57,59,60,62,64]),offsets);
  S.question={notes:offsets.map(o=>root+o),steps:offsets.slice(1).map((o,i)=>o-offsets[i]),harmonic:dir==='harmonic',config:c};S.current=S.question;
  S.session.begin(S.question.steps.map(Math.abs));$('feedback').hidden=true;$('new-question').textContent='Next question →';$('replay').disabled=false;$('harmonic').disabled=false;
  $('question-label').textContent='QUESTION '+String(S.session.total+1).padStart(2,'0')+' / '+(S.quizSize===3?'3-NOTE CELL':'2-NOTE INTERVAL');$('quiz-title').textContent=S.quizSize===3?'Two steps. One musical thought.':'What interval do you hear?';$('quiz-instruction').textContent=dir==='harmonic'?'The notes sound together. Identify the distance'+(S.quizSize===3?' in each step.':'.'):'Listen to the '+(S.quizSize===3?'three notes and identify each step.':dir==='down'?'descending pair.':'ascending pair.');
  renderChoices();await replayQuestion();
 }
 function renderChoices(){
  const q=S.question;if(!q)return;const count=Number($('choice-count').value);q.options=q.steps.map(s=>T.choices([...S.pool],Math.abs(s),count));
  $('quiz-choices').classList.toggle('cell',q.steps.length===2);$('quiz-choices').innerHTML=q.options.map((options,step)=>`<div class="choice-column"><h3 class="choice-heading">${q.steps.length===2?'STEP '+(step+1)+' · NOTE '+(step+1)+' → '+(step+2):'NAME THE INTERVAL'}</h3><div class="choice-grid">${options.map((value,i)=>`<button class="choice" data-choice="${value}" data-step="${step}"><span><b>${T.info(value).short}</b><span class="choice-name">${T.info(value).name}</span></span><kbd>${i<9?i+1:'·'}</kbd></button>`).join('')}</div></div>`).join('');
 }
 async function replayQuestion(harmonic=false){if(!S.question){await newQuestion();return;}clearTimeout(S.auto);S.auto=0;const token=cancelPlayback();await audio();if(token!==S.generation)return;S.current=S.question;playScheduled(S.question.notes,T.phrase(S.question.notes,Number($('bpm').value),'pure',harmonic||S.question.harmonic),token);}
 async function answer(step,value){
  if(!S.question)return;
  if(S.session.done){clearTimeout(S.auto);S.auto=0;const root=S.question.notes[step],signed=value*(S.question.steps[step]<0?-1:1);const token=cancelPlayback();await audio();if(token!==S.generation)return;const notes=[root,root+signed];S.current={notes,steps:[signed]};playScheduled(notes,T.phrase(notes,Number($('bpm').value),'pure',S.question.harmonic),token);toast('Comparing '+T.info(value).name+' from '+T.noteName(root)+'.');return;}
  if(S.session.answers[step]!==null)return;
  const finished=S.session.answer(step,value);$$(`.choice[data-step="${step}"]`).forEach(b=>{b.classList.toggle('chosen',Number(b.dataset.choice)===value);b.setAttribute('aria-pressed',String(Number(b.dataset.choice)===value));});
  if(!finished){$('quiz-instruction').textContent=`Step ${step+1} locked in. Now identify Step ${step===0?2:1}.`;return;}
  const correct=S.session.answers.every((a,i)=>a===S.session.targets[i]);
  cancelPlayback();S.current=S.question;drawInstruments(S.question.notes,[]);
  $$('.choice').forEach(b=>{const col=Number(b.dataset.step),v=Number(b.dataset.choice);b.classList.remove('chosen');b.classList.toggle('correct',v===S.session.targets[col]);b.classList.toggle('wrong',v===S.session.answers[col]&&v!==S.session.targets[col]);});
  $('feedback').className='feedback'+(correct?'':' wrong-feedback');$('feedback').hidden=false;
  $('feedback').innerHTML=`<h3>${correct?'✓ You heard it.':'Keep that sound in mind.'}</h3><p>${correct?'A little more connection, every time.':'Your answer: '+S.session.answers.map(a=>T.info(a).name).join(' + ')+'. The interval was '+S.question.steps.map(s=>T.info(s).name).join(' + ')+'.'}</p><div class="feedback-notes">${S.question.notes.map(T.noteName).join(' → ')}</div><p>${S.question.steps.map(s=>`${s>0?'+':''}${s} semitones · ${Math.pow(2,Math.abs(s)/12).toFixed(4)}× in 12-TET · ${T.info(s).ratio} reference ratio<br>Song cue: ${s<0?T.info(s).down:T.info(s).up}`).join('<br>')}</p><p>Tap any answer to compare it from the same starting note.</p><button id="handoff">∞ Loop this ${S.question.steps.length===2?'cell':'interval'} in Passive Listening ↗</button>`;
  $('handoff').addEventListener('click',safe(handoff));$('quiz-title').textContent=correct?'That’s the connection.':'One step closer.';$('quiz-instruction').textContent='The notes are revealed. Compare the sounds, or try the next question.';renderStats();save();
  if(correct&&$('auto-advance').checked)S.auto=setTimeout(safe(newQuestion),2000);
 }
 async function handoff(){
  const q=S.question;if(!q)return;S.size=q.notes.length;$('selection-mode').value='lock';$('interval').value=Math.abs(q.steps[0]);$('direction').value=q.harmonic?'harmonic':q.steps[0]<0?'down':'up';$('root-mode').value='fixed';
  if(![...$('root-note').options].some(o=>Number(o.value)===q.notes[0])){const o=new Option(T.noteName(q.notes[0]),q.notes[0]);$('root-note').add(o);}$('root-note').value=q.notes[0];
  if(q.steps.length===2){$('step2rule').value='fixed';$('step2interval').value=Math.abs(q.steps[1]);$('step2direction').value=q.steps[1]<0?'down':'up';$('reference').value='chain';}
  $('phrasing').value='pure';refreshControls();setMode('passive');save();await startLoop();$('passive-tab').scrollIntoView({behavior:'smooth',block:'start'});
 }
 function initialize(){
  for(const id of ['interval','step2interval'])$(id).innerHTML=T.intervals.map(i=>`<option value="${i.st}">${i.short} · ${i.name}</option>`).join('');$('interval').value='7';$('step2interval').value='10';
  for(let m=48;m<=72;m++)$('root-note').add(new Option(T.noteName(m),m));$('root-note').value='60';
  restore();if(!['quiz-up','quiz-down','quiz-harmonic'].some(id=>$(id).checked))$('quiz-up').checked=true;
  buildInstruments();refreshControls();renderPool();renderStats();preview();
  document.addEventListener('pointerdown',()=>{audio().catch(()=>{});},{once:true,capture:true});
  on('loop','click',async()=>{if(S.looping)stop();else await startLoop();});on('once','click',async()=>{stop();S.iteration=0;await runCycle(true);});
  on('passive-tab','click',()=>setMode('passive'));on('quiz-tab','click',()=>setMode('quiz'));
  for(const id of ['passive-tab','quiz-tab'])on(id,'keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const mode=S.mode==='quiz'?'passive':'quiz';setMode(mode);$(mode+'-tab').focus();}});
  settingIds.forEach(id=>on(id,$(id).type==='range'?'input':'change',async()=>{
   refreshControls();
   if(id==='voice'){await audio();S.synth.instrument=$('voice').value;S.synth.play(S.current?.notes[0]||60,undefined,0.65,0.7,$('voice').value);}
   else if(id==='volume'){if(S.synth)S.synth.volume(Number($('volume').value)/100);}
   else if(['view','ghosts','blind'].includes(id)){if(S.current)drawInstruments(S.current.notes,S.active);}
   else if(id==='auto-advance'&&!$('auto-advance').checked){clearTimeout(S.auto);S.auto=0;}
   else if(id.startsWith('quiz-')){if(!['quiz-up','quiz-down','quiz-harmonic'].some(x=>$(x).checked)){$(id).checked=true;toast('Keep at least one direction enabled.');}}
   else if(!['auto-advance','choice-count'].includes(id)&&S.mode==='passive'){if(S.looping){S.iteration=0;await runCycle();}else{cancelPlayback();preview();}}
   save();
  }));
  $$('[data-size]').forEach(b=>b.addEventListener('click',safe(async()=>{S.size=Number(b.dataset.size);refreshControls();if(S.looping){S.iteration=0;await runCycle();}else{cancelPlayback();preview();}save();})));
  $$('[data-quiz-size]').forEach(b=>b.addEventListener('click',()=>{S.quizSize=Number(b.dataset.quizSize);refreshControls();save();}));
  $$('[data-bpm]').forEach(b=>b.addEventListener('click',safe(async()=>{$('bpm').value=b.dataset.bpm;refreshControls();save();if(S.looping)await runCycle();})));
  $$('[data-drill]').forEach(b=>b.addEventListener('click',safe(async()=>{
   if(S.mode!=='passive')setMode('passive');$('selection-mode').value='lock';
   if(b.dataset.drill==='cell'){S.size=3;$('interval').value='2';$('direction').value='down';$('step2rule').value='fixed';$('step2interval').value='10';$('step2direction').value='up';$('reference').value='chain';}
   else{S.size=2;const [i,d]=b.dataset.drill.split(',').map(Number);$('interval').value=i;$('direction').value=d<0?'down':'up';}
   refreshControls();save();await startLoop();
  })));
  $$('[data-pool]').forEach(b=>b.addEventListener('click',()=>{S.pool=new Set(poolPresets()[b.dataset.pool]);renderPool();renderStats();save();}));
  $('pool').addEventListener('click',e=>{const b=e.target.closest('[data-pool-note]');if(!b)return;const n=Number(b.dataset.poolNote);if(S.pool.has(n)){if(S.pool.size===1){toast('Keep at least one interval in your pool.');return;}S.pool.delete(n);}else S.pool.add(n);renderPool();renderStats();save();});
  on('new-question','click',newQuestion);on('replay','click',()=>replayQuestion());on('harmonic','click',()=>replayQuestion(true));
  $('quiz-choices').addEventListener('click',safe(async e=>{const b=e.target.closest('[data-choice]');if(b)await answer(Number(b.dataset.step),Number(b.dataset.choice));}));
  on('reset-score','click',()=>{stop();S.session=new T.QuizSession();S.question=null;S.current={notes:[],steps:[]};$('quiz-choices').innerHTML='';$('feedback').hidden=true;$('new-question').textContent='▶ Start ear quiz';$('replay').disabled=true;$('harmonic').disabled=true;$('quiz-title').textContent='A fresh pair of ears.';$('question-label').textContent='YOUR NEXT SMALL BREAKTHROUGH';$('quiz-instruction').textContent='Listen to the notes, then name the distance between them.';drawInstruments([],[]);renderStats();save();toast('Scores reset. Your practice settings are saved.');});
  on('help-button','click',()=>$('help').showModal());on('close-help','click',()=>$('help').close());on('help-done','click',()=>$('help').close());
  document.addEventListener('keydown',safe(async e=>{
   if(e.key==='Escape'){stop();return;}if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||$('help').open||e.target.matches('input,select,textarea,[contenteditable="true"]'))return;
   if(e.target.closest('button')&&[' ','Enter'].includes(e.key))return;
   if(S.mode==='passive'&&e.code==='Space'){e.preventDefault();S.looping?stop():await startLoop();}
   else if(S.mode==='quiz'){
    if(e.code==='Space'||e.key.toLowerCase()==='r'){e.preventDefault();await replayQuestion();}
    else if(e.key==='Enter'){e.preventDefault();await newQuestion();}
    else if(/^[1-9]$/.test(e.key)&&S.question&&!S.session.done){const step=S.session.answers.findIndex(a=>a===null),buttons=$$(`.choice[data-step="${step}"]`),b=buttons[Number(e.key)-1];if(b)await answer(step,Number(b.dataset.choice));}
   }
  }));
  window.addEventListener('pagehide',()=>{stop();save();});
  if(!('speechSynthesis'in window)){$('speech').value='off';$('speech').disabled=true;$('speech-hint').textContent='Voice announcements are unavailable in this browser.';}
 }
 initialize();
})();
