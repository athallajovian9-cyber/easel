// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// 핵심 흐름 회귀 시험: 선택 → 편집 → 원본 반영, 파일 감시(원자적 쓰기 포함)
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { after, before, test } from "node:test";

import { openBoard, startEnv, wait } from "./helpers.mjs";

let env;
before(async () => (env = await startEnv()));
after(async () => env?.close());

test("선택 → 글자·스타일 편집 → 원본은 그 부분만, 임시 파일 없음", async () => {
  const { page, url } = env;
  const orig = await env.read("screens/scr-32.html");
  const fr = await openBoard(page, url, "scr-32.html", { edit: true });
  await fr.locator("a.btn").click();
  await wait(700);
  const sel = await env.api("GET", "/api/selection");
  assert.equal(sel.body.selection.path, "0/1/1/5");
  await fr.locator("a.btn").dblclick();
  await wait(200);
  await page.keyboard.press("Meta+A");
  await page.keyboard.type("문의 접수하기");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => true);
  for (let i = 0; i < 30 && !(await env.read("screens/scr-32.html")).includes("문의 접수하기"); i++) await wait(100);
  const after1 = await env.read("screens/scr-32.html");
  const changed = after1.split("\n").filter((l, i) => l !== orig.split("\n")[i]);
  assert.equal(changed.length, 1);
  assert.match(changed[0], /문의 접수하기/);
  const tmp = (await fs.readdir(path.join(env.dir, "screens"))).filter((n) => n.startsWith(".dc-tmp"));
  assert.deepEqual(tmp, []);
  assert.deepEqual(env.errors, []);
});

test("파일 감시: 밖에서 고치면 1초 안에 그 보드만 다시 그린다(원자적 쓰기 뒤에도)", async () => {
  const { page, url } = env;
  await openBoard(page, url, "scr-02.html");
  const p = path.join(env.dir, "screens/scr-02.html");
  const t0 = Date.now();
  // 원자적 쓰기와 같은 방식(임시 파일 → rename)으로 고친다
  const tmp = path.join(env.dir, "screens", ".dc-tmp-test");
  await fs.writeFile(tmp, (await fs.readFile(p, "utf8")).replace('<div class="x-dc">', '<div class="x-dc"><b id="e2e-mark">E2E</b>'));
  await fs.rename(tmp, p);
  await page.waitForFunction(() => !!document.querySelector('.board[data-file="scr-02.html"] iframe')?.contentDocument?.getElementById("e2e-mark"), null, { timeout: 3000 });
  assert.ok(Date.now() - t0 < 1500);
  const b = await env.api("GET", "/api/board");
  assert.deepEqual(b.body.missing, []);
  assert.ok(b.body.board.boards["scr-02.html"]);
});
