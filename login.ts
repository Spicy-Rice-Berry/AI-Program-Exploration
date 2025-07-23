import { chromium, Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import { URL } from 'url';
import { createObjectCsvWriter } from 'csv-writer';
import promptSync from 'prompt-sync';

const baseUrl = 'https://the-internet.herokuapp.com/secure';
const loginUrl = 'https://the-internet.herokuapp.com/login';
const prompt = promptSync();
const username = prompt('Enter your username: ');
const password = prompt('Enter your password: ', { echo: '*' });
const maxDepth = 2;

const visited = new Set<string>();
const screenshotsDir = './screenshots';
const jsonReport: any[] = [];

// 📁 Create screenshots directory if not present
if (!fs.existsSync(screenshotsDir)) {
 fs.mkdirSync(screenshotsDir);
}

// 🔐 Login Function
async function login(page: Page) {
 console.log('🔐 Navigating to login page...');
 await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });

 await page.waitForSelector('#username');
 await page.waitForSelector('#password');

 await page.fill('#username', username);
 await page.fill('#password', password);
 await page.click('button[type="submit"]');

 await page.waitForSelector('.flash');
 const flashText = await page.textContent('.flash');
 console.log('📣 Flash message:', flashText?.trim());

 await page.waitForTimeout(1000); // Let UI update before screenshot
 await page.screenshot({ path: 'after_login.png', fullPage: true });

 if (flashText?.includes('You logged into a secure area!')) {
   console.log('✅ Login successful!');
 } else {
   console.log('❌ Login failed!');
   throw new Error('Login failed - aborting.');
 }
}

// 🧪 Test page content
async function testPageFunctionality(page: Page) {
 const report: any = {
   url: page.url(),
   hasForm: false,
   clickedButton: false
 };

 const form = await page.$('form');
 if (form) {
   report.hasForm = true;
   const emailInput = await page.$('input[type="email"]');
   if (emailInput) {
     await emailInput.fill('test@example.com');
   }
   const submit = await page.$('button[type="submit"]');
   if (submit) {
     await submit.click();
     report.clickedButton = true;
   }
 }

 const button = await page.$('button');
 if (button && !report.clickedButton) {
   await button.click();
   report.clickedButton = true;
 }

 jsonReport.push(report);
}

// 🔁 Recursive crawler
async function explore(page: Page, url: string, depth: number = 0) {
 if (visited.has(url) || depth > maxDepth) return;
 visited.add(url);

 try {
   console.log(`🌐 Visiting: ${url}`);
   await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

   const safeName = url.replace(/[^a-z0-9]/gi, '_').slice(0, 200);
   const screenshotPath = path.join(screenshotsDir, `${safeName}.png`);
   await page.screenshot({ path: screenshotPath, fullPage: true });

   await testPageFunctionality(page);

   const links = await page.$$eval('a', as => as.map(a => a.href));
   const internalLinks = links
     .map(link => new URL(link, url).href)
     .filter(link => link.startsWith(baseUrl) && !visited.has(link));

   for (const link of internalLinks) {
     await explore(page, link, depth + 1);
   }

 } catch (err) {
   const error = err as Error;
   console.warn(`⚠️ Failed to load ${url}: ${error.message}`);
   jsonReport.push({ url, error: error.message });
 }
}

// 📄 Save report to JSON and CSV
function saveReports() {
 fs.writeFileSync('report.json', JSON.stringify(jsonReport, null, 2));

 const csvWriter = createObjectCsvWriter({
   path: 'report.csv',
   header: [
     { id: 'url', title: 'URL' },
     { id: 'hasForm', title: 'Has Form' },
     { id: 'clickedButton', title: 'Clicked Button' },
     { id: 'error', title: 'Error' }
   ]
 });

 csvWriter.writeRecords(jsonReport).then(() =>
   console.log('📄 Reports saved to report.json and report.csv.')
 );
}

// 🚀 Main
(async () => {
 const browser = await chromium.launch({ headless: true });
 const context = await browser.newContext();
 const page = await context.newPage();

 await login(page);
 await explore(page, baseUrl);

 await browser.close();
 saveReports();
})();

