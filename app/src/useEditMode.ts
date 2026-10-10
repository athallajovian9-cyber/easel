// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// Edit mode hook: hover outlines inside the iframe, click to select (Shift for several), Esc to select parent, reports selection to the server.
import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "./api";
import { computedStyles, elementAt, pathOf, rectOf, type Rect } from "./editor";
import type { Selection } from "./types";
import { strings } from "./strings";

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

  /** Recompute rects from selected paths (after scroll or reload) */
  const refresh = useCallback(() => {
    if (!editFile) return;
    const doc = getFrame(editFile)?.contentDocument;
    if (!doc) return;
    setState((s) => {
      const els = s.paths.map((p) => elementAt(doc, p));
      if (els.some((e) => !e)) return { ...s, paths: [], rects: [], selection: null, error: strings.editMode.fileChanged };
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

  // Clear selection when the edited board changes
  useEffect(() => {
    setState({ hover: null, paths: [], rects: [], selection: null, error: null });
  }, [editFile]);

  // Attach events to the iframe document (again on every load)
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
        // Block links and buttons in edit mode
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
      // Right-click: select the element and open the app menu, converting iframe coordinates to screen coordinates
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
        if (e.isComposing || (e.target as HTMLElement)?.isContentEditable) return; // Don't forward shortcuts during IME composition or while editing text
        if (e.key === "Escape") {
          const cur = pathsRef.current;
          if (cur.length) {
            // With a selection, only go to the parent and don't forward to the app (Esc with no selection exits edit mode)
            const last = cur[cur.length - 1];
            const up = last.includes("/") ? last.slice(0, last.lastIndexOf("/")) : null;
            void select(up == null ? [] : [up]);
            return;
          }
        }
        // Forward other shortcuts to the app window (⌘Z etc.)
        window.dispatchEvent(new KeyboardEvent("keydown", { key: e.key, code: e.code, metaKey: e.metaKey, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey }));
        if (/^(Arrow|Delete|Backspace)/.test(e.key) || ((e.metaKey || e.ctrlKey) && /^[zydcvg]$/i.test(e.key))) e.preventDefault();
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
      // After a reload due to a file change, reselect the same paths to get new hashes
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

/** Element kind and human-readable name (kind and label for MCP get_selection) */
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
