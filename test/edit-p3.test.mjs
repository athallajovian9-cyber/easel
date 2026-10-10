// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// P3 edit ops: insert (paste across boards), batch (several properties, e.g. alignment), move freeze (fix size when dragging out of flex)
import assert from "node:assert/strict";
import { test } from "node:test";

import { applyEdit } from "../server/edit.mjs";
import { inspect } from "../server/html.mjs";
import { ko } from "./fixtures/ko-strings.mjs";

const doc = `<!doctype html>
<html><head><title>t</title></head>
<body>
<div style="display:flex;gap:8px">
  <p>${ko.one}</p>
  <p>${ko.two}</p>
</div>
<section>
  <h2>${ko.title}</h2>
</section>
</body>
</html>
`;

test("insert after: on the next line with the same indent", () => {
  const out = applyEdit(doc, { op: "insert", path: "0/1", hash: inspect(doc, "0/1").hash, position: "after", html: `<p>${ko.three}</p>` });
  assert.ok(out.includes(`  <p>${ko.two}</p>\n  <p>${ko.three}</p>\n</div>`));
  assert.equal(inspect(out, "0/2").text, ko.three);
});

test("insert inside: after the last child, multi-line source is indented", () => {
  const out = applyEdit(doc, { op: "insert", path: "1", hash: inspect(doc, "1").hash, position: "inside", html: "<div>\n      <b>x</b>\n    </div>" });
  assert.ok(out.includes(`  <h2>${ko.title}</h2>\n  <div>\n    <b>x</b>\n  </div>\n</section>`));
});

test("insert: script is blocked", () => {
  assert.throws(() => applyEdit(doc, { op: "insert", path: "1", position: "inside", html: "<script>x</script>" }), /script/);
});

test("batch: several properties on one element, hash checked on the first op only", () => {
  const h = inspect(doc, "1/0").hash;
  const out = applyEdit(doc, { op: "batch", ops: [{ op: "setStyle", path: "1/0", hash: h, prop: "margin-left", value: "auto" }, { op: "setStyle", path: "1/0", hash: h, prop: "margin-right", value: "auto" }] });
  assert.match(out, new RegExp(`<h2 style="margin-left: auto; margin-right: auto;?">${ko.title}</h2>|<h2 style="margin-left:auto;margin-right:auto">${ko.title}</h2>`));
});

test("move + freeze: fixes the flex parent size and moves the element out (in one step)", () => {
  const out = applyEdit(doc, { op: "move", path: "0/0", hash: inspect(doc, "0/0").hash, toParentPath: "1", index: 1, freeze: [{ path: "0", props: { width: "300px", height: "40px" } }] });
  assert.match(out, /<div style="display:flex;gap:8px;\s*width:\s*300px;\s*height:\s*40px;?">/);
  assert.equal(inspect(out, "0/0").text, ko.two);
  assert.equal(inspect(out, "1/1").text, ko.one);
});
