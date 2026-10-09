// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// board.json 형식(PLAN.md 2장)

export type BoardItem = {
  x: number;
  y: number;
  w: number;
  h: number;
  title?: string;
  page?: string;
  autoPlaced?: boolean;
  /** 모서리 px */
  radius?: number;
  /** 틀(그림자·이름표) 없이 */
  frameless?: boolean;
  /** 눌러 보는 보드: 파란 표시와 Play 버튼 */
  is_interactive?: boolean;
  /** 페이지형: 전체 화면 보기에서 창을 채우고 스크롤 */
  expand?: "fill";
};

export type Launch = { view: "canvas" | "focused"; file?: string; page?: string };

export type Tool = "select" | "hand" | "board" | "title" | "sticky";

export type Note = {
  kind: "title" | "sticky";
  x: number;
  y: number;
  text: string;
  w?: number;
  maxW?: number;
  page?: string;
};

export type Page = { id: string; name: string };

export type Board = {
  version: 1;
  title: string;
  pages: Page[];
  boards: Record<string, BoardItem>;
  order: string[];
  notes: Record<string, Note>;
  launch?: Launch;
};

export type BoardResponse = { board: Board; files: string[]; missing: string[]; dir: string };

export type View = { x: number; y: number; zoom: number };

/** 선택한 요소(PLAN.md 3장 경로 규칙) */
export type Selection = {
  file: string;
  path: string;
  paths?: string[];
  tag: string;
  text: string;
  outerHTML: string;
  hash: string;
  styles: Record<string, string>;
  inlineStyle: Record<string, string>;
  rect?: { x: number; y: number; w: number; h: number };
};
