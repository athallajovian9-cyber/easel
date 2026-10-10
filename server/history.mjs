// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// One chronological undo history: canvas operations (board.json), HTML edits and board file create/delete share the same stack.
// step = { label, changes: [{ path, before, after }] } — before/after null means the file does not exist.
import fs from "node:fs/promises";

import { writeAtomic } from "./fsutil.mjs";

const LIMIT = 100;

export function createHistory({ onWrite } = {}) {
  let undo = [];
  let redo = [];

  const read = (p) => fs.readFile(p, "utf8").catch(() => null);

  async function apply(changes, dir) {
    // Do not overwrite if the file changed outside in the meantime
    for (const c of changes) {
      const now = await read(c.path);
      const expect = dir === "undo" ? c.after : c.before;
      if (now !== expect) {
        undo = [];
        redo = [];
        throw Object.assign(new Error("A file changed outside the app, so the undo history was cleared"), { status: 409 });
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
    /** Records a change that has already been written */
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
