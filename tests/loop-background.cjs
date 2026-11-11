const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const url = process.env.TEST_URL || 'file://' + path.resolve('index.html');

(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome' });
  try {
    const page = await browser.newPage();
    await page.goto(url);
    await page.getByLabel('Root transposition').selectOption('fixed');
    await page.getByLabel('Speed', { exact: true }).fill('200');
    await page.getByLabel('Breath between cycles').fill('0.3');
    await page.getByLabel('SOUND ENGINE', { exact: true }).selectOption('sine');

    await page.locator('#loop').click();
    await page.waitForFunction(() => document.querySelector('#background-audio').src.startsWith('blob:'), null, { timeout: 10000 });
    assert.equal(await page.locator('#background-audio').evaluate(audio => audio.paused), true);
    assert.match(await page.locator('#loop-label').textContent(), /Play infinite loop/);

    await page.locator('#loop').click();
    await page.waitForFunction(() => {
      const audio = document.querySelector('#background-audio');
      return !audio.paused && audio.currentTime > 0.2;
    });
    await page.evaluate(() => {
      requestAnimationFrame = () => 0;
      window.dispatchEvent(new PageTransitionEvent('pagehide'));
    });
    const before = await page.locator('#background-audio').evaluate(audio => audio.currentTime);
    const duration = await page.locator('#background-audio').evaluate(audio => audio.duration);
    assert.ok(duration > 0);
    await page.waitForFunction(({ before, duration }) => {
      const audio = document.querySelector('#background-audio');
      const advance = (audio.currentTime - before + duration) % duration;
      return !audio.paused && advance > Math.min(0.25, duration / 4);
    }, { before, duration }, { polling: 50, timeout: 5000 });
    assert.equal(await page.locator('#background-audio').evaluate(audio => audio.paused), false);

    await page.locator('#loop').click();
    assert.equal(await page.locator('#background-audio').evaluate(audio => audio.paused), true);
    assert.ok((await page.locator('#background-audio').getAttribute('src'))?.startsWith('blob:'));
    await page.locator('#loop').click();
    await page.waitForFunction(() => !document.querySelector('#background-audio').paused);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#background-audio').getAttribute('src'), null);
    console.log('PASS main infinite loop uses native media across pagehide and can pause, resume and stop');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
