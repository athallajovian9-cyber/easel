# design-canvas — 로컬 디자인 캔버스

HTML 파일로 그리는 화면 디자인을 보드로 보여 주고, 캔버스에서 고친 내용을 원본 HTML에 직접 반영하는 로컬 도구다. Claude Code·Codex와 MCP·앱 안 채팅으로 연결된다. 내보내기 단계는 없다.

- 디자인 폴더의 `screens/*.html` 파일 하나가 보드 하나다. AI가 HTML을 쓰면 캔버스에 바로 보인다.
- 캔버스에서 고친 내용은 HTML 원본의 그 부분만 바뀐다. 파일 전체를 다시 쓰지 않아 서식이 그대로다.
- 배치는 `board.json`, 댓글은 `comments.json`, 토큰은 `tokens.json`(등록했을 때)에 저장하고 git으로 공유한다.

이 레포는 **독립 레포**다. 처음에는 [farmclub 팀 레포](https://github.com/snuhcs-course/swpp-2026-project-team-06)의 `tools/design-canvas`로 만들었고(DEV-26), 기록을 그대로 옮겨 왔다. 프로젝트에는 git 서브모듈로 넣어 쓴다. 계획과 결정은 [PLAN.md](PLAN.md), Claude Design 기본 기능과의 비교는 [PARITY.md](PARITY.md), 작업 기록은 [tasks.md](tasks.md).

## 다른 프로젝트에 넣어 쓰기 (서브모듈)

디자인 폴더가 `<프로젝트>/docs/design`(그 안에 `screens/`)일 때:

```bash
git submodule add https://github.com/nemodleo/design-canvas.git tools/design-canvas
```

프로젝트 루트 `package.json`에 스크립트를 둔다.

```json
{
  "scripts": {
    "design:install": "git submodule update --init tools/design-canvas && npm --prefix tools/design-canvas install",
    "design": "npm --prefix tools/design-canvas start"
  }
}
```

```bash
npm run design:install   # 처음 한 번(서브모듈 받기 + 설치)
npm run design           # http://localhost:4317
```

- `--dir` 기본값은 **이 도구 폴더 기준 `../../docs/design`**이다. 서브모듈을 `tools/design-canvas`에 두면 프로젝트의 `docs/design`을 바로 연다. 다른 곳이면 `npm --prefix tools/design-canvas start -- --dir <디자인 폴더> --port <포트>`.
- 프로젝트 앱과 따로 설치되는 독립 패키지라 앱 설치·빌드·배포에 영향이 없다. 서브모듈을 받지 않은 CI(`actions/checkout` 기본값)에도 영향이 없다.
- 스크린샷·축소 미리보기는 `playwright`가 쓴다. 내려받은 크로뮴이 없으면 설치된 Chrome을 쓴다. 둘 다 없으면 그 기능만 안 된다.

### 서브모듈 갱신

1. 이 레포(nemodleo/design-canvas)에 고친 것을 push한다(도구를 고치려면 이 레포에 PR).
2. 프로젝트에서 `git submodule update --remote tools/design-canvas`
3. 바뀐 서브모듈 포인터를 커밋한다: `git add tools/design-canvas && git commit -m "chore: design-canvas 갱신"`

팀원은 `git pull` 뒤 `git submodule update --init tools/design-canvas`(또는 `npm run design:install`)로 같은 커밋을 받는다.

## 단독 실행

```bash
npm install
npm start -- --dir <디자인 폴더>
```

## 쓰는 법

Claude Design 기본 기능과의 비교·근거는 [PARITY.md](PARITY.md), 화면별 점검 스크린샷은 `.out/ux/`(로컬).

| 하고 싶은 것 | 방법 |
| --- | --- |
| 이동·확대 | 빈 곳·스페이스·손(H) 끌기, 트랙패드 스크롤, ⌘휠·핀치(4~400%). ⇧1 전체, ⇧2 선택, ⌘0 100%, 미니맵(M) |
| 찾기 | 왼쪽 "보드" 탭 ⌘K 검색·목록, 페이지(끌어서 순서, 우클릭 이름·삭제·시작 페이지) |
| 보드 | 보드 도구(B)로 그리기 또는 "새 보드" 틀(빈·모바일·PC·문서), HTML 파일을 캔버스에 끌어 놓기. 복제 ⌘D, 이름 F2(파일 이름은 참조 갱신 제안), 삭제(확인·휴지통·실행 취소), 맨 앞/뒤 ⌘] ⌘[ |
| 여러 개 | 빈 곳 끌어 영역 선택·Shift, 함께 옮기기(스냅 안내선, Alt로 끔), 화살표 1·Shift 10·Option 100 |
| 보드 옵션 | 오른쪽 "속성": 위치·크기·모서리·틀 없이·눌러 보는 보드·페이지형·시작 화면, 레이아웃 가이드(열·행·격자 6개, ⌃G), Tweaks |
| 보기 | 전체 화면(F, ←→), 그 자리에서 Play(P·▶, Esc), 전체 화면 Play(우클릭) |
| 메모·도형 | 제목(T)·포스트잇(N, 8색·크기·굵게·기울임), 사각형(R)·타원(O)·선(L)·화살표(A)·펜(P는 보드 Play와 같은 키: 보드를 고르지 않았을 때), 이미지(자산·붙여넣기) |
| 편집 모드 | 더블클릭·E. 클릭·Shift, Esc 상위, Enter 자식, ↑↓ 형제, Option+↑↓ 순서, ⌘A 형제 모두, ⌘G flex로 감싸기 |
| 직접 편집 | 손잡이로 옮기기(Alt는 상자 안)·크기, 정렬 6개, 글자 더블클릭(Shift+Enter 줄바꿈), 속성 패널(토큰 칩·⚠·명암비), 이미지 바꾸기, ⌘C/⌘V로 다른 보드에 붙이기 |
| 실행 취소 | ⌘Z / ⌘⇧Z. 캔버스 조작·HTML 편집·보드 만들기/삭제가 한 기록(100개) |
| 디자인 시스템 | 왼쪽 "토큰" 탭에서 등록(docs/design/tokens.json)·테마, 도구 막대 테마 메뉴, 오른쪽 토큰 검사·접근성 목록 |
| 협업 | 댓글(답글·해결·작성자), 스냅숏 메뉴(디자인 폴더만 git 커밋) |
| AI | 오른쪽 "AI"(⌘J): Claude Code·Codex 고르기, 선택·보드·보이는 보드·댓글·참고 자료가 맥락으로, 안 N개, 리뷰 요청 |
| 화면 | F6 영역 이동, Tab 보드 이동, ⌘\\ 패널 숨기기, 화면 모드(시스템·밝게·어둡게) |

다른 사람이나 AI가 그사이 같은 요소를 고쳤으면 편집이 거부된다(해시 확인). 화면이 새로 그려진 뒤 다시 선택하면 된다.

## AI 에이전트 연결 (MCP)

앱(`npm run design`)을 켜 둔 상태에서 쓴다. MCP는 보고(`list_boards`, `read_board`, `screenshot`, `list_errors`, `get_tokens`, `check_tokens`), 지목하고(`get_selection`, 댓글·답글), 캔버스를 정리한다(`place_board`, `create_board`, 메모·페이지, `save_snapshot`). HTML은 에이전트가 파일을 직접 쓴다. 앱 안 채팅(⌘J)은 같은 에이전트를 `claude -p`·`codex exec`로 띄운다.

- **Claude Code**: 프로젝트 루트 `.mcp.json`에 둔다. 프로젝트에서 Claude Code를 열면 `design-canvas` 서버 사용을 한 번 승인한다.

  ```json
  { "mcpServers": { "design-canvas": { "type": "stdio", "command": "node", "args": ["tools/design-canvas/bin/mcp.mjs", "--port", "4317"] } } }
  ```
- **Codex**: 각자 `~/.codex/config.toml`에 한 번 등록한다.

  ```toml
  [mcp_servers.design-canvas]
  command = "node"
  args = ["<레포 절대경로>/tools/design-canvas/bin/mcp.mjs", "--port", "4317"]
  # 이 서버의 도구는 보기·댓글·배치만 하므로 매번 묻지 않게 한다(없으면 codex exec에서 호출이 막힌다)
  default_tools_approval_mode = "approve"
  ```

예시 요청: "캔버스에서 선택한 것 고쳐: 글자를 '농가에 문의 보내기'로", "새 화면 scr-34.html 만들어(390×844)". 새 HTML은 `<meta name="board-size" content="390x844">`가 있으면 그 크기로 "새 화면" 줄에 자동 배치되고, `place_board`로 제목·위치를 정할 수 있다.

## 개발

- `npm test`(단위), `npm run test:e2e`(Playwright, 기본은 `test/fixtures/design`의 작은 폴더. 실제 폴더로 돌리려면 `DESIGN_CANVAS_E2E_DIR=<docs/design>`).

```bash
npm --prefix tools/design-canvas test        # 원본 패치 단위 테스트
npm --prefix tools/design-canvas run typecheck
```

| 폴더 | 내용 |
| --- | --- |
| `bin/` | `server.mjs`(앱 서버), `mcp.mjs`(MCP stdio) |
| `server/` | API(`index.mjs`, `routes.mjs`), board.json(`board.mjs`), 파일 감시(`watch.mjs`), 요소 경로·해시(`html.mjs`), 원본 패치(`edit.mjs`) |
| `app/` | 캔버스 화면(Vite + React + TypeScript) |
| `test/` | `node --test` |
