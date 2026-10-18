// Запись кейса: node capture.js <url> <name>  →  public/<name>.mp4
// Нужны puppeteer (devDependency) и ffmpeg в PATH.
import puppeteer from 'puppeteer';
import { execFileSync } from 'node:child_process';
import { unlinkSync } from 'node:fs';

const [url, name] = process.argv.slice(2);
if (!url || !name) {
  console.error('Usage: node capture.js <url> <name>');
  process.exit(1);
}

const raw = `public/${name}.raw.webm`;
const out = `public/${name}.mp4`;

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 734 });
await page.goto(url, { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 4000)); // дать отыграть интро-анимациям

const recorder = await page.screencast({ path: raw });
await new Promise(r => setTimeout(r, 1000));
await page.evaluate(async () => {
  const max = document.documentElement.scrollHeight - innerHeight;
  const steps = Math.min(Math.ceil(max / 6), 900);
  for (let i = 1; i <= steps; i++) {
    scrollTo(0, (max * i) / steps);
    await new Promise(r => setTimeout(r, 16));
  }
});
await new Promise(r => setTimeout(r, 800));
await recorder.stop();
await browser.close();

execFileSync('ffmpeg', ['-y', '-i', raw, '-an', '-c:v', 'libx264', '-crf', '30', '-preset', 'slow',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: 'inherit' });
unlinkSync(raw);
console.log('Done:', out);
