// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// board.json format: sorted keys, one board/note/page per line, one blank line between entries.
// So that editing different boards (even neighbors) on two branches does not cause git merge conflicts (blank lines separate the hunks).
const BOARD_KEYS = ["x", "y", "w", "h", "title", "page"];
const NOTE_KEYS = ["kind", "x", "y", "w", "h", "maxW", "maxH", "text", "page"];
const SHAPE_KEYS = ["kind", "x", "y", "w", "h", "points", "page"];
const TOP_KEYS = ["version", "title", "pages", "launch", "boards", "order", "notes", "shapes", "guides"];

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** Keep the leading keys in order, the rest alphabetically */
function ordered(obj, first) {
  const out = {};
  for (const k of first) if (obj[k] !== undefined) out[k] = obj[k];
  for (const k of Object.keys(obj).sort(cmp)) if (!(k in out) && obj[k] !== undefined) out[k] = obj[k];
  return out;
}
const line = (v) => JSON.stringify(v);

function objectLines(obj, valueKeys) {
  const keys = Object.keys(obj ?? {}).sort(cmp);
  if (!keys.length) return "{}";
  return "{\n" + keys.map((k) => `    ${line(k)}: ${line(valueKeys ? ordered(obj[k], valueKeys) : obj[k])}`).join(",\n\n") + "\n  }";
}
function arrayLines(arr) {
  if (!arr?.length) return "[]";
  return "[\n" + arr.map((v) => `    ${line(v)}`).join(",\n") + "\n  ]";
}

export function formatBoard(board) {
  const b = ordered(board, TOP_KEYS);
  const parts = Object.keys(b).map((k) => {
    let v;
    if (k === "boards") v = objectLines(b.boards, BOARD_KEYS);
    else if (k === "notes") v = objectLines(b.notes, NOTE_KEYS);
    else if (k === "shapes") v = Array.isArray(b.shapes) ? arrayLines(b.shapes) : objectLines(b.shapes, SHAPE_KEYS);
    else if (k === "pages" || k === "order") v = arrayLines(b[k]);
    else if (k === "guides") v = objectLines(b.guides);
    else v = line(b[k]);
    return `  ${line(k)}: ${v}`;
  });
  return "{\n" + parts.join(",\n") + "\n}\n";
}
