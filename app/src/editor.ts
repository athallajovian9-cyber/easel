// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// 편집 모드: iframe(같은 출처) 안 요소의 경로·사각형·스타일. PLAN.md 3장·5장.

/** <body>의 자식부터 요소 자식 인덱스를 "/"로 잇는다(서버 parse5와 같은 규칙) */
export function pathOf(el: Element): string | null {
  const doc = el.ownerDocument;
  const parts: number[] = [];
  let n: Element | null = el;
  while (n && n !== doc.body) {
    const parent: Element | null = n.parentElement;
    if (!parent) return null;
    parts.unshift(Array.prototype.indexOf.call(parent.children, n));
    n = parent;
  }
  return n === doc.body ? parts.join("/") : null;
}

export function elementAt(doc: Document, path: string): Element | null {
  let n: Element | null = doc.body;
  if (!path) return n;
  for (const p of path.split("/")) {
    n = n?.children[Number(p)] ?? null;
    if (!n) return null;
  }
  return n;
}

export type Rect = { x: number; y: number; w: number; h: number };

/** iframe 문서 안의 사각형(보드 좌표 = iframe CSS px) */
export function rectOf(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

export const STYLE_PROPS = [
  "width",
  "height",
  "padding",
  "margin",
  "gap",
  "font-size",
  "font-weight",
  "color",
  "background-color",
  "border-radius",
  "display",
  "flex-direction",
  "align-items",
  "justify-content",
  "line-height",
  "text-align",
  "border",
  "box-shadow",
  "opacity",
  "flex-wrap",
  "flex-grow",
  "align-self",
  "grid-template-columns",
  "grid-template-rows",
  "position",
  "background-image",
] as const;

export function computedStyles(el: Element): Record<string, string> {
  const cs = el.ownerDocument.defaultView!.getComputedStyle(el);
  const out: Record<string, string> = {};
  for (const p of STYLE_PROPS) out[p] = cs.getPropertyValue(p);
  return out;
}

/** style 속성의 선언들 */
export function inlineStyles(el: Element): Record<string, string> {
  const out: Record<string, string> = {};
  const s = (el as HTMLElement).style;
  if (!s) return out;
  for (let i = 0; i < s.length; i++) out[s[i]] = s.getPropertyValue(s[i]);
  return out;
}

/** 에이전트에 붙여 넣을 한 줄: scr-32.html 1/2/0 "문의 보내기" (button) */
export function describe(file: string, path: string, tag: string, text: string) {
  const t = text.replace(/\s+/g, " ").trim().slice(0, 40);
  return `${file} ${path} ${t ? `"${t}" ` : ""}(${tag})`;
}
