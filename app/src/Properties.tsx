// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// 속성 패널: 값을 바꾸면 setStyle/setAttr를 보낸다. 토큰 색 7개는 스와치. PLAN.md 5장.
import { useEffect, useState } from "react";

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
];

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
          onCommit={(v) => props.onStyle(f.prop, v)}
        />
      ))}
      {attrNames.map((n) => (
        <Field key={n + s.path + s.hash} label={n} value={props.attrs[n] ?? ""} placeholder="" onCommit={(v) => props.onAttr(n, v === "" ? null : v)} />
      ))}
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

function Field(p: { label: string; value: string; placeholder: string; options?: string[]; color?: boolean; onCommit: (v: string) => void }) {
  const [v, setV] = useState(p.value);
  useEffect(() => setV(p.value), [p.value]);
  const commit = (next = v) => {
    if (next.trim() !== p.value.trim()) p.onCommit(next.trim());
  };
  return (
    <label className="field">
      <span>{p.label}</span>
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
            if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
            if (e.key === "Escape") {
              setV(p.value);
              (e.currentTarget as HTMLInputElement).blur();
            }
          }}
        />
      )}
      {p.color && (
        <span className="swatches">
          {TOKEN_COLORS.map((c) => (
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
