// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// 명령줄 인자: --dir <디자인 폴더> --port <포트>. 기본 디자인 폴더는 레포의 docs/design.
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const TOOL_ROOT = path.resolve(here, "..");
export const DEFAULT_DIR = path.resolve(TOOL_ROOT, "../../docs/design");
export const DEFAULT_PORT = 4317;

export function parseArgs(argv = process.argv.slice(2)) {
  const out = { dir: DEFAULT_DIR, port: DEFAULT_PORT };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === "--dir") out.dir = path.resolve(next().replace(/^~(?=\/)/, process.env.HOME ?? "~"));
    else if (a.startsWith("--dir=")) out.dir = path.resolve(a.slice(6).replace(/^~(?=\/)/, process.env.HOME ?? "~"));
    else if (a === "--port") out.port = Number(next());
    else if (a.startsWith("--port=")) out.port = Number(a.slice(7));
  }
  return out;
}
