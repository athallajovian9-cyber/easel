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
- [x] M7 Claude Code 시험(.mcp.json): get_selection·선택한 것 고치기·새 화면 자동 배치·place_board 통과(10/09)

### 결정 사항
- 10/09 최소 확대율 4%(PLAN 10%): 보드 98장 전체(높이 약 17,700)를 한 화면에 보이려고.
- 10/09 요소 해시는 서버가 원본 HTML 구간(parse5 위치)으로 계산한다. 브라우저 outerHTML은 원본 서식과 달라 해시가 어긋나기 때문.
- 10/09 자동 배치한 보드는 `autoPlaced: true`를 board.json에 남긴다. 다음 새 파일을 같은 줄 오른쪽에 잇기 위해서이고, 옮기면 지운다.
- 10/09 Vite는 미들웨어로 붙이고 HMR은 끈다(별도 포트 연결 실패 방지). 코드 수정 뒤 브라우저 새로 고침.
- 10/09 Codex는 MCP 서버에 `default_tools_approval_mode = "approve"`가 있어야 codex exec에서 도구를 부를 수 있다(README·PLAN에 반영).

### 기록
- 10/09 M0~M6 완료, 마일스톤마다 커밋.
- 10/09 M7: Codex로 새 화면 생성 → 자동 배치·표시, get_selection·place_board·선택 요소 글자 수정 통과. Claude Code CLI는 OAuth 만료로 시험 못 함. 시험으로 바뀐 HTML·board.json은 되돌림.

### 후속: Claude Design 기본 기능(P0~P5, 기준 PARITY.md)
- 범위 추가: `docs/design/tokens.json`(토큰 등록 시), `docs/design/.trash`·`.refs`·`.thumbs`(각자 `.gitignore *`). Tweaks·테마 메뉴는 대체 형태로 범위에 넣음.
- [x] P0 안전·버그: 원자적 쓰기, 메모 id, `/` 링크, 끼운 보드 갱신, board.json 정렬·한 줄
- [x] P1 캔버스 기본: 보드 관리, 우클릭, 한 기록 실행 취소, 다중 선택·스냅·순서, 전체 화면·시작 화면·페이지형, 보드 옵션, 검색·미니맵·상태 기억
- [x] P2 AI: 채팅 패널(claude -p·codex exec), 댓글·참고 자료, 선택 세부 값, 오류 보드, MCP 메모·페이지·틀, 안 N개
- [x] P3 직접 편집: 요소 끌기·크기·정렬, flex 밖 끌기 고정, 속성·grid 칸 수, 이미지·자산, 보드 간 복사, 한글 조합
- [x] P4 그리기·도구: 메모 옵션, 도형, 레이아웃 가이드, 페이지 관리, 단축키, 화면 모드
- [x] P5 디자인 시스템·협업: 토큰·테마·경고·접근성, 댓글 답글·git 스냅숏, Tweaks, Windows·바인딩 점검
- [x] 마무리: 축소 미리보기·그 자리 Play·여러 줄 글자·이름 바꾸기 따라가기·키보드 탐색·가져오기 → PARITY PASS 73, N/A 1(#45 온라인 공유)

### 결정 사항(후속)
- 10/09 실행 취소는 서버 한 기록(`history.mjs`): HTML 편집과 board.json·보드 파일 생성/삭제를 같은 줄에 쌓고, 밖에서 바뀌면 409로 비운다.
- 10/09 보드·파일을 바꾸는 요청과 자동 배치는 `store.exclusive`로 직렬화(실행 취소 중 자동 배치가 지운 보드를 되살리던 경쟁).
- 10/09 오류 수집·Tweaks 적용은 화면 HTML을 보낼 때 `<head>`에 스크립트를 끼워서 한다(파일은 그대로, 요소 경로는 `<body>` 기준이라 영향 없음).
- 10/09 도형(`shapes`)은 메모처럼 id 키 객체로 한 줄씩(두 브랜치 병합 충돌 방지).
- 10/09 스냅숏은 디자인 폴더 경로만 커밋하고 되돌리기는 하지 않는다(git으로 직접).
- 10/09 접근성 누르는 영역 기준은 README 토큰의 48(N-02), 글자 명암 4.5(큰 글자 3).

### 기록(후속)
- 10/09 P0~P5와 마무리 완료, 단계마다 push·PR #63 진행표 갱신. e2e 8개(선택→편집→원본, 파일 감시·끼운 보드·루트 링크, 보드 만들기·삭제·undo·한 기록, 채팅 패널) 매 단계 통과, 단위 30개.
- 10/09 AI 항목은 실제 Claude Code·Codex로 편집·안 2개 확인(임시 폴더). 시험 중 바뀐 docs/design은 없음(모두 임시 복사본에서).
