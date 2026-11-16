// Instagram 공식 API로 게시물을 올린다.
// 문서: https://developers.facebook.com/documentation/instagram-platform/content-publishing.md
//
// Meta 앱의 설정 방식에 따라 토큰 종류와 API 주소가 다르다. 토큰을 보고 자동으로 구분한다.
//   - 통합 로그인(Unified Login): graph.facebook.com, 계정 ID는 /me/assigned_instagram_accounts
//   - Instagram 로그인:           graph.instagram.com, 계정 ID는 /me
const API_VERSION = process.env.IG_API_VERSION || "";
const baseUrl = (host) => `https://${host}${API_VERSION ? `/${API_VERSION}` : ""}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function api(base, path, { method = "GET", body, token }) {
  const response = await fetch(`${base}/${path}`, {
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

// 토큰이 어느 방식인지 알아내고, 올릴 계정의 ID를 찾는다.
// 토큰에 연결된 계정이 config의 계정과 다르면 엉뚱한 계정에 올리지 않도록 멈춘다.
async function resolveAccount(token, handle) {
  const wanted = handle.replace(/^@/, "").toLowerCase();
  const sameName = (username) => username?.toLowerCase() === wanted;
  const attempts = [];

  try {
    const base = baseUrl("graph.facebook.com");
    const { data = [] } = await api(base, "me/assigned_instagram_accounts?fields=id,username", { token });
    const account = data.find((a) => sameName(a.username));
    if (account) return { base, userId: account.id, username: account.username };
    const names = data.map((a) => `@${a.username}`).join(", ") || "없음";
    attempts.push(`통합 로그인 토큰에 연결된 계정(${names}) 중에 ${handle}이(가) 없습니다.`);
  } catch (error) {
    attempts.push(`통합 로그인 방식: ${error.message}`);
  }

  try {
    const base = baseUrl("graph.instagram.com");
    const me = await api(base, "me?fields=user_id,username", { token });
    if (sameName(me.username)) return { base, userId: me.user_id, username: me.username };
    attempts.push(`Instagram 로그인 토큰의 계정(@${me.username})이 ${handle}과(와) 다릅니다.`);
  } catch (error) {
    attempts.push(`Instagram 로그인 방식: ${error.message}`);
  }

  throw new Error(`토큰으로 ${handle} 계정을 찾지 못했습니다.\n  - ${attempts.join("\n  - ")}`);
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
async function waitUntilReady(base, containerId, token) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const { status_code: status } = await api(base, `${containerId}?fields=status_code`, { token });
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
 * @param handle    올릴 계정 아이디 (예: "@my_account"). 토큰의 계정과 같은지 확인한다.
 * @returns { id, permalink }
 */
export async function publishToInstagram({ imageUrls, caption, handle }) {
  const token = process.env.IG_ACCESS_TOKEN;
  if (!token) throw new Error("IG_ACCESS_TOKEN 환경 변수가 필요합니다.");
  if (imageUrls.length === 0 || imageUrls.length > 20) {
    throw new Error(`이미지는 1~20장이어야 합니다 (현재 ${imageUrls.length}장)`);
  }

  const { base, userId, username } = await resolveAccount(token, handle);
  console.log(`계정 확인: @${username} (${new URL(base).host})`);

  await waitForImages(imageUrls);

  let creationId;
  if (imageUrls.length === 1) {
    const container = await api(base, `${userId}/media`, {
      method: "POST",
      token,
      body: { image_url: imageUrls[0], caption },
    });
    creationId = container.id;
  } else {
    const children = [];
    for (const url of imageUrls) {
      const item = await api(base, `${userId}/media`, {
        method: "POST",
        token,
        body: { image_url: url, is_carousel_item: true },
      });
      await waitUntilReady(base, item.id, token);
      children.push(item.id);
    }
    const carousel = await api(base, `${userId}/media`, {
      method: "POST",
      token,
      body: { media_type: "CAROUSEL", children: children.join(","), caption },
    });
    creationId = carousel.id;
  }

  await waitUntilReady(base, creationId, token);
  const published = await api(base, `${userId}/media_publish`, {
    method: "POST",
    token,
    body: { creation_id: creationId },
  });

  // 게시물 주소는 기록용이라, 조회에 실패해도 업로드 자체는 성공으로 본다.
  const info = await api(base, `${published.id}?fields=permalink`, { token }).catch(() => ({}));
  return { id: published.id, permalink: info.permalink ?? null };
}
