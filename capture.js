import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({headless: 'new'});
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  
  console.log("Fetching metriks...");
  await page.goto('https://metriks96.ru/', { waitUntil: 'networkidle2' });
  await page.screenshot({ path: 'public/metriks-full.jpg', fullPage: true, type: 'jpeg', quality: 70 });
  
  console.log("Fetching prime...");
  await page.goto('https://skprime-stroy.ru/', { waitUntil: 'networkidle2' });
  await page.screenshot({ path: 'public/prime-full.jpg', fullPage: true, type: 'jpeg', quality: 70 });
  
  await browser.close();
  console.log("Done");
})();
