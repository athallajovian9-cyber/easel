// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// 하나의 시간순 실행 취소 기록: 캔버스 조작(board.json)과 HTML 편집·보드 파일 만들기/지우기를 같은 줄에 쌓는다.
// 단계 = { label, changes: [{ path, before, after }] } — before/after가 null이면 파일이 없다는 뜻.
import fs from "node:fs/promises";

import { writeAtomic } from "./fsutil.mjs";

const LIMIT = 100;

export function createHistory({ onWrite } = {}) {
  let undo = [];
  let redo = [];

  const read = (p) => fs.readFile(p, "utf8").catch(() => null);

  async function apply(changes, dir) {
    // 그사이 밖에서 바뀌었으면 덮어쓰지 않는다
    for (const c of changes) {
      const now = await read(c.path);
      const expect = dir === "undo" ? c.after : c.before;
      if (now !== expect) {
        undo = [];
        redo = [];
        throw Object.assign(new Error("파일이 밖에서 바뀌어 실행 취소 기록을 비웠어요"), { status: 409 });
      }
    }
    for (const c of changes) {
      const target = dir === "undo" ? c.before : c.after;
      if (target == null) await fs.rm(c.path, { force: true });
      else await writeAtomic(c.path, target);
      onWrite?.(c.path, target);
    }
  }

  return {
    /** 이미 쓴 변경을 기록한다 */
    push(label, changes) {
      const real = changes.filter((c) => c.before !== c.after);
      if (!real.length) return;
      undo.push({ label, changes: real, at: Date.now() });
      if (undo.length > LIMIT) undo.shift();
      redo = [];
    },
    async undo() {
      const step = undo[undo.length - 1];
      if (!step) return null;
      await apply([...step.changes].reverse(), "undo");
      undo.pop();
      redo.push(step);
      return step;
    },
    async redo() {
      const step = redo[redo.length - 1];
      if (!step) return null;
      await apply(step.changes, "redo");
      redo.pop();
      undo.push(step);
      return step;
    },
    state: () => ({ undo: undo.map((s) => s.label).slice(-20), redo: redo.map((s) => s.label).slice(-20), canUndo: undo.length > 0, canRedo: redo.length > 0 }),
    clear() {
      undo = [];
      redo = [];
    },
  };
}
