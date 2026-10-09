// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// 편집 모드 훅: iframe 안에서 마우스 올림 외곽선, 클릭 선택(Shift 다중), Esc 상위 선택, 선택을 서버에 알림.
import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "./api";
import { computedStyles, elementAt, pathOf, rectOf, type Rect } from "./editor";
import type { Selection } from "./types";

export type EditState = {
  hover: { path: string; rect: Rect } | null;
  paths: string[];
  rects: Rect[];
  selection: Selection | null;
  error: string | null;
};

export function useEditMode(editFile: string | null, getFrame: (f: string) => HTMLIFrameElement | null, hooks?: { onTextEdit?: (el: HTMLElement, path: string) => void; onContext?: (path: string, at: { clientX: number; clientY: number }) => void }) {
  const [state, setState] = useState<EditState>({ hover: null, paths: [], rects: [], selection: null, error: null });
  const pathsRef = useRef<string[]>([]);
  pathsRef.current = state.paths;
  const hooksRef = useRef(hooks);
  hooksRef.current = hooks;

  /** 선택 경로로 사각형을 다시 계산(스크롤·새로 고침 뒤) */
  const refresh = useCallback(() => {
    if (!editFile) return;
    const doc = getFrame(editFile)?.contentDocument;
    if (!doc) return;
    setState((s) => {
      const els = s.paths.map((p) => elementAt(doc, p));
      if (els.some((e) => !e)) return { ...s, paths: [], rects: [], selection: null, error: "파일이 바뀜, 다시 선택" };
      return { ...s, rects: els.map((e) => rectOf(e!)) };
    });
  }, [editFile, getFrame]);

  const select = useCallback(
    async (paths: string[]) => {
      if (!editFile) return;
      const doc = getFrame(editFile)?.contentDocument;
      const els = doc ? paths.map((p) => elementAt(doc, p)) : [];
      if (!doc || !paths.length || els.some((e) => !e)) {
        setState((s) => ({ ...s, paths: [], rects: [], selection: null }));
        await api.put("/api/selection", { file: null }).catch(() => {});
        return;
      }
      const primary = paths[paths.length - 1];
      setState((s) => ({ ...s, paths, rects: els.map((e) => rectOf(e!)), error: null }));
      try {
        const { selection } = await api.put<{ selection: Selection }>("/api/selection", {
          file: editFile,
          path: primary,
          paths,
          styles: computedStyles(elementAt(doc, primary)!),
          ...kindLabel(elementAt(doc, primary)!),
        });
        setState((s) => (s.paths === paths || s.paths.join() === paths.join() ? { ...s, selection } : s));
      } catch (e) {
        setState((s) => ({ ...s, selection: null, error: String((e as Error).message) }));
      }
    },
    [editFile, getFrame],
  );

  // 편집 보드가 바뀌면 선택을 비운다
  useEffect(() => {
    setState({ hover: null, paths: [], rects: [], selection: null, error: null });
  }, [editFile]);

  // iframe 문서에 이벤트를 단다(불러올 때마다 다시)
  useEffect(() => {
    if (!editFile) return;
    const frame = getFrame(editFile);
    if (!frame) return;
    let detach = () => {};
    const attach = () => {
      detach();
      const doc = frame.contentDocument;
      const win = frame.contentWindow;
      if (!doc || !win) return;
      const target = (e: Event) => {
        const t = e.target as Element | null;
        return t && t.nodeType === 1 && t !== doc.body && t !== doc.documentElement ? t : null;
      };
      const onMove = (e: MouseEvent) => {
        const t = target(e);
        const p = t ? pathOf(t) : null;
        setState((s) => (p == null ? { ...s, hover: null } : s.hover?.path === p ? s : { ...s, hover: { path: p, rect: rectOf(t!) } }));
      };
      const onLeave = () => setState((s) => ({ ...s, hover: null }));
      const onClick = (e: MouseEvent) => {
        // 편집 모드에서는 링크·버튼이 동작하지 않게 막는다
        e.preventDefault();
        e.stopPropagation();
        const t = target(e);
        const p = t ? pathOf(t) : null;
        if (p == null) return;
        const cur = pathsRef.current;
        void select(e.shiftKey ? (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]) : [p]);
      };
      const onDbl = (e: MouseEvent) => {
        e.preventDefault();
        const t = target(e) as HTMLElement | null;
        const p = t ? pathOf(t) : null;
        if (t && p != null) hooksRef.current?.onTextEdit?.(t, p);
      };
      // 우클릭: 그 요소를 선택하고 앱 메뉴를 연다. iframe 안 좌표를 화면 좌표로 바꾼다
      const onCtx = (e: MouseEvent) => {
        e.preventDefault();
        const t = target(e);
        const p = t ? pathOf(t) : null;
        if (p == null) return;
        if (!pathsRef.current.includes(p)) void select([p]);
        const r = frame.getBoundingClientRect();
        const s = r.width / (frame.offsetWidth || r.width);
        hooksRef.current?.onContext?.(p, { clientX: r.left + e.clientX * s, clientY: r.top + e.clientY * s });
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.isComposing || (e.target as HTMLElement)?.isContentEditable) return; // 한글 조합 중·글자 고치는 중에는 단축키를 넘기지 않는다
        if (e.key === "Escape") {
          const cur = pathsRef.current;
          if (cur.length) {
            // 선택이 있으면 상위로만 가고, 앱에는 넘기지 않는다(편집 모드 끝내기는 선택이 없을 때 Esc)
            const last = cur[cur.length - 1];
            const up = last.includes("/") ? last.slice(0, last.lastIndexOf("/")) : null;
            void select(up == null ? [] : [up]);
            return;
          }
        }
        // 나머지 단축키는 앱 창으로 넘긴다(⌘Z 등)
        window.dispatchEvent(new KeyboardEvent("keydown", { key: e.key, code: e.code, metaKey: e.metaKey, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey }));
      };
      const onScroll = () => refresh();
      doc.addEventListener("mousemove", onMove, true);
      doc.addEventListener("mouseleave", onLeave, true);
      doc.addEventListener("click", onClick, true);
      doc.addEventListener("dblclick", onDbl, true);
      doc.addEventListener("contextmenu", onCtx, true);
      doc.addEventListener("keydown", onKey, true);
      win.addEventListener("scroll", onScroll, true);
      detach = () => {
        doc.removeEventListener("mousemove", onMove, true);
        doc.removeEventListener("mouseleave", onLeave, true);
        doc.removeEventListener("click", onClick, true);
        doc.removeEventListener("dblclick", onDbl, true);
        doc.removeEventListener("contextmenu", onCtx, true);
        doc.removeEventListener("keydown", onKey, true);
        win.removeEventListener("scroll", onScroll, true);
      };
    };
    const onLoad = () => {
      attach();
      // 파일이 바뀌어 다시 불러왔으면 같은 경로를 다시 선택해 새 해시를 받는다
      if (pathsRef.current.length) void select(pathsRef.current);
    };
    if (frame.contentDocument?.readyState === "complete") attach();
    frame.addEventListener("load", onLoad);
    return () => {
      frame.removeEventListener("load", onLoad);
      detach();
    };
  }, [editFile, getFrame, select, refresh]);

  return { state, select, refresh, setError: (error: string | null) => setState((s) => ({ ...s, error })) };
}

/** 요소 종류와 사람이 읽는 이름(MCP get_selection의 kind·label) */
export function kindLabel(el: Element) {
  const tag = el.tagName.toLowerCase();
  const role = el.getAttribute("role");
  const kind =
    tag === "img" || tag === "picture" || (el as HTMLElement).style?.backgroundImage?.includes("url(")
      ? "image"
      : tag === "button" || role === "button"
        ? "button"
        : tag === "a"
          ? "link"
          : /^(input|textarea|select)$/.test(tag)
            ? "input"
            : tag === "svg"
              ? "icon"
              : !el.children.length && el.textContent?.trim()
                ? "text"
                : "container";
  const label = (el.getAttribute("aria-label") || el.getAttribute("alt") || el.getAttribute("title") || el.getAttribute("placeholder") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60);
  return { kind, label };
}
