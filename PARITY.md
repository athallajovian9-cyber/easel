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
| PASS | 34 |
| PARTIAL | 22 |
| MISSING | 15 |
| N/A | 3 |
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
| 6 | A 캔버스 | 페이지 40개·추가·이름·삭제·순서·이동·launch.page | 모두 됨 | 추가·이름 변경은 앱 안 입력 창(prompt 없음), 페이지 우클릭으로 선택 보드 옮기기. 삭제·순서 변경·개수 제한은 P4 | PARTIAL | 코드: `addPage`, `renamePage`, `pageMenu` | S |
| 7 | A 캔버스 | 시작 화면(launch.view: 캔버스 / 한 보드 전체 화면) | 캔버스 또는 한 보드를 꽉 채워 연다 | 보드 옵션 '시작 화면으로 열기' → board.json launch {view:focused,file}. 다시 열면 그 보드 전체 화면 보기로 시작. 전체 화면 보기(F)는 ←/→로 이웃 보드, Esc로 닫기 | PASS | ux 스크립트: 체크 후 새로 고침 → .focus 표시; .out/ux/p1-07-focus.png·p1-08-launch.png — Esc 닫기·aria-modal | M |
| 8 | A 캔버스 | 페이지형 보드(expand: fill) | 전체 화면에서 창을 채우고 페이지처럼 스크롤 | 보드 옵션 '페이지형' → expand:"fill". 전체 화면 보기에서 창 크기로 채우고 스크롤 | PASS | ux 스크립트: .focus-fill 1600×952(창 크기); .out/ux/p1-08-expand-fill.png | M |
| 9 | A 캔버스 | 보드 옵션 radius·frameless·is_interactive | 모서리·틀 없음·인터랙티브 보드만 파란 표시와 Play | 보드 옵션 모서리(radius)·틀 없이(frameless)·눌러 보는 보드(is_interactive). Play 버튼은 is_interactive 보드에만, 이름표에 초록 점 | PASS | ux 스크립트: 저장 값 radius 24·frameless·is_interactive, Play 0→1, 다른 보드 Play 0; .out/ux/p1-09-*.png | S |
| 10 | A 캔버스 | 레이아웃 가이드(columns·rows·grid, gutter·margin·align·count·color·hidden) | 보드마다 최대 6개, 캔버스에만 보임 | 없음 | MISSING | 코드 | L |
| 11 | A 캔버스 | 성능(98장 이상, 화면 밖 지연 렌더링) | 미리보기를 보여 주며 부드럽게 | 98장 로드 2.7초. 화면 밖이거나 25% 미만이면 iframe을 그리지 않음(맞춤 상태 0개, 한 보드 확대 5개). 축소 상태는 빈 틀이고 미리보기 썸네일이 없음 | PARTIAL | `A11.load_ms`=2668, `A11.iframes_at_fit`=0, `A11.iframes_when_focused`=5 | M |
| 12 | B 메모 | 큰 제목(title1) 72px 굵게, maxW·maxH 넘으면 줄어듦 | 자동 축소 | 72px 700과 maxW는 됨. maxH와 자동 축소 없음 | PARTIAL | `B12.title_font`="72px 700" | S |
| 13 | B 메모 | 포스트잇 너비·넘치면 스크롤·색 8가지 | 됨 | 너비 w만. 넘치면 늘어나고 색은 노랑 하나 | PARTIAL | 코드: `.note-sticky` 고정 색 | S |
| 14 | B 메모 | 메모 옵션 size·bold·italic·page | 됨 | page만(현재 페이지로 생성). size·bold·italic 없음 | PARTIAL | 코드: `addNote` | S |
| 15 | B 도형 | rect·oval·pen·line·arrow·image | 그려서 추가, 이미지 붙여넣기·업로드 | 없음 | MISSING | 코드 | L |
| 16 | B 메모 | 이동·크기·삭제, 최대 200개 | 됨 | 이동·삭제(× 또는 Delete)·글 편집은 됨. 메모 id 겹침 고침(시간+무작위, 겹치면 다시). 크기 조절·개수 제한 없음 | PARTIAL | B16.delete_selected_note=true · 코드: addNote id | S |
| 17 | C 편집 | hover·클릭·Shift·Esc·보드 전체 선택 | 됨 | hover 외곽선, 클릭, Shift 다중, Esc 상위 됨. 보드 전체 선택 없음 | PARTIAL | `C17.hover_box`=1, `selected_path`=0/1/1/5, `shift_multi`=2, `esc_parent`=0/1/1 · `C17-select.png` | S |
| 18 | C 편집 | 그 자리에서 글자 고치기(여러 줄) | 됨 | 글자 하나만 있는 요소는 됨(원본 그 글자만 바뀜). Shift+Enter 줄바꿈은 textContent로 저장돼 사라짐. 자식이 있으면 거부 | PARTIAL | `C18.settext_diff`(1줄) · 코드: `onTextEdit`의 `textContent` | M |
| 19 | C 편집 | 요소 끌어 옮기기·크기·정렬 | 캔버스에서 바로 | 없음(레이어 목록 끌기만) | MISSING | 코드 | L |
| 20 | C 편집 | 속성 패널 항목 | 크기·여백·글꼴·줄 간격·색·배경·테두리·모서리·그림자·투명도·flex 전부 | 14개(너비·높이·padding·margin·gap·글자 크기·굵기·색·배경·모서리·display·flex 방향·세로·가로 정렬) + href 등. 줄 간격·테두리·그림자·투명도·flex-wrap·flex-grow·align-self 없음 | PARTIAL | `C20.props_fields` · `C20-props.png` | S |
| 21 | C 편집 | grid 열·행 수 숫자 왕복 | `repeat(N, minmax(0,1fr))`를 숫자로 읽고 같은 형식으로 쓴다 | 없음 | MISSING | 코드 | M |
| 22 | C 편집 | Flex·Grid로 감싸기 | 됨 | 같은 부모의 연속 형제를 `<div style="display:flex;gap:8px">`(grid)로 감싸고 들여쓰기 맞춤 | PASS | 단위 테스트 `wrap` 2개, 수동 시험(scr-32) | S |
| 23 | C 편집 | flex·grid 밖으로 끌어낼 때 형제·부모 크기 고정 | 다른 요소가 안 움직임 | 없음(끌어내기 자체가 없음) | MISSING | 코드 | L |
| 24 | C 편집 | 복제·삭제·레이어 목록·순서 변경 | 됨 | 복제·삭제(속성 패널), 레이어 트리, 끌어 놓아 순서 변경 됨 | PASS | `C24.duplicate_diff`(1줄 추가), `C24.layers_rows`, 수동 레이어 끌기(M6) | S |
| 25 | C 편집 | 이미지 교체(업로드하면 경로 바뀜) | 업로드 | `img`의 src를 글자로 바꿀 수만 있음. 업로드 없음 | PARTIAL | 코드: `Properties` ATTRS.img | M |
| 26 | C 편집 | 실행 취소·다시, 사람·AI 동시 수정 충돌 | 됨 | 파일별 서버 기록 50개로 ⌘Z/⌘⇧Z. 옛 해시로 편집하면 409, 밖에서 바뀌면 실행 취소 기록을 비움 | PASS | `C26.undo_redo`(배경 선언만 빠졌다 돌아옴), 수동 재현: 밖에서 글자 수정 → 옛 해시 setStyle 409 "파일이 바뀜, 다시 선택" | S |
| 27 | C 편집 | 원본 그 부분만 바뀜 | 됨 | parse5 위치로 그 구간만 교체 | PASS | `C27.style_diff`(1줄, `style="gap:12px;background:#111111"`), 단위 테스트 12개 | S |
| 28 | D 프로토 | Play(그 자리, 전체 화면) | 둘 다 | 전체 화면 오버레이만. 보드 그 자리에서 실행 없음 | PARTIAL | `D28.play_nav`="SCR-04 상품 상세" · `D28-play.png` | S |
| 29 | D 프로토 | 링크(상대·`/`루트·`#id`·외부 새 탭) | 모두 | 상대 경로·#id는 브라우저 기본. /로 시작하는 링크는 screens/에 같은 파일이 있으면 302로 그리로(없으면 404). Play에서 다른 출처 링크는 새 탭 | PASS | e2e: /scr-02.html → 302 /screens/scr-02.html, /nope.html 404 · 코드: Play.tsx 다른 출처 window.open | S |
| 30 | D 프로토 | 스크립트(상태·이벤트·조건·반복) | 됨 | iframe에서 그대로 실행 | PASS | `D30.script_runs`: 버튼 두 번 → "2" | S |
| 31 | D 프로토 | 다른 보드 끼워 넣기, 원본 바뀌면 갱신 | dc-import가 따라 바뀜 | 화면마다 iframe src를 색인해, 원본이 바뀌면 그 화면을 직접·간접으로 끼운 보드도 다시 불러옴 | PASS | 단위 테스트 deps(직접·간접), e2e: scr-15 수정 → f-3 안 iframe에 반영 4초 안 | S |
| 32 | D 프로토 | Tweaks(색·enum·boolean·숫자 조절) | 패널에서 조절 | 없음(PLAN 범위 밖). 대체 제안: `:root`의 CSS 변수와 `<meta name="tweak" …>` 선언을 읽어 속성 패널에 표시 | MISSING | PLAN 0장 범위 밖 | M |
| 33 | E AI | AI가 새 HTML → 즉시 보드·자동 배치 | 됨 | 323ms 안에 보드가 생기고 board-size 메타 크기로 '새 화면' 줄에 배치. Claude Code·Codex 둘 다 새 화면 생성 → 자동 배치 → `place_board` 제목 확인 | PASS | `E33.*`, Claude Code(.mcp.json, claude -p) 2026-10-09: zz-claude-test.html 생성·제목 'Claude 시험' 캔버스 표시, Codex(M7) 같은 결과 | S |
| 34 | E AI | AI 수정 즉시 반영(스크롤·선택 유지) | 됨 | 484ms에 그 보드만 다시 불러오고 같은 경로로 다시 선택. Claude Code·Codex 모두 "선택한 것 고쳐" → 그 글자만 바뀌고 캔버스 반영. 스크롤 되돌림은 스크롤 있는 보드에서 아직 시험 못 함 | PARTIAL | `E34.reflect_ms`=484, Claude Code: scr-32 0/1/1/5 글자만 수정(diff 1줄)·캔버스 반영 true, Codex(M7) 같은 결과 | S |
| 35 | E AI | 선택 인식 정보 | mode, page, pageName, visible·selectedArtboards, 요소 kind·label, dirty, edits | get_selection = selection(+kind·label) · mode(canvas/edit/focus/play) · page·pageName · visibleArtboards · selectedArtboards · dirty · edits(최근 기록) · erroredArtboards·firstError. 앱이 화면 상태를 PUT /api/context로 알림 | PASS | ux 스크립트 MCP: get_selection 키 10개; 편집 모드 a.btn → kind link·label '문의 보내기'·selectedArtboards [scr-32.html] | M |
| 36 | E AI | 오류 난 보드 목록·"고쳐 달라" | erroredArtboards, firstError, Ask Claude to fix | 서버가 화면 HTML <head>에 오류 수집 스크립트를 끼워(파일은 그대로) 스크립트 오류·불러오지 못한 리소스를 모음. 도구 막대 '오류 N' 메뉴·왼쪽 목록 경고·보드 우클릭 'AI에게 오류 고쳐 달라기'가 채팅에 오류 내용을 넣어 엶. MCP list_errors | PASS | ux 스크립트: zz-err.html → firstError 'undefinedFn is not defined'(줄 1), 고쳐 달라기 초안 채움; .out/ux/p2-36-*.png | M |
| 37 | E AI | AI가 댓글 읽기·답하기·해결 | 됨 | list·add·resolve 됨. 답글(스레드) 없음 | PARTIAL | MCP 도구 목록 | S |
| 38 | E AI | AI가 배치·제목·페이지·메모 변경 | 캔버스 파일 전체를 쓴다 | place_board + create_board(틀) + list/add/update/delete_note + list_pages·manage_page(add·rename·delete·move). 모두 앱 실행 취소 기록에 남음 | PASS | ux 스크립트 MCP: add_note→list_notes에 있음, update·delete, 페이지 '시안' 추가, create_board doc | S |
| 39 | E AI | 스크린샷(보드·요소) | 됨 | 보드 전체·요소 하나 PNG(@2x) | PASS | M4 시험: `.out/scr-32--0-1-1-5.png` | S |
| 40 | F DS | 토큰 등록·테마 메뉴 | 디자인 시스템 설치·테마 선택 | 없음(PLAN 범위 밖) | MISSING | PLAN 0장 | L |
| 41 | F DS | 색·글꼴 입력에 토큰 스와치 | 됨 | 색·배경에 토큰 7색 스와치. 글꼴·간격 토큰 없음 | PARTIAL | `C20-props.png` | S |
| 42 | F DS | 토큰 밖 값 경고 | AI 결과 검사 | 없음(레포 밖 check.py만 있었음) | MISSING | 코드 | M |
| 43 | G 협업 | 댓글 고정·목록·답글·해결·작성자 | 됨 | 요소·보드 고정 핀, 목록, 해결·다시 열기, 작성자. 답글 없음. 축소 상태 보드는 핀이 오른쪽 위에 쌓임 | PARTIAL | M4 댓글 API 시험 · 코드: `renderOverlay` | S |
| 44 | G 협업 | 버전 저장·분기 | 기본 기록 없음, Claude에게 저장 요청 | git 커밋·브랜치로 대체 | N/A | 공식 도움말: 버전 기록 아직 없음 | – |
| 45 | G 협업 | 공유·권한·실시간 공동 편집 | 보기·댓글·편집 권한 공유 | git push·PR로 공유하고 각자 로컬에서 실행 | N/A | – | – |
| 46 | H 단축키 | ⌘Z ⌘⇧Z Delete ⌘D 화살표 ⌘A ⌘G 스페이스 ⌘0 ⌘1 ⌘C ⌘V | 됨 | ⌘Z ⌘⇧Z(⌘Y) Delete ⌘D 화살표(Shift 10) ⌘A ⌘0 ⌘1 ⌘± ⇧1 ⇧2 ⌘K ⌘J ⌘\\ F2 F E M V H B T N Esc 스페이스. ⌘G ⌘C ⌘V F6 없음 | PARTIAL | App.tsx 단축키 표; 메뉴·툴팁에 표시 | M |
| 47 | H 사용성 | 다크 모드·창 크기·휠 조작감 | 됨 | 토큰을 :root에 두고 prefers-color-scheme 다크·data-theme 둘 다 정의. 직접 바꾸는 단추는 P4 | PARTIAL | .out/ux/p1-dark.png | S |
| 48 | I 렌더링 | 98장 픽셀 동일성 | – | 98장 모두 1% 미만(최대 s-03-unfollowed 0.127%, 평균 0.059%) | PASS | `pixel/pixel.json` | – |
| 49 | J 추가 | 캔버스 안 채팅 패널(claude -p·codex exec, 스트리밍, 취소, 에이전트 선택) | 채팅이 기본 | 오른쪽 'AI'(⌘J) 탭: Claude Code·Codex 고르기(설치 확인), 선택 요소·고른 보드·보이는 보드 칩(눌러서 빼기), Enter 보내기(한글 조합 중 무시), 글 조각 스트리밍·도구 줄·비용, 취소(Esc·단추, 프로세스 묶음 종료), 이어서 대화(--resume / exec resume), 새 대화 | PASS | e2e `chat.e2e.mjs`(가짜 에이전트: 스트리밍·원본 반영·맥락·취소); 실제: Claude Code 48s·Codex 38s로 scr-02 title만 바뀜; 단위 `chat.test.mjs`; .out/ux/p2-49-*.png | L |
| 50 | J 추가 | 댓글을 AI에게 보내 그 위치만 고치기 | 인라인 댓글로 부분 수정 | 댓글 'AI에게 보내기' → 채팅에 댓글 칩. 맥락에 파일·경로·글과 '이 위치만 고치고 resolve_comment' 지시 | PASS | ux 스크립트: 프롬프트에 '댓글(c…) screens/scr-02.html 경로 0: "제목을 더 크게"' | M |
| 51 | J 추가 | 참고 자료 첨부(이미지·문서·URL) | 업로드·링크 | 링크 추가, 파일·이미지 첨부(단추·끌어 놓기·붙여넣기) → docs/design/.refs/(gitignore)에 저장, 맥락에 경로. Codex는 이미지를 -i로도 넘김 | PASS | ux 스크립트: 프롬프트에 참고 링크·참고 파일(이미지) .refs/…-ref.png; .out/ux/p2-50-51-attach.png | M |
| 52 | J 추가 | "N가지 안" 나란히 | 변형 2~3개 제안 | 채팅 '안 N개'(2~4): 원본을 -v1…-vN으로 복사해 원본 아래 빈 줄에 나란히 두고, 에이전트에게 각각 다른 방향으로 고치라고 지시. 끝나면 그 자리로 이동 | PASS | 실제: Claude Code 48s·Codex 59s 모두 v1에 '당도순', v2에 '지도', 원본 그대로; .out/ux/p2-52-variants.png | S |
| 53 | J 추가 | 템플릿·빈 보드에서 시작 | 템플릿 | 도구 막대 '새 보드' 메뉴: 빈 보드·모바일 화면·PC 화면·문서 틀(토큰 색·Pretendard), 우클릭 '여기에 모바일 화면 틀', MCP create_board(template) | PASS | ux 스크립트: 모바일 화면 → mobile.html 생성; .out/ux/p2-53-*.png | S |
| 54 | J 추가 | 자산 보관함(이미지·폰트 업로드, 재사용) | 업로드 자산 | 없음(`docs/design/assets/` 정적 서빙만) | MISSING | 코드 | M |
| 55 | J 추가 | 접근성 검사(누르는 영역·명암비·label) | Claude에게 리뷰 요청 | 없음 | MISSING | 코드 | M |
| 56 | J 추가 | 한글 IME | 조합 중 Enter·blur에 깨지지 않음 | 글자 편집 Enter 처리에 `isComposing` 확인이 없어 조합 중 Enter에 확정·저장될 수 있음. 실제 IME는 자동화로 시험 못 함 | PARTIAL | 코드: `onTextEdit` onKey | S |
| 57 | J 추가 | 캔버스 조작 실행 취소 | 됨 | 서버 한 기록(history.mjs)에 HTML 편집·보드 이동/크기/옵션/순서·메모·페이지·보드 만들기/삭제/복제/이름이 시간순으로 쌓임. ⌘Z/⌘⇧Z·도구 막대·우클릭·토스트에서 실행 취소, 밖에서 바뀌면 409로 기록 비움 | PASS | e2e `boards.e2e.mjs` 'HTML 편집 → 보드 옮기기 → ⌘Z 두 번이 역순'; 단위 17개 통과; .out/ux/p1-57-undo-toast.png | M |
| 58 | J 추가 | board.json 충돌 최소화 | – | 보드·메모 키를 정렬하고 항목 하나를 한 줄로, 항목 사이 빈 줄 하나. 서버가 저장할 때 항상 이 형식. 기존 board.json은 값은 그대로 형식만 다시 씀(865→324줄) | PASS | 단위 테스트 boardFormat: 값 동일·한 줄·정렬·다시 써도 같음, git merge-file 병합 3가지(이웃 보드 각각 이동·메모 각각 추가·이동+메모) 충돌 0 | S |
| 59 | J 추가 | HTML 이름 바꾸기·삭제 따라가기 | – | 이름을 바꾸면 새 보드가 자동 배치되고 옛 보드는 '파일 없음'과 '파일 없는 보드 1'로 표시. 따라가거나 정리하는 동작 없음 | PARTIAL | `J59.rename_result`, `J59.missing_badge` | S |
| 60 | J 추가 | 요소를 다른 보드로 복사·붙여넣기 | 됨 | 없음 | MISSING | 코드 | M |
| 61 | J 추가 | 보드 검색·이동 | – | 왼쪽 패널 '보드 찾기(⌘K)': 제목·파일 이름으로 거르고 Enter로 첫 보드로 이동·선택, Esc로 비움 | PASS | ux 스크립트: '결제' 3개, Enter → scr-11 선택; .out/ux/p1-61-search.png | S |
| 62 | J 추가 | Windows 경로·감시 | – | 코드상 `path.sep`으로 나누고 URL은 `/`로 맞춤, chokidar 사용. 실제 Windows 미시험 | PARTIAL | 코드: `watch.mjs`, `safeJoin` | S |
| 63 | J 추가 | 보안(127.0.0.1, 경로 탈출) | – | 127.0.0.1에만 열림, `/screens/..%2F` 404, `/api/file?f=../` 400 | PASS | `J63.*` | S |
| 64 | J 추가 | 원자적 쓰기(임시 파일 → 교체) | – | HTML·board.json·comments.json을 같은 폴더 임시 파일(.dc-tmp-*)에 쓴 뒤 rename. 권한 유지, 실패하면 임시 파일 지움. 감시기는 .으로 시작하는 파일 무시 | PASS | 단위 테스트 fsutil 2개, e2e core: 편집 뒤 .dc-tmp 없음·임시 파일 rename에도 감시 반영 1초 안 | S |
| 65 | J 추가 | 우클릭 메뉴(보드·요소·빈 캔버스) | 됨 | 보드(편집·Play·전체 화면·이동·이름·파일 이름·복제·맨 앞/뒤·삭제), 메모(복제·삭제), 빈 캔버스(여기에 보드·제목·메모, 모두 선택, 전체 보기, 100%, 실행 취소/다시), 편집 중 요소(글자 고치기·부모 선택·AI용 설명 복사·복제·삭제). 단축키 표시, 화살표·Enter·Esc | PASS | ux 스크립트: Esc로 닫힘 true; .out/ux/p1-65-menu-{board,canvas,element}.png — role=menu, 32px 행, 위험 항목 빨강 | M |
| 66 | J 추가 | 캔버스 상태 기억(확대·위치·페이지·패널) | 됨 | 확대·위치·페이지·왼쪽 패널·미니맵을 localStorage(design-canvas:<제목>)에 기억, 다시 열면 되살림(launch 설정이 우선) | PASS | ux 스크립트: 다시 열기 전후 확대 같음(34%→34%) | S |
| 67 | J 추가 | 미니맵·보드 목록 패널 | 레이어·보드 탐색 | 왼쪽 패널: 페이지 목록(보드 수)·보드 목록(파일 없음 경고), 누르면 그 보드로 이동. 미니맵(M): 보드 배치·선택·지금 화면 사각형, 누르거나 끌면 그 자리로 | PASS | .out/ux/p1-09-board-options.png(왼쪽 목록·미니맵), p1-dark.png(다크) | M |
| 68 | 도움말 | F6·Shift+F6 영역 이동, Tab·Space·Return 보드·레이어 탐색 | 키보드·화면 읽기 지원 | 없음 | MISSING | 코드 | M |
| 69 | 도움말 | Option+화살표로 레이어 이동 | 됨 | 없음 | MISSING | 코드 | S |
| 70 | 도움말 | ⌘\ 속성 패널 열고 닫기 | 됨 | 없음(패널 항상 보임) | MISSING | 코드 | S |
| 71 | 도움말 | 색 선택기가 글자 명암 품질 표시 | 됨 | 없음 | PARTIAL | 스와치는 있으나 명암 표시 없음 | S |
| 72 | 도움말 | 레이어 목록 화살표 탐색·펼치기 | 됨 | 클릭·펼치기는 되지만 키보드 탐색 없음 | PARTIAL | 코드: `Layers.tsx` | S |
| 73 | 도움말 | 디자인 시스템 가져오기(/design-sync, GitHub·업로드) | 됨 | 레포 `docs/design`이 원본이라 가져오기 불필요 | N/A | – | – |
| 74 | 도움말 | AI 리뷰(접근성·명암·위계)와 2~3개 변형 요청 | 채팅으로 | 캔버스 안에서 요청할 곳 없음(#49 채팅 필요) | MISSING | 코드 | M |

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
