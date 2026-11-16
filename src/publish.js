// Instagram 공식 API(Instagram 로그인 방식)로 게시물을 올린다.
// 문서: https://developers.facebook.com/docs/instagram-platform/content-publishing
const API_VERSION = process.env.IG_API_VERSION || "";
const API_BASE = `https://graph.instagram.com${API_VERSION ? `/${API_VERSION}` : ""}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function api(path, { method = "GET", body, token }) {
  const response = await fetch(`${API_BASE}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    const detail = data.error?.error_user_msg || data.error?.message || response.statusText;
    throw new Error(`Instagram API 오류 (${method} ${path.split("?")[0]}): ${detail}`);
  }
  return data;
}

// 인스타그램 서버가 이미지를 가져갈 수 있도록 공개 주소가 열릴 때까지 기다린다.
async function waitForImages(urls) {
  for (const url of urls) {
    let ok = false;
    for (let attempt = 0; attempt < 20 && !ok; attempt++) {
      const response = await fetch(url, { method: "HEAD" }).catch(() => null);
      ok = Boolean(response?.ok);
      if (!ok) await sleep(5000);
    }
    if (!ok) throw new Error(`이미지 주소에 접근할 수 없습니다: ${url}`);
  }
}

// 컨테이너(업로드 준비물)가 처리 완료될 때까지 기다린다.
async function waitUntilReady(containerId, token) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const { status_code: status } = await api(`${containerId}?fields=status_code`, { token });
    if (status === "FINISHED") return;
    if (status === "ERROR" || status === "EXPIRED") {
      throw new Error(`이미지 처리에 실패했습니다 (상태: ${status})`);
    }
    await sleep(5000);
  }
  throw new Error("이미지 처리 대기 시간이 초과되었습니다.");
}

/**
 * @param imageUrls 공개 접근 가능한 JPEG 주소들 (1장이면 단일 게시물, 2장 이상이면 캐러셀)
 * @param caption   캡션 (해시태그 포함)
 * @returns { id, permalink }
 */
export async function publishToInstagram({ imageUrls, caption }) {
  const token = process.env.IG_ACCESS_TOKEN;
  if (!token) throw new Error("IG_ACCESS_TOKEN 환경 변수가 필요합니다.");
  if (imageUrls.length === 0 || imageUrls.length > 20) {
    throw new Error(`이미지는 1~20장이어야 합니다 (현재 ${imageUrls.length}장)`);
  }

  await waitForImages(imageUrls);

  const userId = process.env.IG_USER_ID || (await api("me?fields=user_id", { token })).user_id;

  let creationId;
  if (imageUrls.length === 1) {
    const container = await api(`${userId}/media`, {
      method: "POST",
      token,
      body: { image_url: imageUrls[0], caption },
    });
    creationId = container.id;
  } else {
    const children = [];
    for (const url of imageUrls) {
      const item = await api(`${userId}/media`, {
        method: "POST",
        token,
        body: { image_url: url, is_carousel_item: true },
      });
      await waitUntilReady(item.id, token);
      children.push(item.id);
    }
    const carousel = await api(`${userId}/media`, {
      method: "POST",
      token,
      body: { media_type: "CAROUSEL", children: children.join(","), caption },
    });
    creationId = carousel.id;
  }

  await waitUntilReady(creationId, token);
  const published = await api(`${userId}/media_publish`, {
    method: "POST",
    token,
    body: { creation_id: creationId },
  });

  // 게시물 주소는 기록용이라, 조회에 실패해도 업로드 자체는 성공으로 본다.
  const info = await api(`${published.id}?fields=permalink`, { token }).catch(() => ({}));
  return { id: published.id, permalink: info.permalink ?? null };
}
