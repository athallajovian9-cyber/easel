// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// 무한 캔버스: 이동·확대, 보드(iframe)·이름표·크기 조절, 메모. PLAN.md 5장.
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from "react";

import type { Board, BoardItem, Note, View } from "./types";

// PLAN은 10%였지만 보드 98장 전체(높이 약 17,700)를 한 화면에 보이려고 4%까지 허용
export const MIN_ZOOM = 0.04;
export const MAX_ZOOM = 4;
/** 이 확대율보다 작으면 iframe 대신 빈 틀(PLAN.md 9장) */
export const IFRAME_MIN_ZOOM = 0.25;

type Props = {
  board: Board;
  files: string[];
  view: View;
  setView: (v: View | ((v: View) => View)) => void;
  visibleBoards: string[];
  visibleNotes: string[];
  selectedBoard: string | null;
  selectedNote: string | null;
  editFile: string | null;
  reloadKeys: Record<string, number>;
  onSelectBoard: (f: string | null) => void;
  onSelectNote: (id: string | null) => void;
  onMoveBoard: (f: string, patch: Partial<BoardItem>, done: boolean) => void;
  onMoveNote: (id: string, patch: Partial<Note>, done: boolean) => void;
  onDeleteNote: (id: string) => void;
  onPlay: (f: string) => void;
  onEdit: (f: string | null) => void;
  renderBoardOverlay?: (f: string) => ReactNode;
  iframeRef?: (f: string, el: HTMLIFrameElement | null) => void;
  onSize?: (s: { w: number; h: number }) => void;
};

export function Canvas(p: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1200, h: 800 });
  const [space, setSpace] = useState(false);
  const panRef = useRef<{ sx: number; sy: number; vx: number; vy: number } | null>(null);

  useLayoutEffect(() => {
    const el = rootRef.current!;
    const ro = new ResizeObserver(() => {
      const s = { w: el.clientWidth, h: el.clientHeight };
      setSize(s);
      p.onSize?.(s);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 휠: ⌘/Ctrl이면 커서 기준 확대, 아니면 이동(트랙패드)
  useEffect(() => {
    const el = rootRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      if (e.ctrlKey || e.metaKey) {
        p.setView((v) => {
          const z = clamp(v.zoom * Math.exp(-e.deltaY * 0.0025), MIN_ZOOM, MAX_ZOOM);
          const wx = (mx - v.x) / v.zoom;
          const wy = (my - v.y) / v.zoom;
          return { zoom: z, x: mx - wx * z, y: my - wy * z };
        });
      } else {
        p.setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [p.setView]);

  // 스페이스를 누르고 있으면 어디서든 끌어서 이동
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isTyping(e)) {
        e.preventDefault();
        setSpace(true);
      }
    };
    const up = (e: KeyboardEvent) => e.code === "Space" && setSpace(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const startPan = (e: RPointerEvent) => {
    panRef.current = { sx: e.clientX, sy: e.clientY, vx: p.view.x, vy: p.view.y };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const movePan = (e: RPointerEvent) => {
    const s = panRef.current;
    if (!s) return;
    p.setView((v) => ({ ...v, x: s.vx + e.clientX - s.sx, y: s.vy + e.clientY - s.sy }));
  };
  const endPan = () => (panRef.current = null);

  const onBgDown = (e: RPointerEvent) => {
    if (e.button === 1 || e.button === 0) {
      if (e.target === e.currentTarget || e.button === 1) {
        if (e.button === 0) {
          p.onSelectBoard(null);
          p.onSelectNote(null);
        }
        startPan(e);
      }
    }
  };

  const { view } = p;
  const vw = size.w / view.zoom;
  const vh = size.h / view.zoom;
  const vx = -view.x / view.zoom;
  const vy = -view.y / view.zoom;
  const inView = (b: { x: number; y: number; w: number; h: number }) =>
    b.x + b.w > vx - 200 && b.x < vx + vw + 200 && b.y + b.h > vy - 200 && b.y < vy + vh + 200;

  return (
    <div
      ref={rootRef}
      className={`canvas ${space ? "panning" : ""}`}
      onPointerDown={onBgDown}
      onPointerMove={movePan}
      onPointerUp={endPan}
      onAuxClick={(e) => e.preventDefault()}
    >
      <div className="world" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}>
        {p.visibleNotes.map((id) => (
          <NoteView
            key={id}
            id={id}
            note={p.board.notes[id]}
            zoom={view.zoom}
            selected={p.selectedNote === id}
            onSelect={() => p.onSelectNote(id)}
            onMove={(patch, done) => p.onMoveNote(id, patch, done)}
            onDelete={() => p.onDeleteNote(id)}
          />
        ))}
        {p.visibleBoards.map((f) => {
          const b = p.board.boards[f];
          const live = inView(b) && (view.zoom >= IFRAME_MIN_ZOOM || p.editFile === f);
          return (
            <BoardView
              key={f}
              file={f}
              item={b}
              exists={p.files.includes(f)}
              zoom={view.zoom}
              live={live}
              selected={p.selectedBoard === f}
              editing={p.editFile === f}
              reloadKey={p.reloadKeys[f] ?? 0}
              onSelect={() => p.onSelectBoard(f)}
              onMove={(patch, done) => p.onMoveBoard(f, patch, done)}
              onPlay={() => p.onPlay(f)}
              onEdit={() => p.onEdit(p.editFile === f ? null : f)}
              overlay={p.renderBoardOverlay?.(f)}
              iframeRef={(el) => p.iframeRef?.(f, el)}
            />
          );
        })}
      </div>
      {space && <div className="pan-capture" onPointerDown={startPan} onPointerMove={movePan} onPointerUp={endPan} />}
    </div>
  );
}

function BoardView(props: {
  file: string;
  item: BoardItem;
  exists: boolean;
  zoom: number;
  live: boolean;
  selected: boolean;
  editing: boolean;
  reloadKey: number;
  onSelect: () => void;
  onMove: (patch: Partial<BoardItem>, done: boolean) => void;
  onPlay: () => void;
  onEdit: () => void;
  overlay?: ReactNode;
  iframeRef: (el: HTMLIFrameElement | null) => void;
}) {
  const { item: b, zoom } = props;
  const drag = useDrag(zoom);
  // 이름표는 화면에서 같은 크기로 보이게 확대율의 역수로 키운다
  const labelScale = 1 / zoom;
  return (
    <div
      className={`board ${props.selected ? "selected" : ""} ${props.editing ? "editing" : ""}`}
      style={{ left: b.x, top: b.y, width: b.w, height: b.h }}
      data-file={props.file}
    >
      <div
        className="board-label"
        style={{ transform: `scale(${labelScale})`, width: b.w * zoom }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          props.onSelect();
          drag.start(e, { x: b.x, y: b.y }, (d, done) => props.onMove({ x: Math.round(d.x), y: Math.round(d.y) }, done));
        }}
        onPointerMove={drag.move}
        onPointerUp={drag.end}
        onDoubleClick={(e) => {
          e.stopPropagation();
          props.onEdit();
        }}
      >
        <span className="board-title">{b.title ?? props.file}</span>
        {b.w * zoom >= 160 && <span className="board-file">{props.file}</span>}
        {b.w * zoom >= 90 && (
          <>
        <button
          className="board-btn"
          title="Play"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            props.onPlay();
          }}
        >
          ▶
        </button>
        <button
          className={`board-btn ${props.editing ? "on" : ""}`}
          title="편집 모드(보드 더블클릭)"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            props.onEdit();
          }}
        >
          ✎
        </button>
          </>
        )}
      </div>
      <div
        className="board-frame"
        onDoubleClick={(e) => {
          if (!props.editing) {
            e.stopPropagation();
            props.onEdit();
          }
        }}
        onPointerDown={(e) => {
          if (e.button === 0 && !props.editing) {
            e.stopPropagation();
            props.onSelect();
          }
        }}
      >
        {!props.exists ? (
          <div className="board-missing">파일 없음</div>
        ) : props.live ? (
          <iframe
            key={props.reloadKey}
            ref={props.iframeRef}
            src={`/screens/${props.file}`}
            title={b.title ?? props.file}
            style={{ pointerEvents: props.editing ? "auto" : "none" }}
          />
        ) : (
          <div className="board-placeholder" style={{ fontSize: Math.min(64, 18 / zoom) }}>
            {b.title ?? props.file}
          </div>
        )}
        {props.overlay}
      </div>
      <div
        className="board-resize"
        style={{ width: 16 / zoom, height: 16 / zoom }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          drag.start(e, { x: b.w, y: b.h }, (d, done) =>
            props.onMove({ w: Math.max(40, Math.round(d.x)), h: Math.max(40, Math.round(d.y)) }, done),
          );
        }}
        onPointerMove={drag.move}
        onPointerUp={drag.end}
      />
    </div>
  );
}

function NoteView(props: {
  id: string;
  note: Note;
  zoom: number;
  selected: boolean;
  onSelect: () => void;
  onMove: (patch: Partial<Note>, done: boolean) => void;
  onDelete: () => void;
}) {
  const { note: n } = props;
  const drag = useDrag(props.zoom);
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      const r = document.createRange();
      r.selectNodeContents(ref.current);
      const s = getSelection();
      s?.removeAllRanges();
      s?.addRange(r);
    }
  }, [editing]);
  const style =
    n.kind === "title"
      ? { left: n.x, top: n.y, maxWidth: n.maxW ?? 4000 }
      : { left: n.x, top: n.y, width: n.w ?? 320 };
  return (
    <div
      className={`note note-${n.kind} ${props.selected ? "selected" : ""}`}
      style={style}
      onPointerDown={(e) => {
        if (editing || e.button !== 0) return;
        e.stopPropagation();
        props.onSelect();
        drag.start(e, { x: n.x, y: n.y }, (d, done) => props.onMove({ x: Math.round(d.x), y: Math.round(d.y) }, done));
      }}
      onPointerMove={drag.move}
      onPointerUp={drag.end}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
    >
      <div
        ref={ref}
        className="note-text"
        contentEditable={editing}
        suppressContentEditableWarning
        onBlur={(e) => {
          setEditing(false);
          const text = (e.currentTarget as HTMLDivElement).innerText;
          if (text !== n.text) props.onMove({ text }, true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") (e.currentTarget as HTMLDivElement).blur();
        }}
      >
        {n.text}
      </div>
      {props.selected && !editing && (
        <button
          className="note-del"
          style={{ transform: `scale(${1 / props.zoom})` }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            props.onDelete();
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

/** 포인터로 끌기: 시작값 + (이동량 / 확대율) */
function useDrag(zoom: number) {
  const s = useRef<{ sx: number; sy: number; ox: number; oy: number; cb: (d: { x: number; y: number }, done: boolean) => void; moved: boolean } | null>(null);
  return {
    start(e: RPointerEvent, origin: { x: number; y: number }, cb: (d: { x: number; y: number }, done: boolean) => void) {
      s.current = { sx: e.clientX, sy: e.clientY, ox: origin.x, oy: origin.y, cb, moved: false };
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    },
    move(e: RPointerEvent) {
      const d = s.current;
      if (!d) return;
      const dx = (e.clientX - d.sx) / zoom;
      const dy = (e.clientY - d.sy) / zoom;
      if (!d.moved && Math.abs(dx) + Math.abs(dy) < 2 / zoom) return;
      d.moved = true;
      d.cb({ x: d.ox + dx, y: d.oy + dy }, false);
    },
    end(e: RPointerEvent) {
      const d = s.current;
      s.current = null;
      if (!d || !d.moved) return;
      d.cb({ x: d.ox + (e.clientX - d.sx) / zoom, y: d.oy + (e.clientY - d.sy) / zoom }, true);
    },
  };
}

export function clamp(v: number, a: number, b: number) {
  return Math.min(b, Math.max(a, v));
}

export function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
}

/** 보드·메모 묶음이 화면에 꽉 차게 */
export function fitView(rects: { x: number; y: number; w: number; h: number }[], size: { w: number; h: number }, pad = 60): View {
  if (!rects.length) return { x: 0, y: 0, zoom: 1 };
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.w));
  const maxY = Math.max(...rects.map((r) => r.y + r.h));
  const zoom = clamp(Math.min((size.w - pad * 2) / (maxX - minX), (size.h - pad * 2) / (maxY - minY)), MIN_ZOOM, MAX_ZOOM);
  return { zoom, x: pad - minX * zoom + (size.w - pad * 2 - (maxX - minX) * zoom) / 2, y: pad - minY * zoom + (size.h - pad * 2 - (maxY - minY) * zoom) / 2 };
}
