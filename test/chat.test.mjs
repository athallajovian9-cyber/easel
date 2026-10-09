// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// 에이전트 출력(JSONL) → 공통 이벤트 변환
import assert from "node:assert/strict";
import { test } from "node:test";

import { parseLine } from "../server/chat.mjs";

const j = (o) => JSON.stringify(o);

test("claude stream-json: 세션·글 조각·도구·끝", () => {
  const st = {};
  assert.deepEqual(parseLine("claude", j({ type: "system", subtype: "init", session_id: "s1" }), st), [{ kind: "session", id: "s1" }]);
  assert.deepEqual(parseLine("claude", j({ type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text: "안" } } }), st), [{ kind: "delta", text: "안" }]);
  // 조각을 받았으면 assistant의 같은 글은 다시 내지 않는다
  assert.deepEqual(parseLine("claude", j({ type: "assistant", message: { content: [{ type: "text", text: "안" }, { type: "tool_use", name: "Edit", input: { file_path: "a.html" } }] } }), st), [{ kind: "tool", name: "Edit", detail: "a.html" }]);
  assert.deepEqual(parseLine("claude", j({ type: "result", subtype: "success", is_error: false, total_cost_usd: 0.5 }), st), [{ kind: "done", cost: 0.5 }]);
  assert.deepEqual(parseLine("claude", j({ type: "result", subtype: "error_max_turns", is_error: true, result: "x" }), st), [{ kind: "error", text: "x" }]);
});

test("codex --json: 스레드·메시지·명령·파일 수정·끝, 설정 경고는 숨김", () => {
  const st = {};
  assert.deepEqual(parseLine("codex", j({ type: "thread.started", thread_id: "t1" }), st), [{ kind: "session", id: "t1" }]);
  assert.deepEqual(parseLine("codex", j({ type: "item.completed", item: { type: "error", message: "Ignoring unknown `features`" } }), st), []);
  assert.deepEqual(parseLine("codex", j({ type: "item.started", item: { type: "command_execution", command: "ls" } }), st), [{ kind: "tool", name: "명령", detail: "ls" }]);
  assert.deepEqual(parseLine("codex", j({ type: "item.completed", item: { type: "file_change", changes: [{ path: "a.html" }] } }), st), [{ kind: "tool", name: "파일 수정", detail: "a.html" }]);
  assert.deepEqual(parseLine("codex", j({ type: "item.completed", item: { type: "agent_message", text: "끝" } }), st), [{ kind: "text", text: "끝" }]);
  assert.equal(parseLine("codex", j({ type: "turn.completed", usage: {} }), st)[0].kind, "done");
  assert.equal(parseLine("codex", j({ type: "turn.failed", error: { message: "x" } }), st)[0].text, "x");
});

test("JSON이 아닌 줄은 log", () => {
  assert.deepEqual(parseLine("codex", "Reading additional input", {}), [{ kind: "log", text: "Reading additional input" }]);
  assert.deepEqual(parseLine("codex", "  ", {}), []);
});
