// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// 디자인 폴더 감시: HTML이 바뀌면 그 보드만 다시 그리게 알리고, 새 파일은 board.json에 자동 배치한다. PLAN.md 7장 M2.
import fs from "node:fs/promises";
import path from "node:path";

import chokidar from "chokidar";

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
    const file = path.relative(screensDir, abs).split(path.sep).join("/");
    const kind = event === "add" ? "add" : event === "unlink" ? "unlink" : "change";
    broadcast({ type: "file-changed", file, kind });
    if (kind !== "change") scheduleSync();
  });

  return () => watcher.close();
}
