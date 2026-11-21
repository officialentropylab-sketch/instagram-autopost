// 게시물 데이터(post.json)를 카드뉴스 슬라이드 HTML로 바꾼다.
// 슬라이드 구성: 표지 → 한눈에 보기 → 본문 N장 → 전·후 예시(선택) → 마무리
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ctaTexts } from "./cta.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const SLIDE_WIDTH = 1080;
export const SLIDE_HEIGHT = 1350; // 4:5, 인스타그램 피드에서 가장 크게 보이는 비율

const fontCss = (pkg) =>
  pathToFileURL(path.join(ROOT, "node_modules", "@fontsource", pkg, "index.css")).href;

const EMOJI_RE =
  /(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*)/gu;

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// **강조** → 형광펜, 이모지 → 외곽선 없는 span, 줄바꿈 → <br>
function rich(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<em>$1</em>")
    .replace(EMOJI_RE, '<span class="emo">$1</span>')
    .replace(/\n/g, "<br>");
}

// 이모지는 실행 환경에 설치된 글꼴을 쓴다 (Windows: Segoe UI Emoji, GitHub 서버: Noto Color Emoji).
// 이모지 웹폰트는 브라우저 버전에 따라 빈칸으로 그려지는 일이 있어 쓰지 않는다.
const EMOJI_FONTS = "'Segoe UI Emoji', 'Noto Color Emoji', 'Apple Color Emoji'";

const CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: ${SLIDE_WIDTH}px; height: ${SLIDE_HEIGHT}px; overflow: hidden; }
body {
  position: relative;
  font-family: 'Gowun Dodum', ${EMOJI_FONTS}, sans-serif;
  color: #fff;
  word-break: keep-all;
  overflow-wrap: break-word;
  --fit: 1;
}
.emo { font-family: ${EMOJI_FONTS}, sans-serif; -webkit-text-stroke: 0; font-style: normal; }
.bg { position: absolute; inset: -40px; background-size: cover; background-position: center; }
.bg.photo { filter: blur(5px) saturate(.85); }
.overlay { position: absolute; inset: 0; }

/* 사진이 없을 때 쓰는 기본 배경 */
.cover .bg.gen {
  background:
    linear-gradient(rgba(110, 90, 115, .07) 2px, transparent 2px) 0 0 / 60px 60px,
    linear-gradient(90deg, rgba(110, 90, 115, .07) 2px, transparent 2px) 0 0 / 60px 60px,
    radial-gradient(circle at 14% 16%, rgba(255, 255, 255, .95) 0, transparent 360px),
    radial-gradient(circle at 88% 84%, var(--accent-soft) 0, transparent 520px),
    radial-gradient(circle at 80% 12%, var(--cover-glow) 0, transparent 420px),
    linear-gradient(160deg, var(--cover-from) 0%, var(--cover-to) 100%);
}
.inner .bg.gen {
  background:
    linear-gradient(rgba(255, 255, 255, .035) 2px, transparent 2px) 0 0 / 60px 60px,
    linear-gradient(90deg, rgba(255, 255, 255, .035) 2px, transparent 2px) 0 0 / 60px 60px,
    radial-gradient(circle at 90% 6%, color-mix(in srgb, var(--accent) 30%, transparent) 0, transparent 520px),
    radial-gradient(circle at 6% 96%, color-mix(in srgb, var(--accent) 20%, transparent) 0, transparent 480px),
    linear-gradient(170deg, #3b3142 0%, #29232f 100%);
}
.cover.has-photo .overlay { background: rgba(255, 240, 245, .22); }
.inner.has-photo .overlay { background: rgba(30, 24, 33, .76); }

/* ---------- 표지 ---------- */
.cover-wrap {
  position: absolute; inset: 0; padding: 0 60px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center;
}
.pill {
  font-family: 'Jua', ${EMOJI_FONTS}, sans-serif;
  font-size: 40px; letter-spacing: 1px; color: var(--ink);
  background: var(--accent-soft);
  padding: 16px 38px 12px; border-radius: 18px;
  box-shadow: 0 8px 0 rgba(42, 36, 48, .16);
  margin-bottom: 52px;
}
.cover h1 {
  font-family: 'Jua', ${EMOJI_FONTS}, sans-serif; font-weight: 400;
  width: 100%; display: flex; flex-direction: column; align-items: center;
}
.cover h1 span.line {
  display: block; width: max-content; white-space: nowrap;
  font-size: 148px; line-height: 1.22; /* 피드의 작은 썸네일에서도 읽히도록 가로 폭을 꽉 채운다 */
  color: #fff; -webkit-text-stroke: 18px var(--ink); paint-order: stroke fill;
}
.cover h1 span.line.hl { color: var(--accent-soft); }
.cover .sub {
  font-family: 'Jua', ${EMOJI_FONTS}, sans-serif;
  font-size: 46px; line-height: 1.4; margin-top: 50px; max-width: 900px;
  color: #fff; -webkit-text-stroke: 10px var(--ink); paint-order: stroke fill;
  text-wrap: balance;
}
.cover .cta-badge {
  position: absolute; bottom: 150px; left: 0; right: 0;
  display: flex; justify-content: center;
}
.cover .cta-badge span.txt {
  font-family: 'Jua', ${EMOJI_FONTS}, sans-serif; font-size: 40px; white-space: nowrap;
  color: var(--ink); background: #fff; border: 4px solid var(--ink); border-radius: 999px;
  padding: 18px 40px 13px; box-shadow: 0 8px 0 rgba(42, 36, 48, .16);
}
.cover .handle {
  position: absolute; bottom: 64px; left: 0; right: 0; text-align: center;
  font-family: 'Jua', sans-serif; font-size: 32px; letter-spacing: 1px;
  color: #fff; -webkit-text-stroke: 7px var(--ink); paint-order: stroke fill;
}

/* ---------- 본문 공통 ---------- */
.inner-wrap {
  position: absolute; inset: 0; padding: 92px 78px 64px;
  display: flex; flex-direction: column; align-items: center; text-align: center;
}
.h-title {
  font-family: 'Jua', ${EMOJI_FONTS}, sans-serif;
  font-size: 58px; line-height: 1.3; text-wrap: balance;
}
.h-sub { font-size: 32px; margin-top: 16px; color: rgba(255, 255, 255, .82); text-wrap: balance; }
.chip {
  font-family: 'Jua', ${EMOJI_FONTS}, sans-serif;
  font-size: 44px; line-height: 1.3; margin-top: 46px;
  padding: 18px 44px 14px; border-radius: 18px;
  background: rgba(255, 255, 255, .15); border: 2px solid rgba(255, 255, 255, .34);
  text-wrap: balance;
}
.chip b { font-weight: 400; color: var(--accent-soft); margin-right: 10px; }
main {
  flex: 1; min-height: 0; width: 100%; margin-top: 40px;
  display: flex; flex-direction: column; justify-content: center; overflow: hidden;
  font-size: calc(37px * var(--fit)); line-height: 1.62;
}
main p, main li { text-wrap: pretty; }
main p + p { margin-top: calc(26px * var(--fit)); }
em {
  font-style: normal; color: #fff;
  background: linear-gradient(transparent 58%, color-mix(in srgb, var(--accent) 62%, transparent) 0);
  padding: 0 3px;
}
.act-h {
  font-family: 'Jua', ${EMOJI_FONTS}, sans-serif;
  font-size: calc(40px * var(--fit)); color: var(--accent-soft);
  margin-top: calc(40px * var(--fit));
}
ul { list-style: none; }
.acts li { margin-top: calc(20px * var(--fit)); }
.acts li::before { content: '•'; color: var(--accent-soft); margin-right: 12px; }
.tip {
  margin-top: calc(40px * var(--fit)); padding: calc(24px * var(--fit)) 34px;
  border-radius: 22px; background: rgba(255, 255, 255, .1);
  font-size: calc(34px * var(--fit));
}
footer {
  font-family: 'Jua', sans-serif; font-size: 28px; letter-spacing: 1px;
  color: rgba(255, 255, 255, .55); margin-top: 26px;
}

/* ---------- 한눈에 보기 ---------- */
.sum li { margin-top: calc(34px * var(--fit)); }
.sum li:first-child { margin-top: 0; }
.sum .t { font-family: 'Jua', ${EMOJI_FONTS}, sans-serif; font-size: calc(42px * var(--fit)); }
.sum .t b { font-weight: 400; color: var(--accent-soft); margin-right: 8px; }
.sum .d { color: rgba(255, 255, 255, .86); font-size: calc(34px * var(--fit)); }
.sum-close { margin-top: calc(48px * var(--fit)); font-size: calc(36px * var(--fit)); }

/* ---------- 전·후 예시 ---------- */
.ex { display: flex; flex-direction: column; gap: calc(38px * var(--fit)); text-align: left; }
.ex-pair { display: flex; flex-direction: column; align-items: center; gap: calc(10px * var(--fit)); }
.ex-row {
  width: 100%; display: flex; gap: 22px; align-items: flex-start;
  padding: calc(22px * var(--fit)) 30px; border-radius: 22px; line-height: 1.5;
}
.ex-row.before { background: rgba(255, 255, 255, .07); color: rgba(255, 255, 255, .68); }
.ex-row.after {
  background: rgba(255, 255, 255, .14);
  border: 2px solid color-mix(in srgb, var(--accent-soft) 75%, transparent);
}
.ex-mark {
  flex: none; width: calc(50px * var(--fit)); height: calc(50px * var(--fit)); border-radius: 50%;
  display: flex; align-items: center; justify-content: center; margin-top: 3px;
  font-family: 'Jua', sans-serif; font-size: calc(28px * var(--fit)); padding-top: 3px;
}
.before .ex-mark { background: rgba(255, 255, 255, .16); color: rgba(255, 255, 255, .75); }
.after .ex-mark { background: var(--accent-soft); color: var(--ink); }
.ex-arrow { border: 13px solid transparent; border-top-color: var(--accent-soft); border-bottom: 0; }

/* ---------- 마무리 ---------- */
.outro-h {
  font-family: 'Jua', ${EMOJI_FONTS}, sans-serif;
  font-size: calc(64px * var(--fit)); line-height: 1.35; text-wrap: balance;
  margin-bottom: calc(40px * var(--fit));
}
.cta { margin-top: calc(56px * var(--fit)); display: flex; flex-direction: column; gap: 18px; align-items: center; }
.cta div {
  font-family: 'Jua', ${EMOJI_FONTS}, sans-serif; font-size: calc(38px * var(--fit));
  padding: 18px 40px 14px; border-radius: 999px; color: var(--ink); background: var(--accent-soft);
}
.cta div:last-child { background: #fff; }
.cta .cta-main {
  display: flex; flex-direction: column; align-items: center; gap: calc(8px * var(--fit));
  border-radius: 28px; padding: calc(26px * var(--fit)) 46px calc(20px * var(--fit));
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--accent-soft) 35%, transparent);
}
.cta .cta-main .l2 { font-size: calc(44px * var(--fit)); }
`;

// 글자 크기 자동 맞춤: 표지 제목은 가로 폭에, 본문은 세로 높이에 맞춰 줄인다.
// (render.js가 글꼴 로딩이 끝난 뒤 페이지 안에서 실행한다)
export const FIT_SCRIPT = `(() => {
  for (const el of document.querySelectorAll('.cover h1 span.line')) {
    const max = el.parentElement.clientWidth - 24;
    let size = parseFloat(getComputedStyle(el).fontSize);
    while (el.getBoundingClientRect().width > max && size > 56) {
      size -= 2;
      el.style.fontSize = size + 'px';
    }
  }
  for (const el of document.querySelectorAll('.cta-badge span.txt')) {
    let size = parseFloat(getComputedStyle(el).fontSize);
    while (el.getBoundingClientRect().width > 1000 && size > 28) {
      size -= 1;
      el.style.fontSize = size + 'px';
    }
  }
  const main = document.querySelector('main');
  if (!main) return true;
  const inner = main.firstElementChild;
  let fit = 1;
  while (inner.offsetHeight > main.clientHeight && fit > 0.62) {
    fit -= 0.02;
    document.body.style.setProperty('--fit', fit.toFixed(2));
  }
  return inner.offsetHeight <= main.clientHeight;
})()`;

function page({ kind, body, theme, background }) {
  const bg = background
    ? `<div class="bg photo" style="background-image:url('${background}')"></div>`
    : `<div class="bg gen"></div>`;
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="${fontCss("jua")}">
<link rel="stylesheet" href="${fontCss("gowun-dodum")}">
<style>
:root {
  --accent: ${theme.accent}; --accent-soft: ${theme.accentSoft}; --ink: ${theme.ink};
  --cover-from: ${theme.coverFrom}; --cover-to: ${theme.coverTo}; --cover-glow: ${theme.coverGlow};
}
${CSS}
</style>
</head>
<body class="${kind}${background ? " has-photo" : ""}">
${bg}<div class="overlay"></div>
${body}
</body>
</html>`;
}

function innerPage(post, ctx, { chip, main }) {
  return page({
    kind: "inner",
    theme: ctx.theme,
    background: ctx.background,
    body: `<div class="inner-wrap">
  <header>
    <div class="h-title">${rich(post.header.title)}</div>
    <div class="h-sub">${rich(post.header.subtitle)}</div>
  </header>
  <div class="chip">${chip}</div>
  <main><div>${main}</div></main>
  <footer>${escapeHtml(ctx.handle)}</footer>
</div>`,
  });
}

const pad2 = (n) => String(n).padStart(2, "0");

/**
 * @param post  생성된 게시물 데이터
 * @param ctx   { theme, handle, brandName, seriesNumber, background(file URL 또는 null) }
 * @returns 슬라이드별 HTML 문자열 배열
 */
export function buildSlides(post, ctx) {
  const slides = [];
  const cta = ctaTexts(ctx.cta);

  // 1. 표지
  slides.push(
    page({
      kind: "cover",
      theme: ctx.theme,
      background: ctx.background,
      body: `<div class="cover-wrap">
  <div class="pill">${escapeHtml(ctx.brandName)} · ${escapeHtml(post.series)} ${pad2(ctx.seriesNumber)}</div>
  <h1>
    <span class="line">${rich(post.cover.title_line1)}</span>
    <span class="line hl">${rich(post.cover.title_line2)}</span>
  </h1>
  <p class="sub">${rich(post.cover.subtitle)}</p>
  ${cta ? `<div class="cta-badge"><span class="txt">${rich(cta.coverBadge)}</span></div>` : ""}
  <div class="handle">${escapeHtml(ctx.handle)}</div>
</div>`,
    }),
  );

  // 2. 한눈에 보기
  slides.push(
    innerPage(post, ctx, {
      chip: "한눈에 보기",
      main: `<ul class="sum">${post.summary.items
        .map(
          (item, i) =>
            `<li><div class="t"><b>${pad2(i + 1)}.</b>${rich(item.title)}</div><div class="d">${rich(item.desc)}</div></li>`,
        )
        .join("")}</ul>
<p class="sum-close">${rich(post.summary.closing)}</p>`,
    }),
  );

  // 3. 본문
  post.details.forEach((detail, i) => {
    slides.push(
      innerPage(post, ctx, {
        chip: `<b>${pad2(i + 1)}.</b>${rich(detail.title)}`,
        main: `${detail.paragraphs.map((p) => `<p>${rich(p)}</p>`).join("")}
<div class="act-h">${rich(detail.action_heading)}</div>
<ul class="acts">${detail.actions.map((a) => `<li>${rich(a)}</li>`).join("")}</ul>
<div class="tip">${rich(detail.tip)}</div>`,
      }),
    );
  });

  // 4. 전·후 예시 (있는 게시물만)
  if (post.example) {
    slides.push(
      innerPage(post, ctx, {
        chip: rich(post.example.heading),
        main: `<div class="ex">${post.example.pairs
          .map(
            (pair) => `<div class="ex-pair">
  <div class="ex-row before"><span class="ex-mark">X</span><span>${rich(pair.before)}</span></div>
  <div class="ex-arrow"></div>
  <div class="ex-row after"><span class="ex-mark">O</span><span>${rich(pair.after)}</span></div>
</div>`,
          )
          .join("")}</div>`,
      }),
    );
  }

  // 5. 마무리
  slides.push(
    innerPage(post, ctx, {
      chip: "오늘의 정리",
      main: `<div class="outro-h">${rich(post.outro.headline)}</div>
${post.outro.lines.map((l) => `<p>${rich(l)}</p>`).join("")}
${
  cta
    ? `<div class="cta">
  <div class="cta-main"><span>${rich(cta.outroLine1)}</span><span class="l2">${rich(cta.outroLine2)}</span></div>
  <div>🔖 저장하고 ${escapeHtml(ctx.handle)} 팔로우</div>
</div>`
    : `<div class="cta">
  <div>🔖 저장해 두고 필요할 때 꺼내 보기</div>
  <div>${escapeHtml(ctx.handle)} 팔로우하고 다음 글 받기</div>
</div>`
}`,
    }),
  );

  return slides;
}
