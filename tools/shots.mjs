import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173';
const OUT = 'G:\\SelfSpot\\Karman\\docs\\screens';
mkdirSync(OUT, { recursive: true });

await fetch('http://127.0.0.1:8095/api/auth/logout').catch(() => {});

const shots = [
  ['01-all', '/', 1440],
  ['02-my-playlists', '/my', 1440],
  ['03-playlist', '/playlists/4', 1440],
  ['04-video', '/videos/101', 1440],
  ['05-video-deleted', '/videos/113', 1440],
  ['06-history', '/history', 1440],
  ['07-settings', '/settings', 1440],
  ['13-saved', '/saved', 1440],
  ['14-queue', '/queue', 1440],
  ['08-mobile-all', '/', 414],
  ['09-mobile-playlists', '/my', 414],
];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--hide-scrollbars', '--force-device-scale-factor=1', '--font-render-hinting=none'],
});

async function newPage(width) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: width > 600 ? 900 : 860, deviceScaleFactor: 1.5 });
  return page;
}

const settle = async (page) => {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.evaluate(() => {
    document.querySelectorAll('img').forEach((image) => { image.loading = 'eager'; });
  });
  await page.evaluate(() => Promise.race([
    Promise.all(Array.from(document.images).map((image) => (
      image.complete && image.naturalWidth > 0
        ? Promise.resolve()
        : new Promise((resolve) => {
          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', resolve, { once: true });
        })
    ))),
    new Promise((res) => setTimeout(res, 4000)),
  ])).catch(() => {});
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
};

// login screenshot
{
  const page = await newPage(1440);
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.login-card', { timeout: 20000 });
  await settle(page);
  await page.screenshot({ path: `${OUT}\\00-login.jpeg`, type: 'jpeg', quality: 88, fullPage: true });
  await page.close();
}

const page = await newPage(1440);
const pageLog = [];
page.on('console', (m) => { if (m.type() === 'error') pageLog.push(m.text()); });
page.on('pageerror', (e) => pageLog.push('pageerror: ' + e.message));
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.login-card', { timeout: 20000 });
await page.type('input:not([type=password])', 'artem', { delay: 10 });
await page.type('input[type=password]', 'secret123', { delay: 10 });
await page.click('.btn.primary.block');
await page.waitForSelector('.sidebar', { timeout: 20000 });
await page.evaluate(() => window.localStorage.setItem('karman.sidebar', '1'));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('.sidebar.open', { timeout: 20000 });

const results = [];
const shoot = async (name, opts = {}) => {
  console.log('shoot', name);
  await settle(page);
  const info = await page.evaluate(() => ({
    overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
    sidebarWidth: document.querySelector('.sidebar')?.getBoundingClientRect().width ?? 0,
  }));
  await page.screenshot({ path: `${OUT}\\${name}.jpeg`, type: 'jpeg', quality: 88, fullPage: true, ...opts });
  results.push({ name, ...info });
};

for (const [name, path, width] of shots) {
  console.log('go', name);
  await page.setViewport({ width, height: width > 600 ? 900 : 860, deviceScaleFactor: 1.5 });
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.sidebar', { timeout: 20000 });
  await page.waitForSelector('.page', { timeout: 20000 });
  await page.waitForFunction(() => !document.body.innerText.includes('Загружаем'), { timeout: 20000 }).catch(() => {});
  await shoot(name, { fullPage: width > 600 });
}

// settings picker: choose poll interval and a value
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });
await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.picker', { timeout: 20000 });
await page.click('.option-row:nth-child(3)');
await page.waitForFunction(() => document.body.innerText.includes('Проверка новых плейлистов'), { timeout: 5000 });
const choices = await page.$$('.choice');
if (choices[3]) await choices[3].click();
await new Promise((r) => setTimeout(r, 350));
await shoot('10-settings-poll');

// tech editor
await page.goto(`${BASE}/my`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.head-actions .icon-btn', { timeout: 20000 });
await page.waitForFunction(() => !document.body.innerText.includes('Загружаем'), { timeout: 20000 }).catch(() => {});
await page.click('.head-actions .icon-btn');
await page.waitForSelector('.tech', { timeout: 20000 });
await page.waitForSelector('.tech-item', { timeout: 20000 });
await new Promise((r) => setTimeout(r, 300));
await shoot('16-my-tech');

// collapsed sidebar
await page.evaluate(() => window.localStorage.setItem('karman.sidebar', '0'));
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.vcard', { timeout: 20000 });
await page.waitForSelector('.sidebar', { timeout: 10000 });
await new Promise((r) => setTimeout(r, 320));
await shoot('11-sidebar-collapsed');

// mobile drawer open
await page.setViewport({ width: 414, height: 860, deviceScaleFactor: 1.5 });
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.vcard', { timeout: 20000 });
await page.click('.menu-btn');
await page.waitForSelector('.sidebar.open', { timeout: 10000 });
await new Promise((r) => setTimeout(r, 320));
await shoot('12-mobile-drawer', { fullPage: false });

await page.close();

// console errors across pages
const check = await browser.newPage();
const messages = [];
check.on('console', (m) => { if (m.type() === 'error') messages.push(m.text()); });
check.on('pageerror', (e) => messages.push(String(e)));
await check.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, 800));
await check.close();

await browser.close();
console.log(JSON.stringify({ results, pageLog, messages }, null, 2));
