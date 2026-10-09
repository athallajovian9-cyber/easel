// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// 앱 셸: board.json 상태, 페이지 탭, 도구 막대, 저장. PLAN.md 5장.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api, clientId, connectEvents, type ServerEvent } from "./api";
import { Canvas, fitView, isTyping } from "./Canvas";
import { elementAt, inlineStyles, rectOf } from "./editor";
import { Inspector, type Comment } from "./Inspector";
import { Layers } from "./Layers";
import { Play } from "./Play";
import { Properties } from "./Properties";
import { useEditMode } from "./useEditMode";
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
  const frames = useRef(new Map<string, HTMLIFrameElement>());
  const [frameTick, setFrameTick] = useState(0);
  const [comments, setComments] = useState<Comment[]>([]);
  const getFrame = useCallback((f: string) => frames.current.get(f) ?? null, [frameTick]);
  const editRef = useRef<ReturnType<typeof useEditMode> | null>(null);
  /** 원본 패치 요청(해시가 다르면 서버가 거부) */
  const doEdit = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!editFile) return false;
      try {
        await api.post("/api/edit", { file: editFile, ...payload });
        return true;
      } catch (e) {
        editRef.current?.setError(String((e as Error).message));
        return false;
      }
    },
    [editFile],
  );
  /** 더블클릭: 글자 하나만 있는 요소를 그 자리에서 고친다. Enter·포커스 이탈에 setText */
  const onTextEdit = useCallback(
    (el: HTMLElement, path: string) => {
      if (el.children.length) {
        editRef.current?.setError("글자 하나만 있는 요소만 바로 고칠 수 있어요");
        return;
      }
      const before = el.textContent ?? "";
      el.contentEditable = "true";
      el.focus();
      const doc = el.ownerDocument;
      const r = doc.createRange();
      r.selectNodeContents(el);
      doc.getSelection()?.removeAllRanges();
      doc.getSelection()?.addRange(r);
      let cancelled = false;
      const finish = async () => {
        el.removeEventListener("keydown", onKey);
        el.contentEditable = "false";
        const text = el.textContent ?? "";
        if (cancelled || text === before) {
          el.textContent = before;
          return;
        }
        const { hash } = await api.get<{ hash: string }>(`/api/element?f=${encodeURIComponent(editFile!)}&path=${encodeURIComponent(path)}`);
        if (!(await doEdit({ op: "setText", path, hash, text }))) el.textContent = before;
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          el.blur();
        } else if (e.key === "Escape") {
          cancelled = true;
          el.blur();
        }
      };
      el.addEventListener("keydown", onKey);
      el.addEventListener("blur", () => void finish(), { once: true });
    },
    [editFile, doEdit],
  );
  const edit = useEditMode(editFile, getFrame, { onTextEdit });
  editRef.current = edit;
  const loadComments = useCallback(() => api.get<{ comments: Comment[] }>("/api/comments").then((r) => setComments(r.comments)).catch(() => {}), []);
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
    void loadComments();
  }, [load, loadComments]);

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
        else if (e.type === "comments-changed") void loadComments();
      }),
    [load, loadComments],
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

  // 단축키: ⌘Z/⌘⇧Z 실행 취소·다시(서버 기록), Delete로 메모 삭제
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      if (editFile && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        api.post(e.shiftKey ? "/api/redo" : "/api/undo", { file: editFile }).catch((err) => edit.setError(String(err.message)));
        return;
      }
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
  }, [selectedNote, update, editFile, edit]);

  /** 보드 위 오버레이: 편집 중이면 외곽선·선택, 댓글 핀 */
  const renderOverlay = (f: string) => {
    const pins = comments.filter((c) => c.file === f && !c.resolved);
    const doc = frames.current.get(f)?.contentDocument;
    const editing = editFile === f;
    if (!editing && !pins.length) return null;
    return (
      <div className="overlay">
        {editing && edit.state.hover && !edit.state.paths.includes(edit.state.hover.path) && <Box r={edit.state.hover.rect} cls="hover" />}
        {editing && edit.state.rects.map((r, i) => <Box key={i} r={r} cls="sel" />)}
        {pins.map((c, i) => {
          const el = doc && c.path ? elementAt(doc, c.path) : null;
          const r = el ? rectOf(el) : null;
          return (
            <div
              key={c.id}
              className="pin"
              title={c.text}
              style={r ? { left: r.x + r.w - 12, top: r.y - 12, transform: `scale(${1 / Math.max(view.zoom, 0.25)})` } : { right: 8, top: 8 + i * 30, transform: `scale(${1 / Math.max(view.zoom, 0.25)})` }}
            >
              {i + 1}
            </div>
          );
        })}
      </div>
    );
  };

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
      <div className="main">
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
        onEdit={(f) => {
          setEditFile(f);
          if (f) setSelectedBoard(f);
        }}
        onSize={setCanvasSize}
        renderBoardOverlay={renderOverlay}
        iframeRef={(f, el) => {
          // ref 콜백은 렌더마다 null → el로 다시 불린다. 정말 새 iframe일 때만 갱신한다
          if (el && frames.current.get(f) !== el) {
            frames.current.set(f, el);
            setFrameTick((t) => t + 1);
          }
        }}
      />
      <Inspector
        file={editFile ?? selectedBoard}
        editing={!!editFile}
        selection={edit.state.selection}
        multi={edit.state.paths.length}
        error={edit.state.error}
        comments={comments}
        onSelectPath={(p) => editFile && void edit.select([p])}
      >
        {editFile && edit.state.selection && edit.state.selection.file === editFile && (() => {
          const sel = edit.state.selection;
          const el = frames.current.get(editFile)?.contentDocument ? elementAt(frames.current.get(editFile)!.contentDocument!, sel.path) : null;
          const attrs: Record<string, string> = {};
          if (el) for (const a of Array.from(el.attributes)) attrs[a.name] = a.value;
          const paths = edit.state.paths;
          return (
            <Properties
              selection={sel}
              inline={el ? inlineStyles(el) : {}}
              attrs={attrs}
              canWrap={paths.length >= 2}
              onStyle={(prop, value) => void doEdit({ op: "setStyle", path: sel.path, hash: sel.hash, prop, value })}
              onAttr={(name, value) => void doEdit({ op: "setAttr", path: sel.path, hash: sel.hash, name, value })}
              onDuplicate={() => void doEdit({ op: "duplicate", path: sel.path, hash: sel.hash })}
              onDelete={async () => {
                if (await doEdit({ op: "delete", path: sel.path, hash: sel.hash })) void edit.select([]);
              }}
              onWrap={async (display) => {
                const ordered = [...paths].sort((a, b) => Number(a.split("/").pop()) - Number(b.split("/").pop()));
                const hashes = await Promise.all(ordered.map((p) => api.get<{ hash: string }>(`/api/element?f=${encodeURIComponent(editFile)}&path=${encodeURIComponent(p)}`).then((r) => r.hash)));
                if (await doEdit({ op: "wrap", paths: ordered, hashes, display })) void edit.select([ordered[0]]);
              }}
            />
          );
        })()}
        {editFile && (
          <Layers
            file={editFile}
            version={reloadKeys[editFile] ?? 0}
            selected={edit.state.paths}
            onSelect={(p, add) => {
              const cur = edit.state.paths;
              void edit.select(add ? (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]) : [p]);
            }}
            onMove={async (path, toParentPath, index) => {
              const { hash } = await api.get<{ hash: string }>(`/api/element?f=${encodeURIComponent(editFile)}&path=${encodeURIComponent(path)}`);
              if (await doEdit({ op: "move", path, hash, toParentPath, index })) {
                void edit.select([toParentPath ? `${toParentPath}/${index}` : String(index)]);
              }
            }}
          />
        )}
      </Inspector>
      </div>
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

function Box({ r, cls }: { r: { x: number; y: number; w: number; h: number }; cls: string }) {
  return <div className={`box ${cls}`} style={{ left: r.x, top: r.y, width: r.w, height: r.h }} />;
}
