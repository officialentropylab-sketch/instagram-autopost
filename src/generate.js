// 대기열(queue 폴더)에 미리 써 둔 게시물 중 다음에 올릴 것을 꺼내 검사한다.
// 게시물 글을 쓰는 방법은 queue/README.md 참고.
import fs from "node:fs/promises";
import path from "node:path";
import { ctaTexts } from "./cta.js";

const CAPTION_LIMIT = 2200; // 인스타그램 캡션 최대 글자 수
const HASHTAG_LIMIT = 30;

const isText = (value) => typeof value === "string" && value.trim().length > 0;
const isTextList = (value, min, max) =>
  Array.isArray(value) && value.length >= min && value.length <= max && value.every(isText);

/** 대기열 폴더의 게시물 파일 이름을 순서대로 돌려준다. */
export async function listQueue(queueDir) {
  try {
    return (await fs.readdir(queueDir)).filter((name) => name.endsWith(".json")).sort();
  } catch {
    return [];
  }
}

/** 카드에 들어가지 않거나 인스타그램 제한을 넘는 게시물을 걸러낸다. 문제 목록을 돌려준다. */
export function validatePost(post, config) {
  const problems = [];
  const need = (ok, message) => ok || problems.push(message);

  need(isText(post.topic), "topic이 비어 있음");
  need(config.content.series.includes(post.series), `series가 목록에 없음: ${post.series}`);
  need(isText(post.cover?.title_line1) && isText(post.cover?.title_line2), "표지 제목이 비어 있음");
  need(isText(post.cover?.subtitle), "표지 부제가 비어 있음");
  need(isText(post.header?.title) && isText(post.header?.subtitle), "본문 상단 제목이 비어 있음");

  const expected = config.content.detailSlides;
  const details = Array.isArray(post.details) ? post.details : [];
  need(details.length === expected, `본문 카드가 ${details.length}개 (필요: ${expected}개)`);
  for (const [i, d] of details.entries()) {
    need(isText(d.title), `본문 ${i + 1}: 제목이 비어 있음`);
    need(isTextList(d.paragraphs, 1, 3), `본문 ${i + 1}: 문단은 1~3개`);
    need(isText(d.action_heading), `본문 ${i + 1}: 실천 머리말이 비어 있음`);
    need(isTextList(d.actions, 2, 4), `본문 ${i + 1}: 실천 항목은 2~4개`);
    need(isText(d.tip), `본문 ${i + 1}: 팁이 비어 있음`);
  }

  const items = Array.isArray(post.summary?.items) ? post.summary.items : [];
  need(items.length === details.length, "요약 항목 수가 본문 카드 수와 다름");
  need(items.every((item) => isText(item.title) && isText(item.desc)), "요약 항목에 빈 칸이 있음");
  need(isText(post.summary?.closing), "요약 마무리 문장이 비어 있음");

  if (post.example !== undefined) {
    const pairs = Array.isArray(post.example?.pairs) ? post.example.pairs : [];
    need(isText(post.example?.heading), "예시 카드의 제목이 비어 있음");
    need(pairs.length >= 1 && pairs.length <= 3, "예시는 1~3쌍");
    need(pairs.every((pair) => isText(pair.before) && isText(pair.after)), "예시에 빈 칸이 있음");
  }

  need(isText(post.outro?.headline), "마무리 문구가 비어 있음");
  need(isTextList(post.outro?.lines, 1, 3), "마무리 문장은 1~3개");
  need(isText(post.caption), "캡션이 비어 있음");
  need(Array.isArray(post.hashtags) && post.hashtags.every(isText), "hashtags는 문자열 목록이어야 함");

  if (problems.length === 0) {
    const length = buildFullCaption(post, config).length;
    need(length <= CAPTION_LIMIT, `캡션이 ${length}자 (최대 ${CAPTION_LIMIT}자)`);
  }
  return problems;
}

/**
 * 캡션 본문에 댓글 안내(첫 문단 바로 뒤, 마지막)와 해시태그(게시물별 + 공통)를 붙인다.
 * 첫 문단 뒤에 넣는 이유: 피드에서 "더 보기"를 누르기 전에 보이는 범위에 들어가도록.
 */
export function buildFullCaption(post, config) {
  const tags = [...new Set([...post.hashtags, ...config.content.fixedHashtags])]
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`).replace(/\s+/g, ""))
    .slice(0, HASHTAG_LIMIT);
  const paragraphs = post.caption.trim().split(/\n\s*\n/);
  const cta = ctaTexts(config.cta);
  if (cta) {
    paragraphs.splice(1, 0, cta.captionTop);
    paragraphs.push(cta.captionEnd);
  }
  return `${paragraphs.join("\n\n")}\n\n${tags.join(" ")}`;
}

/** 게시물 파일 하나를 읽어 검사한다. 문제가 있으면 오류를 던진다. */
export async function loadPost(queueDir, file, config) {
  let post;
  try {
    post = JSON.parse(await fs.readFile(path.join(queueDir, file), "utf8"));
  } catch (error) {
    throw new Error(`${file}: 파일을 읽을 수 없습니다 (${error.message})`);
  }
  const problems = validatePost(post, config);
  if (problems.length > 0) throw new Error(`${file}: ${problems.join(", ")}`);
  return { ...post, fullCaption: buildFullCaption(post, config) };
}

/** 아직 올리지 않은 게시물 파일 이름을 순서대로 돌려준다. */
export async function pendingFiles(queueDir, history) {
  const used = new Set(history.map((entry) => entry.file));
  return (await listQueue(queueDir)).filter((file) => !used.has(file));
}
