// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// Play: try a board full screen and move between screens via <a href="scr-02.html"> links. PLAN.md section 5.
import { useEffect, useRef, useState } from "react";

import type { Board } from "./types";
import { strings } from "./strings";

export function Play({ board, file, onClose, onLocate }: { board: Board; file: string; onClose: () => void; onLocate: (f: string) => void }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [current, setCurrent] = useState(file);
  const item = board.boards[current] ?? board.boards[file];

  // Follow navigation inside the iframe to update title and size (links are relative, so they stay within /screens/)
  const onLoad = () => {
    const doc = ref.current?.contentDocument;
    // Open cross-origin links in a new tab
    doc?.addEventListener("click", (e) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const u = new URL(a.href, doc.baseURI);
      if (u.origin !== location.origin) {
        e.preventDefault();
        window.open(u.href, "_blank", "noopener");
      }
    });
    const loc = ref.current?.contentWindow?.location.pathname ?? "";
    const m = loc.match(/^\/screens\/(.+)$/);
    if (m) setCurrent(decodeURIComponent(m[1]));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="play" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="play-bar">
        <button onClick={() => ref.current?.contentWindow?.history.back()} title={strings.play.back}>
          ←
        </button>
        <button onClick={() => ref.current?.contentWindow?.history.forward()} title={strings.play.forward}>
          →
        </button>
        <strong>{item?.title ?? current}</strong>
        <span className="muted">{current}</span>
        <div className="spacer" />
        <button
          onClick={() => {
            onLocate(current);
            onClose();
          }}
        >
          {strings.play.viewOnCanvas}
        </button>
        <button onClick={onClose} title={strings.play.closeTitle}>
          {strings.play.close}
        </button>
      </div>
      <iframe
        ref={ref}
        className="play-frame"
        src={`/screens/${file}`}
        title="Play"
        onLoad={onLoad}
        style={{ width: Math.min(item?.w ?? 390, window.innerWidth - 32) }}
      />
    </div>
  );
}
