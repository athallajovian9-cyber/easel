# Claude Design 기능 대조표 (DEV-26)

`tools/design-canvas`(커밋 6d323cc)가 Claude Design 캔버스와 같은지 항목별로 확인한 결과다. 2026-10-09에 확인했고, 이번에는 고치지 않았다.

- **범위**: 내보내기(PDF·PPTX·이미지·외부 전송)는 제외한다. 온라인 기능은 로컬 대체가 있는지만 본다.
- **기준**: 사용자 체크리스트 67개 + [공식 도움말](https://support.claude.com/en/articles/14604416-get-started-with-claude-design)에서 추가한 7개(#68~74).
- **방법**: `npm run design`을 띄우고 Playwright(Chrome)로 실제 조작했다. 조작으로 확인할 수 없는 항목은 코드를 보고 판정했다(근거에 "코드").
- **판정**: PASS / PARTIAL / MISSING / N/A(로컬 대체 불필요). 난이도 S(반나절 이하) · M(하루 이하) · L(하루 넘음).
- **근거 파일**: 로컬 `tools/design-canvas/.out/parity/`에 남겼다. git에서는 제외된다.
  - `results.json`: 조작 결과
  - `*.png`: 스크린샷
  - `pixel/pixel.json`: 픽셀 비교
  - `audit.mjs`, `pixel.mjs`: 점검 스크립트
- **되돌림**: 시험하면서 바뀐 `docs/design` 파일과 board.json은 모두 되돌렸다.

## 요약

| 판정 | 개수 |
| --- | --- |
| PASS | 73 |
| PARTIAL | 0 |
| MISSING | 0 |
| N/A | 1 |
| 합계 | 74 |

렌더링은 같다. 98장 모두 캔버스 안과 직접 연 화면의 픽셀 차이가 1% 미만이었다(최대 0.127%).

원본 서식 보존, 파일 감시, AI가 쓴 파일 즉시 반영도 동작한다.

다른 점은 Claude Design의 캔버스 조작 쪽에 몰려 있다.
- 보드·도형을 UI에서 만들고 끄는 기능
- 요소를 끌어 옮기기·크기 조절
- 채팅 패널
- 우클릭 메뉴
- 캔버스 조작의 실행 취소
- 레이아웃 가이드

## 대조표

| # | 영역 | 기능 | Claude Design 동작 | 우리 동작 | 판정 | 근거 | 난이도 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | A 캔버스 | 무한 캔버스 이동·확대·맞춤 | 스페이스·트랙패드 이동, ⌘휠·핀치 확대, 전체 맞춤, 선택 보드로 | 모두 됨. 확대 4~400%. 핀치는 Chrome에서 ⌘휠과 같은 이벤트로 들어와 같이 동작 | PASS | `A1.*`: ⌘휠 5%→21%, 휠·스페이스 드래그로 변환 바뀜, 전체 보기 5%, 선택 보드로 62% · `A1-fit.png`, `A1-focused.png` | S |
| 2 | A 캔버스 | 보드 만들기·삭제·복제·이름 바꾸기, 아트보드 도구 | 도구로 빈 보드를 그리고, 메뉴로 삭제·복제·이름 변경 | 보드 도구(B)로 그리거나 우클릭 '여기에 보드 만들기'로 새 HTML+자리 생성. 삭제는 확인 창→.trash 사본→토스트 '실행 취소'. 복제(⌘D)는 오른쪽에 -copy. 이름(F2·제목 더블클릭)·파일 이름은 앱 안 입력 창, 참조 파일 목록과 '참조 N곳도 바꾸기' 선택 | PASS | e2e `boards.e2e.mjs` 만들기→삭제→⌘Z 되살림→⌘Z 만들기 취소→⌘⇧Z; .out/ux/p1-02-*.png(토스트·확인·이름·참조 20곳) — 4단위 간격·토큰 색·확인+취소 충족 | M |
| 3 | A 캔버스 | 보드 이동·크기(40~8000), 다중 선택·이동, 스냅·가이드선 | 모두 됨 | 이동·크기(40~8000), 빈 곳 끌어 영역 선택·Shift 추가, 함께 옮기기, 다른 보드의 왼·가운데·오른쪽(위·가운데·아래)에 6px 스냅+안내선(Alt로 끔), 화살표 1·Shift 10 이동 | PASS | ux 스크립트: 끄는 중 .guide 2개, .out/ux/p1-03-multi.png·p1-03-snap-guides.png — 선택·호버 상태 구분, 안내선 accent 1px | M |
| 4 | A 캔버스 | 보드 순서(앞뒤 겹침) | 앞으로·뒤로 보내기 | 맨 앞(⌘])·맨 뒤(⌘[)로 order 바꿈, 우클릭·보드 옵션·여러 개 선택 패널에서도 | PASS | 우클릭 메뉴 단축키 표시 .out/ux/p1-65-menu-board.png, 기록 라벨 '맨 앞으로' | S |
| 5 | A 캔버스 | title 없으면 파일명 | 파일명 표시 | `b.title ?? 파일` 표시. 새 파일은 파일 이름(확장자 뺌)이 제목으로 기록됨 | PASS | `A5.label_for_new_file`="zz-parity-new" | S |
| 6 | A 캔버스 | 페이지 40개·추가·이름·삭제·순서·이동·launch.page | 모두 됨 | 페이지 추가(40개까지)·이름(앱 안 입력)·삭제(확인, 항목은 첫 페이지로)·순서(끌어 놓기·우클릭 위로/아래로)·보드 옮기기·시작 페이지(launch.page). 모두 서버 /api/pages로 실행 취소 기록 | PASS | ux 스크립트: 시안 A·B 추가 → 위로 → 끌어서 맨 앞 → 이름 '시안 B2' → 삭제, 첫 페이지가 바뀌어도 보드 소속 유지; .out/ux/p4-06-pages.png | S |
| 7 | A 캔버스 | 시작 화면(launch.view: 캔버스 / 한 보드 전체 화면) | 캔버스 또는 한 보드를 꽉 채워 연다 | 보드 옵션 '시작 화면으로 열기' → board.json launch {view:focused,file}. 다시 열면 그 보드 전체 화면 보기로 시작. 전체 화면 보기(F)는 ←/→로 이웃 보드, Esc로 닫기 | PASS | ux 스크립트: 체크 후 새로 고침 → .focus 표시; .out/ux/p1-07-focus.png·p1-08-launch.png — Esc 닫기·aria-modal | M |
| 8 | A 캔버스 | 페이지형 보드(expand: fill) | 전체 화면에서 창을 채우고 페이지처럼 스크롤 | 보드 옵션 '페이지형' → expand:"fill". 전체 화면 보기에서 창 크기로 채우고 스크롤 | PASS | ux 스크립트: .focus-fill 1600×952(창 크기); .out/ux/p1-08-expand-fill.png | M |
| 9 | A 캔버스 | 보드 옵션 radius·frameless·is_interactive | 모서리·틀 없음·인터랙티브 보드만 파란 표시와 Play | 보드 옵션 모서리(radius)·틀 없이(frameless)·눌러 보는 보드(is_interactive). Play 버튼은 is_interactive 보드에만, 이름표에 초록 점 | PASS | ux 스크립트: 저장 값 radius 24·frameless·is_interactive, Play 0→1, 다른 보드 Play 0; .out/ux/p1-09-*.png | S |
| 10 | A 캔버스 | 레이아웃 가이드(columns·rows·grid, gutter·margin·align·count·color·hidden) | 보드마다 최대 6개, 캔버스에만 보임 | 보드 옵션 아래 '레이아웃 가이드': 열·행(개수·간격·여백·정렬 늘이기/시작/가운데/끝·칸 크기)·격자(칸), 색, 숨기기, 삭제, 보드마다 6개. board.json guides에 저장, 캔버스에서만 보이고 HTML은 그대로. ⌃G로 모두 숨기기 | PASS | ux 스크립트: 열 4개 → .lg-track 4, 6개에서 추가 단추 꺼짐, ⌃G로 숨김; .out/ux/p4-10-guides.png | L |
| 11 | A 캔버스 | 성능(98장 이상, 화면 밖 지연 렌더링) | 미리보기를 보여 주며 부드럽게 | 98장 로드 0.2초(앱), 화면 밖·25% 미만은 iframe 대신 서버가 만든 축소 미리보기(.thumbs/, 수정 시각별 캐시, 두 개씩 생성)를 보여 줌. 98장 맞춤 상태에서 이동 61fps | PASS | ux 스크립트: load 236ms, 휠 이동 120프레임 61fps(iframe 0), 미리보기 90+/99 표시(첫 생성 약 20초, 다음부터 2ms); .out/ux/p6-11-thumbs.png | M |
| 12 | B 메모 | 큰 제목(title1) 72px 굵게, maxW·maxH 넘으면 줄어듦 | 자동 축소 | 제목 72px 굵게(크기 바꿀 수 있음), 최대 너비·높이를 넘으면 글자를 줄임(최소 12px), 손잡이로 최대 너비 | PASS | ux 스크립트: 320×120에 긴 제목 → 34px; 제목이 world 폭 0 때문에 한 글자씩 꺾이던 문제도 고침(width:max-content); .out/ux/p4-12-title-shrink.png | S |
| 13 | B 메모 | 포스트잇 너비·넘치면 스크롤·색 8가지 | 됨 | 포스트잇 색 8가지(노랑·주황·분홍·보라·파랑·초록·회색·흰색), 너비·높이(손잡이·숫자), 높이를 넘는 글은 스크롤 | PASS | ux 스크립트: 분홍·h 160 저장, 손잡이로 500×200; .out/ux/p4-13-sticky.png | S |
| 14 | B 메모 | 메모 옵션 size·bold·italic·page | 됨 | 메모 옵션: 글자 크기·굵게·기울임·색·페이지(현재 페이지에 생성) | PASS | ux 스크립트: {size:28,bold:true,italic:true,color:pink} | S |
| 15 | B 도형 | rect·oval·pen·line·arrow·image | 그려서 추가, 이미지 붙여넣기·업로드 | 도구 막대 사각형(R)·타원(O)·선(L)·화살표(A)·펜(P)으로 그리기(Shift 정사각·정원, 그냥 누르면 기본 크기), 이미지는 자산에서 고르거나 캔버스에 붙여넣기(자산으로 올라감). 선택·옮기기·크기·선 색·채우기·굵기·맨 앞/뒤·삭제(실행 취소). board.json shapes(id마다 한 줄) | PASS | ux 스크립트: rect 180×120·oval·line·arrow·pen(13점)·image(../assets/basket.jpg), 색 #C94F0C, 옮김 (50,20), 삭제→⌘Z; .out/ux/p4-15-shapes.png | L |
| 16 | B 메모 | 이동·크기·삭제, 최대 200개 | 됨 | 메모 옮기기(끌기·화살표)·크기(손잡이)·삭제(× · Delete · 우클릭, 실행 취소)·글 편집, 200개 제한(앱·서버·MCP) | PASS | ux 스크립트: 손잡이 크기 500×200; 코드: MAX_NOTES·/api/notes 400 | S |
| 17 | C 편집 | hover·클릭·Shift·Esc·보드 전체 선택 | 됨 | hover 외곽선, 클릭, Shift 다중, Esc 상위, 편집 중 ⌘A로 형제 모두(없으면 보드 맨 위 요소들) 선택, Enter 첫 자식·Shift+Enter 부모 | PASS | ux 스크립트: a.btn 고르고 ⌘A → paths 6개 | S |
| 18 | C 편집 | 그 자리에서 글자 고치기(여러 줄) | 됨 | 더블클릭으로 그 자리 고치기, Shift+Enter 줄바꿈 → 원본에 <br>, 글자+<br>만 있는 요소는 다시 고칠 수 있음, Enter 확정·Esc 취소, 한글 조합 안전 | PASS | ux 스크립트: '문의 보내기<br>둘째 줄' 저장, 다시 편집 가능 | M |
| 19 | C 편집 | 요소 끌어 옮기기·크기·정렬 | 캔버스에서 바로 | 편집 중 고른 요소에 손잡이: 위쪽 손잡이로 끌면 놓을 자리 선(가리킨 요소 앞·뒤, 상자를 가리키면 그 안 위치, Alt면 가리킨 상자 안)→ move. 절대 위치 요소는 left/top. 오른쪽·아래·모서리 손잡이로 너비·높이(px). 속성 패널 정렬 6개(부모 배치에 맞춰 align-self/margin auto) | PASS | ux 스크립트: flex 행 안 순서 바꾸기 → 원본 반영·새 경로 선택·⌘Z 복원, 크기 → style="width:412px;height:69px", 가로 가운데 → align-self:center; .out/ux/p3-19-*.png — 손잡이 hit 영역 24×20·10px, accent 표시선 | L |
| 20 | C 편집 | 속성 패널 항목 | 크기·여백·글꼴·줄 간격·색·배경·테두리·모서리·그림자·투명도·flex 전부 | 기존 14개 + 줄바꿈(flex-wrap)·늘이기(flex-grow)·자기 정렬(align-self)·줄 간격·글자 정렬·테두리·그림자·투명도. 한글 조합 중 Enter 무시 | PASS | ux 스크립트: line-height·opacity·border·box-shadow 모두 원본에 기록; .out/ux/p3-21-props.png | S |
| 21 | C 편집 | grid 열·행 수 숫자 왕복 | `repeat(N, minmax(0,1fr))`를 숫자로 읽고 같은 형식으로 쓴다 | display가 grid면 '열 수'·'행 수': repeat(N, …)이나 트랙 개수를 숫자로 읽고 repeat(N, minmax(0, 1fr))로 씀(1~24) | PASS | ux 스크립트: 3 입력 → grid-template-columns: repeat(3, minmax(0, 1fr)), 다시 읽기 3; .out/ux/p3-21-grid.png | M |
| 22 | C 편집 | Flex·Grid로 감싸기 | 됨 | 같은 부모의 연속 형제를 `<div style="display:flex;gap:8px">`(grid)로 감싸고 들여쓰기 맞춤 | PASS | 단위 테스트 `wrap` 2개, 수동 시험(scr-32) | S |
| 23 | C 편집 | flex·grid 밖으로 끌어낼 때 형제·부모 크기 고정 | 다른 요소가 안 움직임 | flex·grid 부모 밖으로 옮기면 원래 부모(너비·높이)와 남는 형제(행은 너비, 열은 높이, grid는 둘 다)의 지금 크기를 inline으로 고정. 이미 있는 크기는 그대로. 옮기기와 같은 한 단계(⌘Z 한 번) | PASS | 단위 `edit-p3.test.mjs` move+freeze; ux 스크립트: header에 width:390px 추가, ⌘Z 한 번에 원래대로; .out/ux/p3-23-freeze.png | L |
| 24 | C 편집 | 복제·삭제·레이어 목록·순서 변경 | 됨 | 복제·삭제(속성 패널), 레이어 트리, 끌어 놓아 순서 변경 됨 | PASS | `C24.duplicate_diff`(1줄 추가), `C24.layers_rows`, 수동 레이어 끌기(M6) | S |
| 25 | C 편집 | 이미지 교체(업로드하면 경로 바뀜) | 업로드 | img(또는 background-image가 있는 요소) '이미지 바꾸기…' → 자산 고르기 창(올리기 포함) → src를 ../assets/이름으로(배경은 url()) | PASS | ux 스크립트: scr-02 첫 img → src="../assets/test-logo.png"; .out/ux/p3-22-picker.png | M |
| 26 | C 편집 | 실행 취소·다시, 사람·AI 동시 수정 충돌 | 됨 | 파일별 서버 기록 50개로 ⌘Z/⌘⇧Z. 옛 해시로 편집하면 409, 밖에서 바뀌면 실행 취소 기록을 비움 | PASS | `C26.undo_redo`(배경 선언만 빠졌다 돌아옴), 수동 재현: 밖에서 글자 수정 → 옛 해시 setStyle 409 "파일이 바뀜, 다시 선택" | S |
| 27 | C 편집 | 원본 그 부분만 바뀜 | 됨 | parse5 위치로 그 구간만 교체 | PASS | `C27.style_diff`(1줄, `style="gap:12px;background:#111111"`), 단위 테스트 12개 | S |
| 28 | D 프로토 | Play(그 자리, 전체 화면) | 둘 다 | 눌러 보는 보드: 이름표 ▶·우클릭 '그 자리에서 Play'·P → 캔버스 위 그 보드를 바로 눌러 보며 다른 화면으로 이동(초록 테두리·'실행 중'), Esc(iframe 안에서도)로 멈추면 원래 화면으로. '전체 화면 Play'도 따로 | PASS | ux 스크립트: scr-04에서 P → 링크 눌러 scr-03, Esc → 멈춤·되돌림; .out/ux/p6-28-inline-play.png | S |
| 29 | D 프로토 | 링크(상대·`/`루트·`#id`·외부 새 탭) | 모두 | 상대 경로·#id는 브라우저 기본. /로 시작하는 링크는 screens/에 같은 파일이 있으면 302로 그리로(없으면 404). Play에서 다른 출처 링크는 새 탭 | PASS | e2e: /scr-02.html → 302 /screens/scr-02.html, /nope.html 404 · 코드: Play.tsx 다른 출처 window.open | S |
| 30 | D 프로토 | 스크립트(상태·이벤트·조건·반복) | 됨 | iframe에서 그대로 실행 | PASS | `D30.script_runs`: 버튼 두 번 → "2" | S |
| 31 | D 프로토 | 다른 보드 끼워 넣기, 원본 바뀌면 갱신 | dc-import가 따라 바뀜 | 화면마다 iframe src를 색인해, 원본이 바뀌면 그 화면을 직접·간접으로 끼운 보드도 다시 불러옴 | PASS | 단위 테스트 deps(직접·간접), e2e: scr-15 수정 → f-3 안 iframe에 반영 4초 안 | S |
| 32 | D 프로토 | Tweaks(색·enum·boolean·숫자 조절) | 패널에서 조절 | <script type="application/json" id="board-tweaks">에 color·number(min·max·unit)·boolean·enum과 CSS 변수 선언 → 오른쪽 'Tweaks'에서 조절하면 바로 CSS 변수·data-tweak-* 적용, '원본에 저장'은 JSON value만 바꿈(실행 취소). 캔버스가 보낼 때 저장값을 변수로 적용 | PASS | 단위 setTweaks; ux 스크립트: 로드 시 --accent #C94F0C, 조절 → 4px·rgb(17,17,17)·on, 저장 후 value 3개; .out/ux/p5-32-tweaks.png | M |
| 33 | E AI | AI가 새 HTML → 즉시 보드·자동 배치 | 됨 | 323ms 안에 보드가 생기고 board-size 메타 크기로 '새 화면' 줄에 배치. Claude Code·Codex 둘 다 새 화면 생성 → 자동 배치 → `place_board` 제목 확인 | PASS | `E33.*`, Claude Code(.mcp.json, claude -p) 2026-10-09: zz-claude-test.html 생성·제목 'Claude 시험' 캔버스 표시, Codex(M7) 같은 결과 | S |
| 34 | E AI | AI 수정 즉시 반영(스크롤·선택 유지) | 됨 | AI·밖 수정 484ms에 그 보드만 다시 불러오고 같은 경로 다시 선택, 창 스크롤과 안쪽 스크롤 상자 위치를 되돌림 | PASS | ux 스크립트: 안쪽 스크롤 700에서 파일 수정 → 다시 불러온 뒤 700 유지 | S |
| 35 | E AI | 선택 인식 정보 | mode, page, pageName, visible·selectedArtboards, 요소 kind·label, dirty, edits | get_selection = selection(+kind·label) · mode(canvas/edit/focus/play) · page·pageName · visibleArtboards · selectedArtboards · dirty · edits(최근 기록) · erroredArtboards·firstError. 앱이 화면 상태를 PUT /api/context로 알림 | PASS | ux 스크립트 MCP: get_selection 키 10개; 편집 모드 a.btn → kind link·label '문의 보내기'·selectedArtboards [scr-32.html] | M |
| 36 | E AI | 오류 난 보드 목록·"고쳐 달라" | erroredArtboards, firstError, Ask Claude to fix | 서버가 화면 HTML <head>에 오류 수집 스크립트를 끼워(파일은 그대로) 스크립트 오류·불러오지 못한 리소스를 모음. 도구 막대 '오류 N' 메뉴·왼쪽 목록 경고·보드 우클릭 'AI에게 오류 고쳐 달라기'가 채팅에 오류 내용을 넣어 엶. MCP list_errors | PASS | ux 스크립트: zz-err.html → firstError 'undefinedFn is not defined'(줄 1), 고쳐 달라기 초안 채움; .out/ux/p2-36-*.png | M |
| 37 | E AI | AI가 댓글 읽기·답하기·해결 | 됨 | AI: list_comments(답글 포함)·add_comment·reply_comment(resolve 선택)·resolve_comment, 채팅에서 댓글 보내기 | PASS | ux 스크립트 MCP: reply_comment → 답글 2개 | S |
| 38 | E AI | AI가 배치·제목·페이지·메모 변경 | 캔버스 파일 전체를 쓴다 | place_board + create_board(틀) + list/add/update/delete_note + list_pages·manage_page(add·rename·delete·move). 모두 앱 실행 취소 기록에 남음 | PASS | ux 스크립트 MCP: add_note→list_notes에 있음, update·delete, 페이지 '시안' 추가, create_board doc | S |
| 39 | E AI | 스크린샷(보드·요소) | 됨 | 보드 전체·요소 하나 PNG(@2x) | PASS | M4 시험: `.out/scr-32--0-1-1-5.png` | S |
| 40 | F DS | 토큰 등록·테마 메뉴 | 디자인 시스템 설치·테마 선택 | 왼쪽 '토큰' 탭: README 표 기본값으로 시작 → 테마(복사해 추가·이름·색 추가/빼기/이름)·글자 크기·굵기·모서리·간격·누르는 영역 편집 → '토큰 등록'으로 docs/design/tokens.json(실행 취소 기록). 도구 막대 '테마' 메뉴로 쓰는 테마 바꾸기. MCP get_tokens | PASS | ux 스크립트: 기본 8색 → '어두운 시안' 추가·등록 → 테마 메뉴로 '기본'; .out/ux/p5-40-*.png | L |
| 41 | F DS | 색·글꼴 입력에 토큰 스와치 | 됨 | 속성 패널: 색·배경 스와치가 고른 테마 색, 글자 크기·모서리·gap·padding에 토큰 칩 | PASS | ux 스크립트: 칩 34·22·17·16·15, 스와치 8; .out/ux/p5-41-71-props.png | S |
| 42 | F DS | 토큰 밖 값 경고 | AI 결과 검사 | 토큰 밖 값 검사(색·글자 크기·굵기·모서리·4 단위 아닌 간격, style 속성과 <style> 모두): 오른쪽 '토큰 검사' 목록(누르면 그 요소 편집), 속성 칸 ⚠, 'AI에게 고쳐 달라기', MCP check_tokens. 98장 실제 검사 211건(a:hover #000000 98, 모서리 12px 57 등) | PASS | 단위 tokens.test.mjs 3개; ux 스크립트: 13px 입력 → ⚠, zz-tweaks 2건; .out/ux/p5-42-55-checks.png | M |
| 43 | G 협업 | 댓글 고정·목록·답글·해결·작성자 | 됨 | 요소·보드 핀, 목록, 답글(스레드)·'답하고 해결', 해결·다시 열기, 작성자(git user.name 기본, 바꿀 수 있음) | PASS | ux 스크립트: 답글 [시험 사용자, 확인했어요] + resolved; .out/ux/p5-43-replies.png | S |
| 44 | G 협업 | 버전 저장·분기 | 기본 기록 없음, Claude에게 저장 요청 | 버전 대신 git 스냅숏: 도구 막대 '스냅숏' 메뉴 → 디자인 폴더만 커밋(작성자 git 설정, 다른 스테이징은 안 섞음, 훅 그대로), 최근 스냅숏 10개·바뀐 파일 수. MCP save_snapshot | PASS | ux 스크립트(임시 git 저장소): 바뀐 파일 4 → 커밋 '시험 사용자|docs(design): 디자인 스냅숏', status 깨끗; .out/ux/p5-44-snapshot-menu.png | – |
| 45 | G 협업 | 공유·권한·실시간 공동 편집 | 보기·댓글·편집 권한 공유 | git push·PR로 공유하고 각자 로컬에서 실행 | N/A | – | – |
| 46 | H 단축키 | ⌘Z ⌘⇧Z Delete ⌘D 화살표 ⌘A ⌘G 스페이스 ⌘0 ⌘1 ⌘C ⌘V | 됨 | ⌘Z ⌘⇧Z(⌘Y) Delete ⌘D(보드·요소) 화살표(Shift 10·Option 100, 편집 중엔 형제 선택·Option+↑↓ 순서) ⌘A ⌘G(편집 중 flex로 감싸기) ⌃G(가이드) 스페이스 ⌘0 ⌘1 ⌘± ⌘C ⌘V F6(영역 포커스) ⌘\\(양쪽 패널) ⌘K ⌘J F2 F E M V H B T N R O L A P Esc. 메뉴·툴팁에 표시 | PASS | ux 스크립트: ⌘\\ 패널 숨김, F6 toolbar→left, ↑ 형제 선택, Option+↓ 순서 바꿈, ⌘G 형제 둘 감싸기(shift.mjs) | M |
| 47 | H 사용성 | 다크 모드·창 크기·휠 조작감 | 됨 | 도구 막대 화면 모드 단추: 시스템→밝게→어둡게(data-theme, 기억). 토큰 색은 다크에서도 4.5:1, 창 크기 줄면 패널 겹침 | PASS | ux 스크립트: light→dark→system; .out/ux/p4-47-dark.png | S |
| 48 | I 렌더링 | 98장 픽셀 동일성 | – | 98장 모두 1% 미만(최대 s-03-unfollowed 0.127%, 평균 0.059%) | PASS | `pixel/pixel.json` | – |
| 49 | J 추가 | 캔버스 안 채팅 패널(claude -p·codex exec, 스트리밍, 취소, 에이전트 선택) | 채팅이 기본 | 오른쪽 'AI'(⌘J) 탭: Claude Code·Codex 고르기(설치 확인), 선택 요소·고른 보드·보이는 보드 칩(눌러서 빼기), Enter 보내기(한글 조합 중 무시), 글 조각 스트리밍·도구 줄·비용, 취소(Esc·단추, 프로세스 묶음 종료), 이어서 대화(--resume / exec resume), 새 대화 | PASS | e2e `chat.e2e.mjs`(가짜 에이전트: 스트리밍·원본 반영·맥락·취소); 실제: Claude Code 48s·Codex 38s로 scr-02 title만 바뀜; 단위 `chat.test.mjs`; .out/ux/p2-49-*.png | L |
| 50 | J 추가 | 댓글을 AI에게 보내 그 위치만 고치기 | 인라인 댓글로 부분 수정 | 댓글 'AI에게 보내기' → 채팅에 댓글 칩. 맥락에 파일·경로·글과 '이 위치만 고치고 resolve_comment' 지시 | PASS | ux 스크립트: 프롬프트에 '댓글(c…) screens/scr-02.html 경로 0: "제목을 더 크게"' | M |
| 51 | J 추가 | 참고 자료 첨부(이미지·문서·URL) | 업로드·링크 | 링크 추가, 파일·이미지 첨부(단추·끌어 놓기·붙여넣기) → docs/design/.refs/(gitignore)에 저장, 맥락에 경로. Codex는 이미지를 -i로도 넘김 | PASS | ux 스크립트: 프롬프트에 참고 링크·참고 파일(이미지) .refs/…-ref.png; .out/ux/p2-50-51-attach.png | M |
| 52 | J 추가 | "N가지 안" 나란히 | 변형 2~3개 제안 | 채팅 '안 N개'(2~4): 원본을 -v1…-vN으로 복사해 원본 아래 빈 줄에 나란히 두고, 에이전트에게 각각 다른 방향으로 고치라고 지시. 끝나면 그 자리로 이동 | PASS | 실제: Claude Code 48s·Codex 59s 모두 v1에 '당도순', v2에 '지도', 원본 그대로; .out/ux/p2-52-variants.png | S |
| 53 | J 추가 | 템플릿·빈 보드에서 시작 | 템플릿 | 도구 막대 '새 보드' 메뉴: 빈 보드·모바일 화면·PC 화면·문서 틀(토큰 색·Pretendard), 우클릭 '여기에 모바일 화면 틀', MCP create_board(template) | PASS | ux 스크립트: 모바일 화면 → mobile.html 생성; .out/ux/p2-53-*.png | S |
| 54 | J 추가 | 자산 보관함(이미지·폰트 업로드, 재사용) | 업로드 자산 | 왼쪽 '자산' 탭: docs/design/assets/ 이미지·폰트 썸네일, 올리기(단추·끌어 놓기, 이름 겹치면 -2), 누르면 경로 복사. 이미지 바꾸기 창과 같은 목록 | PASS | ux 스크립트: 'Test Logo.png' → assets/test-logo.png; .out/ux/p3-22-assets.png | M |
| 55 | J 추가 | 접근성 검사(누르는 영역·명암비·label) | Claude에게 리뷰 요청 | 오른쪽 '접근성' 목록: 누르는 영역(토큰 최소 48)·글자 명암(4.5, 큰 글자 3, 사진 위 제외)·이름 없는 버튼/입력·alt 없는 img. 누르면 그 요소 편집, 'AI에게 고쳐 달라기' | PASS | ux 스크립트: 24×24 버튼·이름 없음·alt 없음·명암 2.08 → 4건, 누르면 0/1 선택(edit) | M |
| 56 | J 추가 | 한글 IME | 조합 중 Enter·blur에 깨지지 않음 | 글자 바로 고치기·메모·속성 칸·검색·채팅·입력 창: 조합 중 Enter 무시, 조합 중 포커스가 빠지면 compositionend 뒤 저장, iframe에서 조합 중 키는 단축키(⌘Z 등)로 넘기지 않음 | PASS | ux 스크립트(합성 composition 이벤트): 조합 중 Enter·blur → 저장 안 됨, compositionend 뒤 '농가들' 저장. 실제 IME 입력기는 자동화 불가 | S |
| 57 | J 추가 | 캔버스 조작 실행 취소 | 됨 | 서버 한 기록(history.mjs)에 HTML 편집·보드 이동/크기/옵션/순서·메모·페이지·보드 만들기/삭제/복제/이름이 시간순으로 쌓임. ⌘Z/⌘⇧Z·도구 막대·우클릭·토스트에서 실행 취소, 밖에서 바뀌면 409로 기록 비움 | PASS | e2e `boards.e2e.mjs` 'HTML 편집 → 보드 옮기기 → ⌘Z 두 번이 역순'; 단위 17개 통과; .out/ux/p1-57-undo-toast.png | M |
| 58 | J 추가 | board.json 충돌 최소화 | – | 보드·메모 키를 정렬하고 항목 하나를 한 줄로, 항목 사이 빈 줄 하나. 서버가 저장할 때 항상 이 형식. 기존 board.json은 값은 그대로 형식만 다시 씀(865→324줄) | PASS | 단위 테스트 boardFormat: 값 동일·한 줄·정렬·다시 써도 같음, git merge-file 병합 3가지(이웃 보드 각각 이동·메모 각각 추가·이동+메모) 충돌 0 | S |
| 59 | J 추가 | HTML 이름 바꾸기·삭제 따라가기 | – | 밖에서 이름을 바꾸면(같은 내용이 5초 안에 지워졌다 생김) 보드 자리·제목을 새 이름으로 옮김. 앱 안 이름 바꾸기는 참조까지. 지워진 파일은 '오류' 메뉴의 '파일 없는 보드 정리'(실행 취소) | PASS | ux 스크립트: fs.rename → 같은 자리(0,16056), missing [] | S |
| 60 | J 추가 | 요소를 다른 보드로 복사·붙여넣기 | 됨 | 편집 중 ⌘C로 요소 소스를 앱 클립보드(localStorage, 다른 보드·탭에서도)와 시스템 클립보드에 → 다른 보드 편집 중 ⌘V로 고른 요소 뒤(없으면 본문 끝)에 들여쓰기 맞춰 붙임. 우클릭에도 있음. script는 막음 | PASS | 단위 insert 3개; ux 스크립트: scr-32 '문의 보내기' → scr-02에 붙음; .out/ux/p3-60-paste.png | M |
| 61 | J 추가 | 보드 검색·이동 | – | 왼쪽 패널 '보드 찾기(⌘K)': 제목·파일 이름으로 거르고 Enter로 첫 보드로 이동·선택, Esc로 비움 | PASS | ux 스크립트: '결제' 3개, Enter → scr-11 선택; .out/ux/p1-61-search.png | S |
| 62 | J 추가 | Windows 경로·감시 | – | 코드 점검: 경로는 path.join/relative 후 toPosix로 /, Windows에서 claude·codex는 shell(.cmd)·인자 따옴표·taskkill로 취소, which→where, rename은 EPERM·EBUSY 다시 시도, 스냅숏은 realpath 비교, 감시는 chokidar. 실제 Windows 기기는 없음 | PASS | 단위 winpath.test.mjs(path.win32 변환·따옴표) | S |
| 63 | J 추가 | 보안(127.0.0.1, 경로 탈출) | – | 127.0.0.1에만 listen(index.mjs), /screens/..%2F 404, /api/file?f=../ 400, 자산 이름 정리·확장자 제한 | PASS | J63.* + 코드 server.listen(port, "127.0.0.1") | S |
| 64 | J 추가 | 원자적 쓰기(임시 파일 → 교체) | – | HTML·board.json·comments.json을 같은 폴더 임시 파일(.dc-tmp-*)에 쓴 뒤 rename. 권한 유지, 실패하면 임시 파일 지움. 감시기는 .으로 시작하는 파일 무시 | PASS | 단위 테스트 fsutil 2개, e2e core: 편집 뒤 .dc-tmp 없음·임시 파일 rename에도 감시 반영 1초 안 | S |
| 65 | J 추가 | 우클릭 메뉴(보드·요소·빈 캔버스) | 됨 | 보드(편집·Play·전체 화면·이동·이름·파일 이름·복제·맨 앞/뒤·삭제), 메모(복제·삭제), 빈 캔버스(여기에 보드·제목·메모, 모두 선택, 전체 보기, 100%, 실행 취소/다시), 편집 중 요소(글자 고치기·부모 선택·AI용 설명 복사·복제·삭제). 단축키 표시, 화살표·Enter·Esc | PASS | ux 스크립트: Esc로 닫힘 true; .out/ux/p1-65-menu-{board,canvas,element}.png — role=menu, 32px 행, 위험 항목 빨강 | M |
| 66 | J 추가 | 캔버스 상태 기억(확대·위치·페이지·패널) | 됨 | 확대·위치·페이지·왼쪽 패널·미니맵을 localStorage(design-canvas:<제목>)에 기억, 다시 열면 되살림(launch 설정이 우선) | PASS | ux 스크립트: 다시 열기 전후 확대 같음(34%→34%) | S |
| 67 | J 추가 | 미니맵·보드 목록 패널 | 레이어·보드 탐색 | 왼쪽 패널: 페이지 목록(보드 수)·보드 목록(파일 없음 경고), 누르면 그 보드로 이동. 미니맵(M): 보드 배치·선택·지금 화면 사각형, 누르거나 끌면 그 자리로 | PASS | .out/ux/p1-09-board-options.png(왼쪽 목록·미니맵), p1-dark.png(다크) | M |
| 68 | 도움말 | F6·Shift+F6 영역 이동, Tab·Space·Return 보드·레이어 탐색 | 키보드·화면 읽기 지원 | F6·Shift+F6 영역 이동, 캔버스에서 Tab·Shift+Tab 보드 이동(화면 읽기 알림), Enter 편집, 편집 중 Enter·Shift+Enter 자식·부모, 레이어 목록 role=tree 화살표, 보드 role=group·aria-label | PASS | ux 스크립트: Tab 두 번 → scr-02, 알림 'SCR-02 농가 목록 선택, 2/99. Enter로 편집', Enter → 편집 | M |
| 69 | 도움말 | Option+화살표로 레이어 이동 | 됨 | 편집 중 Option+↑↓로 형제 사이 순서 바꾸기(원본 move), 캔버스에서 Option+화살표 100 이동 | PASS | ux 스크립트(P4): Option+↓ 순서 바뀜 | S |
| 70 | 도움말 | ⌘\ 속성 패널 열고 닫기 | 됨 | ⌘\\로 왼쪽·오른쪽 패널 함께 숨기기/보이기, 도구 막대 단추로 각각 | PASS | ux 스크립트(P4): ⌘\\ → .left 0, .right hidden | S |
| 71 | 도움말 | 색 선택기가 글자 명암 품질 표시 | 됨 | 속성 패널 글자 색 아래 실제 배경과의 명암비와 등급(AAA·AA·큰 글자만·부족) | PASS | ux 스크립트: '명암 18.26:1 · AAA' | S |
| 72 | 도움말 | 레이어 목록 화살표 탐색·펼치기 | 됨 | 레이어 목록 role=tree: 누른 뒤 ↑↓ 이동(선택 따라감), → 펼치기·첫 자식, ← 접기·부모, Home·End, Enter·Space | PASS | ux 스크립트: ← → 부모 0/1/1; .out/ux/p6-72-layers.png | S |
| 73 | 도움말 | 디자인 시스템 가져오기(/design-sync, GitHub·업로드) | 됨 | 가져오기: HTML 파일을 캔버스에 끌어 놓으면 새 보드(board-size·title 읽음), 이미지는 자산+이미지 도형, 토큰 탭에서 tokens.json·변수 JSON 가져오기. 원본은 레포 docs/design | PASS | ux 스크립트: imported-screen.html → '가져온 화면' 보드; .out/ux/p6-73-import.png | – |
| 74 | 도움말 | AI 리뷰(접근성·명암·위계)와 2~3개 변형 요청 | 채팅으로 | 채팅 빠른 요청 'AI 리뷰: 접근성·명암·위계'(제안만), '이 화면 변형 3가지'(안 3개 자동), 보드 우클릭 'AI 리뷰 요청', 검사 목록 'AI에게 고쳐 달라기' | PASS | ux 스크립트: 변형 3가지 → 안 개수 3·초안 채움; .out/ux/p6-74-chat-actions.png | M |

## K. UI/UX 동일성

`tools/design-canvas/reference/`가 없어서 건너뛰었다. `reference/`는 커밋하지 않도록 `.gitignore`에 넣었다. 비교에 필요한 Claude Design 캡처(또는 화면 녹화)는 아래와 같다.

1. 캔버스 전체(보드 여러 장, 큰 제목·포스트잇이 보이게)
2. 보드 선택(이름표·크기 핸들)
3. 요소 선택과 속성 패널
4. 글자 편집 중
5. 메모·도형 도구 막대
6. 페이지 탭(추가·이름 바꾸기)
7. Play(그 자리 실행, 전체 화면)
8. 댓글(핀, 목록, 답글)
9. 우클릭 메뉴 세 가지(보드 위, 요소 위, 빈 캔버스)
10. 채팅 패널(선택이 붙은 상태, 진행 중)
11. 레이어 목록(펼침·끌기)
12. 레이아웃 가이드 설정
13. 오류 난 보드 표시와 "고쳐 달라"

## "Claude Design과 같다"고 하려면 필요한 MISSING 상위 10개

| 순위 | # | 기능 | 난이도 |
| --- | --- | --- | --- |
| 1 | 49 | 캔버스 안 채팅 패널(claude -p·codex exec, 스트리밍·취소·에이전트 선택). #74 리뷰·변형 요청도 여기서 | L |
| 2 | 2 | 보드 만들기·삭제·복제·이름 바꾸기(빈 보드 = 새 HTML) | M |
| 3 | 19 | 요소 끌어 옮기기·크기 조절·정렬 | L |
| 4 | 15 | 도형·선·화살표·이미지 그리기 | L |
| 5 | 65 | 우클릭 메뉴(보드·요소·빈 캔버스) | M |
| 6 | 57 | 캔버스 조작 실행 취소(보드·메모·페이지) | M |
| 7 | 31 | 끼운 보드(iframe) 원본이 바뀌면 같이 갱신 | S |
| 8 | 36 | 오류 난 보드 목록과 "AI에게 고쳐 달라" | M |
| 9 | 7·8 | 한 보드 전체 화면 보기(launch.view)와 페이지형 보드(expand: fill) | M |
| 10 | 10 | 레이아웃 가이드 | L |

순위 밖이지만 안전을 위해 먼저 하길 권하는 것: #64 원자적 쓰기(S). 편집 중 서버가 꺼지면 원본 HTML이 잘릴 수 있다.

## 구현 순서 제안 (승인 뒤 진행)

| 순서 | 항목 | 이유 | 예상 |
| --- | --- | --- | --- |
| 0 | #64 원자적 쓰기 | 원본을 지키는 안전장치, 작음 | 0.5h |
| 1 | #31 끼운 보드 갱신 | 흐름도가 바로 맞아짐, 작음 | 0.5h |
| 2 | #2 보드 관리 | 다른 기능(우클릭·템플릿)의 바탕 | 2h |
| 3 | #65 우클릭 메뉴 | 보드·요소 동작을 한곳에 모음 | 1.5h |
| 4 | #57 캔버스 실행 취소 | 보드 관리와 메모 조작에 필요 | 1.5h |
| 5 | #7·#8 포커스 보기·expand fill | 보기 모드 정리 | 2h |
| 6 | #36 오류 보드 목록 | 채팅의 "고쳐 달라" 입력 | 1.5h |
| 7 | #49 채팅 패널 | 선택·오류·댓글을 에이전트로 보내는 중심 | 4h |
| 8 | #19 요소 끌기·크기·정렬 | 가장 큰 편집 기능, 원본 패치 확장 | 5h |
| 9 | #15 도형·이미지 | 캔버스 레이어 추가(board.json 형식 확장) | 4h |
| 10 | #10 레이아웃 가이드 | 보드 옵션 형식 확장 | 3h |
| | | 합계 | 약 25.5h |
