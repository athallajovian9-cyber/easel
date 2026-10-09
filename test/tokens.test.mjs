// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// 토큰 밖 값 검사·tweaks 값 바꾸기
import assert from "node:assert/strict";
import { test } from "node:test";

import { applyEdit } from "../server/edit.mjs";
import { DEFAULT_TOKENS, lintHtml, toHex } from "../server/tokens.mjs";

test("색 정규화: #abc·#aabbcc·rgb, 반투명은 검사하지 않음", () => {
  assert.equal(toHex("#c94f0c"), "#C94F0C");
  assert.equal(toHex("#fff"), "#FFFFFF");
  assert.equal(toHex("rgb(17, 17, 17)"), "#111111");
  assert.equal(toHex("rgba(255,255,255,0.82)"), null);
});

test("lint: 토큰 밖 색·글자 크기·모서리·4 단위 아닌 간격, 경로와 줄", () => {
  const html = `<!doctype html><html><head><style>
.a{color:#123456;font-size:13px}
.b{color:#111111;font-size:17px}
</style></head><body>
<div style="gap:10px;border-radius:16px">
  <p style="color:#C94F0C;font-size:15px;border-radius:12px">x</p>
</div>
</body></html>`;
  const w = lintHtml(html, DEFAULT_TOKENS);
  const msgs = w.map((x) => `${x.path ?? "-"}@${x.line}:${x.prop}=${x.value}`);
  assert.deepEqual(msgs.sort(), ["-@2:color=#123456", "-@2:font-size=13px", "0/0@6:border-radius=12px", "0@5:gap=10px"].sort());
});

test("setTweaks: value만 바꾸고 나머지 키는 그대로", () => {
  const html = `<html><head><script type="application/json" id="board-tweaks">{"dense":{"type":"boolean","value":false,"var":"--dense","label":"촘촘하게"}}</script></head><body></body></html>`;
  const out = applyEdit(html, { op: "setTweaks", values: { dense: true, nope: 1 } });
  const json = JSON.parse(out.match(/id="board-tweaks">([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(json, { dense: { type: "boolean", value: true, var: "--dense", label: "촘촘하게" } });
});
