// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// 오른쪽 패널: 선택 정보·복사·스크린샷, 댓글. (M5에서 속성·레이어가 붙는다)
import { useState, type ReactNode } from "react";

import { api } from "./api";
import { describe } from "./editor";
import type { Selection } from "./types";

export type Comment = { id: string; file: string; path: string; text: string; author: string; createdAt: string; resolved: boolean };

export function Inspector(props: {
  file: string | null;
  editing: boolean;
  selection: Selection | null;
  multi: number;
  error: string | null;
  comments: Comment[];
  onSelectPath: (path: string) => void;
  children?: ReactNode;
}) {
  const [text, setText] = useState("");
  const [shot, setShot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const sel = props.selection;
  const list = props.comments.filter((c) => !props.file || c.file === props.file);

  const copy = async () => {
    if (!sel) return;
    await navigator.clipboard.writeText(describe(sel.file, sel.path, sel.tag, sel.text)).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  const takeShot = async () => {
    if (!props.file) return;
    setBusy(true);
    try {
      const r = await api.post<{ path: string }>("/api/screenshot", { file: props.file, path: sel?.path });
      setShot(r.path);
    } catch (e) {
      setShot(`실패: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  const addComment = async () => {
    if (!props.file || !text.trim()) return;
    await api.post("/api/comments", { file: props.file, path: sel?.file === props.file ? sel.path : "", text, author: "Hyun" });
    setText("");
  };

  return (
    <aside className="inspector">
      {!props.file ? (
        <p className="muted">보드를 고르세요. 보드를 더블클릭하면 편집 모드가 돼요.</p>
      ) : (
        <>
          <section>
            <h3>{props.file}</h3>
            <p className="muted">{props.editing ? "편집 모드 · 클릭으로 선택, Shift로 여러 개, Esc로 상위" : "보기 모드 · 더블클릭하면 편집"}</p>
            {props.error && <p className="warn">{props.error}</p>}
            {sel && sel.file === props.file && (
              <div className="sel">
                <div>
                  <code>&lt;{sel.tag}&gt;</code> <code>{sel.path}</code> {props.multi > 1 && <span className="muted">외 {props.multi - 1}개</span>}
                </div>
                {sel.text && <div className="sel-text">“{sel.text.slice(0, 120)}”</div>}
                <div className="row">
                  <button onClick={copy}>{copied ? "복사됨" : "복사"}</button>
                  {sel.path.includes("/") && <button onClick={() => props.onSelectPath(sel.path.slice(0, sel.path.lastIndexOf("/")))}>상위</button>}
                  <button onClick={takeShot} disabled={busy}>
                    {busy ? "찍는 중…" : "스크린샷"}
                  </button>
                </div>
              </div>
            )}
            {!sel && (
              <div className="row">
                <button onClick={takeShot} disabled={busy}>
                  {busy ? "찍는 중…" : "보드 스크린샷"}
                </button>
              </div>
            )}
            {shot && <p className="muted small">{shot}</p>}
          </section>
          {props.children}
          <section>
            <h3>댓글 {list.filter((c) => !c.resolved).length > 0 && <span className="muted">{list.filter((c) => !c.resolved).length}</span>}</h3>
            <textarea
              value={text}
              placeholder={sel?.file === props.file ? `선택한 요소(${sel.path})에 댓글` : "보드에 댓글"}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void addComment();
              }}
            />
            <button onClick={addComment} disabled={!text.trim()}>
              댓글 달기
            </button>
            <ul className="comments">
              {list.map((c) => (
                <li key={c.id} className={c.resolved ? "resolved" : ""}>
                  <div className="c-head">
                    <strong>{c.author}</strong>
                    {c.path && (
                      <button className="link" onClick={() => props.onSelectPath(c.path)}>
                        {c.path}
                      </button>
                    )}
                    <span className="muted">{new Date(c.createdAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <div>{c.text}</div>
                  <button className="link" onClick={() => api.post("/api/comments", { action: "resolve", id: c.id, resolved: !c.resolved })}>
                    {c.resolved ? "다시 열기" : "해결"}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </aside>
  );
}
