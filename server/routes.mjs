// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// 마일스톤별로 붙는 추가 API와 감시기. createServer의 extraRoutes로 들어간다. PLAN.md 4장.
import fs from "node:fs/promises";
import path from "node:path";

import { TOOL_ROOT } from "./args.mjs";
import { boardRoutes } from "./boards.mjs";
import { chatRoutes } from "./chat.mjs";
import { applyEdit, EditError } from "./edit.mjs";
import { writeAtomic } from "./fsutil.mjs";
import { inspect, outline } from "./html.mjs";
import { readBody, safeJoin, sendJson } from "./index.mjs";
import { watchDesign } from "./watch.mjs";

const OUTER_LIMIT = 4096;
let selection = null;
const chat = chatRoutes({ getSelection: () => selection });

async function writeScreen(ctx, p, html) {
  await writeAtomic(p, html);
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
  await writeAtomic(path.join(ctx.dir, "comments.json"), JSON.stringify({ comments }, null, 1) + "\n");
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
      ctx.history.push(`${b.file} ${b.op}`, [{ path: p, before: html, after: next }]);
      ctx.broadcast({ type: "history-changed" });
      sendJson(res, 200, { ok: true, changed: true });
    },
  ],
  // 예전 경로: 시간순 기록으로 넘긴다
  ...["undo", "redo"].map((kind) => [
    "POST",
    `/api/${kind}`,
    async (req, res, url, ctx) => {
      const step = await ctx.history[kind]();
      ctx.broadcast({ type: "history-changed" });
      sendJson(res, 200, { ok: true, changed: !!step, label: step?.label ?? null });
    },
  ]),
  ...boardRoutes(),
  ...chat.routes,
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
  [
    "GET",
    "/api/selection",
    async (req, res, url, ctx) => {
      // 선택 + 캔버스 상태(모드·페이지·보이는/선택한 보드·저장 대기·최근 편집) + 오류 보드
      const c = chat.state.context ?? {};
      const { missing } = await ctx.store.syncBoard();
      const errored = { ...chat.state.errors };
      for (const f of missing) errored[f] = [{ kind: "missing", message: "파일이 없어요" }];
      sendJson(res, 200, {
        selection,
        mode: c.mode ?? null,
        page: c.page ?? null,
        pageName: c.pageName ?? null,
        visibleArtboards: c.visibleArtboards ?? [],
        selectedArtboards: c.selectedArtboards ?? [],
        dirty: !!c.dirty,
        edits: ctx.history.state().undo.slice(-10),
        erroredArtboards: Object.keys(errored),
        firstError: Object.entries(errored).map(([file, l]) => ({ file, ...l[0] }))[0] ?? null,
      });
    },
  ],
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
          kind: body.kind ?? null,
          label: body.label ?? null,
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
      const { board } = await ctx.store.syncBoardNow();
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
