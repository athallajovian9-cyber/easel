// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// 디자인 폴더 감시: HTML이 바뀌면 그 보드만 다시 그리게 알리고, 새 파일은 board.json에 자동 배치한다. PLAN.md 7장 M2.
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import chokidar from "chokidar";

import { createDeps } from "./deps.mjs";
import { toPosix } from "./fsutil.mjs";

export function watchDesign({ dir, store, broadcast }) {
  const screensDir = store.screensDir;
  const watcher = chokidar.watch([screensDir, store.boardPath], {
    ignoreInitial: true,
    // iCloud 자리표시(.icloud)·숨김 파일 무시(PLAN.md 9장)
    ignored: (p) => {
      const base = path.basename(p);
      return base.startsWith(".") || base.endsWith(".icloud");
    },
    awaitWriteFinish: { stabilityThreshold: 120, pollInterval: 40 },
  });

  const deps = createDeps(screensDir);
  // 밖에서 이름을 바꾸면(같은 내용이 지워졌다 생김) 보드 자리·제목을 새 이름으로 옮긴다
  const hashes = new Map(); // file → 내용 sha1
  const removed = []; // { file, hash, at }
  const sha = (t) => crypto.createHash("sha1").update(t).digest("hex");
  store.listScreenFiles().then(async (files) => {
    for (const f of files) hashes.set(f, sha(await fs.readFile(path.join(screensDir, f), "utf8").catch(() => "")));
  });
  store.listScreenFiles().then((files) => deps.init(files));
  let syncTimer = null;
  const scheduleSync = () => {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(async () => {
      try {
        const { added } = await store.syncBoard();
        broadcast({ type: "board-changed", source: added ? "server:auto-place" : "server:files" });
      } catch (e) {
        console.error("board sync 실패", e);
      }
    }, 150);
  };

  async function followRename(from, to) {
    await store.exclusive(async () => {
      const board = await store.readBoard();
      if (!board.boards[from]) return;
      if (board.boards[to] && !board.boards[to].autoPlaced) return; // 앱에서 바꾼 이름이면 이미 옮겨져 있다
      const old = board.boards[from];
      board.boards[to] = { ...old, ...(old.title === from.replace(/\.html$/, "") ? { title: to.replace(/\.html$/, "") } : {}) };
      delete board.boards[from];
      board.order = board.order.filter((f) => f !== to).map((f) => (f === from ? to : f));
      await store.writeBoard(board);
    });
    broadcast({ type: "board-changed", source: "server:rename" });
  }

  watcher.on("all", async (event, abs) => {
    if (abs === store.boardPath) {
      // 이 서버가 방금 쓴 내용이면 알리지 않는다(자기 저장이 되돌아오는 것 방지)
      try {
        const now = await fs.readFile(abs, "utf8");
        if (now === store.lastWritten()) return;
      } catch {
        /* 지워졌으면 알린다 */
      }
      broadcast({ type: "board-changed", source: "server:external" });
      return;
    }
    if (!abs.endsWith(".html")) return;
    const file = toPosix(path.relative(screensDir, abs));
    const kind = event === "add" ? "add" : event === "unlink" ? "unlink" : "change";
    if (kind === "unlink") {
      deps.remove(file);
      if (hashes.has(file)) removed.push({ file, hash: hashes.get(file), at: Date.now() });
      hashes.delete(file);
    } else {
      await deps.update(file);
      const h = sha(await fs.readFile(abs, "utf8").catch(() => ""));
      hashes.set(file, h);
      if (kind === "add") {
        const i = removed.findIndex((r) => r.hash === h && Date.now() - r.at < 5000);
        if (i >= 0) {
          const [r] = removed.splice(i, 1);
          await followRename(r.file, file).catch((e) => console.error("이름 바꾸기 따라가기 실패", e));
        }
      }
    }
    broadcast({ type: "file-changed", file, kind });
    // 이 화면을 끼운 보드(흐름도 등)도 다시 그린다
    for (const host of deps.dependents(file)) broadcast({ type: "file-changed", file: host, kind: "change", via: file });
    if (kind !== "change") scheduleSync();
  });

  return () => watcher.close();
}
