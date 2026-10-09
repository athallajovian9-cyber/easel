// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// 속성 패널: 값을 바꾸면 setStyle/setAttr를 보낸다. 토큰 색 7개는 스와치. PLAN.md 5장.
import { useEffect, useState } from "react";

import { contrast, offToken, themeColors, type Tokens } from "./ds";
import type { Selection } from "./types";

/** docs/design/README.md 디자인 토큰 색 */
export const TOKEN_COLORS = [
  { name: "글자", value: "#111111" },
  { name: "보조 글자", value: "#6B6B6B" },
  { name: "바탕", value: "#FFFFFF" },
  { name: "면", value: "#F5F5F3" },
  { name: "구분선", value: "#E8E8E6" },
  { name: "강조", value: "#C94F0C" },
  { name: "오류", value: "#B42318" },
];

const FIELDS: { prop: string; label: string; options?: string[]; color?: boolean }[] = [
  { prop: "width", label: "너비" },
  { prop: "height", label: "높이" },
  { prop: "padding", label: "padding" },
  { prop: "margin", label: "margin" },
  { prop: "gap", label: "gap" },
  { prop: "font-size", label: "글자 크기" },
  { prop: "font-weight", label: "굵기", options: ["", "400", "600", "700"] },
  { prop: "color", label: "색", color: true },
  { prop: "background", label: "배경", color: true },
  { prop: "border-radius", label: "모서리" },
  { prop: "display", label: "display", options: ["", "block", "flex", "grid", "inline-flex", "none"] },
  { prop: "flex-direction", label: "flex 방향", options: ["", "row", "column"] },
  { prop: "align-items", label: "세로 정렬", options: ["", "flex-start", "center", "flex-end", "stretch", "baseline"] },
  { prop: "justify-content", label: "가로 정렬", options: ["", "flex-start", "center", "flex-end", "space-between"] },
  { prop: "flex-wrap", label: "줄바꿈", options: ["", "nowrap", "wrap"] },
  { prop: "flex-grow", label: "늘이기", options: ["", "0", "1"] },
  { prop: "align-self", label: "자기 정렬", options: ["", "auto", "flex-start", "center", "flex-end", "stretch"] },
  { prop: "line-height", label: "줄 간격" },
  { prop: "text-align", label: "글자 정렬", options: ["", "left", "center", "right"] },
  { prop: "border", label: "테두리" },
  { prop: "box-shadow", label: "그림자" },
  { prop: "opacity", label: "투명도" },
];

/** grid-template-columns/rows → 칸 수. repeat(N, …)이면 N, 아니면 트랙 개수 */
export function gridCount(v: string | undefined): number | null {
  if (!v || v === "none") return null;
  const m = v.match(/^\s*repeat\(\s*(\d+)\s*,/);
  if (m) return Number(m[1]);
  let depth = 0;
  let n = 0;
  let inTok = false;
  for (const ch of v) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (/\s/.test(ch) && depth === 0) inTok = false;
    else if (!inTok) {
      inTok = true;
      n++;
    }
  }
  return n || null;
}
export const gridValue = (n: number) => `repeat(${n}, minmax(0, 1fr))`;

const ALIGN = [
  { dir: "left", label: "왼쪽 맞춤", glyph: "⇤" },
  { dir: "hcenter", label: "가로 가운데", glyph: "↔" },
  { dir: "right", label: "오른쪽 맞춤", glyph: "⇥" },
  { dir: "top", label: "위 맞춤", glyph: "⤒" },
  { dir: "vcenter", label: "세로 가운데", glyph: "↕" },
  { dir: "bottom", label: "아래 맞춤", glyph: "⤓" },
] as const;
export type AlignDir = (typeof ALIGN)[number]["dir"];

const ATTRS: Record<string, string[]> = { a: ["href"], img: ["src", "alt"], input: ["placeholder"], button: ["aria-label"] };

export function Properties(props: {
  selection: Selection;
  inline: Record<string, string>;
  attrs: Record<string, string>;
  onStyle: (prop: string, value: string) => void;
  onAttr: (name: string, value: string | null) => void;
  onWrap: (display: "flex" | "grid") => void;
  onDuplicate: () => void;
  onDelete: () => void;
  canWrap: boolean;
  onAlign: (dir: AlignDir) => void;
  onReplaceImage: (() => void) | null;
  tokens: Tokens | null;
  /** 글자 명암 계산용 실제 배경색 */
  bg: string;
}) {
  const s = props.selection;
  const attrNames = ATTRS[s.tag] ?? [];
  return (
    <section className="props">
      <h3>속성</h3>
      {FIELDS.map((f) => (
        <Field
          key={f.prop + s.path + s.hash}
          label={f.label}
          value={props.inline[f.prop] ?? (f.prop === "background" ? props.inline["background-color"] ?? "" : "")}
          placeholder={s.styles[f.prop === "background" ? "background-color" : f.prop] ?? ""}
          options={f.options}
          color={f.color}
          swatches={f.color ? (props.tokens ? themeColors(props.tokens) : TOKEN_COLORS) : undefined}
          chips={chipsFor(f.prop, props.tokens)}
          warn={offToken(f.prop, props.inline[f.prop] ?? (f.prop === "background" ? props.inline["background-color"] ?? "" : ""), props.tokens)}
          ratio={f.prop === "color" ? contrast(props.inline.color || s.styles.color || "", props.bg) : null}
          onCommit={(v) => props.onStyle(f.prop, v)}
        />
      ))}
      {(props.inline.display ?? s.styles.display ?? "").includes("grid") &&
        (["grid-template-columns", "grid-template-rows"] as const).map((prop) => (
          <Field
            key={prop + s.path + s.hash}
            label={prop.endsWith("columns") ? "열 수" : "행 수"}
            value={String(gridCount(props.inline[prop]) ?? "")}
            placeholder={String(gridCount(s.styles[prop]) ?? "")}
            onCommit={(v) => props.onStyle(prop, /^\d+$/.test(v) && Number(v) > 0 ? gridValue(Math.min(24, Number(v))) : v)}
          />
        ))}
      {attrNames.map((n) => (
        <Field key={n + s.path + s.hash} label={n} value={props.attrs[n] ?? ""} placeholder="" onCommit={(v) => props.onAttr(n, v === "" ? null : v)} />
      ))}
      <div className="align-row" role="group" aria-label="정렬">
        {ALIGN.map((a) => (
          <button key={a.dir} className="icon-btn sm" aria-label={a.label} title={a.label} onClick={() => props.onAlign(a.dir)}>
            <span className="glyph">{a.glyph}</span>
          </button>
        ))}
      </div>
      {props.onReplaceImage && (
        <button onClick={props.onReplaceImage}>
          이미지 바꾸기…
        </button>
      )}
      <div className="row">
        <button onClick={() => props.onWrap("flex")} disabled={!props.canWrap} title="같은 부모의 연속된 형제를 고른 뒤">
          flex로 감싸기
        </button>
        <button onClick={() => props.onWrap("grid")} disabled={!props.canWrap}>
          grid로 감싸기
        </button>
      </div>
      <div className="row">
        <button onClick={props.onDuplicate}>복제</button>
        <button onClick={props.onDelete}>삭제</button>
      </div>
    </section>
  );
}

function chipsFor(prop: string, t: Tokens | null): string[] | undefined {
  if (!t) return undefined;
  if (prop === "font-size") return t.fontSizes.map((n) => `${n}px`);
  if (prop === "border-radius") return t.radii.map((n) => `${n}px`);
  if (prop === "gap" || prop === "padding") return t.spacing.filter((n) => n && n <= 24).map((n) => `${n}px`);
  return undefined;
}

function Field(p: {
  label: string;
  value: string;
  placeholder: string;
  options?: string[];
  color?: boolean;
  swatches?: { name: string; value: string }[];
  chips?: string[];
  warn?: string | null;
  ratio?: number | null;
  onCommit: (v: string) => void;
}) {
  const [v, setV] = useState(p.value);
  useEffect(() => setV(p.value), [p.value]);
  const commit = (next = v) => {
    if (next.trim() !== p.value.trim()) p.onCommit(next.trim());
  };
  return (
    <label className="field">
      <span>
        {p.label}
        {p.warn && (
          <span className="tok-warn" title={p.warn} aria-label={`토큰 밖: ${p.warn}`}>
            {" "}⚠
          </span>
        )}
      </span>
      {p.options ? (
        <select
          value={v}
          onChange={(e) => {
            setV(e.target.value);
            commit(e.target.value);
          }}
        >
          {p.options.map((o) => (
            <option key={o} value={o}>
              {o || `(${p.placeholder || "없음"})`}
            </option>
          ))}
        </select>
      ) : (
        <input
          value={v}
          placeholder={p.placeholder}
          onChange={(e) => setV(e.target.value)}
          onBlur={() => commit()}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
            if (e.key === "Escape") {
              setV(p.value);
              (e.currentTarget as HTMLInputElement).blur();
            }
          }}
        />
      )}
      {p.ratio != null && (
        <span className={`ratio ${p.ratio >= 4.5 ? "ok" : p.ratio >= 3 ? "mid" : "bad"}`} title="바탕과의 명암비(본문 4.5 이상, 큰 글자 3 이상)">
          명암 {p.ratio.toFixed(2)}:1 · {p.ratio >= 7 ? "AAA" : p.ratio >= 4.5 ? "AA" : p.ratio >= 3 ? "큰 글자만" : "부족"}
        </span>
      )}
      {p.chips && (
        <span className="chips-row">
          {p.chips.map((c) => (
            <button
              key={c}
              className={`tchip ${v === c ? "on" : ""}`}
              onClick={(e) => {
                e.preventDefault();
                setV(c);
                commit(c);
              }}
            >
              {c.replace("px", "")}
            </button>
          ))}
        </span>
      )}
      {p.color && (
        <span className="swatches">
          {(p.swatches ?? TOKEN_COLORS).map((c) => (
            <button
              key={c.value}
              className={`swatch ${v.toUpperCase() === c.value ? "on" : ""}`}
              title={`${c.name} ${c.value}`}
              style={{ background: c.value }}
              onClick={(e) => {
                e.preventDefault();
                setV(c.value);
                commit(c.value);
              }}
            />
          ))}
        </span>
      )}
    </label>
  );
}
