// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// Properties panel: changing a value sends setStyle/setAttr. The 7 token colors are swatches. PLAN.md section 5.
import { useEffect, useState } from "react";

import { contrast, offToken, themeColors, type Tokens } from "./ds";
import type { Selection } from "./types";
import { strings } from "./strings";

/** Design token colors from docs/design/README.md */
export const TOKEN_COLORS = [
  { name: strings.properties.tokenColors.text, value: "#111111" },
  { name: strings.properties.tokenColors.secondaryText, value: "#6B6B6B" },
  { name: strings.properties.tokenColors.background, value: "#FFFFFF" },
  { name: strings.properties.tokenColors.surface, value: "#F5F5F3" },
  { name: strings.properties.tokenColors.divider, value: "#E8E8E6" },
  { name: strings.properties.tokenColors.accent, value: "#C94F0C" },
  { name: strings.properties.tokenColors.error, value: "#B42318" },
];

const FIELDS: { prop: string; label: string; options?: string[]; color?: boolean }[] = [
  { prop: "width", label: strings.properties.fields.width },
  { prop: "height", label: strings.properties.fields.height },
  { prop: "padding", label: "padding" },
  { prop: "margin", label: "margin" },
  { prop: "gap", label: "gap" },
  { prop: "font-size", label: strings.properties.fields.fontSize },
  { prop: "font-weight", label: strings.properties.fields.fontWeight, options: ["", "400", "600", "700"] },
  { prop: "color", label: strings.properties.fields.color, color: true },
  { prop: "background", label: strings.properties.fields.background, color: true },
  { prop: "border-radius", label: strings.properties.fields.radius },
  { prop: "display", label: "display", options: ["", "block", "flex", "grid", "inline-flex", "none"] },
  { prop: "flex-direction", label: strings.properties.fields.flexDirection, options: ["", "row", "column"] },
  { prop: "align-items", label: strings.properties.fields.alignItems, options: ["", "flex-start", "center", "flex-end", "stretch", "baseline"] },
  { prop: "justify-content", label: strings.properties.fields.justifyContent, options: ["", "flex-start", "center", "flex-end", "space-between"] },
  { prop: "flex-wrap", label: strings.properties.fields.flexWrap, options: ["", "nowrap", "wrap"] },
  { prop: "flex-grow", label: strings.properties.fields.flexGrow, options: ["", "0", "1"] },
  { prop: "align-self", label: strings.properties.fields.alignSelf, options: ["", "auto", "flex-start", "center", "flex-end", "stretch"] },
  { prop: "line-height", label: strings.properties.fields.lineHeight },
  { prop: "text-align", label: strings.properties.fields.textAlign, options: ["", "left", "center", "right"] },
  { prop: "border", label: strings.properties.fields.border },
  { prop: "box-shadow", label: strings.properties.fields.boxShadow },
  { prop: "opacity", label: strings.properties.fields.opacity },
];

/** grid-template-columns/rows → track count. N for repeat(N, …), otherwise the number of tracks */
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
  { dir: "left", label: strings.properties.alignButtons.left, glyph: "⇤" },
  { dir: "hcenter", label: strings.properties.alignButtons.hcenter, glyph: "↔" },
  { dir: "right", label: strings.properties.alignButtons.right, glyph: "⇥" },
  { dir: "top", label: strings.properties.alignButtons.top, glyph: "⤒" },
  { dir: "vcenter", label: strings.properties.alignButtons.vcenter, glyph: "↕" },
  { dir: "bottom", label: strings.properties.alignButtons.bottom, glyph: "⤓" },
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
  /** Actual background color, for text contrast */
  bg: string;
}) {
  const s = props.selection;
  const attrNames = ATTRS[s.tag] ?? [];
  return (
    <section className="props">
      <h3>{strings.properties.title}</h3>
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
            label={prop.endsWith("columns") ? strings.properties.columns : strings.properties.rows}
            value={String(gridCount(props.inline[prop]) ?? "")}
            placeholder={String(gridCount(s.styles[prop]) ?? "")}
            onCommit={(v) => props.onStyle(prop, /^\d+$/.test(v) && Number(v) > 0 ? gridValue(Math.min(24, Number(v))) : v)}
          />
        ))}
      {attrNames.map((n) => (
        <Field key={n + s.path + s.hash} label={n} value={props.attrs[n] ?? ""} placeholder="" onCommit={(v) => props.onAttr(n, v === "" ? null : v)} />
      ))}
      <div className="align-row" role="group" aria-label={strings.properties.align}>
        {ALIGN.map((a) => (
          <button key={a.dir} className="icon-btn sm" aria-label={a.label} title={a.label} onClick={() => props.onAlign(a.dir)}>
            <span className="glyph">{a.glyph}</span>
          </button>
        ))}
      </div>
      {props.onReplaceImage && (
        <button onClick={props.onReplaceImage}>
          {strings.properties.replaceImage}
        </button>
      )}
      <div className="row">
        <button onClick={() => props.onWrap("flex")} disabled={!props.canWrap} title={strings.properties.wrapTitle}>
          {strings.properties.wrapFlex}
        </button>
        <button onClick={() => props.onWrap("grid")} disabled={!props.canWrap}>
          {strings.properties.wrapGrid}
        </button>
      </div>
      <div className="row">
        <button onClick={props.onDuplicate}>{strings.properties.duplicate}</button>
        <button onClick={props.onDelete}>{strings.properties.delete}</button>
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
          <span className="tok-warn" title={p.warn} aria-label={strings.properties.offToken(p.warn)}>
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
              {o || `(${p.placeholder || strings.properties.none})`}
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
        <span className={`ratio ${p.ratio >= 4.5 ? "ok" : p.ratio >= 3 ? "mid" : "bad"}`} title={strings.properties.contrastTitle}>
          {strings.properties.contrast} {p.ratio.toFixed(2)}:1 · {p.ratio >= 7 ? "AAA" : p.ratio >= 4.5 ? "AA" : p.ratio >= 3 ? strings.properties.largeTextOnly : strings.properties.tooLow}
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
