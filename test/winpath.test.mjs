// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// Windows paths: checks conversion rules with path.win32, without real Windows
import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

import { winQuote } from "../server/chat.mjs";
import { toPosix } from "../server/fsutil.mjs";
import { ko } from "./fixtures/ko-strings.mjs";

test("Windows relative path -> / path (board.json, URL)", () => {
  const rel = path.win32.relative("C:\\repo\\docs\\design\\screens", "C:\\repo\\docs\\design\\screens\\flows\\f-3.html");
  assert.equal(rel, "flows\\f-3.html");
  assert.equal(toPosix(rel, path.win32.sep), "flows/f-3.html");
  assert.equal(toPosix("scr-01.html", path.win32.sep), "scr-01.html");
});

test("Windows shell argument quoting", () => {
  assert.equal(winQuote("--json"), "--json");
  assert.equal(winQuote(ko.quoteArg), ko.quoteArgQuoted);
});
