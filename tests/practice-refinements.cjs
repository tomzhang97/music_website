const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium, webkit, devices } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const url = process.env.TEST_URL || 'file://' + path.resolve('index.html');
const engines = process.env.QA_ENGINE ? [process.env.QA_ENGINE] : ['chromium', 'webkit'];

async function verify(engine) {
  const browser = engine === 'webkit'
    ? await webkit.launch()
    : await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome' });
  try {
    const page = await browser.newPage(engine === 'webkit'
      ? devices['iPhone 13'] : { viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(8000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.quizNotes = [];
      window.spokenAnswers = [];
      window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
      Object.defineProperty(window, 'speechSynthesis', { value: {
        cancel() {},
        speak(utterance) {
          if (utterance.text === 'Ready') return;
          spokenAnswers.push({ text: utterance.text, volume: utterance.volume, notes: quizNotes.slice() });
          window.finishSpeech = () => utterance.onend();
        }
      } });
    });
    await page.goto(url);
    await page.evaluate(() => {
      const original = StudioSynth.prototype.play;
      StudioSynth.prototype.play = function (midi) {
        if (this.ctx instanceof AudioContext) quizNotes.push(midi);
        return original.apply(this, arguments);
      };
    });
    await page.getByLabel('Root transposition').selectOption('fixed');
    await page.getByLabel('Speed', { exact: true }).fill('200');
    await page.getByLabel('Breath between cycles').fill('0.3');
    await page.getByLabel('SOUND ENGINE', { exact: true }).selectOption('sine');
    await page.getByRole('button', { name: /Start infinite loop/ }).click();
    await page.waitForFunction(() => quizNotes.length >= 4);
    assert.equal(await page.locator('#background-audio').getAttribute('src'), null);
    await page.getByRole('button', { name: /Stop infinite loop/ }).click();

    await page.getByLabel('Keep playing in background').check();
    await page.getByRole('button', { name: /Prepare infinite loop/ }).click();
    await page.getByRole('button', { name: /Play infinite loop/ }).waitFor();
    await page.getByRole('button', { name: /Play infinite loop/ }).click();
    await page.waitForFunction(() => !document.querySelector('#background-audio').paused);
    await page.getByLabel('Keep playing in background').uncheck();
    assert.equal(await page.locator('#background-audio').getAttribute('src'), null);
    assert.match(await page.locator('#loop-label').textContent(), /Start infinite loop/);

    await page.getByRole('tab', { name: /Ear Quiz/ }).click();
    await page.getByLabel('Hide answer notes until I answer').uncheck();
    await page.getByRole('button', { name: 'Step & small leaps', exact: true }).click();
    await page.locator('#quiz-down').uncheck();
    await page.getByLabel('Answer choices', { exact: true }).selectOption('0');
    const heard = [];
    for (let question = 0; question < 15; question++) {
      await page.evaluate(() => { quizNotes = []; });
      await page.locator('#new-question').click();
      await page.waitForFunction(() => quizNotes.length === 2);
      const notes = await page.evaluate(() => quizNotes);
      heard.push(Math.abs(notes[1] - notes[0]));
      const choices = await page.locator('#quiz-choices .choice').evaluateAll(buttons => buttons.map(button => Number(button.dataset.choice)));
      assert.deepEqual(choices, [1, 2, 3, 4, 5]);
    }
    for (let start = 0; start < heard.length; start += 5) {
      assert.deepEqual(heard.slice(start, start + 5).sort((a, b) => a - b), [1, 2, 3, 4, 5]);
      if (start) assert.notEqual(heard[start], heard[start - 1]);
    }
    const target = heard.at(-1);
    await page.locator(`.choice[data-choice="${target}"]`).click();
    const answer = page.locator('#quiz-answer-name');
    assert.match(await answer.textContent(), /ascending/);
    assert.ok(await answer.evaluate(element => parseFloat(getComputedStyle(element).fontSize) >= 22));

    await page.locator('#quiz-down').check();
    await page.locator('#quiz-harmonic').check();
    const directionsByInterval = {};
    for (let question = 0; question < 30; question++) {
      await page.evaluate(() => { quizNotes = []; });
      await page.locator('#new-question').click();
      await page.waitForFunction(() => quizNotes.length === 2);
      const notes = await page.evaluate(() => quizNotes);
      const interval = Math.abs(notes[1] - notes[0]);
      const instruction = await page.locator('#quiz-instruction').textContent();
      const direction = instruction.includes('together') ? 'harmonic' : notes[1] < notes[0] ? 'down' : 'up';
      directionsByInterval[interval] ||= [];
      directionsByInterval[interval].push(direction);
    }
    for (const directions of Object.values(directionsByInterval)) {
      assert.deepEqual(directions.sort(), ['down', 'down', 'harmonic', 'harmonic', 'up', 'up']);
    }

    await page.getByRole('button', { name: '3-note cell', exact: true }).click();
    const steps = [[], []];
    for (let question = 0; question < 10; question++) {
      await page.evaluate(() => { quizNotes = []; });
      await page.locator('#new-question').click();
      await page.waitForFunction(() => quizNotes.length === 3);
      const notes = await page.evaluate(() => quizNotes);
      steps.forEach((values, index) => values.push(Math.abs(notes[index + 1] - notes[index])));
    }
    for (const values of steps) assert.deepEqual(values.sort((a, b) => a - b), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);

    await page.getByRole('button', { name: 'Named + Others', exact: true }).click();
    const categories = { 1: 0, 2: 0, others: 0 };
    const othersHeard = [];
    for (let question = 0; question < 9; question++) {
      await page.evaluate(() => { quizNotes = []; });
      await page.locator('#new-question').click();
      await page.waitForFunction(() => quizNotes.length === 2);
      const notes = await page.evaluate(() => quizNotes);
      const interval = notes[1] - notes[0];
      if (interval === 1 || interval === 2) categories[interval]++;
      else { categories.others++; othersHeard.push(interval); }
      const grouped = await page.locator('#quiz-choices .choice').evaluateAll(buttons => buttons.map(button => button.dataset.choice));
      assert.deepEqual(grouped, ['1:up', '2:up', 'others']);
    }
    assert.deepEqual(categories, { 1: 3, 2: 3, others: 3 });
    assert.deepEqual(othersHeard.slice(0, 2).sort((a, b) => a - b), [4, 6]);

    await page.getByLabel('Announce answers').check();
    await page.getByLabel('Plays before answer').fill('1');
    await page.getByLabel('Master volume', { exact: true }).fill('25');
    await page.getByLabel(/^Answer voice balance/).fill('40');
    await page.evaluate(() => { quizNotes = []; });
    await page.locator('#new-question').click();
    await page.waitForFunction(() => spokenAnswers.length === 1);
    const announcement = await page.evaluate(() => spokenAnswers[0]);
    assert.ok(Math.abs(announcement.volume - 0.1) < 1e-6);
    assert.equal(announcement.notes.length, 2);
    assert.ok((await answer.textContent()).length > 8);
    await page.screenshot({ path: process.env.QA_DIR ? path.join(process.env.QA_DIR, engine + '-refinements.png') : '/tmp/' + engine + '-refinements.png', fullPage: true });
    await page.getByRole('button', { name: 'Stop hands-free quiz' }).click();
    await page.getByLabel('Master volume', { exact: true }).fill('0');
    await page.locator('#new-question').click();
    await page.waitForFunction(() => spokenAnswers.length === 2);
    assert.equal(await page.evaluate(() => spokenAnswers[1].volume), 0);
    await page.getByRole('button', { name: 'Stop hands-free quiz' }).click();
    await page.reload();
    await page.getByRole('tab', { name: /Ear Quiz/ }).click();
    assert.equal(await page.getByLabel(/^Answer voice balance/).inputValue(), '40');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
    console.log('PASS', engine, 'direct and background loops, balanced quiz coverage, ascending choices, prominent answers and shared speech volume');
  } finally {
    await browser.close();
  }
}

(async () => {
  for (const engine of engines) await verify(engine);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
