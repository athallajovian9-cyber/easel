// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// 보드 관리: 만들기(새 HTML)·삭제(휴지통)·복제·이름 바꾸기(참조 갱신)·board.json 저장. 모두 시간순 실행 취소 기록에 남긴다.
import fs from "node:fs/promises";
import path from "node:path";

import { formatBoard } from "./boardFormat.mjs";
import { writeAtomic } from "./fsutil.mjs";
import { readBody, safeJoin, sendJson } from "./index.mjs";

const read = (p) => fs.readFile(p, "utf8").catch(() => null);
const FILE_RE = /^[a-z0-9][a-z0-9._-]*\.html$/i;

export function newBoardHtml({ title, w, h }) {
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="board-size" content="${w}x${h}">
<title>${esc(title)}</title>
<style>
body{margin:0;font-family:"Pretendard Variable",Pretendard,-apple-system,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;color:#111111;background:#FFFFFF;-webkit-font-smoothing:antialiased}
</style>
</head>
<body>
<div class="x-dc" style="width:${w}px;min-height:${h}px;box-sizing:border-box;padding:20px;display:flex;flex-direction:column;gap:16px">
</div>
</body>
</html>
`;
}

/** 이름이 겹치지 않는 파일 이름 */
async function uniqueName(screensDir, base) {
  const stem = base.replace(/\.html$/i, "");
  for (let i = 0; i < 1000; i++) {
    const name = `${stem}${i ? `-${i + 1}` : ""}.html`;
    if (!(await read(path.join(screensDir, name)))) return name;
  }
  throw new Error("이름을 만들 수 없어요");
}

/** 다른 화면에서 이 파일을 가리키는 href·src 수 */
async function findRefs(screensDir, files, target) {
  const re = new RegExp(`((?:href|src)\\s*=\\s*["'])(\\.?/?)${target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(["'#?])`, "g");
  const out = [];
  for (const f of files) {
    if (f === target) continue;
    const html = await read(path.join(screensDir, f));
    const n = html ? [...html.matchAll(re)].length : 0;
    if (n) out.push({ file: f, count: n });
  }
  return { re, refs: out };
}

export function boardRoutes() {
  /** board.json을 바꾸고 기록을 남기는 공통 함수 */
  async function commitBoard(ctx, label, mutate, fileChanges = []) {
    const { store, history } = ctx;
    const before = await read(store.boardPath);
    const board = await store.readBoard();
    const after = mutate(board) ?? board;
    await store.writeBoard(after);
    history.push(label, [...fileChanges, { path: store.boardPath, before, after: formatBoard(after) }]);
    ctx.broadcast({ type: "board-changed", source: "server:" + label });
    ctx.broadcast({ type: "history-changed" });
    return after;
  }

  return [
    [
      "PUT",
      "/api/board",
      async (req, res, url, ctx) => {
        const body = await readBody(req);
        if (!body || typeof body.boards !== "object") return sendJson(res, 400, { error: "boards가 필요해요" });
        const { clientId, label, ...rest } = body;
        const next = { version: 1, title: rest.title ?? "", pages: Array.isArray(rest.pages) ? rest.pages : [], boards: rest.boards, order: Array.isArray(rest.order) ? rest.order : Object.keys(rest.boards), notes: rest.notes ?? {} };
        for (const k of ["launch", "shapes", "guides"]) if (rest[k] !== undefined) next[k] = rest[k];
        const before = await read(ctx.store.boardPath);
        await ctx.store.writeBoard(next);
        if (label) {
          ctx.history.push(label, [{ path: ctx.store.boardPath, before, after: formatBoard(next) }]);
          ctx.broadcast({ type: "history-changed" });
        }
        ctx.broadcast({ type: "board-changed", source: clientId ?? null });
        sendJson(res, 200, { ok: true });
      },
    ],
    [
      "POST",
      "/api/boards/create",
      async (req, res, url, ctx) => {
        const b = await readBody(req);
        const w = Math.max(40, Math.min(8000, Math.round(b.w ?? 390)));
        const h = Math.max(40, Math.min(8000, Math.round(b.h ?? 844)));
        const wanted = b.file && FILE_RE.test(b.file) ? b.file : "board.html";
        const file = await uniqueName(ctx.store.screensDir, wanted);
        const title = b.title || file.replace(/\.html$/, "");
        const p = path.join(ctx.store.screensDir, file);
        const html = b.html ?? newBoardHtml({ title, w, h });
        await writeAtomic(p, html);
        await commitBoard(
          ctx,
          `보드 만들기 ${file}`,
          (board) => {
            board.boards[file] = { x: Math.round(b.x ?? 0), y: Math.round(b.y ?? 0), w, h, title, ...(b.page ? { page: b.page } : {}) };
            board.order = [...board.order.filter((f) => f !== file), file];
          },
          [{ path: p, before: null, after: html }],
        );
        sendJson(res, 200, { file });
      },
    ],
    [
      "POST",
      "/api/boards/delete",
      async (req, res, url, ctx) => {
        const b = await readBody(req);
        const files = (b.files ?? []).filter((f) => FILE_RE.test(path.basename(f)));
        if (!files.length) return sendJson(res, 400, { error: "files가 필요해요" });
        // 휴지통(docs/design/.trash/)에도 복사해 둔다. 실행 취소는 기록에서 되살린다
        const trash = path.join(ctx.dir, ".trash", new Date().toISOString().replace(/[:.]/g, "-"));
        await fs.mkdir(trash, { recursive: true });
        await fs.writeFile(path.join(ctx.dir, ".trash", ".gitignore"), "*\n").catch(() => {});
        const changes = [];
        for (const f of files) {
          const p = safeJoin(ctx.store.screensDir, f);
          const html = p && (await read(p));
          if (html == null) continue;
          await fs.writeFile(path.join(trash, path.basename(f)), html);
          await fs.rm(p);
          changes.push({ path: p, before: html, after: null });
        }
        await commitBoard(
          ctx,
          `보드 삭제 ${files.join(", ")}`,
          (board) => {
            for (const f of files) delete board.boards[f];
            board.order = board.order.filter((f) => !files.includes(f));
          },
          changes,
        );
        sendJson(res, 200, { ok: true, trash: path.relative(ctx.dir, trash) });
      },
    ],
    [
      "POST",
      "/api/boards/duplicate",
      async (req, res, url, ctx) => {
        const b = await readBody(req);
        const src = safeJoin(ctx.store.screensDir, b.file ?? "");
        const html = src && (await read(src));
        if (html == null) return sendJson(res, 404, { error: "파일이 없어요" });
        const file = await uniqueName(ctx.store.screensDir, b.file.replace(/\.html$/, "") + "-copy.html");
        const p = path.join(ctx.store.screensDir, file);
        await writeAtomic(p, html);
        const board0 = await ctx.store.readBoard();
        const it = board0.boards[b.file] ?? { x: 0, y: 0, w: 390, h: 844 };
        await commitBoard(
          ctx,
          `보드 복제 ${b.file}`,
          (board) => {
            board.boards[file] = { ...it, x: it.x + it.w + 80, title: `${it.title ?? b.file.replace(/\.html$/, "")} 복사` };
            const i = board.order.indexOf(b.file);
            board.order.splice(i < 0 ? board.order.length : i + 1, 0, file);
          },
          [{ path: p, before: null, after: html }],
        );
        sendJson(res, 200, { file });
      },
    ],
    [
      "GET",
      "/api/boards/refs",
      async (req, res, url, ctx) => {
        const files = await ctx.store.listScreenFiles();
        const { refs } = await findRefs(ctx.store.screensDir, files, url.searchParams.get("file") ?? "");
        sendJson(res, 200, { refs });
      },
    ],
    [
      "POST",
      "/api/boards/rename",
      async (req, res, url, ctx) => {
        const b = await readBody(req);
        const board0 = await ctx.store.readBoard();
        if (!board0.boards[b.file]) return sendJson(res, 404, { error: "보드가 없어요" });
        // 제목만 바꾸기
        if (!b.newFile || b.newFile === b.file) {
          await commitBoard(ctx, `이름 바꾸기 ${b.file}`, (board) => {
            board.boards[b.file] = { ...board.boards[b.file], title: String(b.title ?? "").trim() || undefined };
          });
          return sendJson(res, 200, { file: b.file });
        }
        // 파일 이름 바꾸기(+ 참조 갱신 선택)
        if (!FILE_RE.test(b.newFile)) return sendJson(res, 400, { error: "파일 이름은 영문·숫자·-·_ 와 .html" });
        const from = safeJoin(ctx.store.screensDir, b.file);
        const to = safeJoin(ctx.store.screensDir, b.newFile);
        if (await read(to)) return sendJson(res, 409, { error: "같은 이름의 파일이 있어요" });
        const html = await read(from);
        const changes = [];
        await writeAtomic(to, html);
        await fs.rm(from);
        changes.push({ path: from, before: html, after: null }, { path: to, before: null, after: html });
        if (b.updateRefs) {
          const files = await ctx.store.listScreenFiles();
          const { re, refs } = await findRefs(ctx.store.screensDir, files, b.file);
          for (const r of refs) {
            const p = path.join(ctx.store.screensDir, r.file);
            const before = await read(p);
            const after = before.replace(re, (m, a, dot, z) => `${a}${dot}${b.newFile}${z}`);
            await writeAtomic(p, after);
            changes.push({ path: p, before, after });
          }
        }
        await commitBoard(
          ctx,
          `파일 이름 바꾸기 ${b.file} → ${b.newFile}`,
          (board) => {
            board.boards[b.newFile] = { ...board.boards[b.file], ...(b.title ? { title: b.title } : {}) };
            delete board.boards[b.file];
            board.order = board.order.map((f) => (f === b.file ? b.newFile : f));
          },
          changes,
        );
        sendJson(res, 200, { file: b.newFile });
      },
    ],
    [
      "POST",
      "/api/history/undo",
      async (req, res, url, ctx) => {
        const step = await ctx.history.undo();
        ctx.broadcast({ type: "history-changed" });
        sendJson(res, 200, { ok: true, label: step?.label ?? null, ...ctx.history.state() });
      },
    ],
    [
      "POST",
      "/api/history/redo",
      async (req, res, url, ctx) => {
        const step = await ctx.history.redo();
        ctx.broadcast({ type: "history-changed" });
        sendJson(res, 200, { ok: true, label: step?.label ?? null, ...ctx.history.state() });
      },
    ],
    ["GET", "/api/history", async (req, res, url, ctx) => sendJson(res, 200, ctx.history.state())],
  ];
}
