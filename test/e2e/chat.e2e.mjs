// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// Core-flow regression tests: chat panel -> agent run (fake) -> streaming display -> source updated, context (selected board) passed, cancel
import assert from "node:assert/strict";
import path from "node:path";
import { after, before, test } from "node:test";

import { ko } from "../fixtures/ko-strings.mjs";
import { startEnv, TOOL, wait } from "./helpers.mjs";

let env;
before(async () => {
  process.env.DESIGN_CANVAS_AGENT_CMD = JSON.stringify({ claude: ["node", path.join(TOOL, "test/e2e/fake-agent.mjs")] });
  env = await startEnv();
});
after(async () => {
  delete process.env.DESIGN_CANVAS_AGENT_CMD;
  await env?.close();
});

test("select a board, Cmd+J -> Send -> streamed text and tool line shown, source changes, context includes the target board", async () => {
  const { page, url } = env;
  await page.goto(url);
  await page.waitForSelector(".board");
  await page.getByRole("button", { name: ko.scr02Title }).first().click();
  await wait(300);
  await page.keyboard.press("Meta+j");
  const box = page.getByRole("textbox", { name: "Message to AI" });
  await box.waitFor();
  await box.fill(ko.addTitleRequest);
  await page.keyboard.press("Enter");
  await page.getByText("Fixing the scr-02 title.").waitFor({ timeout: 8000 });
  await page.locator(".ai-tool", { hasText: "Edit" }).waitFor();
  for (let i = 0; i < 40 && !(await env.read("screens/scr-02.html")).includes('data-ai="1"'); i++) await wait(100);
  assert.match(await env.read("screens/scr-02.html"), /data-ai="1"/);
  const prompt = await env.read("prompt.txt");
  assert.match(prompt, /- Target boards: screens\/scr-02\.html/);
  assert.ok(prompt.includes(`[Request]\n${ko.addTitleRequest}`));
  await page.getByText("Continuing conversation").waitFor();
  assert.deepEqual(env.errors, []);
});

test("a slow run stops with the Cancel button", async () => {
  const { page } = env;
  const box = page.getByRole("textbox", { name: "Message to AI" });
  await box.fill("please go slow");
  await page.keyboard.press("Enter");
  await page.locator(".composer").getByRole("button", { name: "Cancel" }).click();
  await page.getByText("Cancelled").waitFor({ timeout: 5000 });
  assert.equal(await page.getByRole("button", { name: "Send" }).count(), 1);
});
