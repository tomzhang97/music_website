/* Prepared native-media tracks: no JavaScript note/loop scheduler at playback time. */
(function(global){
 'use strict';
 const T=global.IntervalCore;
 function phrase(cycle,{bpm=100,style='pure',pause=0.7}={}){return cycle.disjoint?T.disjointPhrase(cycle.notes,bpm,style,pause,cycle.harmonic):T.phrase(cycle.notes,bpm,style,cycle.harmonic);}
 function plan(makeCycle,{bpm=100,style='pure',pause=0.7,gap=2,targetSeconds=60,maxGroups=96}={}){
  const segments=[],events=[];let duration=0,groups=0,iteration=0,last=true;
  do{
   const cycle=makeCycle(iteration++),pairs=cycle.sequence?.style==='pairs';
   if(!pairs||cycle.sequence.index===0)groups++;
   const schedule=phrase(cycle,{bpm,style,pause});
   last=!pairs||cycle.sequence.last;
   const breath=last?gap:pause,start=duration;duration+=schedule.duration+breath;
   segments.push({cycle,plan:schedule,start,end:duration,gap:breath,group:groups});
   for(const event of schedule.events)for(const index of event.indices)events.push({midi:cycle.notes[index],at:start+event.at,length:event.length,velocity:event.velocity});
  }while(!last||duration<targetSeconds&&groups<maxGroups);
  return {segments,events,duration,groups};
 }
 function wav(buffer){
  const samples=buffer.getChannelData(0),bytes=new ArrayBuffer(44+samples.length*2),view=new DataView(bytes);
  const text=(at,s)=>{for(let i=0;i<s.length;i++)view.setUint8(at+i,s.charCodeAt(i));};
  text(0,'RIFF');view.setUint32(4,bytes.byteLength-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,buffer.sampleRate,true);view.setUint32(28,buffer.sampleRate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,samples.length*2,true);
  for(let i=0;i<samples.length;i++){const value=Number.isFinite(samples[i])?Math.max(-1,Math.min(1,samples[i])):0;view.setInt16(44+i*2,Math.round(value*(value<0?32768:32767)),true);}
  return bytes;
 }
 async function render(track,{voice='grand',volume=0.55,sampleRate=44100}={}){
  const Offline=global.OfflineAudioContext||global.webkitOfflineAudioContext;
  if(!Offline)throw Error('Preparing background audio is unavailable in this browser. Use the interactive loop instead.');
  const context=new Offline(1,Math.ceil(track.duration*sampleRate),sampleRate),synth=new global.StudioSynth(context);
  synth.master.gain.value=volume;
  for(const event of track.events)synth.play(event.midi,event.at,event.length,event.velocity,voice);
  const buffer=await context.startRendering();
  return new Blob([wav(buffer)],{type:'audio/wav'});
 }
 global.StudioTrack={phrase,plan,wav,render};
})(globalThis);
