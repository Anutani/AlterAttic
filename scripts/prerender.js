// Renders src/index.html in a headless browser and saves the finished HTML to
// public/index.html, so search engines and AI tools see the full page text
// (portfolio and chapters) without running JavaScript.
// Usage: node scripts/prerender.js   (needs Playwright with Chromium)
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

(async () => {
  const src = "file://" + path.resolve(__dirname, "../src/index.html");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(src, { waitUntil: "load" });
  await page.waitForTimeout(500);
  // Reset state that depends on the visitor's scroll position or pointer.
  await page.evaluate(() => {
    const g = document.getElementById("guide");
    if (g) { g.removeAttribute("style"); g.classList.remove("talk"); }
    document.querySelectorAll(".eye").forEach((e) => e.removeAttribute("transform"));
  });
  const html = "<!doctype html>\n" + (await page.evaluate(() => document.documentElement.outerHTML));
  fs.mkdirSync(path.resolve(__dirname, "../public"), { recursive: true });
  fs.writeFileSync(path.resolve(__dirname, "../public/index.html"), html);
  await browser.close();
  console.log("Wrote public/index.html (" + html.length + " bytes)");
})();
