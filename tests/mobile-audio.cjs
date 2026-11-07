/* Audio API boundary regressions, backed by real AudioContexts. */
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'chrome'});let failed=0;
try{const p=await b.newPage();await p.setContent('<button>Activate audio</button>');await p.getByRole('button').click();await p.addScriptTag({content:fs.readFileSync('src/theory.js','utf8')});await p.addScriptTag({content:fs.readFileSync('src/synth.js','utf8')});
for(const [name,fn] of [
 ['media playback session avoids iPhone ringer-mute routing',async()=>{const state=await p.evaluate(async()=>{const session={type:'ambient'};Object.defineProperty(navigator,'audioSession',{configurable:true,value:session});const c=new AudioContext(),s=new StudioSynth(c);await s.unlock();const result=session.type;await c.close();return result;});assert.equal(state,'playback');}],
 ['interrupted contexts resume instead of being silently treated as ready',async()=>{const result=await p.evaluate(async()=>{const c=new AudioContext(),s=new StudioSynth(c);await c.suspend();const getter=Object.getOwnPropertyDescriptor(BaseAudioContext.prototype,'state').get;Object.defineProperty(c,'state',{get(){const native=getter.call(c);return native==='suspended'?'interrupted':native;}});await s.unlock();const state=c.state;await c.close();return state;});assert.equal(result,'running');}],
 ['closed audio contexts report a recoverable error',async()=>{const message=await p.evaluate(async()=>{const c=new AudioContext(),s=new StudioSynth(c);await c.close();try{await s.unlock();return '';}catch(e){return e.message;}});assert.match(message,/closed|reload|reconnect/i);}]
]){try{await fn();console.log('PASS',name);}catch(e){failed++;console.error('FAIL',name,e.message);}}
}finally{await b.close();if(failed)process.exitCode=1;}})().catch(e=>{console.error(e);process.exitCode=1;});
