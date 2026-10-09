// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// board.json(보드 배치·메모·페이지)과 screens/ 실제 파일 목록을 맞춘다. PLAN.md 2장.
import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_SIZE = { w: 390, h: 844 };
const GAP_X = 80;
const GAP_Y = 120;

export function createBoardStore(dir) {
  const boardPath = path.join(dir, "board.json");
  const screensDir = path.join(dir, "screens");

  async function readBoard() {
    try {
      const raw = await fs.readFile(boardPath, "utf8");
      const b = JSON.parse(raw);
      return {
        version: 1,
        title: b.title ?? path.basename(dir),
        pages: b.pages ?? [],
        boards: b.boards ?? {},
        order: b.order ?? Object.keys(b.boards ?? {}),
        notes: b.notes ?? {},
      };
    } catch (e) {
      if (e.code === "ENOENT") return { version: 1, title: path.basename(dir), pages: [], boards: {}, order: [], notes: {} };
      throw e;
    }
  }

  let writing = Promise.resolve();
  async function writeBoard(board) {
    // 직렬 저장: 동시에 두 요청이 와도 파일이 섞이지 않게 한다
    writing = writing.then(() => fs.writeFile(boardPath, JSON.stringify(board, null, 1) + "\n", "utf8"));
    await writing;
  }

  /** screens/ 아래 .html 파일 목록(하위 폴더 포함, .icloud 자리표시 무시) */
  async function listScreenFiles() {
    const out = [];
    async function walk(rel) {
      let entries = [];
      try {
        entries = await fs.readdir(path.join(screensDir, rel), { withFileTypes: true });
      } catch (e) {
        if (e.code === "ENOENT") return;
        throw e;
      }
      for (const ent of entries) {
        if (ent.name.startsWith(".")) continue;
        const r = rel ? `${rel}/${ent.name}` : ent.name;
        if (ent.isDirectory()) await walk(r);
        else if (ent.name.endsWith(".html")) out.push(r);
      }
    }
    await walk("");
    return out.sort();
  }

  /** <meta name="board-size" content="390x844"> → {w,h} */
  async function readBoardSize(file) {
    try {
      const html = await fs.readFile(path.join(screensDir, file), "utf8");
      const m = html.match(/<meta\s+name=["']board-size["']\s+content=["'](\d+)\s*[x×]\s*(\d+)["']/i);
      if (m) return { w: Number(m[1]), h: Number(m[2]) };
    } catch {
      /* 읽을 수 없으면 기본 크기 */
    }
    return { ...DEFAULT_SIZE };
  }

  /** 새 화면 줄: 마지막으로 자동 배치한 보드 오른쪽, 없으면 전체 최하단 + 120 */
  function placeNew(board, size) {
    const all = Object.values(board.boards);
    const auto = all.filter((b) => b.autoPlaced);
    if (auto.length) {
      const last = auto.reduce((a, b) => (b.x > a.x ? b : a));
      return { x: last.x + last.w + GAP_X, y: last.y, ...size };
    }
    const bottom = all.reduce((m, b) => Math.max(m, b.y + b.h), 0);
    const left = all.reduce((m, b) => Math.min(m, b.x), 0);
    return { x: left, y: bottom + GAP_Y, ...size };
  }

  /** board.json에 없는 파일은 자동 배치해 기록하고, 결과와 누락·고아 목록을 돌려준다 */
  async function syncBoard() {
    const board = await readBoard();
    const files = await listScreenFiles();
    const fileSet = new Set(files);
    let changed = false;
    for (const f of files) {
      if (board.boards[f]) continue;
      const size = await readBoardSize(f);
      board.boards[f] = { ...placeNew(board, size), title: f.replace(/\.html$/, ""), autoPlaced: true };
      board.order.push(f);
      changed = true;
    }
    if (changed) await writeBoard(board);
    const missing = Object.keys(board.boards).filter((f) => !fileSet.has(f));
    return { board, files, missing, added: changed };
  }

  return { dir, screensDir, boardPath, readBoard, writeBoard, listScreenFiles, syncBoard, readBoardSize };
}
