// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// Fake agent for e2e: prints output shaped like claude -p --output-format stream-json and edits screens/scr-02.html.
// If the request contains "go slow", it waits 30 seconds (cancel test).
import fs from "node:fs";

const prompt = process.argv.at(-1);
const out = (o) => process.stdout.write(JSON.stringify(o) + "\n");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
out({ type: "system", subtype: "init", session_id: "fake-session" });
fs.writeFileSync("prompt.txt", prompt);
if (prompt.includes("go slow")) await wait(30000);
out({ type: "stream_event", event: { type: "message_start" } });
for (const t of ["Fixing ", "the scr-02 ", "title."]) {
  out({ type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text: t } } });
  await wait(50);
}
out({ type: "assistant", message: { content: [{ type: "tool_use", name: "Edit", input: { file_path: "screens/scr-02.html" } }] } });
const p = "screens/scr-02.html";
fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace("<title>", '<title data-ai="1">'));
out({ type: "result", subtype: "success", is_error: false, result: "Done", total_cost_usd: 0.001 });
