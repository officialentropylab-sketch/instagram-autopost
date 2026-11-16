// 인스타그램 액세스 토큰(유효 기간 60일)을 연장하고, 새 토큰을 GitHub Secret에 다시 저장한다.
// GitHub Actions에서 매주 실행된다. 필요한 환경 변수:
//   IG_ACCESS_TOKEN  현재 토큰
//   GH_TOKEN         Secret 쓰기 권한이 있는 GitHub 개인 액세스 토큰 (GH_PAT)
//   GITHUB_REPOSITORY  owner/repo (Actions가 자동으로 넣어 준다)
import { spawnSync } from "node:child_process";

const token = process.env.IG_ACCESS_TOKEN;
if (!token) throw new Error("IG_ACCESS_TOKEN 환경 변수가 필요합니다.");
if (!process.env.GH_TOKEN) {
  throw new Error("GH_PAT Secret이 없어 새 토큰을 저장할 수 없습니다. README의 4단계를 확인하세요.");
}

// 이 엔드포인트는 토큰을 쿼리 파라미터로만 받는다 (Meta 공식 문서 기준).
const url = new URL("https://graph.instagram.com/refresh_access_token");
url.searchParams.set("grant_type", "ig_refresh_token");
url.searchParams.set("access_token", token);
const response = await fetch(url);
const data = await response.json();
if (!response.ok || !data.access_token) {
  throw new Error(`토큰 연장 실패: ${data.error?.message ?? response.statusText}`);
}

// 로그에 토큰이 찍히지 않도록 가린다.
console.log(`::add-mask::${data.access_token}`);

const result = spawnSync(
  "gh",
  ["secret", "set", "IG_ACCESS_TOKEN", "--repo", process.env.GITHUB_REPOSITORY],
  { input: data.access_token, encoding: "utf8" },
);
if (result.status !== 0) {
  throw new Error(`새 토큰을 GitHub Secret에 저장하지 못했습니다: ${result.stderr || result.error?.message}`);
}

const days = Math.round(data.expires_in / 86400);
console.log(`토큰을 연장했습니다. 앞으로 ${days}일 동안 유효합니다.`);
