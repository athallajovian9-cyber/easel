// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// Windows 경로: 실제 Windows 없이 path.win32로 변환 규칙을 확인한다
import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

import { winQuote } from "../server/chat.mjs";
import { toPosix } from "../server/fsutil.mjs";

test("Windows 상대 경로 → / 경로(board.json·URL)", () => {
  const rel = path.win32.relative("C:\\repo\\docs\\design\\screens", "C:\\repo\\docs\\design\\screens\\flows\\f-3.html");
  assert.equal(rel, "flows\\f-3.html");
  assert.equal(toPosix(rel, path.win32.sep), "flows/f-3.html");
  assert.equal(toPosix("scr-01.html", path.win32.sep), "scr-01.html");
});

test("Windows shell 인자 따옴표", () => {
  assert.equal(winQuote("--json"), "--json");
  assert.equal(winQuote('제목 "A" 바꿔'), '"제목 ""A"" 바꿔"');
});
