// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { createDeps } from "../server/deps.mjs";

test("끼운 보드: 직접·간접으로 끼운 화면을 찾는다", async () => {
  const d = await fs.mkdtemp(path.join(os.tmpdir(), "dc-"));
  await fs.writeFile(path.join(d, "a.html"), "<p>a</p>");
  await fs.writeFile(path.join(d, "flow.html"), '<iframe src="a.html"></iframe><iframe src="b.html?x=1"></iframe>');
  await fs.writeFile(path.join(d, "cover.html"), "<iframe src='./flow.html'></iframe>");
  const deps = createDeps(d);
  await deps.init(["a.html", "flow.html", "cover.html"]);
  assert.deepEqual(deps.dependents("a.html").sort(), ["cover.html", "flow.html"]);
  assert.deepEqual(deps.dependents("cover.html"), []);
});
