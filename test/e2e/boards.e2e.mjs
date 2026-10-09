// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// 핵심 흐름 회귀 시험: 보드 만들기(보드 도구로 그리기) → 삭제(확인 창·휴지통) → 실행 취소, 캔버스 조작과 HTML 편집이 한 기록에 쌓이는지
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { after, before, test } from "node:test";

import { startEnv, wait } from "./helpers.mjs";

let env;
before(async () => (env = await startEnv()));
after(async () => env?.close());

const board = async () => (await env.api("GET", "/api/board")).body.board;
const exists = (rel) => fs.access(path.join(env.dir, rel)).then(() => true, () => false);
async function until(fn, ms = 6000) {
  for (let t = 0; t < ms; t += 100) {
    if (await fn()) return true;
    await wait(100);
  }
  return false;
}

test("보드 도구로 그려 만들고, 삭제(확인)하고, ⌘Z로 되살리고, 한 번 더 ⌘Z로 만들기도 취소", async () => {
  const { page, url } = env;
  await page.goto(url);
  await page.waitForSelector(".board");
  // 빈 곳으로 화면을 옮긴다(가로로 크게 이동)
  const c = await page.locator(".canvas").boundingBox();
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
  await page.mouse.wheel(20000, 0);
  await wait(200);
  await page.keyboard.press("b");
  assert.equal(await page.getByRole("radio", { name: /보드 그리기/ }).getAttribute("aria-checked"), "true");
  await page.mouse.move(c.x + 200, c.y + 200);
  await page.mouse.down();
  await page.mouse.move(c.x + 300, c.y + 400, { steps: 5 });
  await page.mouse.up();
  assert.ok(await until(() => exists("screens/board.html")), "새 HTML 파일");
  const b1 = await board();
  assert.ok(b1.boards["board.html"], "board.json에 자리");
  assert.ok(b1.boards["board.html"].w > 40);
  await page.waitForSelector('.board.selected[data-file="board.html"]');
  await page.getByText("보드 board.html를 만들었어요").waitFor();

  // 삭제: 확인 창 → 지우기
  await page.keyboard.press("Delete");
  await page.getByRole("dialog").getByRole("button", { name: "지우기" }).click();
  assert.ok(await until(async () => !(await exists("screens/board.html"))), "파일 지움");
  assert.ok(await until(async () => (await board()).boards["board.html"] === undefined), "board.json에서도 뺌");
  const trash = await fs.readdir(path.join(env.dir, ".trash"));
  assert.ok(trash.some((d) => d !== ".gitignore"), "휴지통에 사본");

  // 실행 취소 → 되살아남
  await page.keyboard.press("Meta+z");
  assert.ok(await until(() => exists("screens/board.html")), "되살림");
  assert.ok(await until(async () => !!(await board()).boards["board.html"]));
  await page.waitForSelector('.board[data-file="board.html"]');

  // 한 번 더 → 만들기 취소
  await page.keyboard.press("Meta+z");
  const undone = await until(async () => !(await exists("screens/board.html")));
  assert.ok(undone, "만들기 취소");
  // 다시 실행
  await page.keyboard.press("Meta+Shift+z");
  assert.ok(await until(() => exists("screens/board.html")), "다시 실행");
  assert.deepEqual(env.errors, []);
});

test("한 기록: HTML 편집 → 보드 옮기기(화살표) → ⌘Z 두 번이 시간 역순으로 되돌린다", async () => {
  const { page } = env;
  const f = "scr-02.html";
  const origHtml = await env.read(`screens/${f}`);
  const x0 = (await board()).boards[f].x;
  // HTML 편집(서버 API로 — 편집 UI는 core 시험에서 본다)
  const el = (await env.api("GET", `/api/element?f=${f}&path=0`)).body;
  const r = await env.api("POST", "/api/edit", { file: f, op: "setAttr", path: "0", hash: el.hash, name: "data-e2e", value: "1" });
  assert.equal(r.status, 200);
  // 보드 선택 후 Shift+→ 로 10 옮기기
  await page.evaluate((file) => {
    document.querySelector(`.board[data-file="${file}"] .board-frame`).dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerId: 1 }));
    window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, button: 0, pointerId: 1 }));
  }, f);
  await wait(150);
  await page.keyboard.press("Shift+ArrowRight");
  assert.ok(await until(async () => (await board()).boards[f].x === x0 + 10), "옮기기 저장");
  const h = (await env.api("GET", "/api/history")).body;
  assert.equal(h.undo.at(-1), "보드 옮기기");
  // ⌘Z: 옮기기 먼저, 그다음 HTML 편집
  await page.keyboard.press("Meta+z");
  assert.ok(await until(async () => (await board()).boards[f].x === x0), "옮기기 취소");
  assert.notEqual(await env.read(`screens/${f}`), origHtml);
  await page.keyboard.press("Meta+z");
  assert.ok(await until(async () => (await env.read(`screens/${f}`)) === origHtml), "편집 취소");
  assert.deepEqual(env.errors, []);
});
