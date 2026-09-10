'use strict';

const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const SITE_URL = (process.env.SITE_URL || 'http://127.0.0.1:4173').replace(/\/+$/, '');

async function check(browser, width, delay, reducedMotion = 'no-preference') {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion });
  const page = await context.newPage();
  await page.route('https://**/*', (route) => route.abort());
  await page.route('**/archives/4/', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, delay));
    await route.continue();
  });
  await page.goto(`${SITE_URL}/blog/`);
  await page.waitForFunction(() => Boolean(window.siteSwup));
  await page.evaluate(() => {
    window.flashEvents = { animations: [], views: 0 };
    document.addEventListener('animationstart', (event) => {
      if (event.target.matches('.article-header h1')) {
        window.flashEvents.animations.push(event.animationName);
      }
    });
    document.addEventListener('site:page-view', () => { window.flashEvents.views += 1; });
    // No pointer hover: keep speculative prefetch out of the navigation timing test.
    document.querySelector('.post-row a[href="/archives/4/"]').click();
  });
  await page.waitForURL('**/archives/4/');
  // Swup updates the URL before the response arrives; wait for the actual render.
  await page.waitForFunction(() => window.flashEvents.views === 1);
  await page.waitForTimeout(1200);
  const result = await page.evaluate(() => ({
    ...window.flashEvents,
    documentLoads: performance.getEntriesByType('navigation').length,
    articleRequests: performance.getEntriesByType('resource').filter((entry) => entry.name.endsWith('/archives/4/')).length,
    staleDirection: document.documentElement.matches('.is-opening-article, .is-closing-article')
  }));
  console.log(JSON.stringify({ width, delay, reducedMotion, ...result }));
  assert.deepEqual(result.animations, reducedMotion === 'reduce' ? [] : ['article-content-pop']);
  assert.equal(result.views, 1);
  assert.equal(result.documentLoads, 1);
  assert.equal(result.articleRequests, 1);
  assert.equal(result.staleDirection, false);
  await page.goBack();
  await page.waitForURL('**/blog/');
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    window.flashEvents.animations = [];
    document.querySelector('.post-row a[href="/archives/4/"]').click();
  });
  await page.waitForURL('**/archives/4/');
  await page.waitForTimeout(1400);
  assert.deepEqual(await page.evaluate(() => window.flashEvents.animations), reducedMotion === 'reduce' ? [] : ['article-content-pop']);
  console.log('cached reopen: one entrance (or none for reduced motion)');
  await context.close();
}

(async () => {
  const browser = await chromium.launch({
    ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}),
    headless: true
  });
  try {
    for (const width of [1200, 375]) {
      for (const delay of [0, 700, 1500]) await check(browser, width, delay);
    }
    await check(browser, 375, 700, 'reduce');
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
