// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// 편집 중 선택한 요소의 손잡이: 끌어 옮기기(흐름 안에서는 순서 바꾸기·다른 상자로, 절대 위치면 left/top), 크기(너비·높이).
// flex·grid 밖으로 끌어내면 원래 부모와 형제의 크기를 고정해 다른 요소가 움직이지 않게 한다.
import { useRef, useState, type PointerEvent as RPointerEvent } from "react";

import { elementAt, pathOf, rectOf, type Rect } from "./editor";
import { Icon } from "./icons";

export type Freeze = { path: string; props: Record<string, string> };
export type DropPlan = { toParentPath: string; index: number; freeze: Freeze[] };

const parentPath = (p: string) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
const px = (n: number) => `${Math.round(n)}px`;

/** 놓을 곳 계산: 가리킨 요소의 앞·뒤. 상자(조상이거나 Alt)를 가리키면 그 안에서 포인터 위치로 순서를 정한다 */
export function planDrop(doc: Document, dragged: Element, x: number, y: number, inside: boolean): (DropPlan & { line: Rect }) | null {
  const prev = (dragged as HTMLElement).style.pointerEvents;
  (dragged as HTMLElement).style.pointerEvents = "none";
  const t = doc.elementFromPoint(x, y);
  (dragged as HTMLElement).style.pointerEvents = prev;
  if (!t || t === doc.documentElement || dragged.contains(t)) return null;
  const win = doc.defaultView!;
  const isRow = (el: Element) => {
    const cs = win.getComputedStyle(el);
    return /flex/.test(cs.display) && !cs.flexDirection.startsWith("column");
  };
  const VOID = /^(img|input|br|hr|textarea|select|svg|path|video|iframe)$/i;
  // 상자 안: 자식들 가운데 어디에 끼울지
  const intoContainer = (c: Element) => {
    const cp = c === doc.body ? "" : pathOf(c);
    if (cp == null) return null;
    const row = isRow(c);
    const kids = Array.from(c.children).filter((k) => k !== dragged && !(k as HTMLElement).hasAttribute?.("data-dc-probe"));
    let index = kids.length;
    for (let i = 0; i < kids.length; i++) {
      const r = rectOf(kids[i]);
      if (row ? x < r.x + r.w / 2 : y < r.y + r.h / 2) {
        index = i;
        break;
      }
    }
    const cr = rectOf(c);
    let line: Rect;
    if (index < kids.length) {
      const r = rectOf(kids[index]);
      line = row ? { x: r.x - 1, y: r.y, w: 2, h: r.h } : { x: r.x, y: r.y - 1, w: r.w, h: 2 };
    } else if (kids.length) {
      const r = rectOf(kids[kids.length - 1]);
      line = row ? { x: r.x + r.w, y: r.y, w: 2, h: r.h } : { x: r.x, y: r.y + r.h, w: r.w, h: 2 };
    } else line = { x: cr.x, y: cr.y + cr.h - 2, w: cr.w, h: 2 };
    return { toParentPath: cp, index, freeze: [], line };
  };
  if (t.contains(dragged) || t === doc.body) return intoContainer(t === doc.body ? doc.body : t);
  if (inside && !VOID.test(t.tagName)) return intoContainer(t);
  const parent = t.parentElement!;
  const pp = parent === doc.body ? "" : pathOf(parent);
  if (pp == null) return null;
  const row = isRow(parent);
  const r = rectOf(t);
  const after = row ? x > r.x + r.w / 2 : y > r.y + r.h / 2;
  const others = Array.from(parent.children).filter((k) => k !== dragged);
  const index = others.indexOf(t) + (after ? 1 : 0);
  const line = row ? { x: after ? r.x + r.w : r.x - 1, y: r.y, w: 2, h: r.h } : { x: r.x, y: after ? r.y + r.h : r.y - 1, w: r.w, h: 2 };
  return { toParentPath: pp, index, freeze: [], line };
}

/** 원래 부모가 flex·grid이고 다른 부모로 옮기면, 부모와 남는 형제의 지금 크기를 적어 둔다(inline 크기가 이미 있으면 그대로) */
export function freezeFor(doc: Document, dragged: Element, toParentPath: string): Freeze[] {
  const parent = dragged.parentElement;
  if (!parent || parent === doc.body) return [];
  const from = pathOf(parent);
  if (from == null || from === toParentPath) return [];
  const cs = doc.defaultView!.getComputedStyle(parent);
  if (!/flex|grid/.test(cs.display)) return [];
  const out: Freeze[] = [];
  const fix = (el: Element, dims: ("width" | "height")[]) => {
    const p = pathOf(el);
    const st = (el as HTMLElement).style;
    const r = el.getBoundingClientRect();
    const props: Record<string, string> = {};
    for (const d of dims) if (!st.getPropertyValue(d)) props[d] = px(d === "width" ? r.width : r.height);
    if (p != null && Object.keys(props).length) out.push({ path: p, props });
  };
  fix(parent, ["width", "height"]);
  const grid = cs.display.includes("grid");
  const row = !cs.flexDirection.startsWith("column");
  for (const sib of Array.from(parent.children)) if (sib !== dragged) fix(sib, grid ? ["width", "height"] : row ? ["width"] : ["height"]);
  return out;
}

export function EditHandles(p: {
  doc: Document;
  path: string;
  rect: Rect;
  zoom: number;
  onMove: (plan: DropPlan) => void;
  onPosition: (left: number, top: number) => void;
  onResize: (w: number, h: number) => void;
}) {
  const [line, setLine] = useState<Rect | null>(null);
  const [ghost, setGhost] = useState<Rect | null>(null);
  const drag = useRef<null | { kind: "move" | "e" | "s" | "se"; sx: number; sy: number; el: HTMLElement; abs: boolean; left: number; top: number; w: number; h: number; plan: DropPlan | null; moved: boolean }>(null);
  const s = 1 / Math.max(p.zoom, 0.25);

  const start = (kind: "move" | "e" | "s" | "se") => (e: RPointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const el = elementAt(p.doc, p.path) as HTMLElement | null;
    if (!el) return;
    const cs = p.doc.defaultView!.getComputedStyle(el);
    const abs = cs.position === "absolute" || cs.position === "fixed";
    const r = el.getBoundingClientRect();
    drag.current = { kind, sx: e.clientX, sy: e.clientY, el, abs, left: parseFloat(cs.left) || 0, top: parseFloat(cs.top) || 0, w: r.width, h: r.height, plan: null, moved: false };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const move = (e: RPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.sx) / p.zoom;
    const dy = (e.clientY - d.sy) / p.zoom;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < 3) return;
    d.moved = true;
    if (d.kind === "move") {
      if (d.abs) {
        d.el.style.left = px(d.left + dx);
        d.el.style.top = px(d.top + dy);
        return;
      }
      setGhost({ ...p.rect, x: p.rect.x + dx, y: p.rect.y + dy });
      // 포인터가 가리키는 iframe 안 좌표
      const fr = (p.doc.defaultView?.frameElement as HTMLElement | null)?.getBoundingClientRect();
      const k = fr ? fr.width / (p.doc.defaultView!.innerWidth || fr.width) : p.zoom;
      const ix = fr ? (e.clientX - fr.left) / k : p.rect.x + dx;
      const iy = fr ? (e.clientY - fr.top) / k : p.rect.y + dy;
      const plan = planDrop(p.doc, d.el, ix, iy, e.altKey);
      d.plan = plan ? { toParentPath: plan.toParentPath, index: plan.index, freeze: [] } : null;
      setLine(plan?.line ?? null);
      return;
    }
    // 크기: 끄는 동안은 화면에만 적용하고, 놓을 때 원본에 쓴다
    if (d.kind !== "s") d.el.style.width = px(Math.max(8, d.w + dx));
    if (d.kind !== "e") d.el.style.height = px(Math.max(8, d.h + dy));
  };
  const end = (e: RPointerEvent) => {
    const d = drag.current;
    drag.current = null;
    setLine(null);
    setGhost(null);
    if (!d || !d.moved) return;
    const dx = (e.clientX - d.sx) / p.zoom;
    const dy = (e.clientY - d.sy) / p.zoom;
    if (d.kind === "move") {
      if (d.abs) return p.onPosition(Math.round(d.left + dx), Math.round(d.top + dy));
      if (!d.plan) return;
      const same = d.plan.toParentPath === parentPath(p.path) && d.plan.index === Array.from(d.el.parentElement!.children).indexOf(d.el);
      if (same) return;
      p.onMove({ ...d.plan, freeze: freezeFor(p.doc, d.el, d.plan.toParentPath) });
      return;
    }
    p.onResize(Math.round(d.kind === "s" ? d.w : Math.max(8, d.w + dx)), Math.round(d.kind === "e" ? d.h : Math.max(8, d.h + dy)));
  };

  const r = p.rect;
  const hs = 10 * s;
  return (
    <>
      {ghost && <div className="drag-ghost" style={{ left: ghost.x, top: ghost.y, width: ghost.w, height: ghost.h }} />}
      {line && <div className="drop-line" style={{ left: line.x, top: line.y, width: Math.max(line.w, 2 * s), height: Math.max(line.h, 2 * s) }} />}
      <button
        className="el-move"
        aria-label="요소 옮기기 (Alt: 가리킨 상자 안으로)"
        title="끌어서 옮기기 · Alt를 누르면 가리킨 상자 안으로"
        style={{ left: Math.max(0, r.x), top: r.y >= 22 * s ? r.y - 22 * s : Math.max(0, r.y), transform: `scale(${s})`, transformOrigin: r.y >= 22 * s ? "0 100%" : "0 0" }}
        onPointerDown={start("move")}
        onPointerMove={move}
        onPointerUp={end}
      >
        <Icon name="hand" size={12} />
      </button>
      {(["e", "s", "se"] as const).map((k) => (
        <div
          key={k}
          className={`el-resize ${k}`}
          role="slider"
          aria-label={k === "e" ? "너비" : k === "s" ? "높이" : "크기"}
          aria-valuetext={`${Math.round(r.w)} × ${Math.round(r.h)}`}
          style={{
            left: k === "s" ? r.x + r.w / 2 - hs / 2 : r.x + r.w - hs / 2,
            top: k === "e" ? r.y + r.h / 2 - hs / 2 : r.y + r.h - hs / 2,
            width: hs,
            height: hs,
            borderWidth: 1.5 * s,
          }}
          onPointerDown={start(k)}
          onPointerMove={move}
          onPointerUp={end}
        />
      ))}
    </>
  );
}

/** 정렬: 부모 배치에 맞춰 align-self 또는 margin auto로 */
export function alignOps(doc: Document, path: string, hash: string, dir: "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom") {
  const el = elementAt(doc, path);
  const parent = el?.parentElement;
  if (!el || !parent) return null;
  const cs = doc.defaultView!.getComputedStyle(parent);
  const flex = /flex/.test(cs.display);
  const column = flex && cs.flexDirection.startsWith("column");
  const horizontal = dir === "left" || dir === "hcenter" || dir === "right";
  const pos = dir === "left" || dir === "top" ? "start" : dir === "right" || dir === "bottom" ? "end" : "center";
  const self = { start: "flex-start", center: "center", end: "flex-end" }[pos];
  const set = (prop: string, value: string) => ({ op: "setStyle", path, hash, prop, value });
  // 교차 축이면 align-self, 주 축이거나 블록이면 margin auto
  if (flex && (horizontal ? column : !column)) return [set("align-self", self)];
  if (horizontal) {
    if (pos === "start") return [set("margin-left", "0"), set("margin-right", "auto")];
    if (pos === "end") return [set("margin-left", "auto"), set("margin-right", "0")];
    return [set("margin-left", "auto"), set("margin-right", "auto")];
  }
  if (!flex) return null; // 블록 흐름에서 세로 정렬은 뜻이 없다
  if (pos === "start") return [set("margin-top", "0"), set("margin-bottom", "auto")];
  if (pos === "end") return [set("margin-top", "auto"), set("margin-bottom", "0")];
  return [set("margin-top", "auto"), set("margin-bottom", "auto")];
}
