// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// 캔버스 안 채팅: 에이전트(Claude Code·Codex) 선택, 선택·보드·댓글·참고 자료 첨부, 스트리밍·취소, N가지 안.
import { useEffect, useRef, useState } from "react";

import { api } from "./api";
import { Icon } from "./icons";

export type ChatEvent =
  | { kind: "start"; agent: string; prompt: string; variants?: string[] }
  | { kind: "session"; id: string }
  | { kind: "delta"; text: string }
  | { kind: "break" }
  | { kind: "text"; text: string }
  | { kind: "tool"; name: string; detail?: string }
  | { kind: "error"; text: string }
  | { kind: "log"; text: string }
  | { kind: "done"; cost?: number }
  | { kind: "end"; status: "done" | "error" | "cancelled" };

export type Ref = { kind: "url" | "image" | "file"; value: string; name?: string };
export type Attach = { comments: { id: string; text: string; file: string }[]; refs: Ref[] };

type Msg =
  | { role: "user"; text: string; chips: string[] }
  | { role: "ai"; id: string; agent: string; parts: ({ t: "text"; text: string } | { t: "tool"; name: string; detail?: string } | { t: "error"; text: string })[]; status: "running" | "done" | "error" | "cancelled"; cost?: number; variants?: string[] };

const AGENT_LABEL: Record<string, string> = { claude: "Claude Code", codex: "Codex" };

export function ChatPanel(p: {
  selection: { file: string; path: string; tag: string; text: string } | null;
  boards: string[];
  visibleCount: number;
  titleOf: (f: string) => string;
  attach: Attach;
  setAttach: (fn: (a: Attach) => Attach) => void;
  draft: string;
  setDraft: (s: string) => void;
  subscribe: (fn: (id: string, ev: ChatEvent) => void) => () => void;
  onLocate: (files: string[]) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const [agents, setAgents] = useState<{ id: string; label: string; ok: boolean }[]>([]);
  const [agent, setAgent] = useState<string>(() => {
    try {
      return localStorage.getItem("design-canvas:agent") ?? "claude";
    } catch {
      return "claude";
    }
  });
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Record<string, string>>({});
  const [useSel, setUseSel] = useState(true);
  const [useBoards, setUseBoards] = useState(true);
  const [useVisible, setUseVisible] = useState(true);
  const [variants, setVariants] = useState(1);
  const [urlInput, setUrlInput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const runningRef = useRef<string | null>(null);
  runningRef.current = running;

  useEffect(() => {
    api.get<{ agents: typeof agents }>("/api/agents").then((r) => setAgents(r.agents)).catch(() => {});
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("design-canvas:agent", agent);
    } catch {
      /* 무시 */
    }
  }, [agent]);

  // 서버 이벤트 → 메시지. 보내기 응답보다 먼저 온 이벤트는 모아 뒀다가 붙인다
  const known = useRef(new Set<string>());
  const pending = useRef(new Map<string, ChatEvent[]>());
  const applyRef = useRef<(id: string, ev: ChatEvent) => void>(() => {});
  useEffect(
    () =>
      p.subscribe((id, ev) => {
        if (!known.current.has(id)) {
          pending.current.set(id, [...(pending.current.get(id) ?? []), ev]);
          return;
        }
        applyRef.current(id, ev);
      }),
    [p.subscribe],
  );
  applyRef.current = (id: string, ev: ChatEvent) => {
        setMsgs((list) => {
          const i = list.findIndex((m) => m.role === "ai" && m.id === id);
          if (i < 0) return list;
          const m = { ...(list[i] as Extract<Msg, { role: "ai" }>) };
          const parts = [...m.parts];
          const last = parts[parts.length - 1];
          if (ev.kind === "delta") {
            if (last?.t === "text") parts[parts.length - 1] = { t: "text", text: last.text + ev.text };
            else parts.push({ t: "text", text: ev.text });
          } else if (ev.kind === "break") {
            if (last?.t === "text" && last.text) parts.push({ t: "text", text: "" });
          } else if (ev.kind === "text") parts.push({ t: "text", text: ev.text });
          else if (ev.kind === "tool") parts.push({ t: "tool", name: ev.name, detail: ev.detail });
          else if (ev.kind === "error") parts.push({ t: "error", text: ev.text });
          else if (ev.kind === "done") m.cost = ev.cost;
          else if (ev.kind === "start") m.variants = ev.variants;
          else if (ev.kind === "end") m.status = ev.status;
          else if (ev.kind === "session") setSessions((s) => ({ ...s, [m.agent]: ev.id }));
          m.parts = parts.filter((x) => x.t !== "text" || x.text);
          const next = [...list];
          next[i] = m;
          return next;
        });
        if (ev.kind === "end") setRunning((cur) => (cur === id ? null : cur));
  };
  useEffect(() => {
    const el = listRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 160) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  const sel = useSel ? p.selection : null;
  const boards = useBoards ? p.boards : [];
  const canVariants = boards.length === 1 || (!boards.length && !!sel);

  const send = async () => {
    const text = p.draft.trim();
    if (!text || running) return;
    setError(null);
    const chips = [
      ...(sel ? [`요소 <${sel.tag}>`] : []),
      ...boards.map((f) => p.titleOf(f)),
      ...(useVisible && p.visibleCount ? [`보이는 보드 ${p.visibleCount}`] : []),
      ...p.attach.comments.map((c) => `댓글 "${c.text.slice(0, 16)}"`),
      ...p.attach.refs.map((r) => r.name ?? r.value),
      ...(variants > 1 ? [`안 ${variants}개`] : []),
    ];
    try {
      const r = await api.post<{ id: string; variants: string[] }>("/api/chat", {
        agent,
        text,
        resume: sessions[agent],
        variants: canVariants ? variants : 0,
        attach: { selection: !!sel, boards, visible: useVisible, comments: p.attach.comments.map((c) => c.id), refs: p.attach.refs },
      });
      setMsgs((l) => [...l, { role: "user", text, chips }, { role: "ai", id: r.id, agent, parts: [], status: "running" }]);
      setRunning(r.id);
      known.current.add(r.id);
      for (const ev of pending.current.get(r.id) ?? []) applyRef.current(r.id, ev);
      pending.current.delete(r.id);
      p.setDraft("");
      p.setAttach(() => ({ comments: [], refs: [] }));
      setVariants(1);
      if (r.variants.length) p.onLocate(r.variants);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const cancel = () => running && api.post("/api/chat/cancel", { id: running }).catch(() => {});

  const upload = async (files: FileList | File[]) => {
    for (const f of Array.from(files)) {
      if (f.size > 15 * 1024 * 1024) {
        setError(`${f.name}: 15MB보다 커요`);
        continue;
      }
      const data = await new Promise<string>((res) => {
        const rd = new FileReader();
        rd.onload = () => res(String(rd.result).split(",")[1] ?? "");
        rd.readAsDataURL(f);
      });
      try {
        const r = await api.post<Ref>("/api/refs", { name: f.name || "붙여넣은-이미지.png", data });
        p.setAttach((a) => ({ ...a, refs: [...a.refs, r] }));
      } catch (e) {
        setError((e as Error).message);
      }
    }
  };

  const current = agents.find((a) => a.id === agent);
  return (
    <section className="chat" aria-label="AI 채팅">
      <div className="chat-head">
        <label className="agent-pick">
          <span className="sr-only">에이전트</span>
          <select value={agent} onChange={(e) => setAgent(e.target.value)} disabled={!!running} aria-label="에이전트">
            {(agents.length ? agents : [{ id: "claude", label: "Claude Code", ok: true }, { id: "codex", label: "Codex", ok: true }]).map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
                {a.ok ? "" : " (설치 안 됨)"}
              </option>
            ))}
          </select>
        </label>
        {sessions[agent] && <span className="muted small">이어서 대화 중</span>}
        <div className="spacer" />
        <button
          className="icon-btn sm"
          aria-label="새 대화"
          title="새 대화"
          disabled={!!running || (!msgs.length && !sessions[agent])}
          onClick={() => {
            setMsgs([]);
            setSessions({});
          }}
        >
          <Icon name="plus" size={14} />
        </button>
      </div>
      <div className="chat-list" ref={listRef} aria-live="polite">
        {msgs.length === 0 ? (
          <div className="chat-empty">
            <Icon name="comment" size={28} />
            <p>
              선택한 보드·요소와 화면에 보이는 보드를 맥락으로 붙여 {AGENT_LABEL[agent] ?? agent}에게 보내요. 에이전트가 원본 HTML을 직접 고치고, 캔버스는 바로 다시 그려요.
            </p>
            <div className="chat-suggest">
              {["선택한 버튼 문구를 더 짧게", "이 화면을 다크 모드로 한 안", "빈 상태 화면 하나 새로 만들어 줘"].map((s) => (
                <button key={s} onClick={() => p.setDraft(s)}>
                  {s}
                </button>
              ))}
            </div>
            {current && !current.ok && <p className="warn">{current.label} 명령을 찾지 못했어요. 설치하고 로그인한 뒤 다시 열어 주세요.</p>}
          </div>
        ) : (
          msgs.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="msg user">
                {m.chips.length > 0 && (
                  <div className="chips">
                    {m.chips.map((c, j) => (
                      <span key={j} className="chip">
                        {c}
                      </span>
                    ))}
                  </div>
                )}
                <div className="bubble">{m.text}</div>
              </div>
            ) : (
              <div key={i} className={`msg ai ${m.status}`}>
                <div className="msg-head">
                  <strong>{AGENT_LABEL[m.agent] ?? m.agent}</strong>
                  {m.status === "running" && <span className="spinner" aria-label="실행 중" />}
                  {m.status === "cancelled" && <span className="muted">취소됨</span>}
                  {m.status === "done" && m.cost != null && <span className="muted small">${m.cost.toFixed(3)}</span>}
                </div>
                {m.variants?.length ? (
                  <button className="link" onClick={() => p.onLocate(m.variants!)}>
                    안 {m.variants.length}개를 나란히 만들었어요 · 보기
                  </button>
                ) : null}
                {m.parts.map((x, j) =>
                  x.t === "text" ? (
                    <div key={j} className="ai-text">
                      {x.text}
                    </div>
                  ) : x.t === "tool" ? (
                    <div key={j} className="ai-tool">
                      <Icon name="edit" size={12} />
                      <span>{x.name}</span>
                      {x.detail && <code>{x.detail}</code>}
                    </div>
                  ) : (
                    <div key={j} className="ai-error">
                      <Icon name="warn" size={14} /> {x.text}
                    </div>
                  ),
                )}
                {m.status === "running" && !m.parts.length && <div className="muted">생각하는 중…</div>}
              </div>
            ),
          )
        )}
      </div>
      <div
        className="composer"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length) void upload(e.dataTransfer.files);
        }}
      >
        <div className="chips">
          {p.selection && (
            <Chip on={useSel} onToggle={() => setUseSel((v) => !v)} icon="select" label={`요소 <${p.selection.tag}> ${p.selection.text.slice(0, 14)}`} />
          )}
          {p.boards.length > 0 && <Chip on={useBoards} onToggle={() => setUseBoards((v) => !v)} icon="board" label={p.boards.length === 1 ? p.titleOf(p.boards[0]) : `보드 ${p.boards.length}개`} />}
          {p.visibleCount > 0 && <Chip on={useVisible} onToggle={() => setUseVisible((v) => !v)} icon="fit" label={`보이는 보드 ${p.visibleCount}`} />}
          {p.attach.comments.map((c) => (
            <Chip key={c.id} on icon="comment" label={`댓글 "${c.text.slice(0, 14)}"`} onRemove={() => p.setAttach((a) => ({ ...a, comments: a.comments.filter((x) => x.id !== c.id) }))} />
          ))}
          {p.attach.refs.map((r, i) => (
            <Chip key={i} on icon={r.kind === "url" ? "link" : "page"} label={r.name ?? r.value} onRemove={() => p.setAttach((a) => ({ ...a, refs: a.refs.filter((_, j) => j !== i) }))} />
          ))}
        </div>
        {urlInput != null && (
          <div className="url-row">
            <input
              autoFocus
              value={urlInput}
              placeholder="https://"
              aria-label="참고 링크"
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return;
                if (e.key === "Enter" && /^https?:\/\/\S+$/.test(urlInput.trim())) {
                  p.setAttach((a) => ({ ...a, refs: [...a.refs, { kind: "url", value: urlInput.trim() }] }));
                  setUrlInput(null);
                }
                if (e.key === "Escape") setUrlInput(null);
              }}
            />
          </div>
        )}
        <textarea
          ref={p.inputRef}
          value={p.draft}
          rows={3}
          placeholder={running ? "실행 중… (Esc로 취소)" : "무엇을 바꿀까요? (Enter 보내기 · Shift+Enter 줄바꿈)"}
          aria-label="AI에게 보낼 말"
          onChange={(e) => p.setDraft(e.target.value)}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.files);
            if (files.length) {
              e.preventDefault();
              void upload(files);
            }
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing || e.keyCode === 229) return; // 한글 조합 중 Enter는 글자 확정
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
            if (e.key === "Escape") {
              if (running) cancel();
              else (e.target as HTMLTextAreaElement).blur();
            }
          }}
        />
        {error && <p className="warn small">{error}</p>}
        <div className="composer-bar">
          <button className="icon-btn sm" aria-label="파일·이미지 첨부" title="파일·이미지 첨부(끌어 놓기·붙여넣기도 돼요)" onClick={() => fileRef.current?.click()}>
            <Icon name="plus" size={14} />
          </button>
          <button className="icon-btn sm" aria-label="참고 링크 추가" title="참고 링크 추가" onClick={() => setUrlInput("")}>
            <Icon name="link" size={14} />
          </button>
          <input ref={fileRef} type="file" multiple hidden accept="image/*,.pdf,.md,.txt,.html,.csv,.json" onChange={(e) => e.target.files && void upload(e.target.files)} />
          <label className="variants" title={canVariants ? "고른 보드를 복사해 서로 다른 안을 나란히 만든다" : "보드를 하나 고르면 쓸 수 있어요"}>
            <select value={variants} disabled={!canVariants || !!running} onChange={(e) => setVariants(Number(e.target.value))} aria-label="안 개수">
              <option value={1}>안 1개</option>
              <option value={2}>안 2개</option>
              <option value={3}>안 3개</option>
              <option value={4}>안 4개</option>
            </select>
          </label>
          <div className="spacer" />
          {running ? (
            <button className="danger" onClick={cancel}>
              <Icon name="close" size={14} /> 취소
            </button>
          ) : (
            <button className="primary" disabled={!p.draft.trim()} onClick={() => void send()}>
              보내기
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function Chip({ on, onToggle, onRemove, icon, label }: { on: boolean; onToggle?: () => void; onRemove?: () => void; icon: Parameters<typeof Icon>[0]["name"]; label: string }) {
  return (
    <span className={`chip ${on ? "on" : "off"}`}>
      <button className="chip-main" onClick={onToggle} disabled={!onToggle} aria-pressed={onToggle ? on : undefined} title={onToggle ? (on ? "누르면 빼요" : "누르면 붙여요") : undefined}>
        <Icon name={icon} size={12} />
        <span>{label}</span>
      </button>
      {onRemove && (
        <button className="chip-x" aria-label={`${label} 빼기`} onClick={onRemove}>
          <Icon name="close" size={12} />
        </button>
      )}
    </span>
  );
}
