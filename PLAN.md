# design-canvas — 로컬 디자인 캔버스 (DEV-26, 오늘 MVP)

`docs/design/screens/*.html` 파일 하나가 곧 보드 하나다. 내보내기 단계는 없다.
Claude Code·Codex가 HTML을 쓰면 보드에 즉시 보이고, 보드에서 고친 내용은 HTML 원본에 바로 저장된다.
각자 로컬에서 실행하고, 공유는 git으로 한다.

## 0. 원칙

- **원본은 HTML 파일.** 캔버스 앱은 파일을 보여주고 고치는 창일 뿐이고, 자체 저장소를 두지 않는다.
- **추가 파일은 두 개만.** 둘 다 `docs/design/`에 커밋한다.
  - `board.json`: 보드 배치, 제목, 메모, 페이지
  - `comments.json`: 댓글
- **원본 서식 보존.** 편집할 때 HTML 원본에서 바뀐 범위만 고친다. 파일을 다시 직렬화하지 않는다.
- **위치는 팀 레포 `tools/design-canvas/`.** 브랜치는 `nemodleo/dev-26-design-canvas`(origin/main에서), 커밋과 PR은 `DEV-26`이다.
  - 루트 npm workspaces(`apps/*`, `packages/*`)에 **넣지 않는다**. 자체 `package.json`과 `package-lock.json`을 갖는 독립 패키지로 두어, 앱 설치·빌드·Vercel·CI(apps job)에 영향을 주지 않는다.
  - 루트 `package.json`에는 스크립트 두 줄만 추가한다.
    `"design": "npm --prefix tools/design-canvas start"`, `"design:install": "npm --prefix tools/design-canvas install"`
    (루트 package.json 변경으로 CI apps job이 돌지만 통과해야 한다.)
  - 기본 대상 폴더는 레포의 `docs/design`(스크립트 위치 기준 `../../docs/design`)이고, `--dir`로 바꿀 수 있다.
  - `tools/design-canvas/README.md`에 실행 방법과 Claude Code·Codex MCP 연결 방법을 적고, `AGENTS.md`의 "디자인" 관련 줄에 한 줄로 링크한다.
  - 이 PLAN.md는 `tools/design-canvas/PLAN.md`로 커밋한다.
- 범위 밖: Tweaks, 디자인 시스템 테마 메뉴, 실시간 공동 편집, 로그인.

## 1. 스택

| 부분 | 선택 |
|---|---|
| 런타임 | Node 20+ (팀 레포가 Node 24라 그대로 됨) |
| 앱 | Vite + React + TypeScript (한 패키지) |
| 서버 | Node `http` + `ws` + `chokidar` (Vite dev 서버 미들웨어 또는 별도 포트 4317) |
| HTML 파싱·패치 | `parse5` (`sourceCodeLocationInfo: true`) |
| MCP | `@modelcontextprotocol/sdk` (stdio). 앱 서버의 HTTP API를 부른다 |
| 스크린샷·내보내기 | `playwright` (선택 의존성, 없으면 해당 도구만 비활성) |

실행: 레포 루트에서 `npm run design:install`(처음 한 번) → `npm run design` → http://localhost:4317

## 2. 파일 형식

### board.json
```json
{
  "version": 1,
  "title": "farmclub 디자인",
  "pages": [{"id": "consumer", "name": "소비자"}],
  "boards": {
    "scr-01.html": {"x": 1320, "y": 0, "w": 390, "h": 1300, "title": "SCR-01 홈·발견", "page": "consumer"}
  },
  "order": ["scr-01.html"],
  "notes": {
    "tb": {"kind": "title", "x": 0, "y": -320, "text": "소비자 앱", "maxW": 6970},
    "nb": {"kind": "sticky", "x": 0, "y": -210, "w": 1330, "text": "토큰 메모"}
  }
}
```
- 키는 `screens/` 기준 상대 경로다. 하위 폴더도 허용한다.
- `pages`가 비면 페이지 탭 없이 한 판으로 보여준다. `page`가 없는 보드는 첫 페이지에 속한다.
- **초기값:** Claude Design 캔버스 `canvas.json`에서 변환한 `board.json`을 함께 준다. 98개 보드의 좌표가 이미 들어 있다.

### comments.json
```json
{"comments": [{"id": "c1", "file": "scr-32.html", "path": "1/2/0", "text": "간격 16으로", "author": "Hyun", "createdAt": "2026-10-09T09:00:00Z", "resolved": false}]}
```

- `board.json`의 초기값(98개 보드, 제목 메모 10개)은 주어진 파일을 `docs/design/board.json`으로 그대로 커밋한다.

### 새 보드 크기
- `board.json`에 없는 HTML이 생기면 `<meta name="board-size" content="390x844">`를 읽는다.
- 메타 태그가 없으면 390×844을 쓴다.
- 위치는 "새 화면" 줄의 맨 끝이다. 마지막 보드의 x + w + 80, y는 전체 최하단 + 120.
- 배치가 정해지면 `board.json`에 바로 기록한다.

## 3. 요소 경로 (선택·편집·MCP 공통)

- 루트는 `<body>`의 자식 요소다. 레포 파일은 `<div class="x-dc">`가 루트다.
- 경로는 요소 자식만 센 인덱스를 `/`로 이은 문자열이다. 예: `0/1/3`. 텍스트 노드와 주석은 세지 않는다.
- 브라우저 DOM(iframe)과 parse5 트리에 같은 규칙을 적용한다.
- 정적 HTML이라 둘은 일치한다. 불일치하면 편집을 거부하고 "파일이 바뀜, 다시 선택"을 띄운다.
- 편집 요청에는 대상 요소의 `outerHTML` 해시를 같이 보낸다. 서버는 해시가 다르면 거부한다. 다른 사람이나 AI가 그 사이에 파일을 고쳤을 때의 충돌을 막기 위해서다.

## 4. 서버 API (MCP와 앱이 같이 쓴다)

| 메서드 | 경로 | 하는 일 |
|---|---|---|
| GET | `/api/board` | board.json + 실제 파일 목록(누락·고아 표시) |
| PUT | `/api/board` | board.json 저장(배치·메모·페이지) |
| GET | `/screens/*` | HTML·자산 정적 서빙(same-origin, iframe용) |
| GET | `/api/file?f=` | 원본 HTML |
| POST | `/api/edit` | `{file, path, hash, op, …}` → 원본 패치(아래 op) |
| POST | `/api/undo`, `/api/redo` | 파일별 메모리 히스토리(최근 50) |
| GET/PUT | `/api/selection` | 현재 선택 `{file, path, text, outerHTML(4KB까지), styles}` |
| GET/POST | `/api/comments` | 댓글 목록·추가·해결 |
| POST | `/api/screenshot` | `{file, path?}` → PNG 경로 |
| WS | `/ws` | `file-changed`, `board-changed`, `selection-changed` 알림 |

편집 op:
- `setText {text}`: 자식이 텍스트 하나뿐인 요소만 대상. 그 텍스트 범위를 교체한다.
- `setStyle {prop, value}`: `style` 속성 안의 해당 선언만 추가·교체·삭제한다. `style` 속성이 없으면 새로 만든다.
- `setAttr {name, value}`
- `move {toParentPath, index}`: 원본 문자열에서 요소 구간을 잘라 대상 위치에 붙인다. 같은 파일 안에서만 허용한다.
- `wrap {paths[], display: "flex"|"grid", direction?}`: 같은 부모의 연속된 형제를 `<div style="display:flex;gap:8px">`로 감싼다.
- `delete`, `duplicate`

## 5. 앱 화면

- **캔버스**
  - 스페이스나 가운데 버튼 드래그로 이동, ⌘/Ctrl+휠로 확대(10~400%).
  - "전체 보기"와 "선택 보드로 이동" 버튼을 둔다.
  - 보드는 iframe으로 그린다. 위에 이름표(제목, 파일명)를 둔다.
  - 확대 상태에서는 iframe에 `pointer-events:none`을 주고, 편집 모드에서만 끈다.
- **보드 조작:** 이름표를 잡고 옮기면 `board.json`의 x, y가 바뀐다. 모서리를 끌면 w, h가 바뀐다.
- **메모:** 큰 제목(여러 보드를 묶음)과 포스트잇을 추가, 이동, 편집, 삭제할 수 있다.
- **페이지:** 상단 탭에서 페이지를 추가하고 이름을 바꾸고, 보드를 다른 페이지로 옮긴다.
- **편집 모드**(보드 더블클릭)
  - iframe 안에 오버레이 스크립트를 넣는다. same-origin이라 `contentDocument`로 직접 접근한다.
  - 마우스를 올리면 외곽선을 보여주고, 클릭하면 선택한다(Shift로 여러 개). Esc는 상위 요소를 선택한다.
  - 선택이 바뀌면 `PUT /api/selection`으로 서버에 알린다.
  - 더블클릭으로 글자를 바로 고치고, Enter나 포커스 이탈 때 `setText`를 보낸다.
  - **속성 패널**(오른쪽): 너비, 높이, padding, margin, gap, 글자 크기, 굵기, 색, 배경, 모서리, display, flex 방향, 정렬을 고친다. 값을 바꾸면 `setStyle`을 보낸다. 토큰 색 7개는 스와치로 준다.
  - 레이어 목록에서 끌어 순서를 바꾸면 `move`, "flex로 감싸기"와 "grid로 감싸기"는 `wrap`을 보낸다.
  - ⌘Z / ⌘⇧Z는 서버 undo, redo를 부른다.
- **Play:** 보드의 ▶ 버튼을 누르면 전체 화면 오버레이에서 상호작용할 수 있다. `<a href="scr-02.html">`이 그 안에서 바로 이동한다.
- **댓글:** 선택한 요소에 댓글을 달면 보드 위에 핀이 표시되고, 오른쪽 패널에 목록이 나온다.
- **즉시 반영:** WS로 `file-changed`가 오면 그 보드 iframe만 다시 불러온다. 스크롤 위치와 선택 경로는 유지한다.
- **복사 버튼:** 선택한 요소를 `scr-32.html 1/2/0 "문의 보내기" (button)` 형태로 복사한다. MCP를 연결하지 않은 에이전트에 붙여 넣는 용도다.

## 6. MCP 서버 (`node tools/design-canvas/bin/mcp.mjs`)

| 도구 | 입력 | 출력 |
|---|---|---|
| `list_boards` | `page?` | 파일, 제목, 크기, 페이지 |
| `read_board` | `file` | 원본 HTML |
| `get_selection` | – | 현재 선택(파일, 경로, 텍스트, outerHTML, 계산된 스타일). 없으면 "선택 없음" |
| `screenshot` | `file, path?` | PNG 파일 경로 |
| `list_comments` | `file?, unresolved?` | 댓글 |
| `add_comment` / `resolve_comment` | … | … |
| `place_board` | `file, x?, y?, title?, page?` | board.json 갱신(새 화면 제목·위치 지정용) |

HTML 생성과 수정은 에이전트가 평소처럼 파일을 직접 쓴다. MCP는 보고, 지목하고, 배치하는 역할만 맡는다.

연결:
```bash
# Claude Code
# Claude Code (레포 루트에서, 프로젝트 범위로 .mcp.json에 기록되어 팀이 공유)
claude mcp add --scope project design-canvas -- node tools/design-canvas/bin/mcp.mjs --port 4317
# Codex (~/.codex/config.toml, 각자)
[mcp_servers.design-canvas]
command = "node"
args = ["<레포 절대경로>/tools/design-canvas/bin/mcp.mjs", "--port", "4317"]
default_tools_approval_mode = "approve"  # 없으면 codex exec(승인 정책 never)에서 MCP 호출이 막힘
```

## 7. 오늘 순서 (마일스톤마다 커밋, 시간 초과 시 M6 제외)

| # | 내용 | 완료 기준 | 목표 |
|---|---|---|---|
| M0 | 브랜치, `tools/design-canvas` 뼈대(Vite·서버), `--dir`, 정적 서빙, 루트 스크립트, board.json 커밋 | `npm run design` → `/screens/scr-01.html` 열림, 루트 `npm ci`·`npm run typecheck`가 그대로 통과 | 0:30 |
| M1 | 캔버스(이동·확대), 보드 iframe, 이름표 이동·크기, 메모, 페이지, board.json 저장 | 98개 보드가 canvas.json 배치대로 보임, 옮기면 board.json 바뀜 | 1:30 |
| M2 | chokidar + WS, 바뀐 보드만 다시 불러오기, 새 파일 자동 배치 | 에디터로 HTML 저장 1초 안에 반영, 새 파일이 "새 화면" 줄에 생김 | 0:30 |
| M3 | Play 오버레이, 보드 간 링크 | scr-01에서 scr-04로 눌러서 이동 | 0:30 |
| M4 | 선택 오버레이 + `/api/selection` + MCP(list, read, get_selection, screenshot, comments, place) | Claude Code와 Codex에서 `get_selection`이 방금 클릭한 요소를 돌려줌 | 1:30 |
| M5 | parse5 경로·해시, setText, setStyle, setAttr, 속성 패널, undo·redo | 글자, 간격, 색을 고치면 원본에서 그 부분만 바뀜(`git diff`로 확인) | 2:00 |
| M6 | 레이어 목록, move, wrap(flex·grid), duplicate, delete | 순서 변경과 감싸기가 원본에 반영, 서식 유지 | 1:30 |
| M7 | 실제 시험(Codex로 "새 화면 만들어" → 자동 표시, Claude로 "선택한 것 고쳐" → 반영), README, AGENTS.md 한 줄, `.mcp.json`, draft PR | 두 에이전트 통과, CI 통과, 시험용 HTML 변경은 되돌림 | 0:30 |

## 8. 커밋·PR 규칙

- 마일스톤마다 커밋한다. 메시지는 `feat(design-canvas): … (DEV-26)` 형식이다. `board.json`은 `docs(design): … (DEV-26)`로 따로 커밋한다.
- 시험하면서 `docs/design/screens/*.html`을 고쳤다면 커밋 전에 되돌린다. 시험용 새 화면도 지운다.
- `node_modules`, 스크린샷 출력(`tools/design-canvas/.out/`)은 `.gitignore`에 넣는다.
- PR은 draft로 연다. 제목은 `[DEV-26] 로컬 디자인 캔버스`, 본문 "AI 사용" 칸을 채운다.
- 코드 상단에 `AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park` 주석을 단다. 과목 AI 보고서 규정 때문이다.

## 9. 확인할 위험

- **iframe 수 98개:** 화면에 보이는 보드만 그리고, 나머지는 썸네일이나 빈 틀로 둔다(IntersectionObserver). 확대율이 25% 미만이면 iframe 대신 썸네일을 쓴다.
- **경로 불일치:** 원본 공백 텍스트나 `<template>` 때문에 경로가 어긋날 수 있다. 경로와 해시를 함께 검증한다.
- **동시 수정:** AI와 사람이 같은 파일을 동시에 고칠 수 있다. 해시가 다르면 거부하고 다시 불러오게 한다.
- **iCloud:** 디자인 폴더가 iCloud 안에 있다. chokidar는 `awaitWriteFinish`를 켜고, `.icloud` 자리표시 파일은 무시한다.
