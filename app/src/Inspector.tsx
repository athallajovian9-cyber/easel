// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// 오른쪽 패널: 선택 정보·복사·스크린샷, 댓글. (M5에서 속성·레이어가 붙는다)
import { Children, useState, type ReactNode } from "react";

import { api } from "./api";
import { describe } from "./editor";
import type { Selection } from "./types";

export type Reply = { id: string; author: string; text: string; createdAt: string };
export type Comment = { id: string; file: string; path: string; text: string; author: string; createdAt: string; resolved: boolean; replies?: Reply[] };

export function Inspector(props: {
  file: string | null;
  editing: boolean;
  selection: Selection | null;
  multi: number;
  error: string | null;
  comments: Comment[];
  onSelectPath: (path: string) => void;
  onAskAI?: (c: Comment) => void;
  author: string;
  onAuthor: () => void;
  children?: ReactNode;
}) {
  const [text, setText] = useState("");
  const [shot, setShot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const sendReply = async (id: string, resolve = false) => {
    if (!reply.trim()) return;
    await api.post("/api/comments", { action: "reply", id, text: reply, author: props.author, resolve });
    setReply("");
    setReplyTo(null);
  };
  const when = (d: string) => new Date(d).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
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
    await api.post("/api/comments", { file: props.file, path: sel?.file === props.file ? sel.path : "", text, author: props.author });
    setText("");
  };

  return (
    <aside className="inspector">
      {!props.file ? (
        Children.toArray(props.children).length ? props.children : (
          <div className="inspector-empty">
            <p className="muted">보드를 고르면 옵션이 여기 나와요.</p>
            <ul className="muted">
              <li><kbd>B</kbd> 보드 그리기 · <kbd>T</kbd> 제목 · <kbd>N</kbd> 메모</li>
              <li>더블클릭 또는 <kbd>E</kbd> 편집 · <kbd>F</kbd> 전체 화면</li>
              <li>우클릭으로 메뉴 · <kbd>⌘K</kbd> 보드 찾기</li>
            </ul>
          </div>
        )
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
            <div className="row">
              <button onClick={addComment} disabled={!text.trim()}>
                댓글 달기
              </button>
              <button className="link" onClick={props.onAuthor} title="댓글 작성자 이름 바꾸기">
                작성자: {props.author}
              </button>
            </div>
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
                  {(c.replies ?? []).length > 0 && (
                    <ul className="replies">
                      {c.replies!.map((r) => (
                        <li key={r.id}>
                          <div className="c-head">
                            <strong>{r.author}</strong>
                            <span className="muted">{when(r.createdAt)}</span>
                          </div>
                          <div>{r.text}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                  {replyTo === c.id && (
                    <div className="reply-box">
                      <textarea
                        autoFocus
                        value={reply}
                        placeholder={`${props.author}(으)로 답글 (⌘Enter)`}
                        aria-label="답글"
                        onChange={(e) => setReply(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.nativeEvent.isComposing) return;
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void sendReply(c.id);
                          if (e.key === "Escape") setReplyTo(null);
                        }}
                      />
                      <div className="row">
                        <button onClick={() => void sendReply(c.id)} disabled={!reply.trim()}>
                          답글
                        </button>
                        <button onClick={() => void sendReply(c.id, true)} disabled={!reply.trim()}>
                          답하고 해결
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="row">
                    {replyTo !== c.id && (
                      <button className="link" onClick={() => setReplyTo(c.id)}>
                        답글
                      </button>
                    )}
                    <button className="link" onClick={() => api.post("/api/comments", { action: "resolve", id: c.id, resolved: !c.resolved })}>
                      {c.resolved ? "다시 열기" : "해결"}
                    </button>
                    {!c.resolved && props.onAskAI && (
                      <button className="link" onClick={() => props.onAskAI!(c)} title="이 댓글 위치만 고쳐 달라고 AI에게 보내기">
                        AI에게 보내기
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </aside>
  );
}
