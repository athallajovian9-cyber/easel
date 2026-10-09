// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// 원본 패치가 바뀐 구간만 고치는지 확인한다(PLAN.md M5·M6 완료 기준)
import assert from "node:assert/strict";
import { test } from "node:test";

import { applyEdit, setDecl } from "../server/edit.mjs";
import { inspect } from "../server/html.mjs";

const SRC = `<!doctype html>
<html lang="ko">
<head><meta charset="utf-8"></head>
<body>
<div class="x-dc">
  <h1 class='t34' style="margin:0;font-size:34px">제목 &amp; 부제</h1>
  <p>본문</p>
  <a href="scr-16.html" class="btn">문의 보내기</a>
  <span></span>
</div>
</body>
</html>
`;
const h = (p) => inspect(SRC, p).hash;
const diffLines = (a, b) => {
  const A = a.split("\n");
  const B = b.split("\n");
  return B.filter((l, i) => l !== A[i]).length + Math.abs(A.length - B.length);
};

test("setText: 글자만 바뀌고 다른 줄은 그대로", () => {
  const out = applyEdit(SRC, { op: "setText", path: "0/2", hash: h("0/2"), text: "보내기 <확인>" });
  assert.match(out, /<a href="scr-16.html" class="btn">보내기 &lt;확인&gt;<\/a>/);
  assert.equal(diffLines(SRC, out), 1);
});

test("setText: 빈 요소에 글자 넣기", () => {
  const out = applyEdit(SRC, { op: "setText", path: "0/3", hash: h("0/3"), text: "새 글" });
  assert.match(out, /<span>새 글<\/span>/);
});

test("setText: 자식 요소가 있으면 거부", () => {
  assert.throws(() => applyEdit(SRC, { op: "setText", path: "0", text: "x" }), /글자 하나만/);
});

test("해시가 다르면 거부(동시 수정)", () => {
  assert.throws(() => applyEdit(SRC, { op: "setText", path: "0/1", hash: "deadbeef0000", text: "x" }), /파일이 바뀜/);
});

test("setStyle: 선언 하나만 교체, 따옴표·다른 선언 유지", () => {
  const out = applyEdit(SRC, { op: "setStyle", path: "0/0", hash: h("0/0"), prop: "font-size", value: "22px" });
  assert.match(out, /<h1 class='t34' style="margin:0;font-size:22px">/);
  assert.equal(diffLines(SRC, out), 1);
});

test("setStyle: 새 선언 추가와 삭제, style 없으면 만들기", () => {
  let out = applyEdit(SRC, { op: "setStyle", path: "0/0", hash: h("0/0"), prop: "color", value: "#C94F0C" });
  assert.match(out, /style="margin:0;font-size:34px;color:#C94F0C"/);
  out = applyEdit(SRC, { op: "setStyle", path: "0/0", hash: h("0/0"), prop: "margin", value: "" });
  assert.match(out, /style="font-size:34px"/);
  out = applyEdit(SRC, { op: "setStyle", path: "0/1", hash: h("0/1"), prop: "gap", value: "8px" });
  assert.match(out, /<p style="gap:8px">본문<\/p>/);
});

test("setDecl: url() 안의 ;를 나누지 않음", () => {
  assert.equal(setDecl("background:url(a;b.png);color:red", "color", "blue"), "background:url(a;b.png);color:blue");
  assert.equal(setDecl("margin: 0; padding: 4px", "padding", "8px"), "margin: 0; padding: 8px");
});

test("setAttr: 바꾸기·추가·삭제", () => {
  let out = applyEdit(SRC, { op: "setAttr", path: "0/2", hash: h("0/2"), name: "href", value: "scr-17.html" });
  assert.match(out, /<a href="scr-17.html" class="btn">/);
  out = applyEdit(SRC, { op: "setAttr", path: "0/2", hash: h("0/2"), name: "aria-label", value: "문의" });
  assert.match(out, /class="btn" aria-label="문의">/);
  out = applyEdit(SRC, { op: "setAttr", path: "0/2", hash: h("0/2"), name: "class", value: null });
  assert.match(out, /<a href="scr-16.html">문의 보내기/);
});

test("delete·duplicate: 한 줄 단위로 서식 유지", () => {
  let out = applyEdit(SRC, { op: "delete", path: "0/1", hash: h("0/1") });
  assert.ok(!out.includes("<p>본문</p>"));
  assert.ok(out.includes("  <a href"));
  out = applyEdit(SRC, { op: "duplicate", path: "0/1", hash: h("0/1") });
  assert.match(out, /  <p>본문<\/p>\n  <p>본문<\/p>\n/);
});

test("move: 순서 바꾸기(같은 부모)", () => {
  const out = applyEdit(SRC, { op: "move", path: "0/2", hash: h("0/2"), toParentPath: "0", index: 0 });
  const i = out.indexOf("<a href");
  const j = out.indexOf("<h1");
  assert.ok(i < j);
  assert.match(out, /\n  <a href="scr-16.html" class="btn">문의 보내기<\/a>\n  <h1/);
  assert.equal(out.split("\n").length, SRC.split("\n").length);
});

test("wrap: 연속 형제를 flex div로 감쌈", () => {
  const out = applyEdit(SRC, { op: "wrap", paths: ["0/1", "0/2"], display: "flex" });
  assert.match(out, /<div style="display:flex;gap:8px"><p>본문<\/p>\n  <a|<div style="display:flex;gap:8px">\n/);
  assert.ok(inspect(out, "0/1").tag === "div");
  assert.ok(inspect(out, "0/1/0").tag === "p");
  assert.ok(inspect(out, "0/1/1").tag === "a");
  assert.throws(() => applyEdit(SRC, { op: "wrap", paths: ["0/0", "0/2"] }), /연속/);
});
