// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// 왼쪽 패널(페이지·보드 목록·검색), 미니맵, 보드 옵션, 한 보드 전체 화면 보기.
import { forwardRef, useEffect, useMemo, useRef, useState } from "react";

import type { Rect } from "./Canvas";
import { Icon } from "./icons";
import type { Board, BoardItem, Page, View } from "./types";

/* ---------------- 왼쪽 패널 ---------------- */
export const LeftPanel = forwardRef<HTMLInputElement, {
  board: Board;
  pages: Page[];
  currentPage: string | null;
  selected: string[];
  missing: string[];
  onPage: (id: string) => void;
  onAddPage: () => void;
  onPageMenu: (id: string, e: { clientX: number; clientY: number }) => void;
  onPick: (file: string, add: boolean) => void;
  onBoardMenu: (file: string, e: { clientX: number; clientY: number }) => void;
}>(function LeftPanel(p, searchRef) {
  const [q, setQ] = useState("");
  const firstPage = p.pages[0]?.id;
  const list = useMemo(() => {
    const k = q.trim().toLowerCase();
    return p.board.order.filter((f) => {
      const b = p.board.boards[f];
      if (!b) return false;
      if (k) return f.toLowerCase().includes(k) || (b.title ?? "").toLowerCase().includes(k);
      return !p.pages.length || (b.page ?? firstPage) === p.currentPage;
    });
  }, [q, p.board, p.pages, p.currentPage, firstPage]);
  return (
    <aside className="left" aria-label="페이지와 보드">
      <section className="left-pages">
        <div className="sec-head">
          <span>페이지</span>
          <button className="icon-btn sm" aria-label="페이지 추가" title="페이지 추가" onClick={p.onAddPage}>
            <Icon name="plus" size={14} />
          </button>
        </div>
        {p.pages.length === 0 ? (
          <p className="empty">한 판으로 보고 있어요. + 로 페이지를 나눌 수 있어요.</p>
        ) : (
          <ul role="tablist" aria-label="페이지">
            {p.pages.map((pg) => (
              <li key={pg.id}>
                <button role="tab" aria-selected={pg.id === p.currentPage} className={`row ${pg.id === p.currentPage ? "on" : ""}`} onClick={() => p.onPage(pg.id)} onContextMenu={(e) => { e.preventDefault(); p.onPageMenu(pg.id, e); }}>
                  <Icon name="page" size={14} />
                  <span className="row-text">{pg.name}</span>
                  <span className="row-count">{Object.values(p.board.boards).filter((b) => (b.page ?? firstPage) === pg.id).length}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="left-boards">
        <div className="sec-head">
          <span>보드 {list.length}</span>
        </div>
        <label className="search">
          <Icon name="search" size={14} />
          <input ref={searchRef} value={q} placeholder="보드 찾기 (⌘K)" aria-label="보드 찾기" onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => {
            if (e.key === "Enter" && list[0]) p.onPick(list[0], false);
            if (e.key === "Escape") {
              setQ("");
              (e.target as HTMLInputElement).blur();
            }
          }} />
        </label>
        {list.length === 0 ? (
          <p className="empty">{q ? `"${q}"에 맞는 보드가 없어요` : "이 페이지에 보드가 없어요. 도구 막대의 보드(B)로 그려 보세요."}</p>
        ) : (
          <ul className="board-list">
            {list.map((f) => {
              const b = p.board.boards[f];
              return (
                <li key={f}>
                  <button className={`row ${p.selected.includes(f) ? "on" : ""}`} onClick={(e) => p.onPick(f, e.shiftKey || e.metaKey)} onContextMenu={(e) => { e.preventDefault(); p.onBoardMenu(f, e); }} title={f}>
                    <Icon name="board" size={14} />
                    <span className="row-text">{b.title ?? f}</span>
                    {p.missing.includes(f) && <Icon name="warn" size={14} className="warn-icon" aria-label="파일 없음" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </aside>
  );
});

/* ---------------- 미니맵 ---------------- */
export function Minimap({ rects, selected, view, size, onJump }: { rects: (Rect & { file: string })[]; selected: string[]; view: View; size: { w: number; h: number }; onJump: (x: number, y: number) => void }) {
  const W = 200;
  const H = 130;
  const box = useMemo(() => {
    if (!rects.length) return { x: 0, y: 0, w: 1, h: 1 };
    const x = Math.min(...rects.map((r) => r.x));
    const y = Math.min(...rects.map((r) => r.y));
    return { x, y, w: Math.max(...rects.map((r) => r.x + r.w)) - x, h: Math.max(...rects.map((r) => r.y + r.h)) - y };
  }, [rects]);
  const s = Math.min(W / box.w, H / box.h);
  const ox = (W - box.w * s) / 2;
  const oy = (H - box.h * s) / 2;
  const vp = { x: (-view.x / view.zoom - box.x) * s + ox, y: (-view.y / view.zoom - box.y) * s + oy, w: (size.w / view.zoom) * s, h: (size.h / view.zoom) * s };
  const dragging = useRef(false);
  const jump = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const k = r.width / W; // 좁은 창에서는 CSS로 줄여 그린다
    onJump(((e.clientX - r.left) / k - ox) / s + box.x, ((e.clientY - r.top) / k - oy) / s + box.y);
  };
  return (
    <div
      className="minimap"
      role="img"
      aria-label="미니맵: 눌러서 그 자리로 이동"
      onPointerDown={(e) => {
        dragging.current = true;
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        jump(e);
      }}
      onPointerMove={(e) => dragging.current && jump(e)}
      onPointerUp={() => (dragging.current = false)}
    >
      <svg width={W} height={H}>
        {rects.map((r) => (
          <rect key={r.file} x={(r.x - box.x) * s + ox} y={(r.y - box.y) * s + oy} width={Math.max(1, r.w * s)} height={Math.max(1, r.h * s)} className={selected.includes(r.file) ? "mm-sel" : "mm-board"} />
        ))}
        <rect x={vp.x} y={vp.y} width={vp.w} height={vp.h} className="mm-view" />
      </svg>
    </div>
  );
}

/* ---------------- 보드 옵션 ---------------- */
export function BoardOptions(p: {
  file: string;
  item: BoardItem;
  pages: Page[];
  isLaunch: boolean;
  onPatch: (patch: Partial<BoardItem>) => void;
  onRename: () => void;
  onRenameFile: () => void;
  onFocus: () => void;
  onFront: () => void;
  onBack: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onLaunch: (on: boolean) => void;
}) {
  const b = p.item;
  const num = (k: "x" | "y" | "w" | "h" | "radius", label: string, min?: number, max?: number) => (
    <NumField key={k + p.file + (b[k] ?? "")} label={label} value={b[k] ?? 0} min={min} max={max} onCommit={(v) => p.onPatch({ [k]: v })} />
  );
  return (
    <section className="board-opts" aria-label="보드 옵션">
      <div className="sec-head">
        <span>보드</span>
      </div>
      <button className="title-btn" onClick={p.onRename} title="이름 바꾸기 (F2)">
        <strong>{b.title ?? p.file}</strong>
        <Icon name="edit" size={14} />
      </button>
      <button className="link file-btn" onClick={p.onRenameFile} title="파일 이름 바꾸기">
        {p.file}
      </button>
      <div className="grid2">
        {num("x", "X")}
        {num("y", "Y")}
        {num("w", "너비", 40, 8000)}
        {num("h", "높이", 40, 8000)}
        {num("radius", "모서리", 0, 200)}
      </div>
      <label className="check">
        <input type="checkbox" checked={!!b.is_interactive} onChange={(e) => p.onPatch({ is_interactive: e.target.checked || undefined })} />
        눌러 보는 보드(Play)
      </label>
      <label className="check">
        <input type="checkbox" checked={!!b.frameless} onChange={(e) => p.onPatch({ frameless: e.target.checked || undefined })} />
        틀 없이
      </label>
      <label className="check">
        <input type="checkbox" checked={b.expand === "fill"} onChange={(e) => p.onPatch({ expand: e.target.checked ? "fill" : undefined })} />
        페이지형(전체 화면에서 창 채우기)
      </label>
      <label className="check">
        <input type="checkbox" checked={p.isLaunch} onChange={(e) => p.onLaunch(e.target.checked)} />
        시작 화면으로 열기
      </label>
      {p.pages.length > 0 && (
        <label className="field-row">
          <span>페이지</span>
          <select value={b.page ?? p.pages[0].id} onChange={(e) => p.onPatch({ page: e.target.value })}>
            {p.pages.map((pg) => (
              <option key={pg.id} value={pg.id}>
                {pg.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="btn-row">
        <button className="icon-btn" aria-label="전체 화면 보기" title="전체 화면 보기 (F)" onClick={p.onFocus}><Icon name="focus" /></button>
        <button className="icon-btn" aria-label="맨 앞으로" title="맨 앞으로 (⌘])" onClick={p.onFront}><Icon name="front" /></button>
        <button className="icon-btn" aria-label="맨 뒤로" title="맨 뒤로 (⌘[)" onClick={p.onBack}><Icon name="back" /></button>
        <button className="icon-btn" aria-label="복제" title="복제 (⌘D)" onClick={p.onDuplicate}><Icon name="copy" /></button>
        <button className="icon-btn danger" aria-label="삭제" title="삭제 (Delete)" onClick={p.onDelete}><Icon name="trash" /></button>
      </div>
    </section>
  );
}

function NumField({ label, value, min, max, onCommit }: { label: string; value: number; min?: number; max?: number; onCommit: (v: number) => void }) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  const commit = () => {
    let n = Math.round(Number(v));
    if (!Number.isFinite(n)) return setV(String(value));
    if (min != null) n = Math.max(min, n);
    if (max != null) n = Math.min(max, n);
    if (n !== value) onCommit(n);
    setV(String(n));
  };
  return (
    <label className="num">
      <span>{label}</span>
      <input inputMode="numeric" value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          const n = Number(v) + (e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 10 : 1);
          setV(String(n));
        }
      }} />
    </label>
  );
}

/* ---------------- 한 보드 전체 화면 보기 ---------------- */
export function FocusView({ board, file, onClose, onNav }: { board: Board; file: string; onClose: () => void; onNav: (f: string) => void }) {
  const b = board.boards[file];
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const list = board.order.filter((f) => board.boards[f]);
  const i = list.indexOf(file);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && list[i + 1]) onNav(list[i + 1]);
      if (e.key === "ArrowLeft" && list[i - 1]) onNav(list[i - 1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [file, onClose, onNav, i, list]);
  useEffect(() => {
    const fit = () => {
      const el = ref.current;
      if (!el || !b) return;
      setScale(Math.min(1, (el.clientWidth - 48) / b.w, (el.clientHeight - 48) / b.h));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [b]);
  if (!b) return null;
  const fill = b.expand === "fill";
  return (
    <div className="focus" role="dialog" aria-modal="true" aria-label={`${b.title ?? file} 전체 화면`}>
      <div className="focus-bar">
        <button className="icon-btn" aria-label="이전 보드" disabled={!list[i - 1]} onClick={() => onNav(list[i - 1])}><Icon name="chevronRight" style={{ transform: "rotate(180deg)" }} /></button>
        <button className="icon-btn" aria-label="다음 보드" disabled={!list[i + 1]} onClick={() => onNav(list[i + 1])}><Icon name="chevronRight" /></button>
        <strong>{b.title ?? file}</strong>
        <span className="muted">{file}{fill ? " · 페이지형" : ` · ${b.w}×${b.h} · ${Math.round(scale * 100)}%`}</span>
        <div className="spacer" />
        <button onClick={onClose}>닫기 <kbd>Esc</kbd></button>
      </div>
      <div ref={ref} className={`focus-stage ${fill ? "fill" : ""}`}>
        {fill ? (
          <iframe src={`/screens/${file}`} title={b.title ?? file} className="focus-fill" />
        ) : (
          <div className="focus-frame" style={{ width: b.w * scale, height: b.h * scale, borderRadius: (b.radius ?? 0) * scale }}>
            <iframe src={`/screens/${file}`} title={b.title ?? file} style={{ width: b.w, height: b.h, transform: `scale(${scale})`, transformOrigin: "0 0" }} />
          </div>
        )}
      </div>
    </div>
  );
}
