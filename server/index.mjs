// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// 앱 서버: 디자인 폴더 정적 서빙 + API + WS + (개발) Vite 미들웨어. PLAN.md 4장.
import fs from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { WebSocketServer } from "ws";

import { TOOL_ROOT } from "./args.mjs";
import { createBoardStore } from "./board.mjs";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ico": "image/x-icon",
};

export function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

export async function readBody(req, limit = 4 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw Object.assign(new Error("body too large"), { status: 413 });
    chunks.push(c);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

/** dir 안의 경로만 허용(../ 탈출 막기) */
export function safeJoin(root, rel) {
  const p = path.resolve(root, "." + path.posix.normalize("/" + rel));
  if (p !== root && !p.startsWith(root + path.sep)) return null;
  return p;
}

async function serveFile(res, file) {
  try {
    const st = await fs.stat(file);
    if (!st.isFile()) return false;
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream",
      "Content-Length": st.size,
      "Cache-Control": "no-store",
    });
    createReadStream(file).pipe(res);
    return true;
  } catch {
    return false;
  }
}

/** app/ 아래 파일이 dist/index.html보다 새로우면 다시 빌드한다 */
async function appIsStale(distDir) {
  const built = await fs.stat(path.join(distDir, "index.html")).catch(() => null);
  if (!built) return true;
  let newest = 0;
  const walk = async (d) => {
    for (const e of await fs.readdir(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) await walk(p);
      else newest = Math.max(newest, (await fs.stat(p)).mtimeMs);
    }
  };
  await walk(path.join(TOOL_ROOT, "app"));
  for (const f of ["vite.config.mjs", "package.json"]) newest = Math.max(newest, (await fs.stat(path.join(TOOL_ROOT, f))).mtimeMs);
  return newest > built.mtimeMs;
}

export async function createServer({ dir, port, dev = true, extraRoutes = [] }) {
  if (!existsSync(dir)) throw new Error(`디자인 폴더가 없어요: ${dir}`);
  const store = createBoardStore(dir);
  const ctx = { dir, store, broadcast: () => {} };

  // 앱 화면: 시작할 때 앱 소스가 dist보다 새로우면 한 번 빌드하고 dist를 정적 서빙한다.
  // (Vite 개발 서버는 HMR을 꺼도 웹소켓 클라이언트를 넣어 콘솔 오류가 나서 쓰지 않는다)
  const distDir = path.join(TOOL_ROOT, "dist");
  if (dev && (await appIsStale(distDir))) {
    const { build } = await import("vite");
    await build({ root: path.join(TOOL_ROOT, "app"), configFile: path.join(TOOL_ROOT, "vite.config.mjs"), logLevel: "warn" });
  }
  if (!existsSync(path.join(distDir, "index.html"))) throw new Error("앱 빌드가 없어요(npm start로 실행하면 만들어져요)");

  const routes = [
    ["GET", "/api/health", async (req, res) => sendJson(res, 200, { ok: true, dir })],
    [
      "GET",
      "/api/board",
      async (req, res) => {
        const { board, files, missing } = await store.syncBoard();
        sendJson(res, 200, { board, files, missing, dir });
      },
    ],
    [
      "PUT",
      "/api/board",
      async (req, res) => {
        const body = await readBody(req);
        if (!body || typeof body.boards !== "object") return sendJson(res, 400, { error: "boards가 필요해요" });
        const board = {
          version: 1,
          title: body.title ?? "",
          pages: Array.isArray(body.pages) ? body.pages : [],
          boards: body.boards,
          order: Array.isArray(body.order) ? body.order : Object.keys(body.boards),
          notes: body.notes ?? {},
        };
        await store.writeBoard(board);
        ctx.broadcast({ type: "board-changed", source: body.clientId ?? null });
        sendJson(res, 200, { ok: true });
      },
    ],
    [
      "GET",
      "/api/file",
      async (req, res, url) => {
        const f = url.searchParams.get("f") ?? "";
        const p = safeJoin(store.screensDir, f);
        if (!p || !f.endsWith(".html")) return sendJson(res, 400, { error: "잘못된 파일" });
        try {
          const html = await fs.readFile(p, "utf8");
          res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
          res.end(html);
        } catch {
          sendJson(res, 404, { error: "파일이 없어요" });
        }
      },
    ],
    ...extraRoutes.map((r) => [r[0], r[1], (req, res, url) => r[2](req, res, url, ctx)]),
  ];

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    try {
      // 디자인 폴더: /screens/*, /assets/* 같은 정적 파일(같은 출처라 iframe에서 contentDocument 접근 가능)
      if (req.method === "GET" && (url.pathname.startsWith("/screens/") || url.pathname.startsWith("/assets/"))) {
        const p = safeJoin(dir, decodeURIComponent(url.pathname.slice(1)));
        if (p && (await serveFile(res, p))) return;
        res.writeHead(404);
        return res.end("not found");
      }
      for (const [m, p, h] of routes) {
        if (req.method === m && url.pathname === p) return await h(req, res, url);
      }
      if (url.pathname.startsWith("/api/")) return sendJson(res, 404, { error: "없는 API" });
      if (url.pathname.startsWith("/_app/")) {
        const p = safeJoin(distDir, url.pathname.slice("/_app/".length));
        if (p && (await serveFile(res, p))) return;
        res.writeHead(404);
        return res.end("not found");
      }
      await serveFile(res, path.join(distDir, "index.html"));
    } catch (e) {
      console.error(e);
      if (!res.headersSent) sendJson(res, e.status ?? 500, { error: String(e.message ?? e) });
    }
  });

  const wss = new WebSocketServer({ server, path: "/ws" });
  ctx.broadcast = (msg) => {
    const data = JSON.stringify(msg);
    for (const c of wss.clients) if (c.readyState === 1) c.send(data);
  };

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });

  return {
    ctx,
    server,
    url: `http://localhost:${port}`,
    async close() {
      for (const c of wss.clients) c.terminate();
      wss.close();
      await new Promise((r) => server.close(r));
    },
  };
}
