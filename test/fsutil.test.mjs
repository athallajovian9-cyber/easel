// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { writeAtomic } from "../server/fsutil.mjs";

test("원자적 쓰기: 임시 파일을 남기지 않고 내용·권한을 바꾼다", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dc-"));
  const f = path.join(dir, "a.html");
  await fs.writeFile(f, "old");
  await fs.chmod(f, 0o640);
  await writeAtomic(f, "new");
  assert.equal(await fs.readFile(f, "utf8"), "new");
  assert.equal((await fs.stat(f)).mode & 0o777, 0o640);
  assert.deepEqual((await fs.readdir(dir)).filter((n) => n.startsWith(".dc-tmp")), []);
});

test("원자적 쓰기: 실패하면 원본이 그대로", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dc-"));
  const f = path.join(dir, "sub", "missing.html");
  await assert.rejects(writeAtomic(f, "x"));
});
