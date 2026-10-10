// Korean test data on purpose: these strings check that Korean text survives editing, quoting and rendering.
export const ko = {
  // edit.test.mjs source document
  titleAmp: "제목 &amp; 부제",
  body: "본문",
  sendInquiry: "문의 보내기",
  sendConfirm: "보내기 <확인>",
  sendConfirmEscaped: "보내기 &lt;확인&gt;",
  newText: "새 글",
  inquiry: "문의",
  // edit-p3.test.mjs source document
  one: "하나",
  two: "둘",
  three: "셋",
  title: "제목",
  // chat.test.mjs streamed text pieces
  hello: "안",
  done: "끝",
  // tokens.test.mjs tweak label
  denseLabel: "촘촘하게",
  // winpath.test.mjs shell argument
  quoteArg: '제목 "A" 바꿔',
  quoteArgQuoted: '"제목 ""A"" 바꿔"',
  // e2e: text typed into the canvas, board title from test/fixtures/design/board.json
  inquirySubmit: "문의 접수하기",
  scr02Title: "SCR-02 농가 목록",
  // e2e chat: request typed into the AI composer
  addTitleRequest: "제목 표시를 붙여 줘",
};
