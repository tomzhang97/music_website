const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium, webkit, devices } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const url = process.env.TEST_URL || 'file://' + path.resolve('index.html');
const engines = process.env.QA_ENGINE ? [process.env.QA_ENGINE] : ['chromium', 'webkit'];
const readPractice = page => page.evaluate(() => JSON.parse(localStorage.getItem('interval-01-v1')).practice);

async function verify(engine) {
  const browser = engine === 'webkit'
    ? await webkit.launch()
    : await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome' });
  try {
    const page = await browser.newPage(engine === 'webkit' ? devices['iPhone 13'] : { viewport: { width: 360, height: 800 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.spokenAnswers = [];
      window.quizNotes = [];
      window.speechPrimed = false;
      window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
      Object.defineProperty(window, 'speechSynthesis', { value: {
        cancel() {},
        speak(utterance) {
          if (utterance.volume === 0) {
            speechPrimed = navigator.userActivation?.isActive !== false;
            return;
          }
          if (!speechPrimed) return;
          spokenAnswers.push({ text: utterance.text, noteCount: quizNotes.length });
          window.finishSpeech = () => utterance.onend();
        }
      } });
    });
    await page.goto(url);
    await page.getByLabel('Root transposition').selectOption('fixed');
    await page.getByLabel('Speed', { exact: true }).fill('200');
    await page.getByLabel('Breath between cycles').fill('0.3');
    await page.getByLabel('SOUND ENGINE', { exact: true }).selectOption('sine');
    await page.locator('#interval').selectOption('2');
    await page.getByRole('button', { name: /Prepare infinite loop/ }).click();
    await page.getByRole('button', { name: /Play infinite loop/ }).waitFor();
    assert.equal((await readPractice(page)).lastLoop, null, 'Preparation must not become the last played loop');
    await page.getByRole('button', { name: /Play infinite loop/ }).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('interval-01-v1')).practice.lastLoop?.settings.interval === '2');
    await page.keyboard.press('Escape');

    for (const interval of ['1', '3', '4', '5', '6', '7']) {
      await page.locator('#interval').selectOption(interval);
      await page.locator('#once').click();
      await page.waitForFunction(value => JSON.parse(localStorage.getItem('interval-01-v1')).practice.history.passive[0]?.settings.interval === value, interval);
      await page.keyboard.press('Escape');
    }
    const passive = await readPractice(page);
    assert.deepEqual(passive.history.passive.map(item => item.settings.interval), ['7', '6', '5', '4', '3']);
    assert.equal(passive.lastLoop.settings.interval, '2');
    await page.locator('#interval').selectOption('11');
    await page.reload();
    assert.equal(await page.locator('#interval').inputValue(), '2');
    await page.getByText('Recent interval drills', { exact: true }).click();
    await page.locator('#interval-history button').first().click();
    assert.equal(await page.locator('#interval').inputValue(), '7');

    await page.getByRole('tab', { name: /Ear Quiz/ }).click();
    await page.getByText('Quiz presets and history', { exact: true }).click();
    await page.getByLabel('Preset name').fill('Two notes');
    await page.getByRole('button', { name: 'Save quiz preset' }).click();
    await page.getByRole('button', { name: 'Named + Others', exact: true }).click();
    await page.getByLabel('Announce answers').check();
    await page.getByLabel('Plays before answer').fill('3');
    await page.getByLabel('Preset name').fill('Named intervals');
    await page.getByRole('button', { name: 'Save quiz preset' }).click();
    await page.getByRole('button', { name: 'Star preset Named intervals' }).click();
    assert.equal(await page.locator('#quiz-presets li').first().locator('button').first().textContent(), 'Named intervals');

    await page.evaluate(() => {
      Math.random = () => 0.99;
      const original = StudioSynth.prototype.play;
      StudioSynth.prototype.play = function (midi) {
        if (this.ctx instanceof AudioContext) quizNotes.push(midi);
        return original.apply(this, arguments);
      };
    });
    await page.getByRole('button', { name: /Start hands-free quiz/ }).click();
    await page.waitForFunction(() => spokenAnswers.length === 1);
    assert.equal(await page.evaluate(() => speechPrimed), true);
    const announced = await page.evaluate(() => spokenAnswers[0]);
    assert.deepEqual(announced, { text: 'The answer is Major third ascending (Others).', noteCount: 6 });
    assert.match(await page.locator('#feedback').textContent(), /Major third ascending \(Others\)/);
    assert.equal(await page.locator('#score').textContent(), '0 / 0');
    await page.evaluate(() => finishSpeech());
    await page.waitForFunction(() => quizNotes.length === 8);
    await page.getByRole('button', { name: 'Stop hands-free quiz' }).click();
    await page.waitForTimeout(1300);
    assert.equal(await page.evaluate(() => quizNotes.length), 8);
    assert.equal(await page.evaluate(() => spokenAnswers.length), 1);

    await page.getByLabel('Announce answers').uncheck();
    await page.getByRole('button', { name: '2-note quiz', exact: true }).click();
    for (const [count, blind] of [['4', true], ['6', true], ['8', true], ['0', true], ['4', false], ['6', false]]) {
      await page.getByLabel('Answer choices').selectOption(count);
      await page.getByLabel('Hide answer notes until I answer').setChecked(blind);
      await page.evaluate(() => { quizNotes = []; });
      await page.locator('#new-question').click();
      await page.waitForFunction(() => quizNotes.length === 2);
    }
    const quizHistory = (await readPractice(page)).history.quiz;
    assert.equal(quizHistory.length, 5);
    assert.equal(quizHistory[0].settings['choice-count'], '6');
    assert.equal(quizHistory.at(-1).settings['choice-count'], '6');
    assert.equal(quizHistory.at(-1).settings.blind, true);
    const interval = await page.evaluate(() => Math.abs(quizNotes[1] - quizNotes[0]));
    await page.locator(`.choice[data-choice="${interval}"]`).click();
    assert.equal(await page.locator('#score').textContent(), '1 / 1');
    await page.getByRole('button', { name: 'Reset quiz score' }).click();
    assert.equal(await page.locator('#score').textContent(), '0 / 0');
    await page.reload();
    await page.getByRole('tab', { name: /Ear Quiz/ }).click();
    await page.getByText('Quiz presets and history', { exact: true }).click();
    assert.equal(await page.locator('#score').textContent(), '0 / 0');
    assert.equal(await page.getByRole('button', { name: 'Star preset Named intervals' }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#quiz-history li').count(), 5);
    await page.locator('#quiz-history button').last().click();
    assert.equal(await page.getByLabel('Hide answer notes until I answer').isChecked(), true);
    await page.getByRole('button', { name: 'Named intervals', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Named + Others', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.getByLabel('Announce answers').isChecked(), true);
    assert.equal(await page.getByLabel('Plays before answer').inputValue(), '3');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
    console.log('PASS', engine, 'hands-free announcements, stored presets, five recent setups, last loop restoration and persistent score reset');
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
