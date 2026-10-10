// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// Off-token value lint and tweaks value updates
import assert from "node:assert/strict";
import { test } from "node:test";

import { applyEdit } from "../server/edit.mjs";
import { DEFAULT_TOKENS, lintHtml, toHex } from "../server/tokens.mjs";
import { ko } from "./fixtures/ko-strings.mjs";

test("color normalization: #abc, #aabbcc, rgb; translucent colors are not checked", () => {
  assert.equal(toHex("#c94f0c"), "#C94F0C");
  assert.equal(toHex("#fff"), "#FFFFFF");
  assert.equal(toHex("rgb(17, 17, 17)"), "#111111");
  assert.equal(toHex("rgba(255,255,255,0.82)"), null);
});

test("lint: off-token color, font size, radius and non-4px spacing, with path and line", () => {
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

test("setTweaks: changes only value and keeps the other keys", () => {
  const html = `<html><head><script type="application/json" id="board-tweaks">{"dense":{"type":"boolean","value":false,"var":"--dense","label":${JSON.stringify(ko.denseLabel)}}}</script></head><body></body></html>`;
  const out = applyEdit(html, { op: "setTweaks", values: { dense: true, nope: 1 } });
  const json = JSON.parse(out.match(/id="board-tweaks">([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(json, { dense: { type: "boolean", value: true, var: "--dense", label: ko.denseLabel } });
});
