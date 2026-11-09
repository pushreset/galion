// Headless screenshot: node qa/shot.mjs [out.png] [seconds] [w] [h]
// Needs `python3 -m http.server 8765` at the sandbox root. Uses playwright-core from exp-diorama.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('../../exp-diorama/neon-needle/node_modules/playwright-core');
const [out = 'qa/shot.png', secs = '3', w = '1280', h = '720'] = process.argv.slice(2);
const CHROME = process.env.CHROME_PATH || `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(process.env.URL || 'http://127.0.0.1:8765/exp-pirate-galleons/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
if (process.env.SCRIPT) await page.evaluate(process.env.SCRIPT);
const info = await page.evaluate((s) => { window.__game.advance(+s); return window.__game.info(); }, secs);
await page.screenshot({ path: out });
console.log(JSON.stringify(info), errors.length ? 'ERRORS: ' + errors.join(' | ') : 'no errors');
await browser.close();
