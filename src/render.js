// 슬라이드 HTML을 브라우저로 열어 JPEG 이미지로 저장한다.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { buildSlides, FIT_SCRIPT, SLIDE_HEIGHT, SLIDE_WIDTH } from "./template.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BACKGROUND_DIR = path.join(ROOT, "assets", "backgrounds");

// GitHub Actions에서는 Playwright가 설치한 Chromium을, 내 PC에서는 이미 설치된 Edge/Chrome을 쓴다.
async function launchBrowser() {
  const channels = [...new Set([process.env.BROWSER_CHANNEL || null, null, "msedge", "chrome"])];
  let lastError;
  for (const channel of channels) {
    try {
      return await chromium.launch(channel ? { channel } : {});
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

// assets/backgrounds 폴더에 사진이 있으면 날짜별로 하나를 골라 배경으로 쓴다.
async function pickBackground(seed) {
  let files = [];
  try {
    files = (await fs.readdir(BACKGROUND_DIR)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
  } catch {
    return null;
  }
  if (files.length === 0) return null;
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return pathToFileURL(path.join(BACKGROUND_DIR, files[hash % files.length])).href;
}

/**
 * @returns 저장된 이미지 파일 이름 배열 (slide-1.jpg, slide-2.jpg, ...)
 */
export async function renderPost(post, { config, outDir, seriesNumber, seed }) {
  const slides = buildSlides(post, {
    theme: config.theme,
    handle: config.brand.handle,
    brandName: config.brand.name,
    seriesNumber,
    background: await pickBackground(seed),
  });

  await fs.mkdir(outDir, { recursive: true });
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "autopost-"));
  const browser = await launchBrowser();
  const files = [];
  try {
    const page = await browser.newPage({
      viewport: { width: SLIDE_WIDTH, height: SLIDE_HEIGHT },
      deviceScaleFactor: 1,
    });
    for (const [i, html] of slides.entries()) {
      const htmlPath = path.join(tmpDir, `slide-${i + 1}.html`);
      await fs.writeFile(htmlPath, html, "utf8");
      await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      const fits = await page.evaluate(FIT_SCRIPT);
      if (!fits) {
        throw new Error(`슬라이드 ${i + 1}의 글이 너무 길어 카드 안에 들어가지 않습니다.`);
      }
      const name = `slide-${i + 1}.jpg`;
      await page.screenshot({ path: path.join(outDir, name), type: "jpeg", quality: 92 });
      files.push(name);
    }
  } finally {
    await browser.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
  return files;
}
