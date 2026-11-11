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
    const page = await browser.newPage(engine === 'webkit' ? devices['iPhone 13'] : {});
    await page.goto(url);
    await page.getByLabel('Root transposition').selectOption('fixed');
    await page.getByLabel('Speed', { exact: true }).fill('200');
    await page.getByLabel('Breath between cycles').fill('0.3');
    await page.getByLabel('SOUND ENGINE', { exact: true }).selectOption('sine');
    await page.evaluate(() => {
      window.notes = [];
      const original = StudioSynth.prototype.play;
      StudioSynth.prototype.play = function (midi, when) {
        if (this.ctx instanceof AudioContext) notes.push({ midi, when });
        return original.apply(this, arguments);
      };
    });
    await page.locator('#live-loop').click();
    await page.waitForFunction(() => notes.length === 2);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      requestAnimationFrame = () => 0;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForFunction(() => notes.length >= 6, null, { polling: 50, timeout: 6000 });
    const scheduled = await page.evaluate(() => notes.slice(0, 6));
    assert.deepEqual(scheduled.map(note => note.midi), [60, 67, 60, 67, 60, 67]);
    assert.ok(scheduled[4].when > scheduled[2].when && scheduled[2].when > scheduled[0].when);
    await page.keyboard.press('Escape');
    const stoppedCount = await page.evaluate(() => notes.length);
    await page.waitForTimeout(1300);
    assert.equal(await page.evaluate(() => notes.length), stoppedCount);
    assert.equal(await page.locator('#live-loop').textContent(), 'Start live loop');
    console.log('PASS', engine, 'interval cycles continue without animation frames and Stop cancels the next cycle');
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
