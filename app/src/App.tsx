// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// 앱 셸: board.json 상태, 도구 막대, 왼쪽(페이지·보드)·오른쪽(검사기) 패널, 우클릭 메뉴, 하나의 실행 취소 기록. PLAN.md 5장.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api, clientId, connectEvents, type ServerEvent } from "./api";
import { Canvas, clamp, fitView, isTyping, MAX_ZOOM, MIN_ZOOM, type ContextTarget, type Rect } from "./Canvas";
import { AssetGrid, AssetPicker, type Asset } from "./assets";
import { ChatPanel, type Attach, type ChatEvent } from "./chat";
import { alignOps, EditHandles, type DropPlan } from "./elementDrag";
import { elementAt, inlineStyles, rectOf } from "./editor";
import { Icon, type IconName } from "./icons";
import { Inspector, type Comment } from "./Inspector";
import { Layers } from "./Layers";
import { BoardOptions, FocusView, LeftPanel, Minimap } from "./panels";
import { Play } from "./Play";
import { Properties } from "./Properties";
import { ContextMenu, Dialog, useDialog, useToast, type MenuItem, type MenuState } from "./ui";
import { useEditMode } from "./useEditMode";
import type { Board, BoardItem, BoardResponse, Note, Tool, View } from "./types";

const DRAFT_SAVE_DELAY = 400;
const mod = navigator.platform.includes("Mac") ? "⌘" : "Ctrl+";

type Saved = { view?: View; page?: string | null; left?: boolean; minimap?: boolean };
const stateKey = (title: string) => `design-canvas:${title}`;
function loadSaved(title: string): Saved {
  try {
    return JSON.parse(localStorage.getItem(stateKey(title)) ?? "{}");
  } catch {
    return {};
  }
}

type BoardError = { kind: string; message: string; line?: number };
const TEMPLATES = [
  { id: "blank", label: "빈 보드", size: "390×844", w: 390, h: 844 },
  { id: "mobile", label: "모바일 화면", size: "390×844", w: 390, h: 844 },
  { id: "desktop", label: "PC 화면", size: "1440×900", w: 1440, h: 900 },
  { id: "doc", label: "문서·메모", size: "800×1000", w: 800, h: 1000 },
] as const;

const TOOLS: { id: Tool; icon: IconName; label: string; key: string }[] = [
  { id: "select", icon: "select", label: "선택", key: "V" },
  { id: "hand", icon: "hand", label: "손(이동)", key: "H" },
  { id: "board", icon: "board", label: "보드 그리기", key: "B" },
  { id: "title", icon: "title", label: "제목", key: "T" },
  { id: "sticky", icon: "sticky", label: "메모", key: "N" },
];

export function App() {
  const [data, setData] = useState<BoardResponse | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 0.1 });
  const [page, setPage] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [editFile, setEditFile] = useState<string | null>(null);
  const [playFile, setPlayFile] = useState<string | null>(null);
  const [focusFile, setFocusFile] = useState<string | null>(null);
  const [leftOpen, setLeftOpen] = useState(true);
  const [minimapOpen, setMinimapOpen] = useState(true);
  const [menu, setMenu] = useState<MenuState>(null);
  const [hist, setHist] = useState({ canUndo: false, canRedo: false, undo: [] as string[], redo: [] as string[] });
  const [reloadKeys, setReloadKeys] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number } | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [rightTab, setRightTab] = useState<"inspect" | "chat">("inspect");
  const [chatDraft, setChatDraft] = useState("");
  const [chatAttach, setChatAttach] = useState<Attach>({ comments: [], refs: [] });
  const [errors, setErrors] = useState<Record<string, BoardError[]>>({});
  const chatListeners = useRef(new Set<(id: string, ev: ChatEvent) => void>());
  const chatSubscribe = useCallback((fn: (id: string, ev: ChatEvent) => void) => {
    chatListeners.current.add(fn);
    return () => void chatListeners.current.delete(fn);
  }, []);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const savingRef = useRef(0);
  const [leftTab, setLeftTab] = useState<"boards" | "assets">("boards");
  const [assetsVersion, setAssetsVersion] = useState(0);
  const [picker, setPicker] = useState<null | ((a: Asset) => void)>(null);
  /** 아직 board.json에 안 들어온 새 보드로 이동해야 할 때(안 N개 등): 들어오면 이동 */
  const [locate, setLocate] = useState<string[] | null>(null);
  const restored = useRef(false);
  const frames = useRef(new Map<string, HTMLIFrameElement>());
  const [frameTick, setFrameTick] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const ask = useDialog();
  const getFrame = useCallback((f: string) => frames.current.get(f) ?? null, [frameTick]);
  const editRef = useRef<ReturnType<typeof useEditMode> | null>(null);
  const boardRef = useRef<Board | null>(null);
  boardRef.current = board;
  const draftTimer = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api.board();
      setData(d);
      setBoard(d.board);
      setError(null);
    } catch (e) {
      setError(String((e as Error).message));
    }
  }, []);
  const loadComments = useCallback(() => api.get<{ comments: Comment[] }>("/api/comments").then((r) => setComments(r.comments)).catch(() => {}), []);
  const loadHistory = useCallback(() => api.get<typeof hist>("/api/history").then(setHist).catch(() => {}), []);
  const loadErrors = useCallback(() => api.get<{ errors: Record<string, BoardError[]> }>("/api/errors").then((r) => setErrors(r.errors)).catch(() => {}), []);

  useEffect(() => {
    void load();
    void loadComments();
    void loadHistory();
    void loadErrors();
  }, [load, loadComments, loadHistory, loadErrors]);

  // 보드 안 오류 수집: 서버가 화면 HTML에 끼운 스크립트가 보낸다(start → 오류들 → loaded, 그 뒤 생기는 오류는 바로)
  useEffect(() => {
    const live = new Map<string, { list: BoardError[]; loaded: boolean; t?: number }>();
    const flush = (file: string) => {
      const st = live.get(file)!;
      window.clearTimeout(st.t);
      st.t = window.setTimeout(() => void api.put("/api/errors", { file, errors: st.list }).catch(() => {}), 200);
    };
    const onMsg = (e: MessageEvent) => {
      const d = e.data;
      if (!d || d.type !== "dc-error" || typeof d.file !== "string") return;
      if (d.start) return void live.set(d.file, { list: [], loaded: false });
      const st = live.get(d.file) ?? { list: [], loaded: true };
      live.set(d.file, st);
      if (d.loaded) {
        st.loaded = true;
        return flush(d.file);
      }
      if (st.list.length < 20 && !st.list.some((x) => x.message === d.message)) st.list.push({ kind: d.kind, message: d.message, line: d.line });
      if (st.loaded) flush(d.file);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  /* ---------- 저장·실행 취소 ---------- */
  /** 상태를 바꾼다. label이 있으면 바로 저장하고 실행 취소 기록에 남긴다. "draft"는 기록 없이 조금 뒤 저장(글자 입력 중) */
  const update = useCallback(
    (fn: (b: Board) => Board, label?: string | "draft") => {
      const prev = boardRef.current;
      if (!prev) return;
      const next = fn(prev);
      boardRef.current = next;
      setBoard(next);
      if (!label) return;
      if (draftTimer.current) window.clearTimeout(draftTimer.current);
      const save = () => {
        savingRef.current++;
        return api
          .saveBoard(boardRef.current!, label === "draft" ? undefined : label)
          .catch((e) => toast({ tone: "error", text: `저장 실패: ${e.message}` }))
          .finally(() => savingRef.current--);
      };
      if (label === "draft")
        draftTimer.current = window.setTimeout(() => {
          draftTimer.current = null;
          void save();
        }, DRAFT_SAVE_DELAY);
      else void save();
    },
    [toast],
  );

  const undoRedo = useCallback(
    async (dir: "undo" | "redo") => {
      try {
        const r = await api.post<{ label: string | null }>(`/api/history/${dir}`, {});
        if (r.label) toast({ text: `${dir === "undo" ? "실행 취소" : "다시 실행"}: ${r.label}` });
        else toast({ text: dir === "undo" ? "되돌릴 작업이 없어요" : "다시 할 작업이 없어요" });
        await load();
      } catch (e) {
        toast({ tone: "error", text: String((e as Error).message) });
      }
      void loadHistory();
    },
    [toast, load, loadHistory],
  );
  const undoAction = { label: "실행 취소", run: () => void undoRedo("undo") };

  /* ---------- HTML 편집 ---------- */
  const doEdit = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!editFile) return false;
      try {
        await api.post("/api/edit", { file: editFile, ...payload });
        return true;
      } catch (e) {
        editRef.current?.setError(String((e as Error).message));
        toast({ tone: "error", text: String((e as Error).message) });
        return false;
      }
    },
    [editFile, toast],
  );
  /** 더블클릭: 글자 하나만 있는 요소를 그 자리에서 고친다. 한글 조합 중 Enter는 무시 */
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
        if (e.isComposing || e.keyCode === 229) return; // 조합 중 Enter는 글자 확정일 뿐
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          el.blur();
        } else if (e.key === "Escape") {
          cancelled = true;
          el.blur();
        }
      };
      // 한글 조합 중에 포커스가 빠지면 조합이 끝날 때까지 기다렸다가 저장한다
      let composing = false;
      let blurWhileComposing = false;
      const onStart = () => (composing = true);
      const onEnd = () => {
        composing = false;
        if (blurWhileComposing) done();
      };
      const done = () => {
        el.removeEventListener("compositionstart", onStart);
        el.removeEventListener("compositionend", onEnd);
        el.removeEventListener("blur", onBlur);
        void finish();
      };
      const onBlur = () => {
        if (composing) blurWhileComposing = true;
        else done();
      };
      el.addEventListener("compositionstart", onStart);
      el.addEventListener("compositionend", onEnd);
      el.addEventListener("keydown", onKey);
      el.addEventListener("blur", onBlur);
    },
    [editFile, doEdit],
  );
  const hashOf = (file: string, path: string) => api.get<{ hash: string }>(`/api/element?f=${encodeURIComponent(file)}&path=${encodeURIComponent(path)}`).then((r) => r.hash);
  /** 요소 옮기기: 옮긴 뒤 새 경로를 계산해 다시 고른다 */
  const moveElement = async (path: string, plan: DropPlan) => {
    if (!editFile) return;
    const hash = await hashOf(editFile, path);
    if (!(await doEdit({ op: "move", path, hash, ...plan }))) return;
    void editRef.current?.select([movedPath(path, plan.toParentPath, plan.index)]);
    toast({ text: plan.freeze.length ? "옮겼어요 (원래 자리 크기를 고정)" : "옮겼어요", action: undoAction });
  };
  /** ⌘C: 요소 소스를 앱 클립보드(다른 보드에서도)와 시스템 클립보드에 */
  const copyElement = async () => {
    const sel = edit.state.selection;
    if (!editFile || !sel) return;
    const { source } = await api.get<{ source: string }>(`/api/element?f=${encodeURIComponent(editFile)}&path=${encodeURIComponent(sel.path)}&full=1`);
    try {
      localStorage.setItem("design-canvas:clip", JSON.stringify({ source, file: editFile, path: sel.path, tag: sel.tag }));
    } catch {
      /* 무시 */
    }
    await navigator.clipboard?.writeText(source).catch(() => {});
    toast({ tone: "ok", text: `<${sel.tag}> 복사 — 다른 보드에서 편집 중 ${mod}V로 붙여요` });
  };
  /** ⌘V: 고른 요소 뒤(없으면 본문 끝)에 붙인다 */
  const pasteElement = async () => {
    if (!editFile) return;
    let clip: { source: string; file: string; tag: string } | null = null;
    try {
      clip = JSON.parse(localStorage.getItem("design-canvas:clip") ?? "null");
    } catch {
      clip = null;
    }
    if (!clip) return toast({ text: "복사한 요소가 없어요. 편집 중 요소를 고르고 ⌘C" });
    const sel = edit.state.selection;
    const path = sel?.file === editFile ? sel.path : "";
    if (await doEdit({ op: "insert", path, hash: path ? sel!.hash : undefined, position: "after", html: clip.source })) {
      toast({ tone: "ok", text: `${clip.file}의 <${clip.tag}>를 붙였어요`, action: undoAction });
      if (path) {
        const parts = path.split("/");
        parts[parts.length - 1] = String(Number(parts[parts.length - 1]) + 1);
        setTimeout(() => void editRef.current?.select([parts.join("/")]), 600);
      }
    }
  };
  const replaceImage = (path: string, isImg: boolean) =>
    setPicker(() => async (a: Asset) => {
      setPicker(null);
      if (!editFile) return;
      const hash = await hashOf(editFile, path);
      const ok = isImg ? await doEdit({ op: "setAttr", path, hash, name: "src", value: a.ref }) : await doEdit({ op: "setStyle", path, hash, prop: "background-image", value: `url("${a.ref}")` });
      if (ok) toast({ tone: "ok", text: `이미지를 ${a.name}로 바꿨어요`, action: undoAction });
    });

  const onElementContext = useCallback((path: string, at: { clientX: number; clientY: number }) => elementMenuRef.current?.(path, at), []);
  const elementMenuRef = useRef<((path: string, at: { clientX: number; clientY: number }) => void) | null>(null);
  const edit = useEditMode(editFile, getFrame, { onTextEdit, onContext: onElementContext });
  editRef.current = edit;

  // 서버 알림: 바뀐 파일의 보드만 다시 그리고, board.json이 밖에서 바뀌면 다시 읽는다
  useEffect(
    () =>
      connectEvents((e: ServerEvent) => {
        if (e.type === "file-changed") {
          setReloadKeys((k) => ({ ...k, [e.file]: (k[e.file] ?? 0) + 1 }));
          if (e.kind !== "change") void load();
        } else if (e.type === "board-changed" && e.source !== clientId) void load();
        else if (e.type === "comments-changed") void loadComments();
        else if (e.type === "history-changed") void loadHistory();
        else if (e.type === "errors-changed") void loadErrors();
        else if (e.type === "assets-changed") setAssetsVersion((v) => v + 1);
        else if (e.type === "chat") for (const fn of chatListeners.current) fn(e.id, e.ev);
      }),
    [load, loadComments, loadHistory, loadErrors],
  );

  /* ---------- 페이지·보이는 것 ---------- */
  const pages = board?.pages ?? [];
  const currentPage = pages.find((p) => p.id === page)?.id ?? pages[0]?.id ?? null;
  const onPage = useCallback((item: { page?: string }) => !pages.length || (item.page ?? pages[0].id) === currentPage, [pages, currentPage]);
  const visibleBoards = useMemo(() => (board ? board.order.filter((f) => board.boards[f] && onPage(board.boards[f])) : []), [board, onPage]);
  const visibleNotes = useMemo(() => (board ? Object.keys(board.notes).filter((id) => onPage(board.notes[id])) : []), [board, onPage]);
  const size = canvasSize ?? { w: window.innerWidth, h: window.innerHeight - 48 };

  // 처음 한 번: 저장해 둔 화면(확대·위치·페이지·패널)을 되살리거나 전체 보기. 시작 설정이 있으면 따른다
  useEffect(() => {
    if (restored.current || !board || !canvasSize) return;
    restored.current = true;
    const s = loadSaved(board.title);
    if (s.left != null) setLeftOpen(s.left);
    else if (window.innerWidth < 1000) setLeftOpen(false);
    if (s.minimap != null) setMinimapOpen(s.minimap);
    const launch = board.launch;
    if (launch?.page) setPage(launch.page);
    else if (s.page) setPage(s.page);
    if (launch?.view === "focused" && launch.file && board.boards[launch.file]) setFocusFile(launch.file);
    if (s.view && !launch?.page) setView(s.view);
    else setView(fitView(Object.values(board.boards), canvasSize));
  }, [board, canvasSize]);
  // 화면 상태 기억
  useEffect(() => {
    if (!board || !restored.current) return;
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(stateKey(board.title), JSON.stringify({ view, page: currentPage, left: leftOpen, minimap: minimapOpen } satisfies Saved));
      } catch {
        /* 저장 못 해도 동작에는 지장 없음 */
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [view, currentPage, leftOpen, minimapOpen, board?.title]);

  // 캔버스 상태를 서버에 알린다(MCP get_selection의 mode·page·visibleArtboards·selectedArtboards·dirty)
  useEffect(() => {
    if (!board) return;
    const t = window.setTimeout(() => {
      const vx = -view.x / view.zoom;
      const vy = -view.y / view.zoom;
      const vw = size.w / view.zoom;
      const vh = size.h / view.zoom;
      const visibleArtboards = focusFile ? [focusFile] : visibleBoards.filter((f) => {
        const b = board.boards[f];
        return b.x < vx + vw && b.x + b.w > vx && b.y < vy + vh && b.y + b.h > vy;
      });
      void api
        .put("/api/context", {
          mode: playFile ? "play" : focusFile ? "focus" : editFile ? "edit" : "canvas",
          page: currentPage,
          pageName: pages.find((p) => p.id === currentPage)?.name ?? null,
          visibleArtboards,
          selectedArtboards: selected,
          dirty: savingRef.current > 0 || !!draftTimer.current,
        })
        .catch(() => {});
    }, 300);
    return () => window.clearTimeout(t);
  }, [view, currentPage, selected, editFile, focusFile, playFile, visibleBoards, size.w, size.h]);

  useEffect(() => {
    if (!locate || !board || !locate.every((f) => board.boards[f])) return;
    setSelected(locate);
    setView(fitView(locate.map((f) => board.boards[f]), size, 80));
    setLocate(null);
  }, [locate, board]);

  const noteRect = (n: Note) => ({ x: n.x, y: n.y, w: n.w ?? n.maxW ?? 400, h: n.kind === "title" ? 90 : 200 });
  const fitAll = () => {
    if (!board) return;
    setView(fitView([...visibleBoards.map((f) => board.boards[f]), ...visibleNotes.map((id) => noteRect(board.notes[id]))], size));
  };
  const goTo = (files: string[]) => {
    if (!board || !files.length) return;
    setView(fitView(files.map((f) => board.boards[f]).filter(Boolean), size, 80));
  };
  const zoomBy = (k: number) =>
    setView((v) => {
      const z = clamp(v.zoom * k, MIN_ZOOM, MAX_ZOOM);
      const cx = size.w / 2;
      const cy = size.h / 2;
      return { zoom: z, x: cx - ((cx - v.x) / v.zoom) * z, y: cy - ((cy - v.y) / v.zoom) * z };
    });
  const zoomTo = (z: number) => zoomBy(z / view.zoom);

  /* ---------- 보드 조작 ---------- */
  const select = (files: string[], m: "replace" | "toggle" | "add" = "replace") => {
    setSelected((cur) => (m === "replace" ? files : m === "add" ? [...new Set([...cur, ...files])] : files.reduce((a, f) => (a.includes(f) ? a.filter((x) => x !== f) : [...a, f]), cur)));
    if (files.length) setSelectedNote(null);
  };
  const pageField = () => (pages.length && currentPage ? { page: currentPage } : {});

  const createBoard = async (r: Partial<Rect>, template = "blank") => {
    try {
      const { file } = await api.post<{ file: string }>("/api/boards/create", { ...r, template, ...pageField() });
      await load();
      setSelected([file]);
      setTool("select");
      toast({ tone: "ok", text: `보드 ${file}를 만들었어요`, action: undoAction });
    } catch (e) {
      toast({ tone: "error", text: `보드를 만들지 못했어요: ${(e as Error).message}` });
    }
  };
  const deleteBoards = async (files: string[]) => {
    if (!files.length || !board) return;
    const names = files.map((f) => board.boards[f]?.title ?? f);
    const ok = await ask.confirm({
      title: files.length > 1 ? `보드 ${files.length}개를 지울까요?` : `"${names[0]}" 보드를 지울까요?`,
      body: "HTML 파일도 함께 지워져요. 휴지통(docs/design/.trash)에 사본이 남고, 바로 실행 취소(⌘Z)로 되살릴 수 있어요.",
      ok: "지우기",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.post("/api/boards/delete", { files });
      if (editFile && files.includes(editFile)) setEditFile(null);
      setSelected([]);
      await load();
      toast({ text: `보드 ${files.length}개를 지웠어요`, action: undoAction });
    } catch (e) {
      toast({ tone: "error", text: String((e as Error).message) });
    }
  };
  const duplicateBoard = async (file: string) => {
    try {
      const r = await api.post<{ file: string }>("/api/boards/duplicate", { file });
      await load();
      setSelected([r.file]);
      toast({ tone: "ok", text: `${r.file}로 복제했어요`, action: undoAction });
    } catch (e) {
      toast({ tone: "error", text: String((e as Error).message) });
    }
  };
  const renameBoard = async (file: string) => {
    const b = boardRef.current?.boards[file];
    if (!b) return;
    const r = await ask.prompt({ title: "보드 이름 바꾸기", label: "이름", value: b.title ?? file.replace(/\.html$/, ""), ok: "바꾸기" });
    if (!r || r.value.trim() === (b.title ?? "")) return;
    try {
      await api.post("/api/boards/rename", { file, title: r.value.trim() });
      await load();
      toast({ tone: "ok", text: "이름을 바꿨어요", action: undoAction });
    } catch (e) {
      toast({ tone: "error", text: String((e as Error).message) });
    }
  };
  const renameFile = async (file: string) => {
    const { refs } = await api.get<{ refs: { file: string; count: number }[] }>(`/api/boards/refs?file=${encodeURIComponent(file)}`).catch(() => ({ refs: [] }));
    const r = await ask.prompt({
      title: "파일 이름 바꾸기",
      label: "파일 이름",
      value: file,
      hint: refs.length ? `이 파일을 링크·iframe으로 가리키는 곳: ${refs.map((x) => x.file).join(", ")}` : "이 파일을 가리키는 링크·iframe은 없어요.",
      ok: "바꾸기",
      extra: refs.length ? { label: `참조 ${refs.reduce((a, x) => a + (x.count ?? 1), 0)}곳도 새 이름으로 바꾸기`, checked: true } : undefined,
    });
    if (!r) return;
    let newFile = r.value.trim();
    if (!newFile.endsWith(".html")) newFile += ".html";
    if (newFile === file) return;
    try {
      await api.post("/api/boards/rename", { file, newFile, updateRefs: r.extra });
      if (editFile === file) setEditFile(newFile);
      setSelected([newFile]);
      await load();
      toast({ tone: "ok", text: `${newFile}로 바꿨어요${r.extra ? " (참조도 갱신)" : ""}`, action: undoAction });
    } catch (e) {
      toast({ tone: "error", text: String((e as Error).message) });
    }
  };
  /** 화면 가운데에 틀에서 새 보드 */
  const createFromTemplate = (t: (typeof TEMPLATES)[number]) => {
    const cx = (size.w / 2 - view.x) / view.zoom;
    const cy = (size.h / 2 - view.y) / view.zoom;
    void createBoard({ x: Math.round(cx - t.w / 2), y: Math.round(cy - t.h / 2), w: t.w, h: t.h }, t.id).then(() => setView(fitView([{ x: cx - t.w / 2, y: cy - t.h / 2, w: t.w, h: t.h }], size, 80)));
  };
  const templateMenu = (at: { clientX: number; clientY: number }) =>
    setMenu({ x: at.clientX, y: at.clientY, title: "새 보드", items: TEMPLATES.map((t) => ({ label: `${t.label} · ${t.size}`, icon: t.id === "doc" ? ("page" as IconName) : ("board" as IconName), shortcut: t.id === "blank" ? "B로 그리기" : undefined, run: () => createFromTemplate(t) })) });
  /** 채팅 열기(+ 보낼 말·첨부) */
  const openChat = (draft?: string, files?: string[]) => {
    setRightTab("chat");
    if (files?.length) setSelected(files);
    if (draft != null) setChatDraft(draft);
    setTimeout(() => chatInputRef.current?.focus(), 0);
  };
  const askFix = (files: string[]) =>
    openChat(
      `오류를 고쳐 줘:\n${files.map((f) => `- ${f}: ${(errors[f] ?? [{ message: data?.missing.includes(f) ? "파일이 없어요" : "오류" }])[0].message}`).join("\n")}`,
      files.filter((f) => board?.boards[f]),
    );

  /** 맨 앞(order 끝)·맨 뒤(order 앞)로 */
  const reorder = (files: string[], to: "front" | "back") =>
    update((b) => {
      const rest = b.order.filter((f) => !files.includes(f));
      const moved = b.order.filter((f) => files.includes(f));
      return { ...b, order: to === "front" ? [...rest, ...moved] : [...moved, ...rest] };
    }, to === "front" ? "맨 앞으로" : "맨 뒤로");
  const patchBoard = (file: string, patch: Partial<BoardItem>, label = "보드 옵션") =>
    update((b) => {
      const it: BoardItem = { ...b.boards[file], ...patch };
      for (const k of Object.keys(it) as (keyof BoardItem)[]) if (it[k] === undefined) delete it[k];
      return { ...b, boards: { ...b.boards, [file]: it } };
    }, label);
  const nudge = (dx: number, dy: number) =>
    update(
      (b) => ({ ...b, boards: { ...b.boards, ...Object.fromEntries(selected.map((f) => [f, { ...b.boards[f], x: b.boards[f].x + dx, y: b.boards[f].y + dy }])) } }),
      "보드 옮기기",
    );

  /* ---------- 메모 ---------- */
  const newNoteId = () => {
    let id = "";
    do id = `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    while (boardRef.current?.notes[id]);
    return id;
  };
  const createNote = (kind: Note["kind"], at: { x: number; y: number }) => {
    const id = newNoteId();
    const x = Math.round(at.x);
    const y = Math.round(at.y);
    update(
      (b) => ({
        ...b,
        notes: { ...b.notes, [id]: kind === "title" ? { kind, x, y, text: "새 제목", maxW: 2000, ...pageField() } : { kind, x, y, text: "메모", w: 400, ...pageField() } },
      }),
      kind === "title" ? "제목 추가" : "메모 추가",
    );
    setSelectedNote(id);
    setSelected([]);
    setTool("select");
  };
  const deleteNote = (id: string) => {
    update((b) => {
      const { [id]: _, ...rest } = b.notes;
      return { ...b, notes: rest };
    }, "메모 삭제");
    setSelectedNote(null);
    toast({ text: "메모를 지웠어요", action: undoAction });
  };

  /* ---------- 페이지 ---------- */
  const addPage = async () => {
    const r = await ask.prompt({ title: "새 페이지", label: "이름", value: `페이지 ${Math.max(pages.length, 1) + 1}`, ok: "만들기" });
    if (!r?.value.trim()) return;
    const id = `p${Date.now().toString(36)}`;
    // 첫 페이지를 만들면 지금 보드·메모는 모두 '기본' 페이지에 남는다(page 없는 항목 = 첫 페이지)
    update((b) => ({ ...b, pages: b.pages.length ? [...b.pages, { id, name: r.value.trim() }] : [{ id: "main", name: "기본" }, { id, name: r.value.trim() }] }), "페이지 추가");
    setPage(id);
  };
  const renamePage = async (id: string) => {
    const p = pages.find((x) => x.id === id);
    const r = await ask.prompt({ title: "페이지 이름 바꾸기", label: "이름", value: p?.name ?? "", ok: "바꾸기" });
    if (!r?.value.trim()) return;
    update((b) => ({ ...b, pages: b.pages.map((x) => (x.id === id ? { ...x, name: r.value.trim() } : x)) }), "페이지 이름 바꾸기");
  };
  const pageMenu = (id: string, at: { clientX: number; clientY: number }) =>
    setMenu({
      x: at.clientX,
      y: at.clientY,
      title: pages.find((p) => p.id === id)?.name,
      items: [
        { label: "이름 바꾸기", icon: "edit", run: () => void renamePage(id) },
        ...(selected.length ? [{ label: `선택한 보드 ${selected.length}개를 이 페이지로`, icon: "page" as IconName, run: () => update((b) => ({ ...b, boards: { ...b.boards, ...Object.fromEntries(selected.map((f) => [f, { ...b.boards[f], page: id }])) } }), "페이지로 옮기기") }] : []),
      ],
    });

  /* ---------- 우클릭 메뉴 ---------- */
  const boardMenuItems = (file: string): MenuItem[] => {
    const b = board!.boards[file];
    const files = selected.includes(file) ? selected : [file];
    const many = files.length > 1;
    return [
      { label: editFile === file ? "편집 끝내기" : "편집", icon: "edit", shortcut: "E", disabled: many, run: () => setEditFile(editFile === file ? null : file) },
      { label: "Play", icon: "play", disabled: many || !b?.is_interactive, run: () => setPlayFile(file) },
      { label: "전체 화면 보기", icon: "focus", shortcut: "F", disabled: many, run: () => setFocusFile(file) },
      { label: "AI에게 묻기", icon: "comment", shortcut: `${mod}J`, run: () => openChat(undefined, files) },
      ...(errors[file] || data?.missing.includes(file) ? [{ label: "AI에게 오류 고쳐 달라기", icon: "warn" as IconName, run: () => askFix([file]) }] : []),
      { label: "이 보드로 이동", icon: "fit", shortcut: "⇧2", run: () => goTo(files) },
      "sep",
      { label: "이름 바꾸기", icon: "title", shortcut: "F2", disabled: many, run: () => void renameBoard(file) },
      { label: "파일 이름 바꾸기…", icon: "link", disabled: many, run: () => void renameFile(file) },
      { label: "복제", icon: "copy", shortcut: `${mod}D`, disabled: many, run: () => void duplicateBoard(file) },
      "sep",
      { label: "맨 앞으로", icon: "front", shortcut: `${mod}]`, run: () => reorder(files, "front") },
      { label: "맨 뒤로", icon: "back", shortcut: `${mod}[`, run: () => reorder(files, "back") },
      "sep",
      { label: many ? `보드 ${files.length}개 삭제` : "삭제", icon: "trash", shortcut: "⌫", danger: true, run: () => void deleteBoards(files) },
    ];
  };
  const onContext = (t: ContextTarget, at: { clientX: number; clientY: number }) => {
    if (!board) return;
    if (t.type === "board") {
      if (!selected.includes(t.file)) select([t.file]);
      setMenu({ x: at.clientX, y: at.clientY, title: board.boards[t.file]?.title ?? t.file, items: boardMenuItems(t.file) });
    } else if (t.type === "note") {
      setSelectedNote(t.id);
      setMenu({
        x: at.clientX,
        y: at.clientY,
        title: board.notes[t.id]?.kind === "title" ? "제목" : "메모",
        items: [
          { label: "앞에 복제", icon: "copy", shortcut: `${mod}D`, run: () => { const n = board.notes[t.id]; const id = newNoteId(); update((b) => ({ ...b, notes: { ...b.notes, [id]: { ...n, x: n.x + 40, y: n.y + 40 } } }), "메모 복제"); setSelectedNote(id); } },
          "sep",
          { label: "삭제", icon: "trash", shortcut: "⌫", danger: true, run: () => deleteNote(t.id) },
        ],
      });
    } else {
      setMenu({
        x: at.clientX,
        y: at.clientY,
        items: [
          { label: "여기에 보드 만들기", icon: "board", shortcut: "B", run: () => void createBoard({ x: Math.round(t.x), y: Math.round(t.y), w: 390, h: 844 }) },
          { label: "여기에 모바일 화면 틀", icon: "board", run: () => void createBoard({ x: Math.round(t.x), y: Math.round(t.y) }, "mobile") },
          { label: "여기에 제목", icon: "title", shortcut: "T", run: () => createNote("title", t) },
          { label: "여기에 메모", icon: "sticky", shortcut: "N", run: () => createNote("sticky", t) },
          "sep",
          { label: "이 페이지 모두 선택", icon: "select", shortcut: `${mod}A`, run: () => select(visibleBoards) },
          { label: "전체 보기", icon: "fit", shortcut: "⇧1", run: fitAll },
          { label: "100%로 보기", icon: "search", shortcut: `${mod}0`, run: () => zoomTo(1) },
          "sep",
          { label: "실행 취소", icon: "undo", shortcut: `${mod}Z`, disabled: !hist.canUndo, run: () => void undoRedo("undo") },
          { label: "다시 실행", icon: "redo", shortcut: `⇧${mod}Z`, disabled: !hist.canRedo, run: () => void undoRedo("redo") },
        ],
      });
    }
  };
  // 편집 중인 보드 안 요소 우클릭
  elementMenuRef.current = (path, at) => {
    if (!editFile) return;
    const getHash = () => api.get<{ hash: string }>(`/api/element?f=${encodeURIComponent(editFile)}&path=${encodeURIComponent(path)}`).then((r) => r.hash);
    const el = frames.current.get(editFile)?.contentDocument ? elementAt(frames.current.get(editFile)!.contentDocument!, path) : null;
    const up = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : null;
    setMenu({
      x: at.clientX,
      y: at.clientY,
      title: el ? `<${el.tagName.toLowerCase()}>` : "요소",
      items: [
        { label: "글자 고치기", icon: "edit", disabled: !el || el.children.length > 0, run: () => el && onTextEdit(el as HTMLElement, path) },
        { label: "부모 선택", icon: "layers", shortcut: "Esc", disabled: up == null, run: () => up != null && void edit.select([up]) },
        { label: "이 요소를 AI에게", icon: "comment", run: () => openChat() },
        { label: "복사", icon: "copy", shortcut: `${mod}C`, run: () => void copyElement() },
        { label: "뒤에 붙여넣기", icon: "copy", shortcut: `${mod}V`, run: () => void pasteElement() },
        ...(el?.tagName === "IMG" ? [{ label: "이미지 바꾸기…", icon: "page" as IconName, run: () => replaceImage(path, true) }] : []),
        { label: "AI용 설명 복사", icon: "copy", run: () => void navigator.clipboard.writeText(`${editFile} ${path} <${el?.tagName.toLowerCase()}> "${(el?.textContent ?? "").trim().slice(0, 60)}"`).then(() => toast({ tone: "ok", text: "복사했어요" })) },
        "sep",
        { label: "복제", icon: "copy", shortcut: `${mod}D`, run: async () => void doEdit({ op: "duplicate", path, hash: await getHash() }) },
        {
          label: "삭제",
          icon: "trash",
          shortcut: "⌫",
          danger: true,
          run: async () => {
            if (await doEdit({ op: "delete", path, hash: await getHash() })) {
              void edit.select([]);
              toast({ text: "요소를 지웠어요", action: undoAction });
            }
          },
        },
      ],
    });
  };

  /* ---------- 단축키 ---------- */
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e: KeyboardEvent) => {
    if (!board || ask.state || focusFile || playFile) return;
    if (isTyping(e) || e.isComposing) return;
    const cmd = e.metaKey || e.ctrlKey;
    const k = e.key.toLowerCase();
    const one = selected.length === 1 ? selected[0] : null;
    const run = (fn: () => void) => {
      e.preventDefault();
      fn();
    };
    if (cmd && k === "z") return run(() => void undoRedo(e.shiftKey ? "redo" : "undo"));
    if (cmd && k === "y") return run(() => void undoRedo("redo"));
    if (cmd && k === "j") return run(() => (rightTab === "chat" ? setRightTab("inspect") : openChat()));
    if (cmd && k === "k") return run(() => { setLeftOpen(true); setTimeout(() => searchRef.current?.focus(), 0); });
    if (cmd && k === "a" && !editFile) return run(() => select(visibleBoards));
    if (cmd && k === "c" && editFile && edit.state.selection) return run(() => void copyElement());
    if (cmd && k === "v" && editFile) return run(() => void pasteElement());
    if (cmd && k === "d" && editFile && edit.state.selection) {
      const sel = edit.state.selection;
      return run(() => void doEdit({ op: "duplicate", path: sel.path, hash: sel.hash }));
    }
    if (cmd && k === "d" && one && !editFile) return run(() => void duplicateBoard(one));
    if (cmd && e.key === "]" && selected.length) return run(() => reorder(selected, "front"));
    if (cmd && e.key === "[" && selected.length) return run(() => reorder(selected, "back"));
    if (cmd && e.key === "0") return run(() => zoomTo(1));
    if (cmd && e.key === "1") return run(fitAll);
    if (cmd && (e.key === "=" || e.key === "+")) return run(() => zoomBy(1.25));
    if (cmd && e.key === "-") return run(() => zoomBy(0.8));
    if (cmd && e.key === "\\") return run(() => setLeftOpen((v) => !v));
    if (cmd) return;
    if (e.shiftKey && e.code === "Digit1") return run(fitAll);
    if (e.shiftKey && e.code === "Digit2") return run(() => goTo(selected));
    if (e.key === "Escape") {
      if (editFile) return run(() => setEditFile(null));
      if (tool !== "select") return run(() => setTool("select"));
      setSelected([]);
      setSelectedNote(null);
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      if (editFile && edit.state.selection) {
        const sel = edit.state.selection;
        return run(async () => {
          if (await doEdit({ op: "delete", path: sel.path, hash: sel.hash })) {
            void edit.select([]);
            toast({ text: "요소를 지웠어요", action: undoAction });
          }
        });
      }
      if (selectedNote) return run(() => deleteNote(selectedNote));
      if (selected.length && !editFile) return run(() => void deleteBoards(selected));
      return;
    }
    if (e.key.startsWith("Arrow") && selected.length && !editFile) {
      const d = e.shiftKey ? 10 : 1;
      return run(() => nudge(e.key === "ArrowLeft" ? -d : e.key === "ArrowRight" ? d : 0, e.key === "ArrowUp" ? -d : e.key === "ArrowDown" ? d : 0));
    }
    if (e.key === "F2" && one) return run(() => void renameBoard(one));
    if (k === "f" && one) return run(() => setFocusFile(one));
    if (k === "e" && one) return run(() => setEditFile(editFile === one ? null : one));
    if (k === "m") return run(() => setMinimapOpen((v) => !v));
    const t = TOOLS.find((x) => x.key.toLowerCase() === k);
    if (t && !editFile) return run(() => setTool(t.id));
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ---------- 보드 위 오버레이: 편집 외곽선·선택, 댓글 핀 ---------- */
  const renderOverlay = (f: string) => {
    const pins = comments.filter((c) => c.file === f && !c.resolved);
    const doc = frames.current.get(f)?.contentDocument;
    const editing = editFile === f;
    if (!editing && !pins.length) return null;
    return (
      <div className="overlay">
        {editing && edit.state.hover && !edit.state.paths.includes(edit.state.hover.path) && <Box r={edit.state.hover.rect} cls="hover" />}
        {editing && edit.state.rects.map((r, i) => <Box key={i} r={r} cls="sel" />)}
        {editing && doc && edit.state.paths.length === 1 && edit.state.rects[0] && (
          <EditHandles
            doc={doc}
            path={edit.state.paths[0]}
            rect={edit.state.rects[0]}
            zoom={view.zoom}
            onMove={(plan) => void moveElement(edit.state.paths[0], plan)}
            onPosition={async (left, top) => {
              const path = edit.state.paths[0];
              const hash = await hashOf(f, path);
              await doEdit({ op: "batch", ops: [{ op: "setStyle", path, hash, prop: "left", value: `${left}px` }, { op: "setStyle", path, hash, prop: "top", value: `${top}px` }] });
            }}
            onResize={async (w, h) => {
              const path = edit.state.paths[0];
              const hash = await hashOf(f, path);
              await doEdit({ op: "batch", ops: [{ op: "setStyle", path, hash, prop: "width", value: `${w}px` }, { op: "setStyle", path, hash, prop: "height", value: `${h}px` }] });
            }}
          />
        )}
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

  if (!board || !data)
    return (
      <div className="loading" role="status">
        {error ? (
          <>
            <Icon name="warn" /> 불러오지 못했어요: {error}
            <button onClick={() => void load()}>다시 시도</button>
          </>
        ) : (
          <>
            <span className="spinner" aria-hidden="true" /> 보드를 불러오는 중…
          </>
        )}
      </div>
    );

  const one = selected.length === 1 ? selected[0] : null;
  const erroredFiles = [...new Set([...data.missing, ...Object.keys(errors)])];
  const visibleCount = (() => {
    const vx = -view.x / view.zoom, vy = -view.y / view.zoom, vw = size.w / view.zoom, vh = size.h / view.zoom;
    return visibleBoards.filter((f) => { const b = board.boards[f]; return b.x < vx + vw && b.x + b.w > vx && b.y < vy + vh && b.y + b.h > vy; }).length;
  })();
  const leftTabs = (
    <div className="left-tabs" role="tablist" aria-label="왼쪽 패널">
      <button role="tab" aria-selected={leftTab === "boards"} className={leftTab === "boards" ? "on" : ""} onClick={() => setLeftTab("boards")}>
        보드
      </button>
      <button role="tab" aria-selected={leftTab === "assets"} className={leftTab === "assets" ? "on" : ""} onClick={() => setLeftTab("assets")}>
        자산
      </button>
    </div>
  );
  const rects = visibleBoards.map((f) => ({ file: f, ...board.boards[f] }));

  return (
    <div className="app">
      <header className="toolbar" role="toolbar" aria-label="도구">
        <button className={`icon-btn ${leftOpen ? "on" : ""}`} aria-label="왼쪽 패널" aria-pressed={leftOpen} title={`왼쪽 패널 (${mod}\\)`} onClick={() => setLeftOpen((v) => !v)}>
          <Icon name="panel" style={{ transform: "scaleX(-1)" }} />
        </button>
        <strong className="app-title">{board.title}</strong>
        <div className="tool-group" role="radiogroup" aria-label="캔버스 도구">
          {TOOLS.map((t) => (
            <button key={t.id} role="radio" aria-checked={tool === t.id} aria-label={`${t.label} (${t.key})`} title={`${t.label} (${t.key})`} className={`icon-btn ${tool === t.id ? "on" : ""}`} disabled={!!editFile && t.id !== "select" && t.id !== "hand"} onClick={() => setTool(t.id)}>
              <Icon name={t.icon} />
            </button>
          ))}
        </div>
        <div className="tool-group">
          <button className="icon-btn" aria-label="실행 취소" title={hist.undo.length ? `실행 취소: ${hist.undo[hist.undo.length - 1]} (${mod}Z)` : `실행 취소 (${mod}Z)`} disabled={!hist.canUndo} onClick={() => void undoRedo("undo")}>
            <Icon name="undo" />
          </button>
          <button className="icon-btn" aria-label="다시 실행" title={hist.redo.length ? `다시 실행: ${hist.redo[hist.redo.length - 1]} (⇧${mod}Z)` : `다시 실행 (⇧${mod}Z)`} disabled={!hist.canRedo} onClick={() => void undoRedo("redo")}>
            <Icon name="redo" />
          </button>
        </div>
        <button className="new-board" aria-haspopup="menu" title="새 보드(틀 고르기)" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); templateMenu({ clientX: r.left, clientY: r.bottom + 4 }); }}>
          <Icon name="plus" size={16} /> 새 보드 <Icon name="chevronDown" size={14} />
        </button>
        {editFile && (
          <span className="editing-chip">
            <Icon name="edit" size={14} /> {board.boards[editFile]?.title ?? editFile} 편집 중
            <button className="icon-btn sm" aria-label="편집 끝내기" title="편집 끝내기 (Esc)" onClick={() => setEditFile(null)}>
              <Icon name="close" size={14} />
            </button>
          </span>
        )}
        <div className="spacer" />
        {erroredFiles.length > 0 && (
          <button
            className="err-chip"
            aria-haspopup="menu"
            title="오류 난 보드"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setMenu({
                x: r.left,
                y: r.bottom + 4,
                title: `오류 난 보드 ${erroredFiles.length}`,
                items: [
                  ...erroredFiles.slice(0, 12).map((f) => ({ label: `${board.boards[f]?.title ?? f} — ${(errors[f]?.[0]?.message ?? "파일이 없어요").slice(0, 40)}`, icon: "warn" as IconName, run: () => { select([f]); goTo([f]); } })),
                  "sep" as const,
                  { label: "AI에게 모두 고쳐 달라기", icon: "comment" as IconName, run: () => askFix(erroredFiles) },
                ],
              });
            }}
          >
            <Icon name="warn" size={14} /> 오류 {erroredFiles.length}
          </button>
        )}
        {error && <span className="warn">{error}</span>}
        <div className="tool-group">
          <button className="icon-btn" aria-label="축소" title={`축소 (${mod}-)`} onClick={() => zoomBy(0.8)}>
            <span className="glyph">−</span>
          </button>
          <button className="zoom" aria-label="100%로 보기" title={`100%로 보기 (${mod}0)`} onClick={() => zoomTo(1)}>
            {Math.round(view.zoom * 100)}%
          </button>
          <button className="icon-btn" aria-label="확대" title={`확대 (${mod}+)`} onClick={() => zoomBy(1.25)}>
            <Icon name="plus" />
          </button>
          <button className="icon-btn" aria-label="전체 보기" title="전체 보기 (⇧1)" onClick={fitAll}>
            <Icon name="fit" />
          </button>
          <button className={`icon-btn ${rightTab === "chat" ? "on" : ""}`} aria-label="AI 채팅" aria-pressed={rightTab === "chat"} title={`AI 채팅 (${mod}J)`} onClick={() => (rightTab === "chat" ? setRightTab("inspect") : openChat())}>
            <Icon name="comment" />
          </button>
          <button className={`icon-btn ${minimapOpen ? "on" : ""}`} aria-label="미니맵" aria-pressed={minimapOpen} title="미니맵 (M)" onClick={() => setMinimapOpen((v) => !v)}>
            <Icon name="map" />
          </button>
        </div>
      </header>
      <div className="main">
        {leftOpen && (
          leftTab === "assets" ? (
            <aside className="left" aria-label="자산">
              {leftTabs}
              <AssetGrid version={assetsVersion} onError={(m) => toast({ tone: "error", text: m })} onUploaded={(a) => toast({ tone: "ok", text: `${a.map((x) => x.name).join(", ")}를 올렸어요` })} />
            </aside>
          ) : (
          <LeftPanel
            header={leftTabs}
            ref={searchRef}
            board={board}
            pages={pages}
            currentPage={currentPage}
            selected={selected}
            missing={erroredFiles}
            onPage={setPage}
            onAddPage={() => void addPage()}
            onPageMenu={pageMenu}
            onPick={(f, add) => {
              const b = board.boards[f];
              if (pages.length && b && (b.page ?? pages[0].id) !== currentPage) setPage(b.page ?? pages[0].id);
              select([f], add ? "toggle" : "replace");
              if (!add) goTo([f]);
            }}
            onBoardMenu={(f, at) => {
              if (!selected.includes(f)) select([f]);
              setMenu({ x: at.clientX, y: at.clientY, title: board.boards[f]?.title ?? f, items: boardMenuItems(f) });
            }}
          />
          )
        )}
        <div className="canvas-wrap">
          <Canvas
            board={board}
            files={data.files}
            view={view}
            setView={setView}
            tool={tool}
            setTool={setTool}
            visibleBoards={visibleBoards}
            visibleNotes={visibleNotes}
            selected={selected}
            selectedNote={selectedNote}
            editFile={editFile}
            reloadKeys={reloadKeys}
            onSelect={select}
            onSelectNote={(id) => {
              setSelectedNote(id);
              if (id) setSelected([]);
            }}
            onMoveBoards={(patches, done) =>
              update(
                (b) => ({ ...b, boards: { ...b.boards, ...Object.fromEntries(Object.entries(patches).map(([f, p]) => [f, { ...b.boards[f], ...p, autoPlaced: undefined }])) } }),
                done ? (Object.values(patches).some((p) => p.w != null) ? "보드 크기" : "보드 옮기기") : undefined,
              )
            }
            onMoveNote={(id, patch, done) => update((b) => ({ ...b, notes: { ...b.notes, [id]: { ...b.notes[id], ...patch } } }), done ? ("text" in patch ? "메모 고치기" : "메모 옮기기") : undefined)}
            onDeleteNote={deleteNote}
            onPlay={setPlayFile}
            onEdit={(f) => {
              setEditFile(f);
              if (f) setSelected([f]);
            }}
            onRename={(f) => void renameBoard(f)}
            onCreateBoard={(r) => void createBoard(r)}
            onCreateNote={createNote}
            onContext={onContext}
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
          {visibleBoards.length === 0 && visibleNotes.length === 0 && (
            <div className="canvas-empty">
              <Icon name="board" size={32} />
              <p>이 페이지는 비어 있어요</p>
              <button className="primary" onClick={() => setTool("board")}>
                보드 그리기 <kbd>B</kbd>
              </button>
            </div>
          )}
          {minimapOpen && rects.length > 0 && (
            <Minimap rects={rects} selected={selected} view={view} size={size} onJump={(x, y) => setView((v) => ({ ...v, x: size.w / 2 - x * v.zoom, y: size.h / 2 - y * v.zoom }))} />
          )}
        </div>
        <div className="right">
          <div className="right-tabs" role="tablist" aria-label="오른쪽 패널">
            <button role="tab" aria-selected={rightTab === "inspect"} className={rightTab === "inspect" ? "on" : ""} onClick={() => setRightTab("inspect")}>
              속성
            </button>
            <button role="tab" aria-selected={rightTab === "chat"} className={rightTab === "chat" ? "on" : ""} onClick={() => openChat()}>
              AI <kbd>{mod}J</kbd>
            </button>
          </div>
          <div className="chat-wrap" hidden={rightTab !== "chat"}>
            <ChatPanel
              selection={editFile && edit.state.selection?.file === editFile ? edit.state.selection : null}
              boards={editFile ? [editFile] : selected}
              visibleCount={visibleCount}
              titleOf={(f) => board.boards[f]?.title ?? f}
              attach={chatAttach}
              setAttach={setChatAttach}
              draft={chatDraft}
              setDraft={setChatDraft}
              subscribe={chatSubscribe}
              onLocate={setLocate}
              inputRef={chatInputRef}
            />
          </div>
          {rightTab === "inspect" && (
        <Inspector
          onAskAI={(c) => {
            setChatAttach((a) => ({ ...a, comments: a.comments.some((x) => x.id === c.id) ? a.comments : [...a.comments, { id: c.id, text: c.text, file: c.file }] }));
            openChat(chatDraft || "이 댓글대로 그 위치만 고쳐 줘", [c.file]);
          }}
          file={editFile ?? one}
          editing={!!editFile}
          selection={edit.state.selection}
          multi={edit.state.paths.length}
          error={edit.state.error}
          comments={comments}
          onSelectPath={(p) => editFile && void edit.select([p])}
        >
          {!editFile && one && board.boards[one] && (
            <BoardOptions
              file={one}
              item={board.boards[one]}
              pages={pages}
              isLaunch={board.launch?.view === "focused" && board.launch.file === one}
              onPatch={(patch) => patchBoard(one, patch)}
              onRename={() => void renameBoard(one)}
              onRenameFile={() => void renameFile(one)}
              onFocus={() => setFocusFile(one)}
              onFront={() => reorder([one], "front")}
              onBack={() => reorder([one], "back")}
              onDuplicate={() => void duplicateBoard(one)}
              onDelete={() => void deleteBoards([one])}
              onLaunch={(on) => update((b) => ({ ...b, launch: on ? { view: "focused", file: one } : { view: "canvas" } }), "시작 화면 설정")}
            />
          )}
          {!editFile && selected.length > 1 && (
            <section className="board-opts">
              <div className="sec-head">
                <span>보드 {selected.length}개 선택</span>
              </div>
              <div className="btn-row">
                <button className="icon-btn" aria-label="맨 앞으로" title={`맨 앞으로 (${mod}])`} onClick={() => reorder(selected, "front")}><Icon name="front" /></button>
                <button className="icon-btn" aria-label="맨 뒤로" title={`맨 뒤로 (${mod}[)`} onClick={() => reorder(selected, "back")}><Icon name="back" /></button>
                <button className="icon-btn" aria-label="선택한 보드로 이동" title="선택한 보드로 이동 (⇧2)" onClick={() => goTo(selected)}><Icon name="fit" /></button>
                <button className="icon-btn danger" aria-label="삭제" title="삭제 (⌫)" onClick={() => void deleteBoards(selected)}><Icon name="trash" /></button>
              </div>
            </section>
          )}
          {editFile && edit.state.selection && edit.state.selection.file === editFile && (() => {
            const sel = edit.state.selection;
            const el = frames.current.get(editFile)?.contentDocument ? elementAt(frames.current.get(editFile)!.contentDocument!, sel.path) : null;
            const attrs: Record<string, string> = {};
            if (el) for (const a of Array.from(el.attributes)) attrs[a.name] = a.value;
            const paths = edit.state.paths;
            return (
              <Properties
                onAlign={async (dir) => {
                  const d = frames.current.get(editFile)?.contentDocument;
                  const ops = d && alignOps(d, sel.path, sel.hash, dir);
                  if (!ops) return toast({ text: "블록 흐름에서는 세로 정렬을 쓸 수 없어요. 부모를 flex로 바꿔 보세요" });
                  await doEdit({ op: "batch", ops });
                }}
                onReplaceImage={sel.tag === "img" || /url\(/.test(sel.styles["background-image"] ?? "") ? () => replaceImage(sel.path, sel.tag === "img") : null}
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
          )}
        </div>
      </div>
      {playFile && (
        <Play
          board={board}
          file={playFile}
          onClose={() => setPlayFile(null)}
          onLocate={(f) => {
            setSelected([f]);
            goTo([f]);
          }}
        />
      )}
      {focusFile && board.boards[focusFile] && (
        <FocusView
          board={board}
          file={focusFile}
          onClose={() => {
            setSelected([focusFile]);
            setFocusFile(null);
          }}
          onNav={setFocusFile}
        />
      )}
      <AssetPicker open={!!picker} version={assetsVersion} onClose={() => setPicker(null)} onPick={(a) => picker?.(a)} onError={(m) => toast({ tone: "error", text: m })} />
      <ContextMenu menu={menu} onClose={() => setMenu(null)} />
      <Dialog state={ask.state} onClose={ask.close} />
    </div>
  );
}

/** 옮긴 뒤 요소의 경로: 같은 부모 안 index, 그리고 잘라낸 자리 뒤의 조상 인덱스는 하나씩 당겨진다 */
export function movedPath(from: string, toParent: string, index: number) {
  const f = from.split("/").map(Number);
  const t = toParent === "" ? [] : toParent.split("/").map(Number);
  // 대상 부모 경로가 잘라낸 요소의 (나중) 형제 아래를 지나면 그 단계 인덱스를 하나 줄인다
  const depth = f.length - 1;
  if (t.length > depth && t.slice(0, depth).every((v, i) => v === f[i]) && t[depth] > f[depth]) t[depth]--;
  return [...t, index].join("/");
}

function Box({ r, cls }: { r: { x: number; y: number; w: number; h: number }; cls: string }) {
  return <div className={`box ${cls}`} style={{ left: r.x, top: r.y, width: r.w, height: r.h }} />;
}
