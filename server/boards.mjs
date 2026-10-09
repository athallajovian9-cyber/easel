// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// 보드 관리: 만들기(새 HTML)·삭제(휴지통)·복제·이름 바꾸기(참조 갱신)·board.json 저장. 모두 시간순 실행 취소 기록에 남긴다.
import fs from "node:fs/promises";
import path from "node:path";

import { formatBoard } from "./boardFormat.mjs";
import { writeAtomic } from "./fsutil.mjs";
import { readBody, safeJoin, sendJson } from "./index.mjs";

const read = (p) => fs.readFile(p, "utf8").catch(() => null);
const FILE_RE = /^[a-z0-9][a-z0-9._-]*\.html$/i;

const FONT = `@font-face{font-family:"Pretendard Variable";font-weight:45 920;font-style:normal;font-display:swap;src:url(https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/woff2/PretendardVariable.woff2) format("woff2-variations")}
body{margin:0;color-scheme:light;font-family:"Pretendard Variable",Pretendard,-apple-system,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;color:#111111;background:#FFFFFF;-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}`;

/** 새 보드 틀. 크기는 보드 크기 meta와 맨 바깥 div에 같이 적는다 */
export const TEMPLATES = {
  blank: { label: "빈 보드", w: 390, h: 844 },
  mobile: { label: "모바일 화면", w: 390, h: 844 },
  desktop: { label: "PC 화면", w: 1440, h: 900 },
  doc: { label: "문서·메모", w: 800, h: 1000 },
};

export function newBoardHtml({ title, w, h, template = "blank" }) {
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const t = esc(title);
  const bodies = {
    blank: `<div style="width:${w}px;min-height:${h}px;box-sizing:border-box;padding:20px;display:flex;flex-direction:column;gap:16px">
</div>`,
    mobile: `<div style="width:${w}px;height:${h}px;box-sizing:border-box;position:relative;background:#FFFFFF;display:flex;flex-direction:column;overflow:hidden">
  <header style="height:48px;display:flex;align-items:center;padding:0 20px;flex:none">
    <span style="font-size:17px;font-weight:700">${t}</span>
  </header>
  <main style="flex:1;padding:16px 20px;display:flex;flex-direction:column;gap:16px">
    <h1 style="margin:0;font-size:34px;font-weight:700;letter-spacing:-0.02em;line-height:1.15">제목</h1>
    <p style="margin:0;font-size:17px;line-height:1.5;color:#6B6B6B">설명 글</p>
  </main>
  <footer style="padding:12px 20px 32px;flex:none">
    <a href="#" style="display:flex;align-items:center;justify-content:center;height:56px;border-radius:16px;background:#C94F0C;color:#FFFFFF;font-size:17px;font-weight:700;text-decoration:none">다음</a>
  </footer>
</div>`,
    desktop: `<div style="width:${w}px;min-height:${h}px;box-sizing:border-box;background:#FFFFFF;display:flex;flex-direction:column">
  <header style="height:64px;display:flex;align-items:center;gap:24px;padding:0 40px;border-bottom:1px solid #E8E8E6;flex:none">
    <strong style="font-size:20px">farmclub</strong>
  </header>
  <main style="flex:1;max-width:1120px;width:100%;margin:0 auto;padding:40px;box-sizing:border-box;display:flex;flex-direction:column;gap:24px">
    <h1 style="margin:0;font-size:40px;font-weight:700;letter-spacing:-0.02em">${t}</h1>
  </main>
</div>`,
    doc: `<div style="width:${w}px;min-height:${h}px;box-sizing:border-box;padding:48px;display:flex;flex-direction:column;gap:16px;background:#FFFFFF">
  <h1 style="margin:0;font-size:34px;font-weight:700;letter-spacing:-0.02em">${t}</h1>
  <p style="margin:0;font-size:17px;line-height:1.6;color:#111111">내용</p>
</div>`,
  };
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="board-size" content="${w}x${h}">
<title>${t}</title>
<style>
${FONT}
</style>
</head>
<body>
<div class="x-dc">
${bodies[template] ?? bodies.blank}
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

/** 페이지 목록을 바꾼다. page가 없는 항목은 첫 페이지 소속이므로, 바뀐 첫 페이지 기준으로 다시 적는다 */
function repage(board, pages, map = (pid) => pid) {
  const oldFirst = board.pages[0]?.id;
  const first = pages[0]?.id;
  for (const it of [...Object.values(board.boards), ...Object.values(board.notes)]) {
    const pid = map(it.page ?? oldFirst, first);
    if (pid === first) delete it.page;
    else it.page = pid;
  }
  board.pages = pages;
  if (board.launch?.page && !pages.some((p) => p.id === board.launch.page)) delete board.launch.page;
}

/** 보드 여러 개를 한 기록 단계로 만든다. items: [{file, html, x, y, w, h, title, page}] → 실제 파일 이름 목록 */
export async function createBoards(ctx, items, label) {
  const changes = [];
  const made = [];
  for (const it of items) {
    const file = await uniqueName(ctx.store.screensDir, it.file && FILE_RE.test(it.file) ? it.file : "board.html");
    const p = path.join(ctx.store.screensDir, file);
    await writeAtomic(p, it.html);
    changes.push({ path: p, before: null, after: it.html });
    made.push({ ...it, file });
  }
  await commitBoard(
    ctx,
    label,
    (board) => {
      for (const it of made) {
        board.boards[it.file] = { x: Math.round(it.x ?? 0), y: Math.round(it.y ?? 0), w: it.w, h: it.h, title: it.title, ...(it.page ? { page: it.page } : {}) };
        board.order = [...board.order.filter((f) => f !== it.file), it.file];
      }
    },
    changes,
  );
  return made.map((m) => m.file);
}

/** board.json을 바꾸고 기록을 남기는 공통 함수 */
export async function commitBoard(ctx, label, mutate, fileChanges = []) {
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

export function boardRoutes() {
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
        const tpl = TEMPLATES[b.template] ? b.template : "blank";
        const w = Math.max(40, Math.min(8000, Math.round(b.w ?? TEMPLATES[tpl].w)));
        const h = Math.max(40, Math.min(8000, Math.round(b.h ?? TEMPLATES[tpl].h)));
        const wanted = b.file && FILE_RE.test(b.file) ? b.file : `${tpl === "blank" ? "board" : tpl}.html`;
        const title = b.title || (tpl === "blank" ? wanted.replace(/\.html$/, "") : TEMPLATES[tpl].label);
        const html = b.html ?? newBoardHtml({ title, w, h, template: tpl });
        const [file] = await createBoards(ctx, [{ file: wanted, html, x: b.x, y: b.y, w, h, title, page: b.page }], `보드 만들기 ${wanted}`);
        sendJson(res, 200, { file });
      },
    ],
    ["GET", "/api/boards/templates", async (req, res) => sendJson(res, 200, { templates: Object.entries(TEMPLATES).map(([id, t]) => ({ id, ...t })) })],
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
    // 메모(제목·포스트잇): MCP와 앱이 같이 쓴다. 모두 실행 취소 기록에 남는다
    [
      "POST",
      "/api/notes",
      async (req, res, url, ctx) => {
        const b = await readBody(req);
        const board0 = await ctx.store.readBoard();
        if (b.action === "add") {
          if (!["title", "sticky"].includes(b.kind)) return sendJson(res, 400, { error: "kind는 title 또는 sticky" });
          if (Object.keys(board0.notes).length >= 200) return sendJson(res, 400, { error: "메모는 200개까지예요" });
          let id;
          do id = `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
          while (board0.notes[id]);
          const note = { kind: b.kind, x: Math.round(b.x ?? 0), y: Math.round(b.y ?? 0), text: String(b.text ?? ""), ...(b.kind === "title" ? { maxW: 2000 } : { w: Math.round(b.w ?? 400) }), ...(b.page ? { page: b.page } : {}) };
          await commitBoard(ctx, `메모 추가`, (board) => void (board.notes[id] = note));
          return sendJson(res, 200, { id, note });
        }
        if (!board0.notes[b.id]) return sendJson(res, 404, { error: "메모가 없어요" });
        if (b.action === "update") {
          const patch = {};
          for (const k of ["text", "x", "y", "w", "page", "color", "size", "bold", "italic"]) if (b[k] !== undefined) patch[k] = b[k];
          await commitBoard(ctx, `메모 고치기`, (board) => void (board.notes[b.id] = { ...board.notes[b.id], ...patch }));
          return sendJson(res, 200, { id: b.id });
        }
        if (b.action === "delete") {
          await commitBoard(ctx, `메모 삭제`, (board) => void delete board.notes[b.id]);
          return sendJson(res, 200, { id: b.id });
        }
        sendJson(res, 400, { error: "action은 add·update·delete" });
      },
    ],
    // 페이지: 추가·이름·삭제(보드·메모는 첫 페이지로)·순서
    [
      "POST",
      "/api/pages",
      async (req, res, url, ctx) => {
        const b = await readBody(req);
        const board0 = await ctx.store.readBoard();
        if (b.action === "add") {
          if (board0.pages.length >= 40) return sendJson(res, 400, { error: "페이지는 40개까지예요" });
          const id = `p${Date.now().toString(36)}`;
          const name = String(b.name ?? "").trim() || `페이지 ${board0.pages.length + 1}`;
          await commitBoard(ctx, "페이지 추가", (board) => {
            board.pages = board.pages.length ? [...board.pages, { id, name }] : [{ id: "main", name: "기본" }, { id, name }];
          });
          return sendJson(res, 200, { id });
        }
        const pg = board0.pages.find((p) => p.id === b.id);
        if (!pg) return sendJson(res, 404, { error: "페이지가 없어요" });
        if (b.action === "rename") {
          await commitBoard(ctx, "페이지 이름 바꾸기", (board) => void (board.pages = board.pages.map((p) => (p.id === b.id ? { ...p, name: String(b.name ?? p.name).trim() || p.name } : p))));
          return sendJson(res, 200, { id: b.id });
        }
        if (b.action === "delete") {
          if (board0.pages.length <= 1) return sendJson(res, 400, { error: "마지막 페이지는 지울 수 없어요" });
          await commitBoard(ctx, `페이지 삭제 ${pg.name}`, (board) =>
            repage(board, board.pages.filter((p) => p.id !== b.id), (pid, first) => (pid === b.id ? first : pid)),
          );
          return sendJson(res, 200, { ok: true });
        }
        if (b.action === "move") {
          const to = Math.max(0, Math.min(board0.pages.length - 1, Number(b.index) || 0));
          await commitBoard(ctx, "페이지 순서", (board) => {
            const pages = board.pages.filter((p) => p.id !== b.id);
            pages.splice(to, 0, pg);
            repage(board, pages);
          });
          return sendJson(res, 200, { ok: true });
        }
        sendJson(res, 400, { error: "action은 add·rename·delete·move" });
      },
    ],
  ];
}
