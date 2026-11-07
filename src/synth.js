/* Procedural, sample-free polyphonic instruments and studio signal path. */
(function(global){
 'use strict';
 function playbackSession(){try{if(global.navigator?.audioSession)global.navigator.audioSession.type='playback';}catch(_){} }
 class StudioSynth{
  constructor(context){
   if(!context)playbackSession();
   const Audio=global.AudioContext||global.webkitAudioContext;
   if(!context&&!Audio)throw Error('Web Audio is unavailable in this browser. Try a current Chrome, Safari, Firefox or Edge.');
   this.ctx=context||new Audio();this.voices=new Set();this.instrument='grand';this.cache=new Map();
   const c=this.ctx;this.bus=c.createGain();this.master=c.createGain();this.master.gain.value=0.55;
   this.compressor=c.createDynamicsCompressor();Object.assign(this.compressor.threshold,{value:-18});this.compressor.knee.value=16;this.compressor.ratio.value=4;this.compressor.attack.value=0.003;this.compressor.release.value=0.18;
   const dry=c.createGain();dry.gain.value=0.9;const wet=c.createGain();wet.gain.value=0.13;
   this.reverb=c.createConvolver();const length=Math.floor(c.sampleRate*0.75),ir=c.createBuffer(2,length,c.sampleRate);
   for(let ch=0;ch<2;ch++){const d=ir.getChannelData(ch);for(let i=0;i<length;i++)d[i]=(Math.random()*2-1)*Math.exp(-i/(c.sampleRate*0.12))*0.4;}
   this.reverb.buffer=ir;this.bus.connect(dry).connect(this.compressor);this.bus.connect(this.reverb).connect(wet).connect(this.compressor);this.compressor.connect(this.master).connect(c.destination);
  }
  async unlock(){
   playbackSession();
   if(this.ctx.state==='closed')throw Error('Audio was closed. Tap Enable sound to reconnect.');
   // Start/resume in the actual input handler, before crossing an await boundary.
   const resume=this.ctx.state!=='running'?this.ctx.resume():Promise.resolve();
   if(!this.warmed||this.ctx.state!=='running'){
    const source=this.ctx.createBufferSource();source.buffer=this.ctx.createBuffer(1,1,this.ctx.sampleRate);source.connect(this.ctx.destination);source.onended=()=>source.disconnect();source.start(this.ctx.currentTime);this.warmed=true;
   }
   let timer;
   try{
    await Promise.race([resume,new Promise((resolve,reject)=>{timer=setTimeout(()=>this.ctx.state==='running'?resolve():reject(Error('Sound is waiting for permission. Tap Enable sound to retry.')),2500);})]);
    if(this.ctx.state!=='running')throw Error('Sound is interrupted. Tap Enable sound to reconnect.');
    this.unlockFailed=false;
   }catch(error){this.unlockFailed=true;throw error;}finally{clearTimeout(timer);}
  }
  volume(value){this.master.gain.setTargetAtTime(Math.max(0,Math.min(1,value)),this.ctx.currentTime,0.02);}
  stopAll(){const now=this.ctx.currentTime;for(const v of this.voices){v.gain.gain.cancelScheduledValues(now);v.gain.gain.setTargetAtTime(0,now,0.008);for(const s of v.sources)try{s.stop(now+0.035);}catch(_){} }this.voices.clear();}
  play(midi,when=this.ctx.currentTime,length=0.7,velocity=0.8,instrument=this.instrument){
   const c=this.ctx,t=Math.max(c.currentTime,when),f=IntervalCore.frequency(midi),gate=Math.max(0.12,length);
   const voice={gain:c.createGain(),sources:[]};voice.gain.connect(this.bus);this.voices.add(voice);
   const end=t+gate+0.36;voice.gain.gain.setValueAtTime(0,t);voice.gain.gain.linearRampToValueAtTime(0.23*velocity,t+0.006);voice.gain.gain.setValueAtTime(0.23*velocity,t+gate);voice.gain.gain.exponentialRampToValueAtTime(0.00001,end);
   const track=(source)=>{voice.sources.push(source);source.start(t);source.stop(end+0.04);source.onended=()=>{source._ended=true;if(voice.sources.every(s=>s._ended)){voice.gain.disconnect();this.voices.delete(voice);}};return source;};
   const filter=(cutoff,decayTo,decay=0.4,type='lowpass',q=0.7)=>{const n=c.createBiquadFilter();n.type=type;n.Q.value=q;n.frequency.setValueAtTime(Math.min(c.sampleRate*0.45,cutoff),t);if(decayTo)n.frequency.exponentialRampToValueAtTime(Math.max(40,decayTo),t+decay);n.connect(voice.gain);return n;};
   const partial=(ratio,level,decay=1.4,detune=0,type='sine',dest=voice.gain,attack=0.004)=>{
    const o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.value=f*ratio;o.detune.value=detune;
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(level,t+attack);g.gain.exponentialRampToValueAtTime(Math.max(0.00001,level*0.09),t+Math.max(attack+0.02,decay));o.connect(g).connect(dest);track(o);return o;
   };
   const noise=(level,duration=0.025,dest=voice.gain)=>{
    const b=c.createBuffer(1,Math.ceil(c.sampleRate*duration),c.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,3);
    const s=c.createBufferSource(),g=c.createGain();s.buffer=b;g.gain.value=level;s.connect(g).connect(dest);track(s);
   };
   if(['grand','felt','honky'].includes(instrument)){
    const felt=instrument==='felt',honky=instrument==='honky',dest=filter(f*(felt?7:20),f*(felt?3:5),0.9);
    const count=felt?7:12,detunes=honky?[-9,0,8]:felt?[0]:[-2.3,2.3];
    for(let n=1;n<=count;n++)for(const cents of detunes){
     const ratio=n*Math.sqrt(1+(honky?0.00023:0.00008)*n*n),level=(felt?0.7:0.72)/Math.pow(n,felt?2.3:1.65)/detunes.length;
     partial(ratio,level,Math.max(0.13,(felt?2.5:2.1)/Math.pow(n,0.52)),cents,'sine',dest,felt?0.018:0.003);
    }noise(felt?0.025:honky?0.2:0.09,honky?0.018:0.03,dest);
   }else if(instrument==='rhodes'){
    partial(1,0.85,2.6);partial(2,0.16,1.1);partial(3.98,0.28,0.48);partial(7.02,0.035,0.18);
   }else if(instrument==='wurli'){
    const dest=filter(f*16,f*3.5,0.22,'lowpass',1.2);[1,2,3,4,5,7].forEach((r,i)=>partial(r,[0.68,0.32,0.22,0.07,0.06,0.035][i],1.4/(1+i*0.2),0,'sine',dest));noise(0.035,0.016,dest);
   }else if(instrument==='dx'){
    const carrier=c.createOscillator(),amp=c.createGain();carrier.frequency.value=f;amp.gain.value=0.8;carrier.connect(amp).connect(voice.gain);
    for(const [ratio,index,decay]of [[1,0.85,0.6],[14,0.45,0.2]]){
     const mod=c.createOscillator(),depth=c.createGain();mod.frequency.value=f*ratio;depth.gain.setValueAtTime(f*index,t);depth.gain.exponentialRampToValueAtTime(0.01,t+decay);mod.connect(depth).connect(carrier.frequency);track(mod);
    }track(carrier);
   }else if(['steel','nylon','jazz'].includes(instrument)){
    const config={steel:{pick:0.18,damp:0.996,cut:9000,body:195},nylon:{pick:0.32,damp:0.985,cut:3200,body:140},jazz:{pick:0.42,damp:0.989,cut:1900,body:165}}[instrument];
    const key=instrument+':'+midi;let buffer=this.cache.get(key);
    if(!buffer){
     const duration=3.5,sr=c.sampleRate,delay=sr/f-0.5,N=Math.floor(delay),frac=delay-N,count=Math.ceil(duration*sr);
     buffer=c.createBuffer(1,count,sr);const out=buffer.getChannelData(0),seed=new Float32Array(N+2),shift=Math.max(1,Math.floor(N*config.pick));
     for(let i=0;i<seed.length;i++)seed[i]=Math.random()*2-1;
     for(let i=0;i<N+2;i++)out[i]=(seed[i]-seed[(i+shift)%seed.length])*0.6;
     for(let i=N+2;i<count;i++){const a=out[i-N]*(1-frac)+out[i-N-1]*frac,b=out[i-N-1]*(1-frac)+out[i-N-2]*frac;out[i]=(a+b)*0.5*config.damp;}
     this.cache.set(key,buffer);if(this.cache.size>72)this.cache.delete(this.cache.keys().next().value);
    }
    const source=c.createBufferSource();source.buffer=buffer;const lp=filter(config.cut,config.cut*0.65,0.5);source.connect(lp);
    const body=c.createBiquadFilter();body.type='peaking';body.frequency.value=config.body;body.Q.value=1.3;body.gain.value=4;source.connect(body);const bodyGain=c.createGain();bodyGain.gain.value=0.16;body.connect(bodyGain).connect(voice.gain);track(source);
   }else if(instrument==='pad'){
    const dest=filter(2200,1200,1.4);partial(1,0.25,4,-7,'sawtooth',dest,0.16);partial(1,0.25,4,7,'sawtooth',dest,0.2);partial(0.5,0.35,4,0,'triangle',dest,0.12);
   }else{partial(1,0.8,4,0,'sine',voice.gain,0.012);}
   return voice;
  }
 }
 global.StudioSynth=StudioSynth;
})(globalThis);
