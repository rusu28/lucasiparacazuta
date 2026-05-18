import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const outputDir = resolve("screenshots");
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
});

const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
await page.screenshot({ path: resolve(outputDir, "home.png"), fullPage: true });

await page.goto("http://127.0.0.1:5173/education/powerpoint", {
  waitUntil: "networkidle",
});
await page.screenshot({ path: resolve(outputDir, "deck.png"), fullPage: true });

await browser.close();
