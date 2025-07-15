import { chromium, Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import promptSync from 'prompt-sync';


const prompt = promptSync();


// Ask user for the base URL
const BASE_URL = prompt('Enter the base URL of the website to explore: ').trim();
const DOMAIN_PREFIX = new URL(BASE_URL).origin;


// Constants
const screenshotsDir = './screenshots';
const MAX_DEPTH = 3;
const MAX_PAGES = 50;
const visited = new Set<string>();


// Create screenshot folder if it doesn't exist
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir); 
}


// Normalize URLs
function normalize(url: string) {
  try {
    const u = new URL(url);
    return u.origin + u.pathname.replace(/\/$/, '');
  } catch {
    return url;
  }
}


// Save full-page screenshot
async function screenshotPage(page: Page, url: string) {
  const cleanName = normalize(url).replace(/[^a-zA-Z0-9]/g, '_').slice(0, 100);
  const filePath = path.join(screenshotsDir, `${cleanName}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`📸 Screenshot saved: ${filePath}`);
}


// Recursive crawler
async function crawl(page: Page, url: string, depth: number = 0): Promise<void> {
  const normalized = normalize(url);
  if (visited.has(normalized) || depth > MAX_DEPTH || visited.size >= MAX_PAGES || !normalized.startsWith(DOMAIN_PREFIX)) {
    return;
  }


  visited.add(normalized);
  try {
    console.log(`🌐 Visiting [Depth ${depth}]: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await screenshotPage(page, url);


    const links = await page.$$eval('a[href]', (anchors) =>
      anchors.map((a) => (a as HTMLAnchorElement).href)
    );


    for (const link of links) {
      if (visited.size >= MAX_PAGES) break;
      if (link.startsWith(DOMAIN_PREFIX)) {
        await crawl(page, link, depth + 1);
      }
    }
  } catch (err) {
    console.warn(`⚠️ Failed to visit ${url}: ${(err as Error).message}`);
  }
}


// Entrypoint
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();


  await crawl(page, BASE_URL);
  await browser.close();


  console.log(`✅ Done! Explored ${visited.size} pages.`);
})();
