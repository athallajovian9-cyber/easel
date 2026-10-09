# design-canvas — 로컬 디자인 캔버스 (DEV-26)

디자인 작업용 도구다. `docs/design/screens/*.html` 파일 하나가 보드 하나다. 내보내기 단계는 없다.

- Claude Code·Codex가 HTML 파일을 쓰면 캔버스에 바로 보인다.
- 캔버스에서 고친 내용은 HTML 원본의 그 부분만 바뀐다. 파일 전체를 다시 쓰지 않아 서식이 그대로다.
- 배치는 `docs/design/board.json`, 댓글은 `docs/design/comments.json`에 저장하고 git으로 공유한다.

계획과 결정은 [PLAN.md](PLAN.md)에 있다.

## 실행

레포 루트에서:

```bash
npm run design:install   # 처음 한 번
npm run design           # http://localhost:4317
```

- 다른 디자인 폴더를 보려면 `npm --prefix tools/design-canvas start -- --dir <폴더> --port <포트>`.
- 앱 workspaces(`apps/*`, `packages/*`)와 따로 설치되는 독립 패키지라 앱 설치·빌드·배포에 영향이 없다.
- 스크린샷은 `playwright`가 쓴다. 내려받은 크로뮴이 없으면 설치된 Chrome을 쓴다. 둘 다 없으면 스크린샷만 안 된다. 결과는 `tools/design-canvas/.out/`(git 제외).

## 쓰는 법

| 하고 싶은 것 | 방법 |
| --- | --- |
| 이동 | 빈 곳·스페이스·가운데 버튼 드래그, 트랙패드 스크롤 |
| 확대 | ⌘/Ctrl + 휠(4~400%). 25% 미만이면 보드는 빈 틀로 보인다 |
| 보드 옮기기·크기 | 이름표를 끌기, 선택한 보드 오른쪽 아래 모서리를 끌기 |
| 메모 | `+ 제목`, `+ 메모`. 더블클릭으로 고치기, 선택 후 Delete |
| 페이지 | `+ 페이지`, 탭 더블클릭으로 이름 바꾸기, 보드 선택 후 "페이지로 옮기기" |
| 눌러 보기 | 이름표의 ▶ (화면 안 링크로 이동, Esc로 닫기) |
| 편집 모드 | 보드 더블클릭 또는 ✎. 클릭 선택, Shift 다중 선택, Esc 상위 선택 |
| 글자 고치기 | 편집 모드에서 글자를 더블클릭 → Enter |
| 스타일 | 오른쪽 속성 패널(너비·높이·여백·gap·글자·색·배경·모서리·정렬, 토큰 색 7개) |
| 순서·감싸기 | 레이어 목록에서 끌어 놓기, 여러 개 고른 뒤 "flex/grid로 감싸기" |
| 실행 취소 | ⌘Z / ⌘⇧Z (서버의 파일별 기록 50개) |
| 에이전트에 알려 주기 | 오른쪽 패널 "복사" → `scr-32.html 0/1/1/5 "문의 보내기" (a)` |

다른 사람이나 AI가 그사이 같은 요소를 고쳤으면 편집이 거부된다(해시 확인). 화면이 새로 그려진 뒤 다시 선택하면 된다.

## AI 에이전트 연결 (MCP)

앱(`npm run design`)을 켜 둔 상태에서 쓴다. MCP는 보고(`list_boards`, `read_board`, `screenshot`), 지목하고(`get_selection`, 댓글), 배치(`place_board`)만 한다. HTML은 에이전트가 파일을 직접 쓴다.

- **Claude Code**: 레포의 `.mcp.json`에 들어 있다. 레포에서 Claude Code를 열면 `design-canvas` 서버 사용을 한 번 승인한다.
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
