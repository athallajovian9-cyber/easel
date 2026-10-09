// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// 마일스톤별로 붙는 추가 API와 감시기. createServer의 extraRoutes로 들어간다. PLAN.md 4장.
import fs from "node:fs/promises";
import path from "node:path";

import { TOOL_ROOT } from "./args.mjs";
import { applyEdit, EditError } from "./edit.mjs";
import { inspect, outline } from "./html.mjs";
import { readBody, safeJoin, sendJson } from "./index.mjs";
import { watchDesign } from "./watch.mjs";

const OUTER_LIMIT = 4096;
let selection = null;

/* ---------- 실행 취소: 파일별 메모리 기록(최근 50) ---------- */
const HISTORY_LIMIT = 50;
const history = new Map(); // file → { undo: [{before, after}], redo: [...] }
const hist = (f) => {
  if (!history.has(f)) history.set(f, { undo: [], redo: [] });
  return history.get(f);
};

async function writeScreen(ctx, p, html) {
  await fs.writeFile(p, html, "utf8");
}

async function readScreen(ctx, file) {
  const p = safeJoin(ctx.store.screensDir, file ?? "");
  if (!p || !String(file).endsWith(".html")) throw Object.assign(new Error("잘못된 파일"), { status: 400 });
  try {
    return { p, html: await fs.readFile(p, "utf8") };
  } catch {
    throw Object.assign(new Error("파일이 없어요"), { status: 404 });
  }
}

/* ---------- 댓글 (docs/design/comments.json) ---------- */
async function readComments(ctx) {
  try {
    const d = JSON.parse(await fs.readFile(path.join(ctx.dir, "comments.json"), "utf8"));
    return Array.isArray(d.comments) ? d.comments : [];
  } catch {
    return [];
  }
}
async function writeComments(ctx, comments) {
  await fs.writeFile(path.join(ctx.dir, "comments.json"), JSON.stringify({ comments }, null, 1) + "\n", "utf8");
  ctx.broadcast({ type: "comments-changed" });
}

/* ---------- 스크린샷 (playwright가 있으면) ---------- */
let browserPromise = null;
async function getBrowser() {
  if (!browserPromise) {
    browserPromise = (async () => {
      const { chromium } = await import("playwright").catch(() => {
        throw Object.assign(new Error("playwright가 없어 스크린샷을 쓸 수 없어요(npm run design:install)"), { status: 501 });
      });
      // 내려받은 크로뮴이 없으면 설치된 Chrome을 쓴다
      return chromium.launch().catch(() => chromium.launch({ channel: "chrome" }));
    })();
    browserPromise.catch(() => (browserPromise = null));
  }
  return browserPromise;
}

export async function screenshot(ctx, port, file, elPath) {
  const board = (await ctx.store.readBoard()).boards[file];
  const browser = await getBrowser();
  const page = await browser.newPage({ viewport: { width: board?.w ?? 390, height: board?.h ?? 844 }, deviceScaleFactor: 2 });
  try {
    await page.goto(`http://127.0.0.1:${port}/screens/${encodeURI(file)}`, { waitUntil: "networkidle" });
    const outDir = path.join(TOOL_ROOT, ".out");
    await fs.mkdir(outDir, { recursive: true });
    const name = `${file.replace(/[\\/]/g, "_").replace(/\.html$/, "")}${elPath ? "--" + elPath.replace(/\//g, "-") : ""}.png`;
    const out = path.join(outDir, name);
    if (elPath) {
      const handle = await page.evaluateHandle((p) => {
        let n = document.body;
        for (const i of p.split("/")) n = n?.children[Number(i)];
        return n;
      }, elPath);
      const el = handle.asElement();
      if (!el) throw Object.assign(new Error("요소를 찾을 수 없어요"), { status: 404 });
      await el.screenshot({ path: out });
    } else {
      await page.screenshot({ path: out, fullPage: true });
    }
    return out;
  } finally {
    await page.close();
  }
}

export const extraRoutes = [
  [
    "POST",
    "/api/edit",
    async (req, res, url, ctx) => {
      const b = await readBody(req);
      const { p, html } = await readScreen(ctx, b.file);
      let next;
      try {
        next = applyEdit(html, b);
      } catch (e) {
        if (e instanceof EditError) return sendJson(res, e.status, { error: e.message });
        throw e;
      }
      if (next === html) return sendJson(res, 200, { ok: true, changed: false });
      await writeScreen(ctx, p, next);
      const h = hist(b.file);
      h.undo.push({ before: html, after: next, op: b.op });
      if (h.undo.length > HISTORY_LIMIT) h.undo.shift();
      h.redo = [];
      sendJson(res, 200, { ok: true, changed: true });
    },
  ],
  ...["undo", "redo"].map((kind) => [
    "POST",
    `/api/${kind}`,
    async (req, res, url, ctx) => {
      const b = await readBody(req);
      const { p, html } = await readScreen(ctx, b.file);
      const h = hist(b.file);
      const from = kind === "undo" ? h.undo : h.redo;
      const to = kind === "undo" ? h.redo : h.undo;
      const step = from[from.length - 1];
      if (!step) return sendJson(res, 200, { ok: true, changed: false, message: kind === "undo" ? "되돌릴 편집이 없어요" : "다시 할 편집이 없어요" });
      // 그사이 다른 사람·AI가 파일을 고쳤으면 덮어쓰지 않는다
      const expect = kind === "undo" ? step.after : step.before;
      if (html !== expect) {
        h.undo = [];
        h.redo = [];
        return sendJson(res, 409, { error: "파일이 밖에서 바뀌어 기록을 비웠어요" });
      }
      from.pop();
      to.push(step);
      await writeScreen(ctx, p, kind === "undo" ? step.before : step.after);
      sendJson(res, 200, { ok: true, changed: true, op: step.op });
    },
  ]),
  [
    "GET",
    "/api/element",
    async (req, res, url, ctx) => {
      const { html } = await readScreen(ctx, url.searchParams.get("f"));
      const info = inspect(html, url.searchParams.get("path") ?? "");
      if (!info) return sendJson(res, 404, { error: "요소가 없어요(파일이 바뀜, 다시 선택)" });
      sendJson(res, 200, { hash: info.hash, tag: info.tag, text: info.text.slice(0, 200), source: info.source.slice(0, OUTER_LIMIT) });
    },
  ],
  [
    "GET",
    "/api/outline",
    async (req, res, url, ctx) => {
      const { html } = await readScreen(ctx, url.searchParams.get("f"));
      sendJson(res, 200, { tree: outline(html) });
    },
  ],
  ["GET", "/api/selection", async (req, res) => sendJson(res, 200, { selection })],
  [
    "PUT",
    "/api/selection",
    async (req, res, url, ctx) => {
      const body = await readBody(req);
      if (!body || !body.file) {
        selection = null;
      } else {
        const { html } = await readScreen(ctx, body.file);
        const info = inspect(html, body.path);
        if (!info) return sendJson(res, 409, { error: "파일이 바뀜, 다시 선택" });
        selection = {
          file: body.file,
          path: body.path,
          paths: Array.isArray(body.paths) && body.paths.length > 1 ? body.paths : undefined,
          tag: info.tag,
          text: info.text.slice(0, 500),
          outerHTML: info.source.length > OUTER_LIMIT ? info.source.slice(0, OUTER_LIMIT) + "…" : info.source,
          hash: info.hash,
          styles: body.styles ?? {},
          selectedAt: new Date().toISOString(),
        };
      }
      ctx.broadcast({ type: "selection-changed" });
      sendJson(res, 200, { selection });
    },
  ],
  [
    "GET",
    "/api/comments",
    async (req, res, url, ctx) => {
      let list = await readComments(ctx);
      const f = url.searchParams.get("file");
      if (f) list = list.filter((c) => c.file === f);
      if (url.searchParams.get("unresolved") === "1") list = list.filter((c) => !c.resolved);
      sendJson(res, 200, { comments: list });
    },
  ],
  [
    "POST",
    "/api/comments",
    async (req, res, url, ctx) => {
      const b = await readBody(req);
      const list = await readComments(ctx);
      if (b.action === "resolve") {
        const c = list.find((x) => x.id === b.id);
        if (!c) return sendJson(res, 404, { error: "댓글이 없어요" });
        c.resolved = b.resolved ?? true;
        await writeComments(ctx, list);
        return sendJson(res, 200, { comment: c });
      }
      if (!b.file || !String(b.text ?? "").trim()) return sendJson(res, 400, { error: "file과 text가 필요해요" });
      const c = {
        id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
        file: b.file,
        path: b.path ?? "",
        text: String(b.text).trim(),
        author: b.author ?? process.env.USER ?? "unknown",
        createdAt: new Date().toISOString(),
        resolved: false,
      };
      list.push(c);
      await writeComments(ctx, list);
      sendJson(res, 200, { comment: c });
    },
  ],
  [
    "POST",
    "/api/screenshot",
    async (req, res, url, ctx) => {
      const b = await readBody(req);
      await readScreen(ctx, b.file);
      const port = Number(req.socket.localPort);
      const out = await screenshot(ctx, port, b.file, b.path || "");
      sendJson(res, 200, { path: out });
    },
  ],
  [
    "POST",
    "/api/place",
    async (req, res, url, ctx) => {
      const b = await readBody(req);
      await readScreen(ctx, b.file);
      const { board } = await ctx.store.syncBoard();
      const cur = board.boards[b.file];
      board.boards[b.file] = {
        ...cur,
        ...(Number.isFinite(b.x) ? { x: b.x } : {}),
        ...(Number.isFinite(b.y) ? { y: b.y } : {}),
        ...(b.title ? { title: b.title } : {}),
        ...(b.page ? { page: b.page } : {}),
      };
      if (Number.isFinite(b.x) || Number.isFinite(b.y)) delete board.boards[b.file].autoPlaced;
      await ctx.store.writeBoard(board);
      ctx.broadcast({ type: "board-changed", source: "server:place" });
      sendJson(res, 200, { board: board.boards[b.file] });
    },
  ],
];

/** 서버가 뜬 뒤 붙일 것(파일 감시 등) */
export async function attach(app) {
  const stop = watchDesign(app.ctx);
  const close = app.close;
  app.close = async () => {
    await stop();
    if (browserPromise) (await browserPromise.catch(() => null))?.close();
    await close();
  };
}
