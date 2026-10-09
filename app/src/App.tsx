// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// 앱 셸: board.json 상태, 페이지 탭, 도구 막대, 저장. PLAN.md 5장.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api, clientId, connectEvents, type ServerEvent } from "./api";
import { Canvas, fitView, isTyping } from "./Canvas";
import { Play } from "./Play";
import type { Board, BoardItem, BoardResponse, Note, View } from "./types";

const SAVE_DELAY = 300;

export function App() {
  const [data, setData] = useState<BoardResponse | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 0.1 });
  const [page, setPage] = useState<string | null>(null);
  const [selectedBoard, setSelectedBoard] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [editFile, setEditFile] = useState<string | null>(null);
  const [playFile, setPlayFile] = useState<string | null>(null);
  const [reloadKeys, setReloadKeys] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number } | null>(null);
  const fitted = useRef(false);
  const saveTimer = useRef<number | null>(null);
  const boardRef = useRef<Board | null>(null);
  boardRef.current = board;

  const load = useCallback(async (fit: boolean) => {
    try {
      const d = await api.board();
      setData(d);
      setBoard(d.board);
      setError(null);
    } catch (e) {
      setError(String((e as Error).message));
    }
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  // 처음 한 번: 보드와 캔버스 크기를 둘 다 알면 전체 보기
  useEffect(() => {
    if (fitted.current || !board || !canvasSize) return;
    fitted.current = true;
    setView(fitView(Object.values(board.boards), canvasSize));
  }, [board, canvasSize]);

  /** 상태를 바꾸고 잠시 뒤 board.json에 저장 */
  const update = useCallback((fn: (b: Board) => Board, saveNow = false) => {
    setBoard((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      boardRef.current = next;
      return next;
    });
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(
      () => {
        if (boardRef.current) api.saveBoard(boardRef.current).catch((e) => setError(`저장 실패: ${e.message}`));
      },
      saveNow ? 0 : SAVE_DELAY,
    );
  }, []);

  // 서버 알림: 파일이 바뀐 보드만 다시 불러오고, 다른 창에서 board.json이 바뀌면 다시 읽는다
  useEffect(
    () =>
      connectEvents((e: ServerEvent) => {
        if (e.type === "file-changed") {
          setReloadKeys((k) => ({ ...k, [e.file]: (k[e.file] ?? 0) + 1 }));
          if (e.kind !== "change") void load(false);
        } else if (e.type === "board-changed" && e.source !== clientId) void load(false);
      }),
    [load],
  );

  const pages = board?.pages ?? [];
  const currentPage = page ?? pages[0]?.id ?? null;
  const onPage = useCallback(
    (item: { page?: string }) => !pages.length || (item.page ?? pages[0].id) === currentPage,
    [pages, currentPage],
  );
  const visibleBoards = useMemo(() => (board ? board.order.filter((f) => board.boards[f] && onPage(board.boards[f])) : []), [board, onPage]);
  const visibleNotes = useMemo(() => (board ? Object.keys(board.notes).filter((id) => onPage(board.notes[id])) : []), [board, onPage]);

  const fitAll = () => {
    if (!board) return;
    const rects = [
      ...visibleBoards.map((f) => board.boards[f]),
      ...visibleNotes.map((id) => {
        const n = board.notes[id];
        return { x: n.x, y: n.y, w: n.w ?? n.maxW ?? 400, h: n.kind === "title" ? 90 : 200 };
      }),
    ];
    setView(fitView(rects, canvasSize ?? { w: window.innerWidth, h: window.innerHeight - 48 }));
  };
  const goSelected = () => {
    if (!board || !selectedBoard) return;
    const b = board.boards[selectedBoard];
    setView(fitView([b], canvasSize ?? { w: window.innerWidth, h: window.innerHeight - 48 }, 80));
  };

  const addNote = (kind: Note["kind"]) => {
    const id = `n${Date.now().toString(36)}`;
    const cx = (window.innerWidth / 2 - view.x) / view.zoom;
    const cy = (window.innerHeight / 2 - view.y) / view.zoom;
    update((b) => ({
      ...b,
      notes: {
        ...b.notes,
        [id]:
          kind === "title"
            ? { kind, x: Math.round(cx), y: Math.round(cy), text: "새 제목", maxW: 2000, ...(currentPage && pages.length ? { page: currentPage } : {}) }
            : { kind, x: Math.round(cx), y: Math.round(cy), text: "메모", w: 400, ...(currentPage && pages.length ? { page: currentPage } : {}) },
      },
    }));
    setSelectedNote(id);
  };

  const addPage = () => {
    const name = prompt("새 페이지 이름", `페이지 ${pages.length + 1}`);
    if (!name) return;
    const id = `p${Date.now().toString(36)}`;
    update((b) => {
      // 첫 페이지를 만들면 지금 보드·메모는 모두 그 페이지에 그대로 남는다(page 없는 항목 = 첫 페이지)
      const nextPages = b.pages.length ? [...b.pages, { id, name }] : [{ id: "main", name: "기본" }, { id, name }];
      return { ...b, pages: nextPages };
    }, true);
    setPage(id);
  };
  const renamePage = (id: string) => {
    const p = pages.find((x) => x.id === id);
    const name = prompt("페이지 이름", p?.name);
    if (!name) return;
    update((b) => ({ ...b, pages: b.pages.map((x) => (x.id === id ? { ...x, name } : x)) }), true);
  };
  const moveSelectedToPage = (id: string) => {
    if (!selectedBoard) return;
    update((b) => ({ ...b, boards: { ...b.boards, [selectedBoard]: { ...b.boards[selectedBoard], page: id } } }), true);
  };

  // 단축키: Delete로 메모 삭제, Esc로 편집 모드 끄기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedNote) {
        update((b) => {
          const { [selectedNote]: _, ...rest } = b.notes;
          return { ...b, notes: rest };
        }, true);
        setSelectedNote(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedNote, update]);

  if (!board || !data) return <div className="loading">{error ?? "불러오는 중…"}</div>;

  return (
    <div className="app">
      <header className="toolbar">
        <strong className="app-title">{board.title}</strong>
        <nav className="pages">
          {pages.map((p) => (
            <button key={p.id} className={`tab ${p.id === currentPage ? "on" : ""}`} onClick={() => setPage(p.id)} onDoubleClick={() => renamePage(p.id)}>
              {p.name}
            </button>
          ))}
          <button className="tab add" onClick={addPage} title="페이지 추가">
            + 페이지
          </button>
        </nav>
        <div className="spacer" />
        {selectedBoard && pages.length > 0 && (
          <select value="" onChange={(e) => e.target.value && moveSelectedToPage(e.target.value)} title="선택 보드를 다른 페이지로">
            <option value="">페이지로 옮기기…</option>
            {pages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        <button onClick={() => addNote("title")}>+ 제목</button>
        <button onClick={() => addNote("sticky")}>+ 메모</button>
        <button onClick={fitAll}>전체 보기</button>
        <button onClick={goSelected} disabled={!selectedBoard}>
          선택 보드로
        </button>
        <span className="zoom">{Math.round(view.zoom * 100)}%</span>
        {data.missing.length > 0 && (
          <span className="warn" title={data.missing.join("\n")}>
            파일 없는 보드 {data.missing.length}
          </span>
        )}
        {error && <span className="warn">{error}</span>}
      </header>
      <Canvas
        board={board}
        files={data.files}
        view={view}
        setView={setView}
        visibleBoards={visibleBoards}
        visibleNotes={visibleNotes}
        selectedBoard={selectedBoard}
        selectedNote={selectedNote}
        editFile={editFile}
        reloadKeys={reloadKeys}
        onSelectBoard={(f) => {
          setSelectedBoard(f);
          if (f) setSelectedNote(null);
        }}
        onSelectNote={(id) => {
          setSelectedNote(id);
          if (id) setSelectedBoard(null);
        }}
        onMoveBoard={(f, patch: Partial<BoardItem>, done) =>
          update((b) => ({ ...b, boards: { ...b.boards, [f]: { ...b.boards[f], ...patch, autoPlaced: undefined } } }), done)
        }
        onMoveNote={(id, patch, done) => update((b) => ({ ...b, notes: { ...b.notes, [id]: { ...b.notes[id], ...patch } } }), done)}
        onDeleteNote={(id) => {
          update((b) => {
            const { [id]: _, ...rest } = b.notes;
            return { ...b, notes: rest };
          }, true);
          setSelectedNote(null);
        }}
        onPlay={setPlayFile}
        onEdit={setEditFile}
        onSize={setCanvasSize}
      />
      {playFile && (
        <Play
          board={board}
          file={playFile}
          onClose={() => setPlayFile(null)}
          onLocate={(f) => {
            setSelectedBoard(f);
            const b = board.boards[f];
            if (b) setView(fitView([b], canvasSize ?? { w: window.innerWidth, h: window.innerHeight - 48 }, 80));
          }}
        />
      )}
    </div>
  );
}
