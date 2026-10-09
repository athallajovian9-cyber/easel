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
};

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
