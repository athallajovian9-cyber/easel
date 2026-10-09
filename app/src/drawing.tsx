// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// 캔버스 그리기: 도형(사각형·타원·선·화살표·펜·이미지) 그리기·선택·옮기기·크기, 메모 옵션, 보드 레이아웃 가이드.
import { useRef, useState, type PointerEvent as RPointerEvent } from "react";

import { Icon } from "./icons";
import type { LayoutGuide, Note, Shape, ShapeKind, View } from "./types";

export const STICKY_COLORS: { id: string; label: string; bg: string }[] = [
  { id: "yellow", label: "노랑", bg: "#FFF1A8" },
  { id: "orange", label: "주황", bg: "#FFD9BC" },
  { id: "pink", label: "분홍", bg: "#FFD6E2" },
  { id: "purple", label: "보라", bg: "#E5DAFF" },
  { id: "blue", label: "파랑", bg: "#D2E4FF" },
  { id: "green", label: "초록", bg: "#D5F0D3" },
  { id: "gray", label: "회색", bg: "#ECEBE7" },
  { id: "white", label: "흰색", bg: "#FFFFFF" },
];
export const stickyBg = (c?: string) => STICKY_COLORS.find((x) => x.id === c)?.bg ?? STICKY_COLORS[0].bg;
export const MAX_NOTES = 200;
export const MAX_GUIDES = 6;
const SHAPE_COLORS = ["#111111", "#6B6B6B", "#C94F0C", "#B42318", "#1E7A4C", "#2F6FDE", "#FFFFFF", "none"];

/* ---------------- 도형 렌더링 ---------------- */
function ShapeSvg({ s, id }: { s: Shape; id: string }) {
  const sw = s.strokeWidth ?? 4;
  const stroke = s.stroke ?? "#111111";
  const fill = s.fill ?? "none";
  const pad = sw;
  const w = Math.max(1, s.w);
  const h = Math.max(1, s.h);
  const pts = (s.points ?? []).map(([x, y]) => `${x},${y}`).join(" ");
  return (
    <svg width={w + pad * 2} height={h + pad * 2} viewBox={`${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}`} style={{ position: "absolute", left: -pad, top: -pad, overflow: "visible" }}>
      {s.kind === "arrow" && (
        <defs>
          <marker id={`ah-${id}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" fill={stroke} />
          </marker>
        </defs>
      )}
      {s.kind === "rect" && <rect x={0} y={0} width={w} height={h} rx={8} fill={fill} stroke={stroke} strokeWidth={sw} />}
      {s.kind === "oval" && <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill={fill} stroke={stroke} strokeWidth={sw} />}
      {(s.kind === "line" || s.kind === "arrow") && <polyline points={pts} fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" markerEnd={s.kind === "arrow" ? `url(#ah-${id})` : undefined} />}
      {s.kind === "pen" && <polyline points={pts} fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />}
      {s.kind === "image" && <image href={s.src?.replace(/^\.\.\//, "/")} x={0} y={0} width={w} height={h} preserveAspectRatio="xMidYMid slice" />}
    </svg>
  );
}

export function ShapesLayer(p: {
  shapes: Record<string, Shape>;
  ids: string[];
  zoom: number;
  selected: string | null;
  interactive: boolean;
  onSelect: (id: string) => void;
  onChange: (id: string, patch: Partial<Shape>, done: boolean) => void;
  onContext: (id: string, e: { clientX: number; clientY: number }) => void;
}) {
  const drag = useRef<null | { id: string; mode: "move" | "resize"; sx: number; sy: number; o: Shape; moved: boolean }>(null);
  const start = (id: string, mode: "move" | "resize") => (e: RPointerEvent) => {
    if (e.button !== 0 || !p.interactive) return;
    e.stopPropagation();
    p.onSelect(id);
    drag.current = { id, mode, sx: e.clientX, sy: e.clientY, o: p.shapes[id], moved: false };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const move = (e: RPointerEvent, done = false) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.sx) / p.zoom;
    const dy = (e.clientY - d.sy) / p.zoom;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < 2 / p.zoom) {
      if (done) drag.current = null;
      return;
    }
    d.moved = true;
    if (d.mode === "move") p.onChange(d.id, { x: Math.round(d.o.x + dx), y: Math.round(d.o.y + dy) }, done);
    else {
      const w = Math.max(8, d.o.w + dx);
      const h = Math.max(8, d.o.h + dy);
      const sx = w / Math.max(1, d.o.w);
      const sy = h / Math.max(1, d.o.h);
      const patch: Partial<Shape> = { w: Math.round(w), h: Math.round(h) };
      if (d.o.points) patch.points = d.o.points.map(([x, y]) => [Math.round(x * sx), Math.round(y * sy)]);
      p.onChange(d.id, patch, done);
    }
    if (done) drag.current = null;
  };
  return (
    <>
      {p.ids.map((id) => {
        const s = p.shapes[id];
        const sel = p.selected === id;
        return (
          <div
            key={id}
            className={`shape ${sel ? "selected" : ""}`}
            data-shape={id}
            style={{ left: s.x, top: s.y, width: Math.max(1, s.w), height: Math.max(1, s.h), pointerEvents: p.interactive ? "auto" : "none" }}
            onPointerDown={start(id, "move")}
            onPointerMove={(e) => move(e)}
            onPointerUp={(e) => move(e, true)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              p.onSelect(id);
              p.onContext(id, e);
            }}
          >
            <ShapeSvg s={s} id={id} />
            {sel && (
              <div
                className="shape-resize"
                role="slider"
                aria-label="도형 크기"
                aria-valuetext={`${s.w} × ${s.h}`}
                style={{ width: 12 / p.zoom, height: 12 / p.zoom, right: -6 / p.zoom, bottom: -6 / p.zoom, borderWidth: 1.5 / p.zoom }}
                onPointerDown={start(id, "resize")}
                onPointerMove={(e) => move(e)}
                onPointerUp={(e) => move(e, true)}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

/* ---------------- 도형 그리기(도구가 도형일 때 캔버스 위 덮개) ---------------- */
export function ShapeDrawer({ tool, view, onDone }: { tool: ShapeKind; view: View; onDone: (s: Shape) => void }) {
  const [draft, setDraft] = useState<Shape | null>(null);
  const st = useRef<{ x0: number; y0: number; pts: [number, number][] } | null>(null);
  const world = (e: RPointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: (e.clientX - r.left - view.x) / view.zoom, y: (e.clientY - r.top - view.y) / view.zoom };
  };
  const shapeOf = (x0: number, y0: number, x1: number, y1: number, pts: [number, number][], shift: boolean): Shape => {
    if (shift && (tool === "rect" || tool === "oval")) {
      const d = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      x1 = x0 + Math.sign(x1 - x0 || 1) * d;
      y1 = y0 + Math.sign(y1 - y0 || 1) * d;
    }
    if (tool === "pen") {
      const xs = pts.map((q) => q[0]);
      const ys = pts.map((q) => q[1]);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      return { kind: "pen", x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y, points: pts.map(([a, b]) => [Math.round(a - x), Math.round(b - y)]) };
    }
    const x = Math.min(x0, x1);
    const y = Math.min(y0, y1);
    const w = Math.abs(x1 - x0);
    const h = Math.abs(y1 - y0);
    if (tool === "line" || tool === "arrow") return { kind: tool, x, y, w, h, points: [[Math.round(x0 - x), Math.round(y0 - y)], [Math.round(x1 - x), Math.round(y1 - y)]] };
    return { kind: tool, x, y, w, h };
  };
  return (
    <div
      className="shape-drawer"
      aria-label="도형 그리기"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        const w = world(e);
        st.current = { x0: w.x, y0: w.y, pts: [[w.x, w.y]] };
      }}
      onPointerMove={(e) => {
        const s = st.current;
        if (!s) return;
        const w = world(e);
        if (tool === "pen") s.pts.push([w.x, w.y]);
        setDraft(shapeOf(s.x0, s.y0, w.x, w.y, s.pts, e.shiftKey));
      }}
      onPointerUp={(e) => {
        const s = st.current;
        st.current = null;
        setDraft(null);
        if (!s) return;
        const w = world(e);
        let sh = shapeOf(s.x0, s.y0, w.x, w.y, s.pts, e.shiftKey);
        // 그냥 눌렀으면 기본 크기
        if (sh.w < 4 && sh.h < 4) {
          if (tool === "pen") return;
          sh = tool === "line" || tool === "arrow" ? { kind: tool, x: s.x0, y: s.y0, w: 200, h: 0, points: [[0, 0], [200, 0]] } : { kind: tool, x: s.x0, y: s.y0, w: 200, h: 140 };
        }
        onDone({ ...sh, x: Math.round(sh.x), y: Math.round(sh.y), w: Math.round(sh.w), h: Math.round(sh.h) });
      }}
    >
      {draft && (
        <div className="world" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`, pointerEvents: "none" }}>
          <div className="shape" style={{ left: draft.x, top: draft.y, width: Math.max(1, draft.w), height: Math.max(1, draft.h) }}>
            <ShapeSvg s={{ ...draft, strokeWidth: 4 }} id="draft" />
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- 오른쪽 패널: 도형 옵션 ---------------- */
export function ShapeOptions({ shape, onPatch, onDelete, onFront, onBack }: { shape: Shape; onPatch: (p: Partial<Shape>) => void; onDelete: () => void; onFront: () => void; onBack: () => void }) {
  const KIND: Record<ShapeKind, string> = { rect: "사각형", oval: "타원", line: "선", arrow: "화살표", pen: "펜", image: "이미지" };
  const Swatches = ({ value, onPick, allowNone }: { value: string; onPick: (v: string) => void; allowNone?: boolean }) => (
    <span className="swatches">
      {SHAPE_COLORS.filter((c) => allowNone || c !== "none").map((c) => (
        <button key={c} className={`swatch ${value === c ? "on" : ""} ${c === "none" ? "none" : ""}`} title={c === "none" ? "없음" : c} aria-label={c === "none" ? "없음" : c} style={{ background: c === "none" ? undefined : c }} onClick={() => onPick(c)} />
      ))}
    </span>
  );
  return (
    <section className="board-opts" aria-label="도형 옵션">
      <div className="sec-head">
        <span>{KIND[shape.kind]}</span>
      </div>
      {shape.kind !== "image" && (
        <>
          <div className="field-row">
            <span>선 색</span>
            <Swatches value={shape.stroke ?? "#111111"} onPick={(v) => onPatch({ stroke: v })} />
          </div>
          {(shape.kind === "rect" || shape.kind === "oval") && (
            <div className="field-row">
              <span>채우기</span>
              <Swatches value={shape.fill ?? "none"} onPick={(v) => onPatch({ fill: v })} allowNone />
            </div>
          )}
          <label className="field-row">
            <span>굵기</span>
            <input type="range" min={1} max={24} value={shape.strokeWidth ?? 4} onChange={(e) => onPatch({ strokeWidth: Number(e.target.value) })} aria-label="선 굵기" />
          </label>
        </>
      )}
      <div className="muted small">
        {shape.w} × {shape.h} · ({shape.x}, {shape.y})
      </div>
      <div className="btn-row">
        <button className="icon-btn" aria-label="맨 앞으로" title="맨 앞으로" onClick={onFront}><Icon name="front" /></button>
        <button className="icon-btn" aria-label="맨 뒤로" title="맨 뒤로" onClick={onBack}><Icon name="back" /></button>
        <button className="icon-btn danger" aria-label="도형 삭제" title="삭제 (⌫)" onClick={onDelete}><Icon name="trash" /></button>
      </div>
    </section>
  );
}

/* ---------------- 오른쪽 패널: 메모 옵션 ---------------- */
export function NoteOptions({ note, onPatch, onDelete }: { note: Note; onPatch: (p: Partial<Note>) => void; onDelete: () => void }) {
  const title = note.kind === "title";
  const def = title ? 72 : 22;
  return (
    <section className="board-opts" aria-label="메모 옵션">
      <div className="sec-head">
        <span>{title ? "제목" : "포스트잇"}</span>
      </div>
      <label className="field-row">
        <span>글자 크기</span>
        <select value={note.size ?? def} onChange={(e) => onPatch({ size: Number(e.target.value) === def ? undefined : Number(e.target.value) })} aria-label="글자 크기">
          {(title ? [32, 48, 56, 72, 96, 128] : [14, 18, 22, 28, 36]).map((n) => (
            <option key={n} value={n}>
              {n}px{n === def ? " (기본)" : ""}
            </option>
          ))}
        </select>
      </label>
      <div className="btn-row" role="group" aria-label="글자 모양">
        <button className={`icon-btn ${note.bold ?? title ? "on" : ""}`} aria-pressed={!!(note.bold ?? title)} aria-label="굵게" title="굵게" onClick={() => onPatch({ bold: !(note.bold ?? title) })}>
          <strong>B</strong>
        </button>
        <button className={`icon-btn ${note.italic ? "on" : ""}`} aria-pressed={!!note.italic} aria-label="기울임" title="기울임" onClick={() => onPatch({ italic: !note.italic || undefined })}>
          <em>I</em>
        </button>
      </div>
      {!title && (
        <div className="field-row">
          <span>색</span>
          <span className="swatches">
            {STICKY_COLORS.map((c) => (
              <button key={c.id} className={`swatch ${(note.color ?? "yellow") === c.id ? "on" : ""}`} title={c.label} aria-label={`${c.label} 포스트잇`} style={{ background: c.bg }} onClick={() => onPatch({ color: c.id === "yellow" ? undefined : c.id })} />
            ))}
          </span>
        </div>
      )}
      {title ? (
        <div className="grid2">
          <NumIn label="최대 너비" value={note.maxW ?? 2000} onCommit={(v) => onPatch({ maxW: v })} />
          <NumIn label="최대 높이" value={note.maxH ?? 0} onCommit={(v) => onPatch({ maxH: v || undefined })} />
        </div>
      ) : (
        <div className="grid2">
          <NumIn label="너비" value={note.w ?? 400} onCommit={(v) => onPatch({ w: v })} />
          <NumIn label="높이" value={note.h ?? 0} onCommit={(v) => onPatch({ h: v || undefined })} />
        </div>
      )}
      <p className="muted small">{title ? "최대 너비·높이를 넘으면 글자가 줄어들어요(0은 제한 없음)." : "높이를 정하면 넘치는 글은 스크롤돼요(0은 내용만큼)."}</p>
      <div className="btn-row">
        <button className="icon-btn danger" aria-label="메모 삭제" title="삭제 (⌫)" onClick={onDelete}><Icon name="trash" /></button>
      </div>
    </section>
  );
}

function NumIn({ label, value, onCommit }: { label: string; value: number; onCommit: (v: number) => void }) {
  return (
    <label className="num">
      <span>{label}</span>
      <input
        key={value}
        inputMode="numeric"
        defaultValue={value}
        onBlur={(e) => {
          const n = Math.max(0, Math.round(Number(e.target.value)));
          if (Number.isFinite(n) && n !== value) onCommit(n);
        }}
        onKeyDown={(e) => !e.nativeEvent.isComposing && e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      />
    </label>
  );
}

/* ---------------- 레이아웃 가이드 ---------------- */
export const newGuide = (type: LayoutGuide["type"]): LayoutGuide =>
  type === "grid" ? { type, count: 0, gutter: 0, margin: 0, align: "stretch", size: 8, color: "#C94F0C" } : { type, count: type === "columns" ? 4 : 6, gutter: 16, margin: 20, align: "stretch", size: 80, color: "#C94F0C" };

/** 한 축의 칸 위치 [시작, 길이][] */
export function tracks(total: number, g: LayoutGuide): [number, number][] {
  const n = Math.max(1, Math.round(g.count));
  if (g.align === "stretch") {
    const inner = total - g.margin * 2;
    const size = (inner - g.gutter * (n - 1)) / n;
    return Array.from({ length: n }, (_, i) => [g.margin + i * (size + g.gutter), size]);
  }
  const span = n * g.size + (n - 1) * g.gutter;
  const start = g.align === "start" ? g.margin : g.align === "end" ? total - g.margin - span : (total - span) / 2;
  return Array.from({ length: n }, (_, i) => [start + i * (g.size + g.gutter), g.size]);
}

export function GuidesOverlay({ guides, w, h }: { guides: LayoutGuide[]; w: number; h: number }) {
  return (
    <div className="layout-guides" aria-hidden="true">
      {guides
        .filter((g) => !g.hidden)
        .map((g, i) =>
          g.type === "grid" ? (
            <div key={i} className="lg-grid" style={{ backgroundImage: `linear-gradient(to right, ${g.color}55 1px, transparent 1px), linear-gradient(to bottom, ${g.color}55 1px, transparent 1px)`, backgroundSize: `${g.size}px ${g.size}px` }} />
          ) : (
            tracks(g.type === "columns" ? w : h, g).map(([a, len], j) => (
              <div key={`${i}-${j}`} className="lg-track" style={g.type === "columns" ? { left: a, top: 0, width: len, height: h, background: `${g.color}1f` } : { top: a, left: 0, height: len, width: w, background: `${g.color}1f` }} />
            ))
          ),
        )}
    </div>
  );
}

export function GuidesEditor({ guides, onChange }: { guides: LayoutGuide[]; onChange: (g: LayoutGuide[], label: string) => void }) {
  const set = (i: number, patch: Partial<LayoutGuide>) => onChange(guides.map((g, j) => (j === i ? { ...g, ...patch } : g)), "레이아웃 가이드 고치기");
  const TYPE = { columns: "열", rows: "행", grid: "격자" } as const;
  return (
    <section className="board-opts guides-editor" aria-label="레이아웃 가이드">
      <div className="sec-head">
        <span>레이아웃 가이드 {guides.length}/{MAX_GUIDES}</span>
        <span className="btn-row">
          {(["columns", "rows", "grid"] as const).map((t) => (
            <button key={t} className="icon-btn sm" disabled={guides.length >= MAX_GUIDES} title={`${TYPE[t]} 가이드 추가`} aria-label={`${TYPE[t]} 가이드 추가`} onClick={() => onChange([...guides, newGuide(t)], "레이아웃 가이드 추가")}>
              <span className="small">{TYPE[t]}</span>
            </button>
          ))}
        </span>
      </div>
      {guides.length === 0 && <p className="muted small">열·행·격자 가이드를 6개까지 둘 수 있어요. 캔버스에서만 보이고 화면 HTML에는 안 들어가요. 모두 숨기기: ⌃G</p>}
      {guides.map((g, i) => (
        <div key={i} className="guide-row">
          <div className="guide-head">
            <strong>{TYPE[g.type]}</strong>
            <input type="color" value={g.color} onChange={(e) => set(i, { color: e.target.value })} aria-label="가이드 색" />
            <div className="spacer" />
            <button className="icon-btn sm" aria-label={g.hidden ? "보이기" : "숨기기"} title={g.hidden ? "보이기" : "숨기기"} onClick={() => set(i, { hidden: !g.hidden || undefined })}>
              <Icon name={g.hidden ? "close" : "check"} size={14} />
            </button>
            <button className="icon-btn sm danger" aria-label="가이드 삭제" title="삭제" onClick={() => onChange(guides.filter((_, j) => j !== i), "레이아웃 가이드 삭제")}>
              <Icon name="trash" size={14} />
            </button>
          </div>
          {g.type === "grid" ? (
            <div className="grid2">
              <NumIn label="칸" value={g.size} onCommit={(v) => set(i, { size: Math.max(2, v) })} />
            </div>
          ) : (
            <div className="grid2">
              <NumIn label="개수" value={g.count} onCommit={(v) => set(i, { count: Math.max(1, Math.min(48, v)) })} />
              <NumIn label="간격" value={g.gutter} onCommit={(v) => set(i, { gutter: v })} />
              <NumIn label="여백" value={g.margin} onCommit={(v) => set(i, { margin: v })} />
              {g.align !== "stretch" && <NumIn label="칸 크기" value={g.size} onCommit={(v) => set(i, { size: Math.max(1, v) })} />}
              <label className="field-row span2">
                <span>정렬</span>
                <select value={g.align} onChange={(e) => set(i, { align: e.target.value as LayoutGuide["align"] })} aria-label="가이드 정렬">
                  <option value="stretch">늘이기</option>
                  <option value="start">{g.type === "columns" ? "왼쪽" : "위"}</option>
                  <option value="center">가운데</option>
                  <option value="end">{g.type === "columns" ? "오른쪽" : "아래"}</option>
                </select>
              </label>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
