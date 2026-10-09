// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// 핵심 흐름 회귀 시험: 채팅 패널 → 에이전트 실행(가짜) → 스트리밍 표시 → 원본 반영, 맥락(선택 보드) 전달, 취소
import assert from "node:assert/strict";
import path from "node:path";
import { after, before, test } from "node:test";

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

test("보드를 고르고 ⌘J → 보내기 → 스트리밍 글·도구 줄 표시, 원본이 바뀌고, 맥락에 대상 보드가 들어간다", async () => {
  const { page, url } = env;
  await page.goto(url);
  await page.waitForSelector(".board");
  await page.getByRole("button", { name: /SCR-02 농가 목록/ }).first().click();
  await wait(300);
  await page.keyboard.press("Meta+j");
  const box = page.getByRole("textbox", { name: "AI에게 보낼 말" });
  await box.waitFor();
  await box.fill("제목 표시를 붙여 줘");
  await page.keyboard.press("Enter");
  await page.getByText("scr-02 제목을 고칠게요.").waitFor({ timeout: 8000 });
  await page.locator(".ai-tool", { hasText: "Edit" }).waitFor();
  for (let i = 0; i < 40 && !(await env.read("screens/scr-02.html")).includes('data-ai="1"'); i++) await wait(100);
  assert.match(await env.read("screens/scr-02.html"), /data-ai="1"/);
  const prompt = await env.read("prompt.txt");
  assert.match(prompt, /대상 보드: screens\/scr-02\.html/);
  assert.match(prompt, /\[요청\]\n제목 표시를 붙여 줘/);
  await page.getByText("이어서 대화 중").waitFor();
  assert.deepEqual(env.errors, []);
});

test("느린 실행은 취소 단추로 멈춘다", async () => {
  const { page } = env;
  const box = page.getByRole("textbox", { name: "AI에게 보낼 말" });
  await box.fill("느리게 해 줘");
  await page.keyboard.press("Enter");
  await page.locator(".composer").getByRole("button", { name: "취소" }).click();
  await page.getByText("취소됨").waitFor({ timeout: 5000 });
  assert.equal(await page.getByRole("button", { name: "보내기" }).count(), 1);
});
