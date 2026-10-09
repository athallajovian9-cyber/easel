// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// 서버 API·WS 호출. PLAN.md 4장.
import type { Board, BoardResponse } from "./types";

export const clientId = Math.random().toString(36).slice(2);

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error ?? res.statusText), { status: res.status, body });
  return body as T;
}

export const api = {
  board: () => fetch("/api/board").then((r) => json<BoardResponse>(r)),
  saveBoard: (board: Board, label?: string) =>
    fetch("/api/board", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...board, clientId, ...(label ? { label } : {}) }),
    }).then((r) => json<{ ok: true }>(r)),
  post: <T>(path: string, body: unknown) =>
    fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => json<T>(r)),
  put: <T>(path: string, body: unknown) =>
    fetch(path, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => json<T>(r)),
  get: <T>(path: string) => fetch(path).then((r) => json<T>(r)),
};

export type ServerEvent =
  | { type: "file-changed"; file: string; kind: "change" | "add" | "unlink" }
  | { type: "board-changed"; source: string | null }
  | { type: "selection-changed" }
  | { type: "comments-changed" }
  | { type: "history-changed" }
  | { type: "errors-changed" }
  | { type: "assets-changed" }
  | { type: "chat"; id: string; ev: import("./chat").ChatEvent };

/** 끊기면 1초 뒤 다시 붙는 WS */
export function connectEvents(onEvent: (e: ServerEvent) => void) {
  let ws: WebSocket | null = null;
  let closed = false;
  const open = () => {
    ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
    ws.onmessage = (m) => {
      try {
        onEvent(JSON.parse(m.data));
      } catch {
        /* 무시 */
      }
    };
    ws.onclose = () => {
      if (!closed) setTimeout(open, 1000);
    };
  };
  open();
  return () => {
    closed = true;
    ws?.close();
  };
}
