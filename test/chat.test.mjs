// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// Agent output (JSONL) -> common events
import assert from "node:assert/strict";
import { test } from "node:test";

import { parseLine } from "../server/chat.mjs";
import { ko } from "./fixtures/ko-strings.mjs";

const j = (o) => JSON.stringify(o);

test("claude stream-json: session, text delta, tool, done", () => {
  const st = {};
  assert.deepEqual(parseLine("claude", j({ type: "system", subtype: "init", session_id: "s1" }), st), [{ kind: "session", id: "s1" }]);
  assert.deepEqual(parseLine("claude", j({ type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text: ko.hello } } }), st), [{ kind: "delta", text: ko.hello }]);
  // Once deltas arrived, the assistant message's same text is not emitted again
  assert.deepEqual(parseLine("claude", j({ type: "assistant", message: { content: [{ type: "text", text: ko.hello }, { type: "tool_use", name: "Edit", input: { file_path: "a.html" } }] } }), st), [{ kind: "tool", name: "Edit", detail: "a.html" }]);
  assert.deepEqual(parseLine("claude", j({ type: "result", subtype: "success", is_error: false, total_cost_usd: 0.5 }), st), [{ kind: "done", cost: 0.5 }]);
  assert.deepEqual(parseLine("claude", j({ type: "result", subtype: "error_max_turns", is_error: true, result: "x" }), st), [{ kind: "error", text: "x" }]);
});

test("codex --json: thread, message, command, file change, done; config warnings are hidden", () => {
  const st = {};
  assert.deepEqual(parseLine("codex", j({ type: "thread.started", thread_id: "t1" }), st), [{ kind: "session", id: "t1" }]);
  assert.deepEqual(parseLine("codex", j({ type: "item.completed", item: { type: "error", message: "Ignoring unknown `features`" } }), st), []);
  assert.deepEqual(parseLine("codex", j({ type: "item.started", item: { type: "command_execution", command: "ls" } }), st), [{ kind: "tool", name: "Command", detail: "ls" }]);
  assert.deepEqual(parseLine("codex", j({ type: "item.completed", item: { type: "file_change", changes: [{ path: "a.html" }] } }), st), [{ kind: "tool", name: "File change", detail: "a.html" }]);
  assert.deepEqual(parseLine("codex", j({ type: "item.completed", item: { type: "agent_message", text: ko.done } }), st), [{ kind: "text", text: ko.done }]);
  assert.equal(parseLine("codex", j({ type: "turn.completed", usage: {} }), st)[0].kind, "done");
  assert.equal(parseLine("codex", j({ type: "turn.failed", error: { message: "x" } }), st)[0].text, "x");
});

test("non-JSON lines become log", () => {
  assert.deepEqual(parseLine("codex", "Reading additional input", {}), [{ kind: "log", text: "Reading additional input" }]);
  assert.deepEqual(parseLine("codex", "  ", {}), []);
});
