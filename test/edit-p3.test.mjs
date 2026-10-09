// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// P3 편집 연산: insert(보드 간 붙여넣기)·batch(정렬 등 여러 속성)·move freeze(flex 밖으로 끌 때 크기 고정)
import assert from "node:assert/strict";
import { test } from "node:test";

import { applyEdit } from "../server/edit.mjs";
import { inspect } from "../server/html.mjs";

const doc = `<!doctype html>
<html><head><title>t</title></head>
<body>
<div style="display:flex;gap:8px">
  <p>하나</p>
  <p>둘</p>
</div>
<section>
  <h2>제목</h2>
</section>
</body>
</html>
`;

test("insert after: 같은 들여쓰기로 다음 줄에", () => {
  const out = applyEdit(doc, { op: "insert", path: "0/1", hash: inspect(doc, "0/1").hash, position: "after", html: "<p>셋</p>" });
  assert.match(out, /  <p>둘<\/p>\n  <p>셋<\/p>\n<\/div>/);
  assert.equal(inspect(out, "0/2").text, "셋");
});

test("insert inside: 마지막 자식 뒤, 여러 줄 소스는 들여쓰기", () => {
  const out = applyEdit(doc, { op: "insert", path: "1", hash: inspect(doc, "1").hash, position: "inside", html: "<div>\n      <b>x</b>\n    </div>" });
  assert.match(out, /  <h2>제목<\/h2>\n  <div>\n    <b>x<\/b>\n  <\/div>\n<\/section>/);
});

test("insert: script는 막는다", () => {
  assert.throws(() => applyEdit(doc, { op: "insert", path: "1", position: "inside", html: "<script>x</script>" }), /script/);
});

test("batch: 한 요소에 속성 여러 개, 해시는 첫 연산만", () => {
  const h = inspect(doc, "1/0").hash;
  const out = applyEdit(doc, { op: "batch", ops: [{ op: "setStyle", path: "1/0", hash: h, prop: "margin-left", value: "auto" }, { op: "setStyle", path: "1/0", hash: h, prop: "margin-right", value: "auto" }] });
  assert.match(out, /<h2 style="margin-left: auto; margin-right: auto;?">제목<\/h2>|<h2 style="margin-left:auto;margin-right:auto">제목<\/h2>/);
});

test("move + freeze: flex 부모 크기를 고정하고 밖으로 옮긴다(한 번에)", () => {
  const out = applyEdit(doc, { op: "move", path: "0/0", hash: inspect(doc, "0/0").hash, toParentPath: "1", index: 1, freeze: [{ path: "0", props: { width: "300px", height: "40px" } }] });
  assert.match(out, /<div style="display:flex;gap:8px;\s*width:\s*300px;\s*height:\s*40px;?">/);
  assert.equal(inspect(out, "0/0").text, "둘");
  assert.equal(inspect(out, "1/1").text, "하나");
});
