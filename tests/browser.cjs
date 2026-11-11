const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.TEST_URL||'http://127.0.0.1:4173';
const screenshots=path.resolve(process.env.QA_DIR||'test-results');fs.mkdirSync(screenshots,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
 let passed=0;
 async function scenario(name,fn,options={}){if(process.env.TEST_FILTER&&!name.includes(process.env.TEST_FILTER))return;const ctx=await browser.newContext({viewport:{width:1440,height:1000},...options});const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await fn(p,ctx);assert.deepEqual(errors,[]);console.log('PASS:',name);passed++;}catch(e){await p.screenshot({path:path.join(screenshots,'failure.png'),fullPage:true});throw e;}finally{await ctx.close();}}
 try{
 await scenario('HTTP studio, instruments, loop cadence, stop and one-shot',async p=>{
  const requests=[];p.on('request',r=>requests.push(r.url()));await p.goto(base);assert.equal(await p.locator('[data-midi].piano-key').count(),37);assert.equal(await p.locator('.fret').count(),96);
  await p.getByLabel('Root transposition').selectOption('fixed');await p.getByLabel('Root / starting note').selectOption('60');await p.getByLabel('Speed',{exact:true}).fill('200');await p.getByLabel('Breath between cycles').fill('0.3');
  await p.getByRole('button',{name:/Start live loop/}).click();await p.waitForFunction(()=>Number(document.getElementById('cycle-count').textContent)>=2,{},{timeout:6000});
  await p.keyboard.press('Escape');assert.match(await p.locator('#loop-label').textContent(),/Prepare/);assert.equal(await p.locator('.piano-key.sounding').count(),0);
  await p.getByRole('button',{name:/Play cycle once/}).click();await p.waitForFunction(()=>document.querySelector('.piano-key.sounding'));await p.waitForFunction(()=>document.getElementById('transport-status').textContent==='STANDBY');
  await p.getByRole('button',{name:/Open help/}).click();assert.equal(await p.locator('dialog').isVisible(),true);await p.getByRole('button',{name:'Let’s listen'}).click();
  assert.ok(requests.every(u=>u.startsWith(base)||u.startsWith('data:')),'External runtime request');await p.screenshot({path:path.join(screenshots,'desktop.png'),fullPage:true});
 });
 await scenario('3-note cell construction, root reference and instant drill',async p=>{
  await p.goto(base);await p.getByRole('button',{name:/3-note M2/}).click();assert.equal(await p.locator('#interval-title').textContent(),'M2 ↓ + m7 ↑');assert.equal(await p.locator('.note-chip').count(),3);await p.keyboard.press('Escape');
  await p.getByLabel('Root transposition').selectOption('fixed');await p.getByLabel('Root / starting note').selectOption('60');await p.getByLabel('Step reference').selectOption('root');
  assert.equal(await p.locator('#interval-title').textContent(),'M2 ↓ + P8 ↑');assert.match(await p.locator('#note-sequence').textContent(),/C4.*B♭3.*B♭4/);
  await p.getByLabel('Step 2 rule').selectOption('mirror');assert.match(await p.locator('#note-sequence').textContent(),/C4.*B♭3.*D4/);
 });
 await scenario('quiz blind state, wrong answer, one-time score, same-root comparisons and handoff',async p=>{
  await p.addInitScript(()=>{Math.random=()=>0.25;});await p.goto(base);await p.getByRole('button',{name:'Core pillars',exact:true}).click();for(const st of [4,5,12])await p.locator(`[data-pool-note="${st}"]`).click();await p.locator('[data-pool-note="2"]').click();
  await p.getByRole('tab',{name:/Ear Quiz/}).click();await p.getByRole('button',{name:/Start ear quiz/}).click();
  assert.equal(await p.locator('.piano-key.context').count(),1);assert.match(await p.locator('#fingering-path').textContent(),/Answer notes hidden/);await p.getByRole('button',{name:/M2Major second/}).click();
  assert.equal(await p.locator('#score').textContent(),'0 / 1');assert.equal(await p.locator('#feedback').isVisible(),true);assert.equal(await p.locator('.piano-key.context').count(),2);
  await p.evaluate(()=>{globalThis.played=[];const original=StudioSynth.prototype.play;StudioSynth.prototype.play=function(...a){played.push(a[0]);return original.apply(this,a);};});
  const rootName=(await p.locator('.feedback-notes').textContent()).split(' → ')[0];await p.locator('.choice[data-choice="7"]').click();const notes=await p.evaluate(()=>played);assert.equal(notes[1]-notes[0],7);assert.equal(await p.evaluate(m=>IntervalCore.noteName(m),notes[0]),rootName);assert.equal(await p.locator('#score').textContent(),'0 / 1');
  await p.locator('#handoff').click();assert.equal(await p.getByRole('tab',{name:/Passive Listening/}).getAttribute('aria-selected'),'true');assert.match(await p.locator('#loop-label').textContent(),/Stop/);assert.equal(await p.getByLabel('Root transposition').inputValue(),'fixed');assert.equal(await p.getByLabel('Root / starting note').inputValue(),String(notes[0]));await p.keyboard.press('Escape');
 });
 await scenario('3-note quiz keyboard answers, replay and statistics persistence',async p=>{
  await p.goto(base);await p.getByRole('button',{name:'Core pillars',exact:true}).click();for(const st of [4,5,12])await p.locator(`[data-pool-note="${st}"]`).click();await p.getByRole('tab',{name:/Ear Quiz/}).click();await p.getByRole('button',{name:'3-note cell',exact:true}).click();await p.getByRole('button',{name:/Start ear quiz/}).click();
  assert.equal(await p.locator('.choice-column').count(),2);await p.keyboard.press('1');assert.equal(await p.locator('#score').textContent(),'0 / 0');assert.equal(await p.locator('.piano-key.context').count(),1);await p.keyboard.press('1');assert.equal(await p.locator('#score').textContent(),'1 / 1');assert.equal(await p.locator('#streak').textContent(),'1');assert.equal(await p.locator('#accuracy').textContent(),'100%');await p.keyboard.press('r');await p.waitForFunction(()=>document.querySelector('.piano-key.sounding'));await p.screenshot({path:path.join(screenshots,'quiz.png'),fullPage:true});
  await p.reload();await p.getByRole('tab',{name:/Ear Quiz/}).click();assert.equal(await p.locator('#score').textContent(),'1 / 1');assert.equal(await p.locator('#best').textContent(),'1');
 });
 await scenario('360px layout, high-note auto-centering, gestures and focused controls',async p=>{
  await p.goto(base);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=360));await p.getByLabel('Root transposition').selectOption('fixed');await p.getByLabel('Root / starting note').selectOption('72');await p.getByLabel('Speed',{exact:true}).fill('200');await p.getByRole('button',{name:/Play cycle once/}).click();await p.waitForFunction(()=>document.getElementById('piano-scroll').scrollLeft>300);await p.waitForFunction(()=>document.getElementById('guitar-scroll').scrollLeft>300);await p.keyboard.press('Escape');
  const box=await p.locator('#piano-scroll').boundingBox();await p.mouse.move(box.x+100,box.y+110);await p.mouse.down();await p.mouse.move(box.x+30,box.y+110,{steps:5});await p.mouse.up();assert.equal(await p.locator('.piano-key.sounding').count(),0);
  await p.locator('#bpm').focus();await p.keyboard.press('Space');assert.match(await p.locator('#loop-label').textContent(),/Prepare/);await p.locator('#workspace').click({position:{x:1,y:1}});await p.screenshot({path:path.join(screenshots,'mobile.png'),fullPage:true});
 },{viewport:{width:360,height:800},isMobile:true,hasTouch:true});
 await scenario('fret auditions retain the clicked string and fret; touch controls are at least 44px tall',async p=>{
  await p.goto(base);await p.getByRole('button',{name:'String 6, fret 12, E3',exact:true}).click();await p.waitForFunction(()=>document.getElementById('guitar-info').textContent.includes('String 6 · Fret 12'));
  await p.waitForFunction(()=>document.querySelector('.fret.sounding[data-string="5"][data-fret="12"]'));
  await p.keyboard.press('Escape');const rect=await p.locator('#piano-scroll').boundingBox();await p.mouse.move(rect.x+160,rect.y+230);await p.mouse.down();await p.mouse.move(rect.x+70,rect.y+230,{steps:5});await p.mouse.up();
  await p.getByRole('button',{name:'C3, MIDI 48, 130.81 hertz',exact:true}).focus();await p.keyboard.press('Enter');await p.waitForFunction(()=>document.querySelector('.piano-key.sounding[data-midi="48"]'),{},{timeout:1500});
  const heights=await p.evaluate(()=>['#view','#help-button','.fret','.segmented button','.pool-presets button','#volume'].map(s=>({selector:s,height:document.querySelector(s).getBoundingClientRect().height})));
  assert.ok(heights.every(x=>x.height>=44),JSON.stringify(heights));
 });
 await scenario('auto-advance respects its toggle and direction/pool selections stay nonempty',async p=>{
  await p.goto(base);await p.getByRole('button',{name:'Core pillars',exact:true}).click();for(const st of [4,5,12])await p.locator(`[data-pool-note="${st}"]`).click();await p.locator('[data-pool-note="7"]').click();assert.equal(await p.locator('[data-pool-note="7"]').getAttribute('aria-pressed'),'true');
  await p.getByRole('tab',{name:/Ear Quiz/}).click();await p.getByLabel('Descending ↓',{exact:true}).uncheck();await p.getByLabel('Ascending ↑',{exact:true}).click();assert.equal(await p.getByLabel('Ascending ↑',{exact:true}).isChecked(),true);
  await p.getByLabel('Auto-advance on correct').check();await p.getByRole('button',{name:/Start ear quiz/}).click();await p.locator('.choice').click();await p.waitForFunction(()=>document.getElementById('question-label').textContent.startsWith('QUESTION 02'),{},{timeout:4000});
  await p.locator('.choice').click();await p.getByLabel('Auto-advance on correct').uncheck();await p.evaluate(()=>new Promise(resolve=>setTimeout(resolve,2200)));assert.match(await p.locator('#question-label').textContent(),/^QUESTION 02/);assert.equal(await p.locator('#score').textContent(),'2 / 2');
 });
 await scenario('file:// single-file operation without network',async p=>{
  const requests=[];p.on('request',r=>requests.push(r.url()));await p.goto('file://'+path.resolve('index.html'));await p.getByRole('button',{name:/Play cycle once/}).click();await p.waitForFunction(()=>document.querySelector('.piano-key.sounding'));assert.ok(requests.every(u=>u.startsWith('file:')||u.startsWith('data:')));
 });
 await scenario('strict opaque-origin sandbox without localStorage',async p=>{
  const html=fs.readFileSync('index.html','utf8');await p.setContent('<iframe id="sandbox" sandbox="allow-scripts" style="width:100%;height:900px"></iframe>');await p.locator('iframe').evaluate((el,html)=>el.srcdoc=html,html);const frame=p.frameLocator('#sandbox');await frame.getByRole('heading',{name:'Hear the space between.'}).waitFor();
  const f=p.frames()[1];assert.equal(await f.evaluate(()=>location.origin),'null');assert.equal(await f.evaluate(()=>{try{localStorage.getItem('x');return false;}catch(_){return true;}}),true);await frame.getByRole('button',{name:/Play cycle once/}).click();await f.waitForFunction(()=>document.querySelector('.piano-key.sounding'));await frame.getByRole('tab',{name:/Ear Quiz/}).click();await frame.getByRole('button',{name:/Start ear quiz/}).click();assert.ok(await frame.locator('.choice').count()>=1);
 });
 console.log(`PASS: ${passed} browser scenarios`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
