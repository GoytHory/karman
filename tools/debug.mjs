import puppeteer from 'puppeteer-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173';
await fetch('http://127.0.0.1:8095/api/auth/logout').catch(() => {});
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--hide-scrollbars'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.login-card');
await page.type('input:not([type=password])', 'artem');
await page.type('input[type=password]', 'secret123');
await page.click('.btn.primary.block');
await page.waitForSelector('.rail');
await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.picker');
await new Promise((r) => setTimeout(r, 900));
console.log(JSON.stringify(await page.evaluate(() => {
  const box = (el) => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top), height: Math.round(r.height) }; };
  return {
    picker: box(document.querySelector('.picker')),
    main: box(document.querySelector('.picker-main')),
    list: box(document.querySelector('.option-list')),
    rows: Array.from(document.querySelectorAll('.option-row')).map(box),
    side: box(document.querySelector('.picker-side')),
    col: box(document.querySelector('.choice-col')),
  };
}), null, 2));
await browser.close();
