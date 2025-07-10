import { chromium, Page } from 'playwright';
import fs from 'fs';
import path from 'path';

// Constants
const BASE_URL = 'https://books.toscrape.com';
const screenshotDir = './screenshots';
const visited = new Set<string>();

// Ensure screenshot folder exists
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir);
}

// Normalize URLs to remove trailing slashes, anchors, etc.
function normalize(url: string) {
  try {
    const u = new URL(url);
    return u.origin + u.pathname.replace(/\/$/, '');
  } catch {
    return url;
  }
}

// Take screenshot of a page and save it
async function screenshotPage(page: Page, url: string) {
  const cleanName = normalize(url).replace(/[^a-zA-Z0-9]/g, '_').slice(0, 80);
  const filePath = path.join(screenshotDir, `${cleanName}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`📸 Screenshot saved: ${filePath}`);
}

// Main crawler
async function crawl(page: Page, url: string) {
  const normalized = normalize(url);
  if (visited.has(normalized) || !url.startsWith(BASE_URL)) return;

  visited.add(normalized);
  console.log(`🌐 Visiting: ${url}`);

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await screenshotPage(page, url);

    // Get all internal links
    const hrefs = await page.$$eval('a[href]', (anchors) =>
      anchors.map((a) => (a as HTMLAnchorElement).href).filter((href) =>
        href.includes('books.toscrape.com')
      )
    );

    for (const link of hrefs) {
      await crawl(page, link);
    }
  } catch (error) {
    console.error(`⚠️ Failed to visit ${url}:`, error);
  }
}

// Entrypoint
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await crawl(page, BASE_URL);

  await browser.close();
  console.log('✅ Done exploring all pages!');
})();
