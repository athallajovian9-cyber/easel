// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// Play: 전체 화면에서 보드를 눌러 보고, <a href="scr-02.html"> 링크로 화면 사이를 이동한다. PLAN.md 5장.
import { useEffect, useRef, useState } from "react";

import type { Board } from "./types";

export function Play({ board, file, onClose, onLocate }: { board: Board; file: string; onClose: () => void; onLocate: (f: string) => void }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [current, setCurrent] = useState(file);
  const item = board.boards[current] ?? board.boards[file];

  // iframe 안 이동을 따라가 제목·크기를 바꾼다(링크는 상대 경로라 /screens/ 안에서 그대로 이동)
  const onLoad = () => {
    const doc = ref.current?.contentDocument;
    // 다른 출처로 가는 링크는 새 탭으로 연다
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
        <button onClick={() => ref.current?.contentWindow?.history.back()} title="뒤로">
          ←
        </button>
        <button onClick={() => ref.current?.contentWindow?.history.forward()} title="앞으로">
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
          캔버스에서 보기
        </button>
        <button onClick={onClose} title="닫기(Esc)">
          닫기
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
