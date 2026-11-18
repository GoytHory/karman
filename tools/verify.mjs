import puppeteer from 'puppeteer-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173';
await fetch('http://127.0.0.1:8095/api/auth/logout').catch(() => {});

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--hide-scrollbars', '--force-device-scale-factor=1'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.login-card');
await page.type('input:not([type=password])', 'artem');
await page.type('input[type=password]', 'secret123');
await page.click('.btn.primary.block');
await page.waitForSelector('.rail');

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.vcard');
await page.evaluate(() => {
  window.__blinks = 0;
  const root = document.querySelector('.view');
  new MutationObserver(() => {
    if (root.querySelector('.screen-loader')) window.__blinks += 1;
  }).observe(root, { childList: true, subtree: true });
});
await new Promise((r) => setTimeout(r, 9000));
console.log('blinks in 9s:', await page.evaluate(() => window.__blinks));
console.log('cards after 9s:', await page.$$eval('.vcard', (n) => n.length));

// mobile panel should be closed on load
await page.setViewport({ width: 414, height: 860, deviceScaleFactor: 1 });
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.vcard');
const closed = await page.evaluate(() => {
  const panel = document.querySelector('.panel');
  const rect = panel.getBoundingClientRect();
  return { right: Math.round(rect.right), open: panel.className, scrim: !!document.querySelector('.panel-scrim') };
});
console.log('mobile panel closed:', JSON.stringify(closed));
await page.click('.menu-btn');
await new Promise((r) => setTimeout(r, 400));
console.log('drawer open:', await page.evaluate(() => ({
  right: Math.round(document.querySelector('.panel').getBoundingClientRect().right),
  scrim: !!document.querySelector('.panel-scrim'),
})));
await page.screenshot({ path: 'G:\\SelfSpot\\Karman\\docs\\screens\\debug-mobile.jpeg', type: 'jpeg', quality: 85 });

await browser.close();
