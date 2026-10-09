#!/usr/bin/env node
// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// MCP 서버(stdio): 앱 서버(http://localhost:<port>)의 API로 보드·선택·스크린샷·댓글·배치를 제공한다. PLAN.md 6장.
// HTML 생성·수정은 에이전트가 파일을 직접 쓴다. 이 서버는 보고, 지목하고, 배치만 한다.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { parseArgs } from "../server/args.mjs";

const { port } = parseArgs();
const BASE = `http://127.0.0.1:${port}`;

async function call(method, path, body) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(`디자인 캔버스 앱이 꺼져 있어요. 레포 루트에서 npm run design 으로 켜 주세요 (${BASE}).`);
  }
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try {
      msg = JSON.parse(text).error ?? text;
    } catch {
      /* 그대로 */
    }
    throw new Error(`${res.status} ${msg}`);
  }
  return text;
}
const callJson = async (m, p, b) => JSON.parse(await call(m, p, b));
const ok = (data) => ({ content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] });

const server = new McpServer({ name: "design-canvas", version: "0.1.0" });

server.registerTool(
  "list_boards",
  {
    description: "디자인 캔버스의 보드(=docs/design/screens/*.html 파일) 목록: 파일, 제목, 크기, 위치, 페이지",
    inputSchema: { page: z.string().optional().describe("페이지 id로 거르기") },
  },
  async ({ page }) => {
    const { board, missing } = await callJson("GET", "/api/board");
    const first = board.pages[0]?.id;
    const rows = board.order
      .filter((f) => board.boards[f])
      .map((f) => ({ file: f, ...board.boards[f], page: board.boards[f].page ?? first }))
      .filter((b) => !page || b.page === page);
    return ok({ dir: "docs/design/screens", pages: board.pages, boards: rows, missingFiles: missing });
  },
);

server.registerTool(
  "read_board",
  { description: "보드의 원본 HTML(파일 그대로)", inputSchema: { file: z.string().describe("예: scr-01.html") } },
  async ({ file }) => ok(await call("GET", `/api/file?f=${encodeURIComponent(file)}`)),
);

server.registerTool(
  "get_selection",
  {
    description:
      "사용자가 지금 보는 것: selection(편집 모드에서 클릭한 요소 — 파일, 경로(<body> 자식부터 요소 인덱스), 태그, kind·label, 텍스트, 원본 outerHTML(4KB까지), 해시, 계산된 스타일), mode(canvas·edit·focus·play), page·pageName, visibleArtboards(화면에 보이는 보드), selectedArtboards, dirty(저장 대기), edits(최근 편집 기록), erroredArtboards·firstError(오류 난 보드). '선택한 것 고쳐', '이 화면' 같은 요청에 쓴다",
    inputSchema: {},
  },
  async () => {
    return ok(await callJson("GET", "/api/selection"));
  },
);

server.registerTool(
  "screenshot",
  {
    description: "보드 또는 보드 안 요소의 PNG 스크린샷을 찍어 파일 경로를 돌려준다(playwright 필요)",
    inputSchema: { file: z.string(), path: z.string().optional().describe("요소 경로, 예: 0/2/1") },
  },
  async ({ file, path }) => ok(await callJson("POST", "/api/screenshot", { file, path })),
);

server.registerTool(
  "list_comments",
  {
    description: "보드 댓글 목록(docs/design/comments.json)",
    inputSchema: { file: z.string().optional(), unresolved: z.boolean().optional() },
  },
  async ({ file, unresolved }) => {
    const q = new URLSearchParams();
    if (file) q.set("file", file);
    if (unresolved) q.set("unresolved", "1");
    return ok(await callJson("GET", `/api/comments?${q}`));
  },
);

server.registerTool(
  "add_comment",
  {
    description: "보드(또는 요소)에 댓글 달기",
    inputSchema: { file: z.string(), path: z.string().optional(), text: z.string(), author: z.string().optional() },
  },
  async (args) => ok(await callJson("POST", "/api/comments", { ...args, author: args.author ?? "AI" })),
);

server.registerTool(
  "resolve_comment",
  { description: "댓글 해결 처리(resolved=false면 다시 열기)", inputSchema: { id: z.string(), resolved: z.boolean().optional() } },
  async ({ id, resolved }) => ok(await callJson("POST", "/api/comments", { action: "resolve", id, resolved: resolved ?? true })),
);

server.registerTool(
  "place_board",
  {
    description: "보드의 캔버스 위치·제목·페이지를 board.json에 기록(새 화면을 만든 뒤 이름과 자리를 정할 때)",
    inputSchema: {
      file: z.string(),
      x: z.number().optional(),
      y: z.number().optional(),
      title: z.string().optional(),
      page: z.string().optional(),
    },
  },
  async (args) => ok(await callJson("POST", "/api/place", args)),
);

server.registerTool(
  "list_errors",
  { description: "오류 난 보드 목록(스크립트 오류·불러오지 못한 이미지·없는 파일)과 첫 오류", inputSchema: {} },
  async () => {
    const s = await callJson("GET", "/api/selection");
    const { errors } = await callJson("GET", "/api/errors");
    return ok({ erroredArtboards: s.erroredArtboards, firstError: s.firstError, errors });
  },
);

server.registerTool(
  "create_board",
  {
    description: "새 보드(HTML 파일)를 틀에서 만들고 캔버스에 둔다. 틀: blank(빈 보드)·mobile(390×844 모바일)·desktop(1440×900)·doc(문서). 만든 뒤 파일을 직접 고친다",
    inputSchema: {
      file: z.string().optional().describe("예: scr-40.html"),
      title: z.string().optional(),
      template: z.enum(["blank", "mobile", "desktop", "doc"]).optional(),
      x: z.number().optional(),
      y: z.number().optional(),
      w: z.number().optional(),
      h: z.number().optional(),
      page: z.string().optional(),
    },
  },
  async (args) => ok(await callJson("POST", "/api/boards/create", args)),
);

server.registerTool(
  "list_notes",
  { description: "캔버스 메모(제목·포스트잇) 목록", inputSchema: { page: z.string().optional() } },
  async ({ page }) => {
    const { board } = await callJson("GET", "/api/board");
    const first = board.pages[0]?.id;
    return ok(Object.entries(board.notes).map(([id, n]) => ({ id, ...n, page: n.page ?? first })).filter((n) => !page || n.page === page));
  },
);

server.registerTool(
  "add_note",
  {
    description: "캔버스에 메모 추가. kind=title(큰 제목) 또는 sticky(포스트잇)",
    inputSchema: { kind: z.enum(["title", "sticky"]), text: z.string(), x: z.number(), y: z.number(), w: z.number().optional(), page: z.string().optional() },
  },
  async (args) => ok(await callJson("POST", "/api/notes", { action: "add", ...args })),
);

server.registerTool(
  "update_note",
  {
    description: "메모 고치기(글·위치·너비·페이지·색·크기·굵게·기울임)",
    inputSchema: {
      id: z.string(),
      text: z.string().optional(),
      x: z.number().optional(),
      y: z.number().optional(),
      w: z.number().optional(),
      page: z.string().optional(),
      color: z.string().optional(),
      size: z.number().optional(),
      bold: z.boolean().optional(),
      italic: z.boolean().optional(),
    },
  },
  async (args) => ok(await callJson("POST", "/api/notes", { action: "update", ...args })),
);

server.registerTool(
  "delete_note",
  { description: "메모 지우기(앱에서 실행 취소 가능)", inputSchema: { id: z.string() } },
  async ({ id }) => ok(await callJson("POST", "/api/notes", { action: "delete", id })),
);

server.registerTool(
  "list_pages",
  { description: "캔버스 페이지 목록(첫 페이지가 기본)", inputSchema: {} },
  async () => ok((await callJson("GET", "/api/board")).board.pages),
);

server.registerTool(
  "manage_page",
  {
    description: "페이지 추가(add, name)·이름 바꾸기(rename, id·name)·삭제(delete, id — 항목은 첫 페이지로)·순서(move, id·index)",
    inputSchema: { action: z.enum(["add", "rename", "delete", "move"]), id: z.string().optional(), name: z.string().optional(), index: z.number().optional() },
  },
  async (args) => ok(await callJson("POST", "/api/pages", args)),
);

server.registerTool(
  "get_tokens",
  { description: "디자인 토큰(테마별 색, 글자 크기·굵기·모서리·간격, 글꼴, 최소 누르는 영역). 화면을 만들거나 고칠 때 이 값만 쓴다", inputSchema: {} },
  async () => ok(await callJson("GET", "/api/tokens")),
);

server.registerTool(
  "check_tokens",
  {
    description: "화면 HTML에서 토큰 밖 값(색·글자 크기·굵기·모서리·4 단위 아닌 간격)을 찾는다. 고친 뒤 결과 확인에 쓴다. file을 빼면 전체",
    inputSchema: { file: z.string().optional() },
  },
  async ({ file }) => ok(await callJson("GET", `/api/lint${file ? `?f=${encodeURIComponent(file)}` : ""}`)),
);

server.registerTool(
  "reply_comment",
  { description: "댓글에 답글(resolve=true면 답하고 해결 처리)", inputSchema: { id: z.string(), text: z.string(), resolve: z.boolean().optional(), author: z.string().optional() } },
  async (args) => ok(await callJson("POST", "/api/comments", { action: "reply", ...args, author: args.author ?? "AI" })),
);

server.registerTool(
  "save_snapshot",
  { description: "디자인 폴더만 git 커밋해 스냅숏을 남긴다(버전 저장). 사람이 '저장해 줘'라고 할 때만", inputSchema: { message: z.string().optional() } },
  async ({ message }) => ok(await callJson("POST", "/api/snapshot", { message })),
);

await server.connect(new StdioServerTransport());
