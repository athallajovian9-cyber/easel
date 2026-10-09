# tasks.md — tools/design-canvas

## DEV-26 로컬 디자인 캔버스

- 이슈: DEV-26 · 브랜치: `nemodleo/dev-26-design-canvas`
- 계획(spec 역할): [PLAN.md](PLAN.md)
- 목표: `docs/design/screens/*.html`을 보드로 보여 주고 원본을 직접 고치는 로컬 캔버스. Claude Code·Codex가 MCP로 선택·스크린샷·댓글·배치를 공유한다.
- 범위(수정 허용 경로): `tools/design-canvas/**`, `docs/design/board.json`, `docs/design/comments.json`, 루트 `package.json`의 `design`·`design:install` 스크립트, 루트 `.mcp.json`, `AGENTS.md`의 디자인 한 줄
- 비범위: 앱(`apps/`, `packages/`), 루트 workspaces, Tweaks·테마 메뉴·실시간 공동 편집·로그인

### 작업
- [x] M0 뼈대·정적 서빙·루트 스크립트·board.json
- [x] M1 캔버스·보드·이름표·메모·페이지·저장
- [x] M2 파일 감시·바뀐 보드만 다시 불러오기·새 파일 자동 배치
- [x] M3 Play·보드 간 링크
- [x] M4 선택 오버레이·/api/selection·댓글·스크린샷·MCP
- [x] M5 원본 패치(setText·setStyle·setAttr)·속성 패널·실행 취소
- [x] M6 레이어·move·wrap·duplicate·delete
- [x] M7 README·AGENTS.md·.mcp.json·draft PR, Codex 시험(새 화면 자동 표시, get_selection·place_board·선택한 것 고치기)
- [ ] M7 Claude Code 시험: CLI 로그인 만료로 못 함(`claude /login` 뒤 다시)

### 결정 사항
- 10/09 최소 확대율 4%(PLAN 10%): 보드 98장 전체(높이 약 17,700)를 한 화면에 보이려고.
- 10/09 요소 해시는 서버가 원본 HTML 구간(parse5 위치)으로 계산한다. 브라우저 outerHTML은 원본 서식과 달라 해시가 어긋나기 때문.
- 10/09 자동 배치한 보드는 `autoPlaced: true`를 board.json에 남긴다. 다음 새 파일을 같은 줄 오른쪽에 잇기 위해서이고, 옮기면 지운다.
- 10/09 Vite는 미들웨어로 붙이고 HMR은 끈다(별도 포트 연결 실패 방지). 코드 수정 뒤 브라우저 새로 고침.
- 10/09 Codex는 MCP 서버에 `default_tools_approval_mode = "approve"`가 있어야 codex exec에서 도구를 부를 수 있다(README·PLAN에 반영).

### 기록
- 10/09 M0~M6 완료, 마일스톤마다 커밋.
- 10/09 M7: Codex로 새 화면 생성 → 자동 배치·표시, get_selection·place_board·선택 요소 글자 수정 통과. Claude Code CLI는 OAuth 만료로 시험 못 함. 시험으로 바뀐 HTML·board.json은 되돌림.
