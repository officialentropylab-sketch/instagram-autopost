# 인스타그램 카드뉴스 자동 업로드

매일 정해진 시간에 카드뉴스 게시물(표지 + 요약 + 본문 + 마무리, 총 7장)을 자동으로 만들어 인스타그램에 올립니다.
GitHub의 서버에서 실행되므로 내 PC가 꺼져 있어도 올라갑니다.

## 동작 순서

1. 매일 오후 7시(한국 시간)에 GitHub Actions가 실행됩니다.
2. Claude가 지금까지 올린 주제와 겹치지 않는 새 게시물의 글을 씁니다.
3. 글을 카드 이미지(1080×1350 JPEG)로 만들어 이 저장소의 `output/날짜/` 폴더에 저장합니다.
4. Instagram 공식 API로 캐러셀 게시물을 올립니다.
5. 올린 주제를 `data/history.json`에 기록합니다.

## 설정 방법

### 1단계. `config.json` 확인

@official.entropylab 계정에 맞춰 채워 두었습니다. 바꾸고 싶은 항목만 고치면 됩니다.

| 항목 | 설명 |
| --- | --- |
| `brand.name` | 표지 라벨에 들어가는 이름 |
| `brand.handle` | 카드 하단에 들어가는 계정 아이디 |
| `content.niche` | 계정이 다루는 분야 |
| `content.audience` | 주요 독자 |
| `content.tone` | 말투 |
| `content.persona` | 계정에 대한 **실제** 사실. 글에서 계정·운영자 이야기는 여기 적힌 범위 안에서만 합니다. 집필진 이력처럼 내세우고 싶은 사실이 있으면 추가하세요. |
| `content.rules` | 글을 쓸 때 반드시 지킬 규칙. 한 줄씩 추가·삭제할 수 있습니다. |
| `content.series` | 시리즈 이름 목록. 표지 라벨에 `생기부 엔트로피 · 세특 설계 01`처럼 번호가 붙습니다. |
| `content.fixedHashtags` | 모든 게시물에 붙는 해시태그 |
| `theme` | 강조 색상 |

배경 사진을 쓰려면 `assets/backgrounds/` 폴더에 직접 찍은 사진을 넣으세요. 비워 두면 기본 파스텔 배경을 씁니다.

### 2단계. GitHub 저장소 만들기

1. [github.com](https://github.com)에 가입하고 새 저장소를 **Public**으로 만듭니다.
   - 인스타그램 서버가 이미지를 가져가려면 공개 주소가 필요해서 Public이어야 합니다. 비밀번호·토큰은 저장소가 아닌 Secrets에 따로 보관되므로 노출되지 않습니다.
2. 이 폴더의 파일을 저장소에 올립니다. **`node_modules` 폴더는 올리지 않습니다.**
   - `.github` 폴더는 반드시 포함해야 합니다 (자동 실행 설정이 들어 있습니다).
   - [GitHub Desktop](https://desktop.github.com)을 쓰면 폴더째 올리기 쉽습니다.

### 3단계. Secrets 3개 등록

저장소의 **Settings → Secrets and variables → Actions → New repository secret**에서 등록합니다.

| 이름 | 값 | 발급 위치 |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Claude API 키 | [platform.claude.com](https://platform.claude.com) → API Keys (결제 수단 등록 필요) |
| `IG_ACCESS_TOKEN` | 인스타그램 액세스 토큰 | 아래 참고 |
| `GH_PAT` | GitHub 개인 액세스 토큰 | 아래 참고 |

**인스타그램 토큰 발급**

1. 인스타그램 앱에서 계정을 **프로페셔널 계정**(비즈니스 또는 크리에이터)으로 전환합니다.
2. [developers.facebook.com](https://developers.facebook.com)에서 개발자로 등록하고 앱을 만듭니다. 사용 사례는 Instagram 관련 항목을 고릅니다.
3. 앱 대시보드의 **Instagram → Instagram 로그인을 통한 API 설정**에서 내 인스타그램 계정을 추가하고 **토큰 생성**을 누릅니다.
4. 권한 요청 화면에서 콘텐츠 게시 권한(`instagram_business_content_publish`)을 허용합니다.
5. 생성된 토큰을 `IG_ACCESS_TOKEN`으로 등록합니다.

Meta 개발자 화면의 메뉴 이름은 자주 바뀌므로 실제 화면과 다를 수 있습니다.

**GitHub 개인 액세스 토큰 발급 (`GH_PAT`)**

인스타그램 토큰은 60일마다 만료됩니다. 매주 자동으로 연장해서 다시 저장하려면 이 토큰이 필요합니다.

1. GitHub **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
2. Repository access: 이 저장소만 선택
3. Permissions → Repository permissions → **Secrets: Read and write**
4. 만료 기간은 가능한 한 길게 설정합니다. 이 토큰이 만료되면 다시 발급해 등록해야 합니다.

### 4단계. 첫 실행

저장소의 **Actions** 탭 → **매일 인스타그램 게시물 올리기** → **Run workflow**를 누르면 바로 한 번 실행됩니다.
성공하면 인스타그램에 게시물이 올라가고, 이후에는 매일 자동으로 실행됩니다.

## 자주 바꾸는 설정

- **올리는 시간**: `.github/workflows/daily-post.yml`의 `cron: "0 10 * * *"`. UTC 기준이라 한국 시간에서 9시간을 뺀 값을 적습니다 (오후 7시 → 10). GitHub 사정에 따라 수십 분 늦게 실행될 수 있습니다.
- **본문 카드 수**: `config.json`의 `content.detailSlides`
- **잠시 멈추기**: Actions 탭에서 워크플로를 **Disable workflow**로 끕니다.

## 내 PC에서 미리 보기

카드 디자인만 확인할 때는 API 키 없이 예시 게시물로 이미지를 만들 수 있습니다. [Node.js](https://nodejs.org) 20 이상이 필요합니다.

```bash
npm install
```

```bash
npm run sample
```

결과는 `output/sample/` 폴더에 저장됩니다. `sample/sample-post.json`을 고치면 다른 문구로도 확인할 수 있습니다.

## 알아 둘 점

- 게시물은 사람의 검수 없이 올라갑니다. 처음 며칠은 올라온 게시물을 직접 확인해 보고, 마음에 들지 않는 부분은 `config.json`의 `tone`이나 `src/generate.js`의 안내문을 고쳐 주세요.
- 하루에 한 번만 올라갑니다. 같은 날 다시 실행해도 이미 올린 게시물은 건너뜁니다.
- 실패하면 GitHub가 가입한 이메일로 알림을 보냅니다. Actions 탭에서 실패 이유를 볼 수 있습니다.
