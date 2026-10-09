// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// 캔버스 안 채팅: claude -p / codex exec를 띄워 출력(JSONL)을 같은 모양의 이벤트로 바꿔 WS로 흘린다.
// 선택·보이는 보드·댓글·참고 자료·오류를 맥락으로 붙이고, "N가지 안"이면 복사본을 먼저 나란히 만들어 둔다.
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import { createBoards } from "./boards.mjs";
import { readBody, sendJson } from "./index.mjs";

/** 에이전트 실행 명령. 시험에서는 DESIGN_CANVAS_AGENT_CMD='{"claude":["node","fake.mjs"]}'로 바꾼다 */
function agentCommand(agent, { prompt, resume, root, images }) {
  const override = process.env.DESIGN_CANVAS_AGENT_CMD ? JSON.parse(process.env.DESIGN_CANVAS_AGENT_CMD)[agent] : null;
  if (override) return { cmd: override[0], args: [...override.slice(1), prompt] };
  if (agent === "codex") {
    const common = ["--json", "--skip-git-repo-check", "-s", "workspace-write", ...images.flatMap((i) => ["-i", i])];
    return resume ? { cmd: "codex", args: ["exec", "resume", resume, ...common, prompt] } : { cmd: "codex", args: ["exec", ...common, "-C", root, prompt] };
  }
  return {
    cmd: "claude",
    args: ["-p", prompt, "--output-format", "stream-json", "--verbose", "--include-partial-messages", "--permission-mode", "acceptEdits", "--allowedTools", "mcp__design-canvas", ...(resume ? ["--resume", resume] : [])],
  };
}

const short = (v, n = 120) => {
  const s = typeof v === "string" ? v : JSON.stringify(v ?? "");
  return s.length > n ? s.slice(0, n) + "…" : s;
};

/** 에이전트 출력 한 줄 → 공통 이벤트 목록 */
export function parseLine(agent, line, st) {
  let o;
  try {
    o = JSON.parse(line);
  } catch {
    return line.trim() ? [{ kind: "log", text: line.trim() }] : [];
  }
  const out = [];
  if (agent === "codex") {
    if (o.type === "thread.started") out.push({ kind: "session", id: o.thread_id });
    else if (o.type === "item.started" || o.type === "item.completed") {
      const it = o.item ?? {};
      if (it.type === "agent_message" && o.type === "item.completed") out.push({ kind: "text", text: it.text ?? "" });
      else if (it.type === "command_execution" && o.type === "item.started") out.push({ kind: "tool", name: "명령", detail: short(it.command) });
      else if (it.type === "file_change" && o.type === "item.completed") out.push({ kind: "tool", name: "파일 수정", detail: (it.changes ?? []).map((c) => c.path).join(", ") });
      else if (it.type === "mcp_tool_call" && o.type === "item.started") out.push({ kind: "tool", name: it.tool ?? "MCP", detail: short(it.arguments) });
      else if (it.type === "error" && !String(it.message).startsWith("Ignoring unknown")) out.push({ kind: "error", text: it.message });
    } else if (o.type === "turn.completed") out.push({ kind: "done", usage: o.usage });
    else if (o.type === "turn.failed" || o.type === "error") out.push({ kind: "error", text: o.error?.message ?? o.message ?? "실패" });
    return out;
  }
  // claude stream-json
  if (o.type === "system" && o.subtype === "init") out.push({ kind: "session", id: o.session_id });
  else if (o.type === "stream_event" && o.event?.type === "content_block_delta" && o.event.delta?.type === "text_delta") {
    st.streamed = true;
    out.push({ kind: "delta", text: o.event.delta.text });
  } else if (o.type === "stream_event" && o.event?.type === "message_start") out.push({ kind: "break" });
  else if (o.type === "assistant") {
    for (const c of o.message?.content ?? []) {
      if (c.type === "tool_use") out.push({ kind: "tool", name: c.name, detail: short(c.input?.file_path ?? c.input?.path ?? c.input) });
      else if (c.type === "text" && !st.streamed) out.push({ kind: "text", text: c.text });
    }
  } else if (o.type === "result") out.push(o.is_error ? { kind: "error", text: o.result ?? o.subtype } : { kind: "done", cost: o.total_cost_usd });
  return out;
}

/** Windows shell 인자: 큰따옴표로 감싸고 안의 큰따옴표는 두 번 */
export const winQuote = (a) => (/^[\w./:=-]+$/.test(a) ? a : `"${String(a).replace(/"/g, '""')}"`);

/** 저장소 뿌리: docs/design이면 두 단계 위, 아니면(시험용 임시 폴더) 그 폴더 */
const rootOf = (dir) => (dir.endsWith(path.join("docs", "design")) ? path.resolve(dir, "../..") : dir);

/** 맥락 블록 */
export async function buildPrompt(ctx, body, state) {
  const { board } = await ctx.store.syncBoard();
  const rel0 = path.relative(rootOf(ctx.dir), ctx.dir);
  const rel = rel0 || ".";
  const lines = [`[디자인 캔버스 맥락]`, `- 디자인 폴더: ${rel} (화면은 ${rel0 ? rel0 + "/" : ""}screens/*.html, 캔버스 자리는 board.json)`];
  const c = state.context;
  if (c) {
    if (c.pageName) lines.push(`- 지금 페이지: ${c.pageName}`);
    if (body.attach?.visible !== false && c.visibleArtboards?.length) lines.push(`- 화면에 보이는 보드: ${c.visibleArtboards.slice(0, 20).join(", ")}`);
  }
  const boards = [...new Set(body.attach?.boards ?? [])];
  if (boards.length) lines.push(`- 대상 보드: ${boards.map((f) => `${rel0 ? rel0 + "/" : ""}screens/${f} ("${board.boards[f]?.title ?? f}")`).join(", ")}`);
  const sel = state.selection;
  if (body.attach?.selection !== false && sel) {
    lines.push(`- 선택한 요소: ${rel0 ? rel0 + "/" : ""}screens/${sel.file} 경로 ${sel.path} <${sel.tag}>${sel.label ? ` "${sel.label}"` : ""}`);
    lines.push("  원본 일부:\n" + sel.outerHTML.slice(0, 1200).replace(/^/gm, "    "));
  }
  const comments = body.attach?.comments ?? [];
  if (comments.length) {
    const d = await readJson(path.join(ctx.dir, "comments.json"), {});
    const all = Array.isArray(d.comments) ? d.comments : [];
    for (const id of comments) {
      const cm = all.find((x) => x.id === id);
      if (cm) lines.push(`- 댓글(${cm.id}) ${rel0 ? rel0 + "/" : ""}screens/${cm.file}${cm.path ? ` 경로 ${cm.path}` : ""}: "${cm.text}" — 이 위치만 고치고, 끝나면 resolve_comment로 해결 처리`);
    }
  }
  for (const r of body.attach?.refs ?? []) {
    if (r.kind === "url") lines.push(`- 참고 링크: ${r.value}`);
    else lines.push(`- 참고 파일(${r.kind === "image" ? "이미지" : "문서"}): ${path.relative(rootOf(ctx.dir), path.join(ctx.dir, r.value))} — 읽어서 참고`);
  }
  const errs = Object.entries(state.errors).filter(([f]) => boards.includes(f));
  for (const [f, list] of errs) lines.push(`- ${f} 오류: ${list[0].message}${list[0].line ? ` (줄 ${list[0].line})` : ""}`);
  if (body.variants?.files?.length) {
    lines.push(`- "${body.variants.base}"의 서로 다른 안 ${body.variants.files.length}개를 만든다. 복사본을 미리 만들어 나란히 두었다: ${body.variants.files.map((f) => `${rel0 ? rel0 + "/" : ""}screens/${f}`).join(", ")}. 각 파일을 서로 다른 방향으로 고치고, place_board로 제목을 "안 1: 요약"처럼 바꾼다. 원본은 고치지 않는다.`);
  }
  lines.push(
    `규칙: 디자인 파일은 ${rel}/screens 안에서만 고친다. 바꿀 부분만 고치고 나머지는 그대로 둔다. 새 화면은 <meta name="board-size" content="390x844">를 넣고, 만든 뒤 place_board로 이름과 자리를 정한다. 색은 #111111·#6B6B6B·#C94F0C·#FFFFFF·#F5F5F3, 글꼴은 Pretendard.`,
    "",
    "[요청]",
    body.text,
  );
  return lines.join("\n");
}

/** 원본 아래에서 안 n개가 다른 보드와 겹치지 않는 첫 줄의 y */
function freeRowY(board, b, n) {
  const w = (b.w + 80) * n;
  let y = b.y + b.h + 160;
  for (let k = 0; k < 200; k++) {
    const hit = Object.values(board.boards).filter((o) => o.x < b.x + w && o.x + o.w > b.x && o.y < y + b.h + 160 && o.y + o.h > y - 80);
    if (!hit.length) return y;
    y = Math.max(...hit.map((o) => o.y + o.h)) + 160;
  }
  return y;
}

const readJson = (p, d) => fs.readFile(p, "utf8").then(JSON.parse, () => d);

export function chatRoutes({ getSelection } = {}) {
  const runs = new Map(); // id → { proc, agent, events, status }
  const state = { selection: null, context: null, errors: {} };

  return {
    state,
    routes: [
      [
        "POST",
        "/api/chat",
        async (req, res, url, ctx) => {
          const body = await readBody(req);
          const agent = body.agent === "codex" ? "codex" : "claude";
          if (!String(body.text ?? "").trim()) return sendJson(res, 400, { error: "할 말을 적어 주세요" });
          state.selection = getSelection?.() ?? null;
          // N가지 안: 원본 복사본을 오른쪽에 나란히 만든다
          const n = Math.min(4, Math.max(0, Number(body.variants) || 0));
          if (n > 1) {
            const base = body.attach?.boards?.[0] ?? state.selection?.file;
            if (!base) return sendJson(res, 400, { error: "안을 만들 보드를 하나 고르세요" });
            const html = await fs.readFile(path.join(ctx.store.screensDir, base), "utf8");
            const { board } = await ctx.store.syncBoard();
            const b = board.boards[base] ?? { x: 0, y: 0, w: 390, h: 844 };
            const stem = base.replace(/\.html$/, "");
            const files = await ctx.store.exclusive(() =>
              createBoards(
                ctx,
                Array.from({ length: n }, (_, i) => ({ file: `${stem}-v${i + 1}.html`, html, x: b.x + (b.w + 80) * i, y: freeRowY(board, b, n), w: b.w, h: b.h, title: `${b.title ?? stem} 안 ${i + 1}`, page: b.page })),
                `안 ${n}개 만들기 ${base}`,
              ),
            );
            body.variants = { base, files };
            body.attach = { ...body.attach, boards: [base, ...files] };
          } else body.variants = undefined;
          const prompt = await buildPrompt(ctx, body, state);
          const images = (body.attach?.refs ?? []).filter((r) => r.kind === "image").map((r) => path.join(ctx.dir, r.value));
          const { cmd, args } = agentCommand(agent, { prompt, resume: body.resume, root: rootOf(ctx.dir), images });
          const id = `r${Date.now().toString(36)}`;
          let proc;
          try {
            // Windows: claude·codex는 .cmd 껍데기라 shell이 필요하고, 프로세스 묶음 종료가 없어 detached를 쓰지 않는다
            const win = process.platform === "win32";
            proc = spawn(cmd, win ? args.map(winQuote) : args, { cwd: rootOf(ctx.dir), stdio: ["ignore", "pipe", "pipe"], detached: !win, shell: win, windowsHide: true, env: { ...process.env, DESIGN_CANVAS_PORT: String(req.socket.localPort) } });
          } catch (e) {
            return sendJson(res, 500, { error: `${cmd}를 실행하지 못했어요: ${e.message}` });
          }
          const run = { proc, agent, events: [], status: "running", prompt };
          runs.set(id, run);
          const emit = (ev) => {
            run.events.push(ev);
            ctx.broadcast({ type: "chat", id, ev });
          };
          emit({ kind: "start", agent, prompt, variants: body.variants?.files });
          const st = {};
          let buf = "";
          proc.stdout.on("data", (d) => {
            buf += d;
            let i;
            while ((i = buf.indexOf("\n")) >= 0) {
              const line = buf.slice(0, i);
              buf = buf.slice(i + 1);
              for (const ev of parseLine(agent, line, st)) emit(ev);
            }
          });
          let err = "";
          proc.stderr.on("data", (d) => (err += d).length > 4000 && (err = err.slice(-4000)));
          proc.on("error", (e) => {
            run.status = "error";
            emit({ kind: "error", text: e.code === "ENOENT" ? `${cmd} 명령이 없어요. 설치하고 로그인해 주세요.` : e.message });
            emit({ kind: "end", status: "error" });
          });
          proc.on("close", (code, signal) => {
            if (run.status === "error") return;
            if (buf.trim()) for (const ev of parseLine(agent, buf, st)) emit(ev);
            run.status = run.cancelled ? "cancelled" : code === 0 ? "done" : "error";
            if (run.status === "error") emit({ kind: "error", text: err.trim().split("\n").slice(-3).join("\n") || `종료 코드 ${code ?? signal}` });
            emit({ kind: "end", status: run.status });
          });
          sendJson(res, 200, { id, variants: body.variants?.files ?? [] });
        },
      ],
      [
        "POST",
        "/api/chat/cancel",
        async (req, res) => {
          const { id } = await readBody(req);
          const run = runs.get(id);
          if (!run || run.status !== "running") return sendJson(res, 404, { error: "실행 중이 아니에요" });
          run.cancelled = true;
          try {
            if (process.platform === "win32") spawn("taskkill", ["/pid", String(run.proc.pid), "/T", "/F"], { windowsHide: true });
            else process.kill(-run.proc.pid, "SIGTERM"); // 프로세스 묶음째
          } catch {
            run.proc.kill("SIGTERM");
          }
          sendJson(res, 200, { ok: true });
        },
      ],
      ["GET", "/api/chat", async (req, res, url) => sendJson(res, 200, { events: runs.get(url.searchParams.get("id"))?.events ?? [] })],
      [
        "GET",
        "/api/agents",
        async (req, res) => {
          const which = (c) => new Promise((r) => spawn(process.platform === "win32" ? "where" : "which", [c], { windowsHide: true }).on("close", (code) => r(code === 0)).on("error", () => r(false)));
          const fake = process.env.DESIGN_CANVAS_AGENT_CMD ? Object.keys(JSON.parse(process.env.DESIGN_CANVAS_AGENT_CMD)) : [];
          sendJson(res, 200, { agents: [{ id: "claude", label: "Claude Code", ok: fake.includes("claude") || (await which("claude")) }, { id: "codex", label: "Codex", ok: fake.includes("codex") || (await which("codex")) }] });
        },
      ],
      // 참고 자료 올리기: docs/design/.refs/에 저장(.gitignore로 레포에 안 들어감)
      [
        "POST",
        "/api/refs",
        async (req, res, url, ctx) => {
          const b = await readBody(req, 20 * 1024 * 1024);
          const name = String(b.name ?? "ref").replace(/[^\w.-]+/g, "_").slice(-80);
          const dir = path.join(ctx.dir, ".refs");
          await fs.mkdir(dir, { recursive: true });
          await fs.writeFile(path.join(dir, ".gitignore"), "*\n").catch(() => {});
          const file = `${Date.now().toString(36)}-${name}`;
          await fs.writeFile(path.join(dir, file), Buffer.from(String(b.data ?? ""), "base64"));
          sendJson(res, 200, { value: `.refs/${file}`, kind: /\.(png|jpe?g|gif|webp)$/i.test(name) ? "image" : "file", name });
        },
      ],
      // 캔버스 상태(모드·페이지·보이는 보드·선택 보드·저장 대기)와 보드 오류
      [
        "PUT",
        "/api/context",
        async (req, res) => {
          state.context = { ...(await readBody(req)), at: new Date().toISOString() };
          sendJson(res, 200, { ok: true });
        },
      ],
      [
        "PUT",
        "/api/errors",
        async (req, res, url, ctx) => {
          const { file, errors } = await readBody(req);
          if (!file) return sendJson(res, 400, { error: "file이 필요해요" });
          if (errors?.length) state.errors[file] = errors.slice(0, 20);
          else delete state.errors[file];
          ctx.broadcast({ type: "errors-changed" });
          sendJson(res, 200, { ok: true });
        },
      ],
      ["GET", "/api/errors", async (req, res) => sendJson(res, 200, { errors: state.errors })],
    ],
  };
}
