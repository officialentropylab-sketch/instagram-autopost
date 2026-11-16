// Claude API로 오늘 올릴 카드뉴스의 글(슬라이드 문구 + 캡션)을 만든다.
import Anthropic from "@anthropic-ai/sdk";

const CAPTION_LIMIT = 2200; // 인스타그램 캡션 최대 글자 수
const HASHTAG_LIMIT = 30;
const MAX_ATTEMPTS = 3;

const str = (description) => ({ type: "string", description });
const obj = (properties) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

function buildSchema(config) {
  return obj({
    topic: str("이 게시물의 주제를 한 문장으로. 나중에 주제 중복을 피하는 기록으로 쓰인다."),
    series: { type: "string", enum: config.content.series, description: "이 게시물이 속하는 시리즈" },
    cover: obj({
      title_line1: str("표지 제목 첫 줄. 공백 포함 9자 이내 + 이모지 0~1개"),
      title_line2: str("표지 제목 둘째 줄(강조 색으로 표시됨). 공백 포함 10자 이내 + 이모지 0~1개"),
      subtitle: str("표지 부제. 독자가 '내 얘기다' 싶게 만드는 한 줄, 22자 이내"),
    }),
    header: obj({
      title: str("본문 카드 상단에 반복해서 들어가는 제목. 22자 이내"),
      subtitle: str("그 아래 한 줄 설명. 24자 이내"),
    }),
    summary: obj({
      items: {
        type: "array",
        description: "본문 카드와 같은 개수, 같은 순서의 요약",
        items: obj({ title: str("본문 카드 제목과 동일"), desc: str("핵심 행동 한 줄, 22자 이내") }),
      },
      closing: str("요약 카드 맨 아래 한 줄. 26자 이내"),
    }),
    details: {
      type: "array",
      description: `본문 카드. 정확히 ${config.content.detailSlides}개`,
      items: obj({
        title: str("카드 제목. 14자 이내"),
        paragraphs: {
          type: "array",
          description: "공감 → 이유 순서의 짧은 문단 2개. 각 60자 이내",
          items: { type: "string" },
        },
        action_heading: str("실천 목록 머리말. 이모지 1개 포함, 14자 이내"),
        actions: {
          type: "array",
          description: "바로 따라 할 수 있는 구체적 행동 3개. 각 26자 이내",
          items: { type: "string" },
        },
        tip: str("한 줄 팁. 이모지로 시작, 42자 이내"),
      }),
    },
    outro: obj({
      headline: str("마무리 카드의 큰 문구. 두 줄(줄바꿈 \\n 한 번), 각 줄 12자 이내"),
      lines: { type: "array", description: "짧은 격려 문장 2개. 각 32자 이내", items: { type: "string" } },
    }),
    caption: str("인스타그램 캡션 본문(해시태그 제외). 1,500자 이내"),
    hashtags: {
      type: "array",
      description: "이 게시물 주제에 맞는 해시태그 3~5개. '#'으로 시작",
      items: { type: "string" },
    },
  });
}

function buildSystemPrompt(config) {
  const { brand, content } = config;
  const persona = content.persona?.trim();
  const rules = (content.rules ?? []).map((rule) => `- ${rule}`).join("\n");
  return `당신은 인스타그램 계정 ${brand.handle}(${brand.name})의 카드뉴스 콘텐츠를 쓰는 에디터입니다.

# 계정
- 분야: ${content.niche}
- 독자: ${content.audience}
- 말투: ${content.tone}

# 이 게시물이 쓰이는 방식
매일 한 개씩, 사람의 검수 없이 자동으로 발행됩니다. 그래서 틀리거나 과장된 내용이 그대로 올라갑니다. 독자는 이 글을 믿고 자기 준비 방식을 바꾸는 학생과 학부모이므로, 널리 받아들여지는 내용과 실제로 따라 할 수 있는 행동만 담아 주세요.

게시물은 여러 장의 카드로 구성됩니다: 표지 → 한눈에 보기(요약) → 본문 카드 ${content.detailSlides}장 → 마무리. 독자는 표지 한 장을 보고 넘길지 말지를 정하고, 넘긴 뒤에는 카드마다 한 가지 행동만 가져갑니다. 카드는 작은 휴대폰 화면에서 읽히니 문장은 짧게, 한 카드에는 한 가지 이야기만 담습니다.

# 좋은 게시물의 기준
- 주제가 좁고 구체적입니다. 분야 전체를 훑는 글이 아니라, 독자가 자주 하는 실수 하나나 막히는 지점 하나를 다룹니다.
- 표지는 독자가 자기 상황을 떠올리며 멈추게 만듭니다.
- 각 본문 카드는 '공감되는 상황 → 왜 그런지 → 이렇게 해 보세요' 흐름입니다.
- 실천 항목은 오늘 당장 할 수 있는 행동입니다. "열심히 하기" 같은 다짐이 아니라, 무엇을 어디에 어떻게 적을지까지 알 수 있는 행동이어야 합니다.
- 날짜가 주어지면 그 시기 독자의 상황(학기 초, 시험 기간, 학기 말, 방학 등)에 맞는 주제를 고릅니다.

# 사실에 관한 규칙
- 통계 수치, 연구 결과, 특정 인물의 사례를 지어내지 않습니다. 출처를 댈 수 없는 숫자는 쓰지 않습니다.
- ${
    persona
      ? `이 계정에 대해 알려진 사실은 다음이 전부입니다: "${persona}". 계정이나 운영자에 관한 이야기는 이 범위 안에서만 하고, 여기에 없는 경험담·실적·사례를 만들어 내지 않습니다.`
      : `계정 운영자의 개인 경험담("저는 ~했어요", "제가 가르친 학생은 ~")은 쓰지 않습니다. 운영자에 대해 알려진 사실이 없기 때문입니다. 일반적인 조언의 형태로 씁니다.`
  }
- 성적 향상이나 합격을 보장하는 표현은 쓰지 않습니다.
- 의학·심리 상담이 필요한 주제(수면 장애, 우울, 약물 등)는 다루지 않습니다.
${rules}

# 표기
- 카드 문구에서 강조할 핵심 구절은 **이렇게** 감쌉니다. 카드 하나에 1~3곳만 강조합니다. 표지와 제목류에는 쓰지 않습니다.
- 이모지는 분위기를 살리는 정도로 가볍게 씁니다.
- 각 필드의 글자 수 제한은 카드 안에 글이 들어가기 위한 것이니 지켜 주세요.

# 캡션
카드 내용을 글로 풀어 쓴 것입니다. 첫 줄에서 주제를 밝히고, 저장·공유를 권하는 한두 줄, 본문 카드별 요약(번호 포함), 마무리 한마디 순서로 씁니다. 문단 사이는 빈 줄로 구분합니다. 해시태그는 캡션에 넣지 말고 hashtags 필드에만 넣습니다.`;
}

function buildUserPrompt({ history, date }) {
  const recent = history.slice(-90);
  const list = recent.length
    ? recent.map((h) => `- ${h.date} [${h.series}] ${h.topic}`).join("\n")
    : "(아직 없음)";
  return `오늘 날짜: ${date} (한국 시간)

지금까지 올린 게시물:
${list}

위 게시물과 주제·접근이 겹치지 않는 새 게시물을 하나 써 주세요. 최근에 자주 쓴 시리즈보다 덜 쓴 시리즈를 우선해 주세요. 교육·인문·자연·메디컬 계열도 한쪽에 치우치지 않게 골고루 다뤄 주세요.`;
}

async function requestPost(client, { config, history, date }) {
  const params = {
    model: config.model ?? "claude-opus-5-5",
    max_tokens: 16000,
    output_config: {
      effort: "high",
      format: { type: "json_schema", schema: buildSchema(config) },
    },
    system: buildSystemPrompt(config),
    messages: [{ role: "user", content: buildUserPrompt({ history, date }) }],
  };

  let response;
  try {
    // 모델이 요청을 거절하면 서버가 자동으로 대체 모델로 다시 시도한다.
    response = await client.beta.messages.create({
      ...params,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
  } catch (error) {
    if (!(error instanceof Anthropic.BadRequestError)) throw error;
    console.warn(`대체 모델 옵션 없이 다시 요청합니다 (${error.message})`);
    response = await client.messages.create(params);
  }

  if (response.stop_reason !== "end_turn") {
    throw new Error(`글 생성이 정상적으로 끝나지 않았습니다 (stop_reason: ${response.stop_reason})`);
  }
  const text = response.content.find((block) => block.type === "text")?.text;
  if (!text) throw new Error("응답에 글이 없습니다.");
  return JSON.parse(text);
}

// 카드에 들어가지 않거나 인스타그램 제한을 넘는 결과를 걸러낸다.
function validate(post, config) {
  const problems = [];
  const expected = config.content.detailSlides;
  if (post.details.length !== expected) problems.push(`본문 카드가 ${post.details.length}개 (필요: ${expected}개)`);
  if (post.summary.items.length !== post.details.length) problems.push("요약 항목 수가 본문 카드 수와 다름");
  for (const [i, d] of post.details.entries()) {
    if (d.paragraphs.length === 0 || d.paragraphs.length > 3) problems.push(`본문 ${i + 1}: 문단 수`);
    if (d.actions.length < 2 || d.actions.length > 4) problems.push(`본문 ${i + 1}: 실천 항목 수`);
  }
  if (post.outro.lines.length > 3) problems.push("마무리 문장이 너무 많음");
  if (!post.caption.trim()) problems.push("캡션이 비어 있음");
  return problems;
}

function buildFullCaption(post, config) {
  const tags = [...new Set([...post.hashtags, ...config.content.fixedHashtags])]
    .map((t) => (t.startsWith("#") ? t : `#${t}`).replace(/\s+/g, ""))
    .slice(0, HASHTAG_LIMIT);
  return `${post.caption.trim()}\n\n${tags.join(" ")}`;
}

export async function generatePost({ config, history, date }) {
  const client = new Anthropic(); // ANTHROPIC_API_KEY 환경 변수를 사용
  let lastProblem;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const post = await requestPost(client, { config, history, date });
    const problems = validate(post, config);
    const fullCaption = buildFullCaption(post, config);
    if (fullCaption.length > CAPTION_LIMIT) problems.push(`캡션이 ${fullCaption.length}자 (최대 ${CAPTION_LIMIT}자)`);
    if (problems.length === 0) return { ...post, fullCaption };
    lastProblem = problems.join(", ");
    console.warn(`생성 결과를 다시 요청합니다 (${attempt}/${MAX_ATTEMPTS}): ${lastProblem}`);
  }
  throw new Error(`쓸 수 있는 게시물을 만들지 못했습니다: ${lastProblem}`);
}
