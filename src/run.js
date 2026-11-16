// 실행 진입점
//   node src/run.js sample    예시 게시물로 이미지만 만들어 본다 (API 키 불필요)
//   node src/run.js generate  오늘 게시물의 글과 이미지를 만든다
//   node src/run.js publish   만들어 둔 오늘 게시물을 인스타그램에 올린다
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderPost } from "./render.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HISTORY_PATH = path.join(ROOT, "data", "history.json");

const readJson = async (file) => JSON.parse(await fs.readFile(file, "utf8"));
const writeJson = (file, data) => fs.writeFile(file, JSON.stringify(data, null, 2) + "\n", "utf8");
const exists = (file) => fs.access(file).then(() => true, () => false);

// 한국 시간 기준 오늘 날짜 (YYYY-MM-DD)
const todayKst = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

async function loadHistory() {
  return (await exists(HISTORY_PATH)) ? readJson(HISTORY_PATH) : [];
}

async function sample(config) {
  const post = await readJson(path.join(ROOT, "sample", "sample-post.json"));
  const outDir = path.join(ROOT, "output", "sample");
  const files = await renderPost(post, { config, outDir, seriesNumber: 1, seed: "sample" });
  console.log(`예시 이미지 ${files.length}장을 만들었습니다: ${outDir}`);
}

async function generate(config, date) {
  const outDir = path.join(ROOT, "output", date);
  const postPath = path.join(outDir, "post.json");
  if (await exists(postPath)) {
    console.log(`${date} 게시물이 이미 만들어져 있어 건너뜁니다.`);
    return;
  }

  const history = await loadHistory();
  const { generatePost } = await import("./generate.js");
  const post = await generatePost({ config, history, date });
  const seriesNumber = history.filter((h) => h.series === post.series).length + 1;

  const slides = await renderPost(post, { config, outDir, seriesNumber, seed: date });
  await writeJson(postPath, { ...post, date, seriesNumber, slides });

  history.push({ date, series: post.series, topic: post.topic });
  await fs.mkdir(path.dirname(HISTORY_PATH), { recursive: true });
  await writeJson(HISTORY_PATH, history);
  console.log(`${date} 게시물 생성 완료: "${post.topic}" (이미지 ${slides.length}장)`);
}

async function publish(date) {
  const outDir = path.join(ROOT, "output", date);
  const postPath = path.join(outDir, "post.json");
  const publishedPath = path.join(outDir, "published.json");
  if (!(await exists(postPath))) {
    throw new Error(`${date} 게시물이 없습니다. 먼저 generate를 실행하세요.`);
  }
  if (await exists(publishedPath)) {
    console.log(`${date} 게시물은 이미 올라가 있어 건너뜁니다.`);
    return;
  }
  const baseUrl = process.env.IMAGE_BASE_URL;
  if (!baseUrl) throw new Error("IMAGE_BASE_URL 환경 변수가 필요합니다.");

  const post = await readJson(postPath);
  const imageUrls = post.slides.map((name) => `${baseUrl.replace(/\/$/, "")}/output/${date}/${name}`);
  const { publishToInstagram } = await import("./publish.js");
  const result = await publishToInstagram({ imageUrls, caption: post.fullCaption });
  await writeJson(publishedPath, { ...result, publishedAt: new Date().toISOString() });
  console.log(`인스타그램 업로드 완료: ${result.permalink ?? result.id}`);
}

const command = process.argv[2];
const date = process.env.POST_DATE || todayKst();
const config = await readJson(path.join(ROOT, "config.json"));

try {
  if (command === "sample") await sample(config);
  else if (command === "generate") await generate(config, date);
  else if (command === "publish") await publish(date);
  else {
    console.error("사용법: node src/run.js <sample|generate|publish>");
    process.exitCode = 1;
  }
} catch (error) {
  console.error(`실패: ${error.message}`);
  process.exitCode = 1;
}
