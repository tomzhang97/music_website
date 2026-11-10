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
      ? devices['iPhone 13']
      : { viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true });
    page.setDefaultTimeout(8000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.getByRole('tab', { name: /Ear Quiz/ }).tap();
    await page.getByRole('button', { name: 'Named + Others', exact: true }).tap();
    assert.equal(await page.getByRole('button', { name: 'Remove Tritone ascending from Others' }).count(), 1);
    await page.getByRole('button', { name: 'Remove Major third ascending from Others' }).tap();
    await page.getByLabel('Sound interval', { exact: true }).selectOption('4');
    await page.getByLabel('Sound direction', { exact: true }).selectOption('down');
    await page.getByRole('button', { name: 'Add to Others', exact: true }).tap();
    await page.getByRole('button', { name: 'Add named answer', exact: true }).tap();
    assert.match(await page.locator('#toast').textContent(), /already/);
    await page.evaluate(() => {
      Math.random = () => 0.99;
      window.quizNotes = [];
      const play = StudioSynth.prototype.play;
      StudioSynth.prototype.play = function (midi) {
        quizNotes.push(midi);
        return play.apply(this, arguments);
      };
    });
    await page.locator('#new-question').tap();
    const choices = page.locator('#quiz-choices .choice');
    const keys = await choices.evaluateAll(buttons => buttons.map(button => button.dataset.choice));
    assert.deepEqual(keys.sort(), ['1:up', '2:up', 'others']);
    await page.waitForFunction(() => quizNotes.length === 2);
    const first = await page.evaluate(() => quizNotes);
    assert.equal(first[1] - first[0], -4);
    assert.equal(await page.locator('.piano-key.context').count(), 1);
    await page.locator('.choice[data-choice="others"]').tap();
    assert.equal(await page.locator('#score').textContent(), '1 / 1');
    assert.match(await page.locator('#feedback').textContent(), /Major third descending \(Others\)/);
    assert.match(await page.locator('#interval-progress').textContent(), /M3100% · 1\/1/);
    await page.evaluate(() => { quizNotes = []; });
    await page.locator('.choice[data-choice="2:up"]').tap();
    await page.waitForFunction(() => quizNotes.length === 2);
    assert.deepEqual(await page.evaluate(() => quizNotes), [first[0], first[0] + 2]);
    assert.equal(await page.locator('#score').textContent(), '1 / 1');

    await page.getByLabel('Others source').selectOption('random');
    const selected = page.locator('#pool [aria-pressed="true"]:not([data-pool-note="2"])');
    while (await selected.count()) await selected.first().tap();
    await page.locator('#quiz-down').uncheck();
    await page.locator('#new-question').tap();
    assert.match(await page.locator('#toast').textContent(), /no sounds.*Others/i);
    await page.locator('#quiz-down').check();
    await page.evaluate(() => { quizNotes = []; });
    await page.locator('#new-question').tap();
    await page.waitForFunction(() => quizNotes.length === 2);
    const second = await page.evaluate(() => quizNotes);
    assert.equal(second[1] - second[0], -2, 'Random excludes the named ascending sound, not the whole interval');
    await page.locator('.choice[data-choice="1:up"]').tap();
    assert.equal(await page.locator('#score').textContent(), '1 / 2');
    assert.match(await page.locator('#feedback').textContent(), /Major second descending \(Others\)/);

    await page.evaluate(() => { Math.random = () => 0; quizNotes = []; });
    await page.locator('#new-question').tap();
    await page.waitForFunction(() => quizNotes.length === 2);
    const third = await page.evaluate(() => quizNotes);
    assert.equal(third[1] - third[0], 2);
    const namedIndex = await choices.evaluateAll(buttons => buttons.findIndex(button => button.dataset.choice === '2:up'));
    await page.keyboard.press(String(namedIndex + 1));
    assert.equal(await page.locator('#score').textContent(), '2 / 3');
    assert.match(await page.locator('#feedback').textContent(), /The sound was Major second ascending\./);

    await page.reload();
    await page.getByRole('tab', { name: /Ear Quiz/ }).tap();
    assert.equal(await page.getByRole('button', { name: 'Named + Others', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.getByLabel('Others source').inputValue(), 'random');
    assert.equal(await page.locator('#score').textContent(), '2 / 3');
    await page.getByLabel('Others source').selectOption('custom');
    assert.equal(await page.getByRole('button', { name: 'Remove Major third descending from Others' }).count(), 1);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
    console.log('PASS', engine, 'grouped quiz editing, exact directions, Others scoring, random exclusion, comparison and persistence');
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
