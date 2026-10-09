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
      "사용자가 캔버스 편집 모드에서 방금 클릭한 요소: 파일, 경로(<body> 자식부터 요소 인덱스), 태그, 텍스트, 원본 outerHTML(4KB까지), 해시, 계산된 스타일. '선택한 것 고쳐'라는 요청에 쓴다",
    inputSchema: {},
  },
  async () => {
    const { selection } = await callJson("GET", "/api/selection");
    return ok(selection ?? "선택 없음");
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

await server.connect(new StdioServerTransport());
