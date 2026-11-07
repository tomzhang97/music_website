/* Real browser audio rendering; no mocked AudioNodes. */
const {chromium,webkit}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs');
(async()=>{
 const browser=await (process.env.QA_ENGINE==='webkit'?webkit:chromium).launch({headless:true,...(process.env.QA_ENGINE!=='webkit'&&process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
 try{const page=await browser.newPage();await page.addScriptTag({content:fs.readFileSync('src/theory.js','utf8')});
 if(fs.existsSync('src/synth.js'))await page.addScriptTag({content:fs.readFileSync('src/synth.js','utf8')});
 const results=await page.evaluate(async()=>{
  if(!globalThis.StudioSynth)throw Error('StudioSynth is not implemented');
  const result=[];
  for(const name of ['grand','felt','honky','rhodes','wurli','dx','steel','nylon','jazz','pad','sine']){
   const c=new OfflineAudioContext(2,44100*3,44100),s=new StudioSynth(c);s.play(60,0.02,0.65,0.8,name);const b=await c.startRendering(),x=b.getChannelData(0);
   let sum=0,peak=0;for(let i=0;i<x.length;i++){if(!Number.isFinite(x[i]))throw Error(name+' produced invalid samples');sum+=x[i]*x[i];peak=Math.max(peak,Math.abs(x[i]));}
   if(s.voices.size!==0)throw Error(name+' leaked '+s.voices.size+' completed voice(s)');
   const rms=Math.sqrt(sum/x.length);if(rms<0.0002||peak>1.01)throw Error(name+' invalid output '+JSON.stringify({rms,peak}));result.push({name,rms:+rms.toFixed(4),peak:+peak.toFixed(3)});
  }
  const c=new OfflineAudioContext(2,44100,44100),s=new StudioSynth(c);s.play(60,0.5,0.4,0.8,'grand');s.stopAll();const b=await c.startRendering();if(b.getChannelData(0).some(v=>Math.abs(v)>0.0001))throw Error('Cancelled future notes still sound');
  return result;
 });console.log(JSON.stringify(results,null,2));console.log('PASS: 11 voices render audible finite bounded output; cancellation silences future notes');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
