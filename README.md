# 인스타그램 카드뉴스 자동 업로드

매일 정해진 시간에 카드뉴스 게시물(표지 + 요약 + 본문 + 마무리, 총 7장)을 인스타그램에 올립니다.
GitHub의 서버에서 실행되므로 내 PC가 꺼져 있어도 올라가고, 별도의 유료 API를 쓰지 않습니다.

## 동작 순서

1. 매일 오후 7시(한국 시간)에 GitHub Actions가 실행됩니다.
2. `queue` 폴더에 미리 써 둔 게시물 중 아직 올리지 않은 것을 순서대로 하나 꺼냅니다.
3. 글을 카드 이미지(1080×1350 JPEG)로 만들어 이 저장소의 `output/날짜/` 폴더에 저장합니다.
4. Instagram 공식 API로 캐러셀 게시물을 올립니다.
5. 올린 게시물을 `data/history.json`에 기록합니다.

업로드에 실패한 날의 게시물은 버려지지 않고 다음 날 다시 올라갑니다.

## 게시물 채우기

게시물 글은 `queue` 폴더에 들어 있습니다. 하루에 하나씩 쓰이므로 다 떨어지기 전에 새로 채워야 합니다.
작성 기준과 파일 형식, 추가하는 방법은 [queue/README.md](queue/README.md)에 있습니다.

- 남은 게시물이 5개 이하가 되면 Actions 실행 결과에 경고가 표시됩니다.
- 0개가 되면 실행이 실패하고 GitHub가 이메일로 알려 줍니다.

## 설정 방법

### 1단계. `config.json` 확인

@official.entropylab 계정에 맞춰 채워 두었습니다. 바꾸고 싶은 항목만 고치면 됩니다.

| 항목 | 설명 |
| --- | --- |
| `brand.name` | 표지 라벨에 들어가는 이름 |
| `brand.handle` | 카드 하단에 들어가는 계정 아이디 |
| `content.niche`, `audience`, `tone`, `persona`, `rules` | 게시물 글을 쓸 때 참고하는 계정 정보와 규칙 |
| `content.series` | 시리즈 이름 목록. 표지 라벨에 `생기부 엔트로피 · 세특 설계 01`처럼 번호가 붙습니다. |
| `content.detailSlides` | 본문 카드 수 |
| `content.fixedHashtags` | 모든 게시물에 붙는 해시태그 |
| `theme` | 강조 색상 |

배경 사진을 쓰려면 `assets/backgrounds/` 폴더에 직접 찍은 사진을 넣으세요. 비워 두면 기본 파스텔 배경을 씁니다.

### 2단계. GitHub 저장소 만들기

1. [github.com](https://github.com)에 가입하고 새 저장소를 **Public**으로 만듭니다.
   - 인스타그램 서버가 이미지를 가져가려면 공개 주소가 필요해서 Public이어야 합니다. 토큰은 저장소가 아닌 Secrets에 따로 보관되므로 노출되지 않습니다.
2. 이 폴더의 파일을 저장소에 올립니다. `node_modules` 폴더가 있다면 올리지 않습니다.
   - 웹 화면에 끌어다 놓으면 `.github` 폴더는 빠집니다. 그 안의 파일 2개는 GitHub에서 **Add file → Create new file**로 직접 만들어야 합니다.

### 3단계. Secrets 2개 등록

저장소의 **Settings → Secrets and variables → Actions → New repository secret**에서 등록합니다.

| 이름 | 값 |
| --- | --- |
| `IG_ACCESS_TOKEN` | 인스타그램 액세스 토큰 |
| `GH_PAT` | GitHub 개인 액세스 토큰 |

**인스타그램 토큰 발급**

1. 인스타그램 앱에서 계정을 **프로페셔널 계정**(비즈니스 또는 크리에이터)으로 전환합니다.
2. [developers.facebook.com/apps](https://developers.facebook.com/apps)에서 앱을 만듭니다. 이용 사례는 **Instagram에서 메시지 및 콘텐츠 관리**를 고르고, 비즈니스 포트폴리오를 연결합니다.
3. 앱 대시보드에서 **이용 사례 → 맞춤 설정 → API setup with Unified login**(통합 로그인)으로 들어갑니다.
4. **1. 앱 구성**에서 **새로운 구성 만들기**를 눌러 구성을 만듭니다. 권한에 `instagram_content_publish`가 들어 있어야 합니다.
5. **2. 액세스 토큰 생성**에서 내 인스타그램 계정을 테스터로 추가하고, 인스타그램 웹의 **설정 → 앱 및 웹사이트 → 테스터 초대**에서 수락합니다.
6. **토큰 생성**을 눌러 나온 토큰을 `IG_ACCESS_TOKEN`으로 등록합니다. 토큰은 한 번만 표시됩니다.

Meta 개발자 화면의 메뉴 이름은 자주 바뀌므로 실제 화면과 다를 수 있습니다.
예전 방식(Instagram 로그인을 통한 API 설정)으로 받은 토큰도 그대로 쓸 수 있습니다. 프로그램이 토큰 종류를 자동으로 구분합니다.

**GitHub 개인 액세스 토큰 발급 (`GH_PAT`)**

예전 방식(Instagram 로그인)의 토큰을 쓸 때만 필요합니다. 그 토큰은 60일마다 만료되어, 매주 자동으로 연장해서 다시 저장하는 데 이 토큰을 씁니다.
통합 로그인 방식의 토큰은 이 방법으로 연장하지 않으므로 `GH_PAT`가 없어도 됩니다.

1. GitHub **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
2. Repository access: 이 저장소만 선택
3. Permissions → Repository permissions → **Secrets: Read and write**
4. 만료 기간은 가능한 한 길게 설정합니다. 이 토큰이 만료되면 다시 발급해 등록해야 합니다.

### 4단계. 첫 실행

저장소의 **Actions** 탭 → **매일 인스타그램 게시물 올리기** → **Run workflow**를 누르면 바로 한 번 실행됩니다.
성공하면 인스타그램에 게시물이 올라가고, 이후에는 매일 자동으로 실행됩니다.

## 자주 바꾸는 설정

- **올리는 시간**: `.github/workflows/daily-post.yml`의 `cron: "0 10 * * *"`. UTC 기준이라 한국 시간에서 9시간을 뺀 값을 적습니다 (오후 7시 → 10). GitHub 사정에 따라 수십 분 늦게 실행될 수 있습니다.
- **잠시 멈추기**: Actions 탭에서 워크플로를 **Disable workflow**로 끕니다.

## 내 PC에서 확인하기

[Node.js](https://nodejs.org) 20 이상이 필요합니다. 처음 한 번 설치합니다.

```bash
npm install
```

예시 게시물로 카드 디자인을 확인합니다. 결과는 `output/sample/` 폴더에 저장됩니다.

```bash
npm run sample
```

대기열에 남은 게시물을 전부 검사합니다. 게시물을 새로 추가했을 때 실행합니다.

```bash
npm run check
```

## 알아 둘 점

- 게시물은 `queue`에 있는 글 그대로 올라갑니다. 올라가기 전에 읽어 보고 고칠 수 있습니다.
- 하루에 한 번만 올라갑니다. 같은 날 다시 실행해도 이미 올린 게시물은 건너뜁니다.
- 이모지는 실행 환경의 글꼴로 그려지므로 내 PC에서 만든 이미지와 GitHub에서 만든 이미지의 이모지 모양이 조금 다릅니다.
- 실패하면 GitHub가 가입한 이메일로 알림을 보냅니다. Actions 탭에서 실패 이유를 볼 수 있습니다.
