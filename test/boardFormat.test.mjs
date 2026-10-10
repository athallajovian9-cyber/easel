// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { formatBoard } from "../server/boardFormat.mjs";

const REPO_BOARD = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "fixtures/board-sample.json");

test("only the format changes, values stay equal; one board per line, sorted keys", async () => {
  const b = JSON.parse(await fs.readFile(REPO_BOARD, "utf8"));
  const text = formatBoard(b);
  assert.deepEqual(JSON.parse(text), JSON.parse(JSON.stringify(b)));
  const lines = text.split("\n");
  assert.ok(lines.some((l) => l.startsWith('    "scr-01.html": {"x":')));
  const keys = lines.filter((l) => /^    "[^"]+\.html": \{/.test(l)).map((l) => l.trim().split('"')[1]);
  assert.deepEqual(keys, [...keys].sort());
  assert.equal(formatBoard(JSON.parse(text)), text, "rewriting gives the same text");
});

test("merging two branches: moving different boards and adding notes do not conflict", async () => {
  const base = JSON.parse(await fs.readFile(REPO_BOARD, "utf8"));
  const d = await fs.mkdtemp(path.join(os.tmpdir(), "dc-merge-"));
  const w = async (name, fn) => {
    const v = structuredClone(base);
    fn(v);
    await fs.writeFile(path.join(d, name), formatBoard(v));
  };
  await w("base", () => {});
  const cases = [
    ["move adjacent boards", (v) => (v.boards["scr-01.html"].x = 1500), (v) => (v.boards["scr-02.html"].x = 2400)],
    ["add a note on each side", (v) => (v.notes.na = { kind: "sticky", x: 1, y: 1, text: "A", w: 100 }), (v) => (v.notes.tz = { kind: "sticky", x: 2, y: 2, text: "B", w: 100 })],
    ["move a board + add a note", (v) => (v.boards["ds.html"].y = 1), (v) => (v.notes.nz = { kind: "title", x: 0, y: 0, text: "C" })],
  ];
  for (const [name, a, b] of cases) {
    await w("ours", a);
    await w("theirs", b);
    let code = 0;
    try {
      execFileSync("git", ["merge-file", path.join(d, "ours"), path.join(d, "base"), path.join(d, "theirs")]);
    } catch (e) {
      code = e.status;
    }
    assert.equal(code, 0, `${name}: conflict`);
    JSON.parse(await fs.readFile(path.join(d, "ours"), "utf8"));
  }
});
