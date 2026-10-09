// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// 디자인 시스템: 토큰 등록·테마, 토큰 밖 값 검사, 접근성 검사(누르는 영역·명암비·라벨), 보드 Tweaks.
import { useEffect, useState } from "react";

import { api } from "./api";
import { pathOf } from "./editor";
import { Icon } from "./icons";

export type Tokens = {
  version: 1;
  active: string;
  themes: Record<string, Record<string, string>>;
  fontSizes: number[];
  fontWeights: number[];
  radii: number[];
  spacing: number[];
  fontFamily: string;
  minTarget: number;
  registered?: boolean;
};
export type LintItem = { line: number; path?: string; prop: string; value: string; message: string };

export function useTokens(version: number) {
  const [t, setT] = useState<Tokens | null>(null);
  useEffect(() => {
    api.get<Tokens>("/api/tokens").then(setT).catch(() => {});
  }, [version]);
  return t;
}
export const themeColors = (t: Tokens | null) => Object.entries(t?.themes[t.active] ?? {}).map(([name, value]) => ({ name, value }));

/* ---------- 색·명암 ---------- */
export function parseColor(c: string): [number, number, number, number] | null {
  const s = c.trim().toLowerCase();
  let m = s.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1];
    if (h.length <= 4) h = [...h].map((x) => x + x).join("");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1];
  }
  m = s.match(/^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+))?\s*\)$/);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] == null ? 1 : Number(m[4])];
  if (s === "transparent") return [0, 0, 0, 0];
  return null;
}
const lum = ([r, g, b]: number[]) => {
  const f = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
export function contrast(fg: string, bg: string) {
  const a = parseColor(fg);
  const b = parseColor(bg);
  if (!a || !b) return null;
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
export const toHex = (c: string) => {
  const p = parseColor(c);
  return p && p[3] === 1 ? "#" + p.slice(0, 3).map((n) => Math.round(n).toString(16).padStart(2, "0")).join("").toUpperCase() : null;
};

/** 속성 값 하나가 토큰 밖인지(속성 패널 ⚠ 표시) */
export function offToken(prop: string, value: string, t: Tokens | null): string | null {
  if (!t || !value) return null;
  const colors = new Set(themeColors(t).map((c) => toHex(c.value)));
  if (/^(color|background|background-color|border-color)$/.test(prop)) {
    const hex = toHex(value);
    if (hex && !colors.has(hex)) return `토큰에 없는 색`;
  }
  const px = [...value.matchAll(/(-?\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
  if (prop === "font-size" && px.some((n) => !t.fontSizes.includes(n))) return `토큰 글자 크기: ${t.fontSizes.join("·")}`;
  if (prop === "border-radius" && px.some((n) => !t.radii.includes(n) && n < 999)) return `토큰 모서리: ${t.radii.join("·")}`;
  if (/^(gap|padding|margin)/.test(prop) && px.some((n) => n % 4 !== 0)) return "4 단위가 아니에요";
  if (prop === "font-weight" && /^\d+$/.test(value) && !t.fontWeights.includes(Number(value))) return `토큰 굵기: ${t.fontWeights.join("·")}`;
  return null;
}

/* ---------- 접근성 검사(iframe 문서) ---------- */
export type A11yItem = { path: string; kind: "target" | "contrast" | "label"; message: string };
export function checkA11y(doc: Document, minTarget = 48): A11yItem[] {
  const win = doc.defaultView!;
  const out: A11yItem[] = [];
  const bgOf = (el: Element | null): string => {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = win.getComputedStyle(n);
      const c = parseColor(cs.backgroundColor);
      if (cs.backgroundImage !== "none") return "";
      if (c && c[3] > 0.5) return cs.backgroundColor;
    }
    return "rgb(255,255,255)";
  };
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    const cs = win.getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
  };
  const interactive = doc.body.querySelectorAll("a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=tab], [onclick]");
  for (const el of Array.from(interactive)) {
    if (!visible(el)) continue;
    const p = pathOf(el);
    if (p == null) continue;
    const r = el.getBoundingClientRect();
    if (r.width < minTarget && r.height < minTarget) out.push({ path: p, kind: "target", message: `<${el.tagName.toLowerCase()}> 누르는 영역 ${Math.round(r.width)}×${Math.round(r.height)} (${minTarget} 미만)` });
    const name = (el.getAttribute("aria-label") || el.getAttribute("title") || el.getAttribute("placeholder") || (el as HTMLElement).innerText || el.querySelector("img[alt]")?.getAttribute("alt") || "").trim();
    const labelled = el.getAttribute("aria-labelledby") || (el.id && doc.querySelector(`label[for="${el.id}"]`)) || el.closest("label");
    if (!name && !labelled) out.push({ path: p, kind: "label", message: `<${el.tagName.toLowerCase()}> 이름이 없어요(aria-label·글자·label)` });
  }
  for (const img of Array.from(doc.body.querySelectorAll("img"))) {
    if (!img.hasAttribute("alt") && visible(img)) {
      const p = pathOf(img);
      if (p != null) out.push({ path: p, kind: "label", message: "<img> alt가 없어요(꾸밈이면 alt=\"\")" });
    }
  }
  // 글자 명암: 글자를 직접 가진 요소
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const seen = new Set<Element>();
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const el = t.parentElement;
    if (!el || seen.has(el) || !t.textContent?.trim() || /^(SCRIPT|STYLE)$/.test(el.tagName) || !visible(el)) continue;
    seen.add(el);
    const cs = win.getComputedStyle(el);
    const bg = bgOf(el);
    if (!bg) continue; // 사진 위 글자는 건너뜀
    const ratio = contrast(cs.color, bg);
    if (ratio == null) continue;
    const size = parseFloat(cs.fontSize);
    const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
    const need = large ? 3 : 4.5;
    if (ratio < need) {
      const p = pathOf(el);
      if (p != null) out.push({ path: p, kind: "contrast", message: `명암 ${ratio.toFixed(2)}:1 (${need} 필요) "${t.textContent.trim().slice(0, 16)}"` });
    }
  }
  return out;
}

/* ---------- 왼쪽 '토큰' 탭: 등록·테마 ---------- */
export function TokenPanel({ tokens, onSave }: { tokens: Tokens; onSave: (t: Tokens, label: string) => void }) {
  const [t, setT] = useState(tokens);
  useEffect(() => setT(tokens), [tokens]);
  const colors = t.themes[t.active] ?? {};
  const dirty = JSON.stringify(t) !== JSON.stringify(tokens) || !tokens.registered;
  const setColors = (c: Record<string, string>) => setT({ ...t, themes: { ...t.themes, [t.active]: c } });
  const list = (k: "fontSizes" | "radii" | "spacing" | "fontWeights", label: string) => (
    <label className="field-row tok-list">
      <span>{label}</span>
      <input defaultValue={t[k].join(", ")} key={t[k].join()} aria-label={label} onBlur={(e) => setT({ ...t, [k]: e.target.value.split(/[,\s]+/).map(Number).filter((n) => Number.isFinite(n)) })} />
    </label>
  );
  return (
    <div className="tokens">
      <div className="sec-head">
        <span>테마</span>
        <button
          className="icon-btn sm"
          aria-label="테마 추가(지금 테마 복사)"
          title="테마 추가(지금 테마 복사)"
          onClick={() => {
            let name = "새 테마";
            for (let i = 2; t.themes[name]; i++) name = `새 테마 ${i}`;
            setT({ ...t, themes: { ...t.themes, [name]: { ...colors } }, active: name });
          }}
        >
          <Icon name="plus" size={14} />
        </button>
      </div>
      <div className="theme-row">
        <select value={t.active} onChange={(e) => setT({ ...t, active: e.target.value })} aria-label="쓰는 테마">
          {Object.keys(t.themes).map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
        <input
          key={t.active}
          defaultValue={t.active}
          aria-label="테마 이름"
          onBlur={(e) => {
            const n = e.target.value.trim();
            if (!n || n === t.active || t.themes[n]) return;
            const { [t.active]: cur, ...rest } = t.themes;
            setT({ ...t, themes: { ...rest, [n]: cur }, active: n });
          }}
        />
      </div>
      <div className="sec-head">
        <span>색 {Object.keys(colors).length}</span>
        <button className="icon-btn sm" aria-label="색 추가" title="색 추가" onClick={() => setColors({ ...colors, [`색 ${Object.keys(colors).length + 1}`]: "#111111" })}>
          <Icon name="plus" size={14} />
        </button>
      </div>
      <ul className="tok-colors">
        {Object.entries(colors).map(([name, value]) => (
          <li key={name}>
            <input type="color" value={toHex(value)?.toLowerCase() ?? "#000000"} aria-label={`${name} 색`} onChange={(e) => setColors({ ...colors, [name]: e.target.value.toUpperCase() })} />
            <input
              defaultValue={name}
              aria-label="색 이름"
              onBlur={(e) => {
                const n = e.target.value.trim();
                if (!n || n === name || colors[n]) return;
                setColors(Object.fromEntries(Object.entries(colors).map(([k, v]) => (k === name ? [n, v] : [k, v]))));
              }}
            />
            <code>{value}</code>
            <button className="icon-btn sm danger" aria-label={`${name} 빼기`} onClick={() => setColors(Object.fromEntries(Object.entries(colors).filter(([k]) => k !== name)))}>
              <Icon name="close" size={12} />
            </button>
          </li>
        ))}
      </ul>
      {list("fontSizes", "글자 크기")}
      {list("fontWeights", "굵기")}
      {list("radii", "모서리")}
      {list("spacing", "간격")}
      <label className="field-row tok-list">
        <span>누르는 영역</span>
        <input type="number" value={t.minTarget} onChange={(e) => setT({ ...t, minTarget: Number(e.target.value) || 48 })} aria-label="최소 누르는 영역" />
      </label>
      <button className="primary" disabled={!dirty} title="docs/design/tokens.json에 저장" onClick={() => onSave(t, tokens.registered ? "토큰 저장" : "토큰 등록")}>
        {tokens.registered ? "저장" : "토큰 등록"}
      </button>
      <p className="muted small">
        {tokens.registered ? "속성 패널 스와치·토큰 검사·AI(get_tokens)가 고른 테마 값을 써요." : "지금은 docs/design/README.md 표의 기본값이에요. 등록하면 tokens.json으로 저장돼요."}
      </p>
    </div>
  );
}

/* ---------- 오른쪽: 검사 결과 목록(토큰·접근성) ---------- */
export function CheckList({ title, items, empty, onPick, onAskAI }: { title: string; items: { path?: string; message: string; line?: number }[] | null; empty: string; onPick: (path: string) => void; onAskAI?: () => void }) {
  return (
    <section className="board-opts" aria-label={title}>
      <div className="sec-head">
        <span>
          {title} {items ? items.length : ""}
        </span>
        {onAskAI && items && items.length > 0 && (
          <button className="link" onClick={onAskAI}>
            AI에게 고쳐 달라기
          </button>
        )}
      </div>
      {items == null ? (
        <p className="muted small">보드를 화면에 보이게 하면 검사해요.</p>
      ) : items.length === 0 ? (
        <p className="ok-line">
          <Icon name="check" size={14} /> {empty}
        </p>
      ) : (
        <ul className="check-list">
          {items.slice(0, 30).map((it, i) => (
            <li key={i}>
              <button className="check-item" disabled={!it.path} onClick={() => it.path && onPick(it.path)} title={it.path ? `편집에서 ${it.path} 고르기` : `줄 ${it.line}`}>
                <Icon name="warn" size={12} />
                <span>{it.message}</span>
                <code>{it.path ?? `줄 ${it.line}`}</code>
              </button>
            </li>
          ))}
          {items.length > 30 && <li className="muted small">외 {items.length - 30}개</li>}
        </ul>
      )}
    </section>
  );
}

/* ---------- Tweaks: <script type="application/json" id="board-tweaks"> ---------- */
export type Tweak = { type: "color" | "number" | "boolean" | "enum"; value: string | number | boolean; var?: string; label?: string; min?: number; max?: number; step?: number; unit?: string; options?: string[] };
export function readTweaks(doc: Document | null | undefined): Record<string, Tweak> | null {
  const el = doc?.getElementById("board-tweaks");
  if (!el) return null;
  try {
    return JSON.parse(el.textContent ?? "");
  } catch {
    return null;
  }
}
export function applyTweak(doc: Document, key: string, t: Tweak) {
  const v = t.type === "boolean" ? (t.value ? "1" : "0") : String(t.value) + (t.type === "number" && t.unit ? t.unit : "");
  if (t.var) doc.documentElement.style.setProperty(t.var, v);
  doc.documentElement.setAttribute(`data-tweak-${key}`, t.type === "boolean" ? (t.value ? "on" : "off") : String(t.value));
}
export function TweaksPanel({ doc, onSave }: { doc: Document | null; onSave: (values: Record<string, Tweak["value"]>) => Promise<void> }) {
  const [tw, setTw] = useState<Record<string, Tweak> | null>(() => readTweaks(doc));
  const [orig, setOrig] = useState<string>(() => JSON.stringify(readTweaks(doc)));
  useEffect(() => {
    const t = readTweaks(doc);
    setTw(t);
    setOrig(JSON.stringify(t));
  }, [doc]);
  if (!tw) return null;
  const set = (k: string, value: Tweak["value"]) => {
    const next = { ...tw, [k]: { ...tw[k], value } };
    setTw(next);
    if (doc) applyTweak(doc, k, next[k]);
  };
  const dirty = JSON.stringify(tw) !== orig;
  return (
    <section className="board-opts" aria-label="Tweaks">
      <div className="sec-head">
        <span>Tweaks</span>
      </div>
      {Object.entries(tw).map(([k, t]) => (
        <label key={k} className={t.type === "boolean" ? "check" : "field-row"}>
          {t.type === "boolean" ? (
            <>
              <input type="checkbox" checked={!!t.value} onChange={(e) => set(k, e.target.checked)} />
              {t.label ?? k}
            </>
          ) : (
            <>
              <span>{t.label ?? k}</span>
              {t.type === "color" ? (
                <input type="color" value={String(t.value)} onChange={(e) => set(k, e.target.value.toUpperCase())} aria-label={t.label ?? k} />
              ) : t.type === "enum" ? (
                <select value={String(t.value)} onChange={(e) => set(k, e.target.value)} aria-label={t.label ?? k}>
                  {(t.options ?? []).map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <span className="tw-num">
                  <input type="range" min={t.min ?? 0} max={t.max ?? 100} step={t.step ?? 1} value={Number(t.value)} onChange={(e) => set(k, Number(e.target.value))} aria-label={t.label ?? k} />
                  <code>
                    {String(t.value)}
                    {t.unit ?? ""}
                  </code>
                </span>
              )}
            </>
          )}
        </label>
      ))}
      <div className="btn-row">
        <button
          disabled={!dirty}
          onClick={() => {
            const o = JSON.parse(orig) as Record<string, Tweak>;
            setTw(o);
            if (doc) for (const [k, t] of Object.entries(o)) applyTweak(doc, k, t);
          }}
        >
          되돌리기
        </button>
        <button className="primary" disabled={!dirty} onClick={() => void onSave(Object.fromEntries(Object.entries(tw).map(([k, t]) => [k, t.value]))).then(() => setOrig(JSON.stringify(tw)))}>
          원본에 저장
        </button>
      </div>
      <p className="muted small">CSS 변수로 바로 적용돼요. 저장하면 board-tweaks JSON의 value만 바뀌어요.</p>
    </section>
  );
}
