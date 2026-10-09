// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// e2e용 가짜 에이전트: claude -p --output-format stream-json 모양으로 출력하고 screens/scr-02.html을 고친다.
// 요청에 "느리게"가 있으면 30초 기다린다(취소 시험).
import fs from "node:fs";

const prompt = process.argv.at(-1);
const out = (o) => process.stdout.write(JSON.stringify(o) + "\n");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
out({ type: "system", subtype: "init", session_id: "fake-session" });
fs.writeFileSync("prompt.txt", prompt);
if (prompt.includes("느리게")) await wait(30000);
out({ type: "stream_event", event: { type: "message_start" } });
for (const t of ["scr-02 ", "제목을 ", "고칠게요."]) {
  out({ type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text: t } } });
  await wait(50);
}
out({ type: "assistant", message: { content: [{ type: "tool_use", name: "Edit", input: { file_path: "screens/scr-02.html" } }] } });
const p = "screens/scr-02.html";
fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace("<title>", '<title data-ai="1">'));
out({ type: "result", subtype: "success", is_error: false, result: "끝", total_cost_usd: 0.001 });
