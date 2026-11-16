// 실행 진입점
//   node src/run.js sample    예시 게시물로 이미지만 만들어 본다
//   node src/run.js check     대기열에 남은 게시물을 모두 검사한다 (올리기 전 점검용)
//   node src/run.js generate  대기열에서 다음 게시물을 꺼내 오늘 올릴 이미지를 만든다
//   node src/run.js publish   만들어 둔 오늘 게시물을 인스타그램에 올린다
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPost, pendingFiles } from "./generate.js";
import { renderPost } from "./render.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const QUEUE_DIR = path.join(ROOT, "queue");
const HISTORY_PATH = path.join(ROOT, "data", "history.json");
const LOW_QUEUE = 5; // 남은 게시물이 이 개수 이하이면 경고한다

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

// 대기열에 남은 게시물을 전부 읽고 이미지로 만들어 보면서, 올릴 수 없는 게시물을 찾는다.
async function check(config) {
  const pending = await pendingFiles(QUEUE_DIR, await loadHistory());
  if (pending.length === 0) {
    console.log("대기열에 남은 게시물이 없습니다.");
    return;
  }
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "autopost-check-"));
  const failures = [];
  try {
    for (const file of pending) {
      try {
        const post = await loadPost(QUEUE_DIR, file, config);
        await renderPost(post, { config, outDir: path.join(tmpDir, file), seriesNumber: 1, seed: file });
        console.log(`OK    ${file}  ${post.topic}`);
      } catch (error) {
        failures.push(error.message);
        console.log(`실패  ${error.message}`);
      }
    }
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
  console.log(`\n남은 게시물 ${pending.length}개 중 ${pending.length - failures.length}개 정상`);
  if (failures.length > 0) throw new Error(`고쳐야 할 게시물이 ${failures.length}개 있습니다.`);
}

async function generate(config, date) {
  const outDir = path.join(ROOT, "output", date);
  const postPath = path.join(outDir, "post.json");
  if (await exists(postPath)) {
    console.log(`${date} 게시물이 이미 만들어져 있어 건너뜁니다.`);
    return;
  }

  const history = await loadHistory();

  // 지난번에 만들어 놓고 올리지 못한 게시물이 있으면(토큰 만료, 일시적 오류 등) 그것부터 다시 올린다.
  let retryFile = null;
  const last = history.at(-1);
  if (last && !(await exists(path.join(ROOT, "output", last.date, "published.json")))) {
    retryFile = last.file;
    history.pop();
    await fs.rm(path.join(ROOT, "output", last.date), { recursive: true, force: true });
    console.log(`${last.date}에 올리지 못한 ${retryFile}을(를) 다시 준비합니다.`);
  }

  const pending = await pendingFiles(QUEUE_DIR, history);
  if (pending.length === 0) {
    throw new Error("대기열에 남은 게시물이 없습니다. queue 폴더에 새 게시물을 추가해 주세요.");
  }
  const file = retryFile && pending.includes(retryFile) ? retryFile : pending[0];
  const post = await loadPost(QUEUE_DIR, file, config);
  const seriesNumber = history.filter((h) => h.series === post.series).length + 1;

  const slides = await renderPost(post, { config, outDir, seriesNumber, seed: date });
  await writeJson(postPath, { ...post, date, file, seriesNumber, slides });

  history.push({ date, file, series: post.series, topic: post.topic });
  await fs.mkdir(path.dirname(HISTORY_PATH), { recursive: true });
  await writeJson(HISTORY_PATH, history);
  console.log(`${date} 게시물 준비 완료: ${file} "${post.topic}" (이미지 ${slides.length}장)`);

  const remaining = pending.length - 1;
  if (remaining <= LOW_QUEUE) {
    // GitHub Actions 실행 결과 화면에 경고로 표시된다.
    console.log(`::warning::대기열에 게시물이 ${remaining}개 남았습니다. 새 게시물을 추가해 주세요.`);
  }
}

async function publish(config, date) {
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
  const result = await publishToInstagram({
    imageUrls,
    caption: post.fullCaption,
    handle: config.brand.handle,
  });
  await writeJson(publishedPath, { ...result, publishedAt: new Date().toISOString() });
  console.log(`인스타그램 업로드 완료: ${result.permalink ?? result.id}`);
}

const command = process.argv[2];
const date = process.env.POST_DATE || todayKst();
const config = await readJson(path.join(ROOT, "config.json"));

try {
  if (command === "sample") await sample(config);
  else if (command === "check") await check(config);
  else if (command === "generate") await generate(config, date);
  else if (command === "publish") await publish(config, date);
  else {
    console.error("사용법: node src/run.js <sample|check|generate|publish>");
    process.exitCode = 1;
  }
} catch (error) {
  console.error(`실패: ${error.message}`);
  if (process.env.GITHUB_ACTIONS) {
    // GitHub Actions 실행 결과 화면에 오류 내용이 바로 보이도록 표시한다.
    console.log(`::error::${error.message.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A")}`);
  }
  process.exitCode = 1;
}
