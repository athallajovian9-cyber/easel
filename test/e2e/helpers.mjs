// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// e2e 공통: docs/design을 임시 폴더에 복사해 서버를 따로 띄운다(레포 파일은 건드리지 않음).
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
export const TOOL = path.resolve(here, "../..");
export const REPO_DESIGN = path.resolve(TOOL, "../../docs/design");

const freePort = () =>
  new Promise((r) => {
    const s = net.createServer();
    s.listen(0, () => {
      const p = s.address().port;
      s.close(() => r(p));
    });
  });

export async function startEnv() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dc-e2e-"));
  await fs.cp(REPO_DESIGN, dir, { recursive: true, filter: (src) => !src.endsWith("feedback.md") });
  const port = await freePort();
  const proc = spawn(process.execPath, [path.join(TOOL, "bin/server.mjs"), "--dir", dir, "--port", String(port)], { stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  proc.stdout.on("data", (d) => (log += d));
  proc.stderr.on("data", (d) => (log += d));
  const url = `http://localhost:${port}`;
  for (let i = 0; i < 600; i++) {
    try {
      if ((await fetch(url + "/api/health")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  let browser;
  try {
    browser = await chromium.launch();
  } catch {
    browser = await chromium.launch({ channel: "chrome" });
  }
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  return {
    dir,
    url,
    page,
    errors,
    log: () => log,
    read: (rel) => fs.readFile(path.join(dir, rel), "utf8"),
    write: (rel, text) => fs.writeFile(path.join(dir, rel), text),
    api: async (method, p, body) => {
      const r = await fetch(url + p, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
      return { status: r.status, body: await r.json().catch(() => null) };
    },
    async close() {
      await browser.close();
      proc.kill();
      await fs.rm(dir, { recursive: true, force: true });
    },
  };
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** 보드 하나를 크게 보고 편집 모드로 */
export async function openBoard(page, url, file, { edit = false } = {}) {
  if (!page.url().startsWith(url)) {
    await page.goto(url);
    await page.waitForSelector(".board");
  }
  await page.evaluate((f) => {
    document.querySelector(`.board[data-file="${f}"] .board-frame`).dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerId: 1 }));
  }, file);
  await wait(100);
  await page.getByRole("button", { name: "선택 보드로" }).click();
  await page.waitForSelector(`.board[data-file="${file}"] iframe`);
  await wait(600);
  if (edit) {
    await page.dispatchEvent(`.board[data-file="${file}"] .board-frame`, "dblclick");
    await wait(800);
  }
  return page.frameLocator(`.board[data-file="${file}"] iframe`);
}
