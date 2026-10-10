#!/usr/bin/env node
// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// Usage: node bin/server.mjs [--dir <design folder>] [--port 4317]
import { parseArgs } from "../server/args.mjs";
import { createServer } from "../server/index.mjs";
import { attach, closeBrowser, extraRoutes } from "../server/routes.mjs";

const { dir, port } = parseArgs();
const app = await createServer({ dir, port, dev: !process.argv.includes("--prod"), extraRoutes });
await attach(app);
console.log(`Easel: ${app.url}  (design folder ${dir})`);

for (const sig of ["SIGTERM", "SIGINT", "SIGHUP"])
  process.on(sig, async () => {
    await closeBrowser();
    process.exit(0);
  });
