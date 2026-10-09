// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { formatBoard } from "../server/boardFormat.mjs";

const REPO_BOARD = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../docs/design/board.json");

test("형식만 바뀌고 값은 같다, 보드 하나가 한 줄, 키 정렬", async () => {
  const b = JSON.parse(await fs.readFile(REPO_BOARD, "utf8"));
  const text = formatBoard(b);
  assert.deepEqual(JSON.parse(text), JSON.parse(JSON.stringify(b)));
  const lines = text.split("\n");
  assert.ok(lines.some((l) => l.startsWith('    "scr-01.html": {"x":')));
  const keys = lines.filter((l) => /^    "[^"]+\.html": \{/.test(l)).map((l) => l.trim().split('"')[1]);
  assert.deepEqual(keys, [...keys].sort());
  assert.equal(formatBoard(JSON.parse(text)), text, "다시 써도 같다");
});

test("두 브랜치 병합: 서로 다른 보드 이동·메모 추가는 충돌 없음", async () => {
  const base = JSON.parse(await fs.readFile(REPO_BOARD, "utf8"));
  const d = await fs.mkdtemp(path.join(os.tmpdir(), "dc-merge-"));
  const w = async (name, fn) => {
    const v = structuredClone(base);
    fn(v);
    await fs.writeFile(path.join(d, name), formatBoard(v));
  };
  await w("base", () => {});
  const cases = [
    ["인접 보드 이동", (v) => (v.boards["scr-01.html"].x = 1500), (v) => (v.boards["scr-02.html"].x = 2400)],
    ["메모 각각 추가", (v) => (v.notes.na = { kind: "sticky", x: 1, y: 1, text: "A", w: 100 }), (v) => (v.notes.tz = { kind: "sticky", x: 2, y: 2, text: "B", w: 100 })],
    ["보드 이동 + 메모 추가", (v) => (v.boards["ds.html"].y = 1), (v) => (v.notes.nz = { kind: "title", x: 0, y: 0, text: "C" })],
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
    assert.equal(code, 0, `${name}: 충돌`);
    JSON.parse(await fs.readFile(path.join(d, "ours"), "utf8"));
  }
});
