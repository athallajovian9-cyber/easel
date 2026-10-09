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

export type Tool = "select" | "hand" | "board" | "title" | "sticky" | "rect" | "oval" | "line" | "arrow" | "pen";

export type Note = {
  kind: "title" | "sticky";
  x: number;
  y: number;
  text: string;
  w?: number;
  /** 포스트잇 높이(넘치면 스크롤) */
  h?: number;
  maxW?: number;
  /** 제목: 넘으면 글자를 줄인다 */
  maxH?: number;
  page?: string;
  /** 포스트잇 색 이름(STICKY_COLORS) */
  color?: string;
  /** 글자 크기 px */
  size?: number;
  bold?: boolean;
  italic?: boolean;
};

export type ShapeKind = "rect" | "oval" | "line" | "arrow" | "pen" | "image";
export type Shape = {
  kind: ShapeKind;
  x: number;
  y: number;
  w: number;
  h: number;
  /** line·arrow·pen: 상자 왼쪽 위 기준 점들 */
  points?: [number, number][];
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  /** 쌓는 순서(클수록 위) */
  z?: number;
  /** image: ../assets/이름 */
  src?: string;
  page?: string;
};

/** 레이아웃 가이드(보드마다 최대 6개, 캔버스에서만 보임) */
export type LayoutGuide = {
  type: "columns" | "rows" | "grid";
  count: number;
  gutter: number;
  margin: number;
  align: "stretch" | "start" | "center" | "end";
  /** stretch가 아닐 때 칸 크기, grid는 칸 크기 */
  size: number;
  color: string;
  hidden?: boolean;
};

export type Page = { id: string; name: string };

export type Board = {
  version: 1;
  title: string;
  pages: Page[];
  boards: Record<string, BoardItem>;
  order: string[];
  notes: Record<string, Note>;
  shapes?: Record<string, Shape>;
  guides?: Record<string, LayoutGuide[]>;
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
