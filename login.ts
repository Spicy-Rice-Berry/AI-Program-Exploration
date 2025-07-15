import { chromium, Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import { URL } from 'url';
import { createObjectCsvWriter } from 'csv-writer';
import promptSync from 'prompt-sync';




const baseUrl = 'https://demo.opencart.com/en-gb?route=common/home';
const loginUrl = 'https://demo.opencart.com/en-gb?route=account/login';
const prompt = promptSync();
const username = prompt('Enter your username or email: ');
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
 // Wait for the correct selectors
 await page.pause(); // This opens Playwright Inspector and lets you interact manually
 await page.waitForSelector('input[name="email"]');
 await page.waitForSelector('input[name="password"]');


 // Fill in credentials
 await page.fill('input[name="email"]', username);
 await page.fill('input[name="password"]', password);


 // Click the login button
 await page.click('button[type="submit"]');


 // Wait for navigation or a known post-login element
 await Promise.race([
   page.waitForSelector('.alert-danger', { timeout: 10000 }),
   page.waitForSelector('a[title="My Account"]', { timeout: 10000 }) // or another post-login selector
 ]);


 // Optional: Take a screenshot after login
 await page.screenshot({ path: path.join(screenshotsDir, 'after_login.png'), fullPage: true });


 console.log('✅ Login attempted, check after_login.png for result.');
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
const browser = await chromium.launchPersistentContext('./user-data-dir', { headless: false });
const page = await browser.newPage();




await login(page);
await explore(page, baseUrl);




await browser.close();
saveReports();
})();
