// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// 버전 대신 git 스냅숏: 디자인 폴더만 커밋하고(작성자는 git 설정 그대로), 최근 스냅숏 목록을 보여 준다.
// 되돌리기는 하지 않는다(git으로 직접). 다른 파일이 스테이징돼 있으면 섞이지 않게 디자인 폴더 경로만 커밋한다.
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import { readBody, sendJson } from "./index.mjs";

export function git(cwd, args) {
  return new Promise((resolve) => {
    const p = spawn("git", args, { cwd, windowsHide: true });
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", (e) => resolve({ code: -1, out, err: e.message }));
    p.on("close", (code) => resolve({ code, out, err }));
  });
}

async function repoOf(dir) {
  const r = await git(dir, ["rev-parse", "--show-toplevel"]);
  return r.code === 0 ? r.out.trim() : null;
}

export function snapshotRoutes() {
  return [
    [
      "GET",
      "/api/me",
      async (req, res, url, ctx) => {
        const r = await git(ctx.dir, ["config", "user.name"]);
        sendJson(res, 200, { name: r.code === 0 ? r.out.trim() : process.env.USER ?? "" });
      },
    ],
    [
      "GET",
      "/api/snapshots",
      async (req, res, url, ctx) => {
        const root = await repoOf(ctx.dir);
        if (!root) return sendJson(res, 200, { git: false, snapshots: [], changed: 0 });
        const rel = path.relative(root, await fs.realpath(ctx.dir)) || "."; // /var → /private/var 같은 링크를 풀고 비교
        const log = await git(root, ["log", "-n", "15", "--format=%h%x09%an%x09%ar%x09%s", "--", rel]);
        const st = await git(root, ["status", "--porcelain", "--", rel]);
        const branch = (await git(root, ["branch", "--show-current"])).out.trim();
        sendJson(res, 200, {
          git: true,
          branch,
          changed: st.out.split("\n").filter(Boolean).length,
          snapshots: log.out.split("\n").filter(Boolean).map((l) => {
            const [hash, author, when, subject] = l.split("\t");
            return { hash, author, when, subject };
          }),
        });
      },
    ],
    [
      "POST",
      "/api/snapshot",
      async (req, res, url, ctx) => {
        const b = await readBody(req);
        const root = await repoOf(ctx.dir);
        if (!root) return sendJson(res, 400, { error: "디자인 폴더가 git 저장소 안에 있지 않아요" });
        const rel = path.relative(root, await fs.realpath(ctx.dir)) || "."; // /var → /private/var 같은 링크를 풀고 비교
        const msg = String(b.message ?? "").trim() || `디자인 스냅숏 ${new Date().toLocaleString("ko-KR")}`;
        const add = await git(root, ["add", "--", rel]);
        if (add.code !== 0) return sendJson(res, 500, { error: add.err.trim() || "git add 실패" });
        const diff = await git(root, ["diff", "--cached", "--quiet", "--", rel]);
        if (diff.code === 0) return sendJson(res, 200, { ok: true, nothing: true });
        // 디자인 폴더 경로만 커밋(다른 스테이징은 그대로 둔다). 훅도 그대로 돈다
        const c = await git(root, ["commit", "-m", msg, "--", rel]);
        if (c.code !== 0) return sendJson(res, 500, { error: (c.err || c.out).trim().split("\n").slice(-3).join("\n") || "git commit 실패" });
        const hash = (await git(root, ["rev-parse", "--short", "HEAD"])).out.trim();
        sendJson(res, 200, { ok: true, hash, message: msg });
      },
    ],
  ];
}
