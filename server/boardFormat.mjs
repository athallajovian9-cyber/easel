// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// board.json 형식: 키 정렬 + 보드·메모·페이지 하나를 한 줄로, 항목 사이에 빈 줄 하나.
// 두 브랜치에서 서로 다른 보드(이웃한 보드 포함)를 고쳐도 git 병합이 충돌하지 않게 한다(빈 줄이 변경 구간을 떼어 놓음).
const BOARD_KEYS = ["x", "y", "w", "h", "title", "page"];
const NOTE_KEYS = ["kind", "x", "y", "w", "h", "maxW", "maxH", "text", "page"];
const TOP_KEYS = ["version", "title", "pages", "launch", "boards", "order", "notes", "shapes", "guides"];

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** 앞에 둘 키 순서를 지키고 나머지는 이름순 */
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
    else if (k === "pages" || k === "order" || k === "shapes") v = arrayLines(b[k]);
    else if (k === "guides") v = objectLines(b.guides);
    else v = line(b[k]);
    return `  ${line(k)}: ${v}`;
  });
  return "{\n" + parts.join(",\n") + "\n}\n";
}
