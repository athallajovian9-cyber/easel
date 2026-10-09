// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// 디자인 토큰: docs/design/tokens.json(없으면 docs/design/README.md 표의 기본값). 테마별 색, 글자 크기·굵기·모서리·간격.
// 토큰 밖 값 검사(lint): style 속성과 <style> 안의 색·글자 크기·모서리·간격을 토큰과 비교한다.
import fs from "node:fs/promises";
import path from "node:path";

import { writeAtomic } from "./fsutil.mjs";
import { elementChildren, findBody, parseHtml } from "./html.mjs";
import { readBody, sendJson } from "./index.mjs";

export const DEFAULT_TOKENS = {
  version: 1,
  active: "기본",
  themes: {
    기본: {
      글자: "#111111",
      "보조 글자": "#6B6B6B",
      바탕: "#FFFFFF",
      면: "#F5F5F3",
      구분선: "#E8E8E6",
      강조: "#C94F0C",
      "강조 눌림": "#A8420A",
      오류: "#B42318",
    },
  },
  fontSizes: [34, 22, 17, 16, 15],
  fontWeights: [400, 600, 700],
  radii: [4, 8, 16, 999],
  spacing: [0, 4, 8, 12, 16, 20, 24, 32, 40],
  fontFamily: '"Pretendard Variable", Pretendard, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif',
  minTarget: 48,
};

export async function readTokens(dir) {
  try {
    const t = JSON.parse(await fs.readFile(path.join(dir, "tokens.json"), "utf8"));
    return { ...DEFAULT_TOKENS, ...t, registered: true };
  } catch {
    return { ...DEFAULT_TOKENS, registered: false };
  }
}

/* ---------- 색 ---------- */
export function toHex(v) {
  const s = String(v).trim().toLowerCase();
  let m = s.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
    if (h.length === 8 && h.slice(6) !== "ff") return null; // 반투명
    return "#" + h.slice(0, 6).toUpperCase();
  }
  m = s.match(/^rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)(?:[ ,/]+([\d.]+%?))?\s*\)$/);
  if (m) {
    if (m[4] != null && parseFloat(m[4]) < (m[4].endsWith("%") ? 100 : 1)) return null;
    return "#" + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("").toUpperCase();
  }
  return null;
}
const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g;
const COLOR_PROPS = /^(color|background|background-color|border|border-(top|right|bottom|left)(-color)?|border-color|outline|outline-color|fill|stroke|box-shadow|text-decoration-color)$/;

/** 선언 하나 검사 → 경고 목록 */
export function checkDecl(prop, value, tokens) {
  const out = [];
  const p = prop.trim().toLowerCase();
  const v = String(value).trim();
  const colors = new Set(Object.values(tokens.themes?.[tokens.active] ?? Object.values(tokens.themes ?? {})[0] ?? {}).map((c) => toHex(c)).filter(Boolean));
  if (COLOR_PROPS.test(p)) {
    for (const c of v.match(COLOR_RE) ?? []) {
      const hex = toHex(c);
      if (hex && !colors.has(hex)) out.push({ prop: p, value: c, message: `토큰에 없는 색 ${c}` });
    }
  }
  const px = (s) => [...s.matchAll(/(-?\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
  if (p === "font-size") for (const n of px(v)) if (!tokens.fontSizes.includes(n)) out.push({ prop: p, value: `${n}px`, message: `토큰에 없는 글자 크기 ${n}px (${tokens.fontSizes.join("·")})` });
  if (p === "font-weight" && /^\d+$/.test(v) && !tokens.fontWeights.includes(Number(v))) out.push({ prop: p, value: v, message: `토큰에 없는 굵기 ${v}` });
  if (p === "border-radius") for (const n of px(v)) if (!tokens.radii.includes(n) && n < 999) out.push({ prop: p, value: `${n}px`, message: `토큰에 없는 모서리 ${n}px (${tokens.radii.join("·")})` });
  if (/^(gap|row-gap|column-gap|padding|margin)(-(top|right|bottom|left))?$/.test(p))
    for (const n of px(v)) if (n % 4 !== 0) out.push({ prop: p, value: `${n}px`, message: `4 단위가 아닌 간격 ${n}px` });
  return out;
}

const decls = (style) =>
  style
    .split(";")
    .map((d) => d.split(/:(.*)/s))
    .filter((x) => x.length >= 2 && x[0].trim())
    .map(([prop, value]) => ({ prop, value }));

/** 화면 HTML 검사: [{line, path?, prop, value, message}] */
export function lintHtml(html, tokens) {
  const out = [];
  const lineOf = (off) => html.slice(0, off).split("\n").length;
  const doc = parseHtml(html);
  const body = findBody(doc);
  const walk = (node, p) => {
    elementChildren(node).forEach((el, i) => {
      const path = p ? `${p}/${i}` : String(i);
      const st = el.attrs?.find((a) => a.name === "style");
      if (st) for (const d of decls(st.value)) for (const w of checkDecl(d.prop, d.value, tokens)) out.push({ ...w, path, line: lineOf(el.sourceCodeLocation?.startOffset ?? 0) });
      walk(el, path);
    });
  };
  if (body) walk(body, "");
  // <style>은 head·body 어디에 있든
  const stack = [doc];
  while (stack.length) {
    const n = stack.pop();
    if (n.tagName === "style") {
      const text = n.childNodes?.[0]?.value ?? "";
      const base = n.childNodes?.[0]?.sourceCodeLocation?.startOffset ?? 0;
      for (const m of text.matchAll(/([a-z-]+)\s*:\s*([^;{}]+)/gi)) for (const w of checkDecl(m[1], m[2], tokens)) out.push({ ...w, line: lineOf(base + m.index) });
    }
    for (const c of n.childNodes ?? []) stack.push(c);
  }
  return out.sort((a, b) => a.line - b.line);
}

export function tokenRoutes() {
  return [
    ["GET", "/api/tokens", async (req, res, url, ctx) => sendJson(res, 200, await readTokens(ctx.dir))],
    [
      "PUT",
      "/api/tokens",
      async (req, res, url, ctx) => {
        const b = await readBody(req);
        if (!b.themes || typeof b.themes !== "object" || !Object.keys(b.themes).length) return sendJson(res, 400, { error: "themes가 필요해요" });
        const t = { version: 1, active: b.themes[b.active] ? b.active : Object.keys(b.themes)[0], themes: b.themes };
        for (const k of ["fontSizes", "fontWeights", "radii", "spacing"]) t[k] = Array.isArray(b[k]) ? b[k].map(Number).filter(Number.isFinite) : DEFAULT_TOKENS[k];
        t.fontFamily = String(b.fontFamily ?? DEFAULT_TOKENS.fontFamily);
        t.minTarget = Number(b.minTarget) || DEFAULT_TOKENS.minTarget;
        const p = path.join(ctx.dir, "tokens.json");
        const before = await fs.readFile(p, "utf8").catch(() => null);
        const after = JSON.stringify(t, null, 2) + "\n";
        await writeAtomic(p, after);
        ctx.history.push(b.label || "토큰 저장", [{ path: p, before, after }]);
        ctx.broadcast({ type: "tokens-changed" });
        ctx.broadcast({ type: "history-changed" });
        sendJson(res, 200, { ok: true });
      },
    ],
    [
      "GET",
      "/api/lint",
      async (req, res, url, ctx) => {
        const tokens = await readTokens(ctx.dir);
        const files = url.searchParams.get("f") ? [url.searchParams.get("f")] : await ctx.store.listScreenFiles();
        const result = {};
        for (const f of files) {
          const html = await fs.readFile(path.join(ctx.store.screensDir, f), "utf8").catch(() => null);
          if (html != null) result[f] = lintHtml(html, tokens);
        }
        sendJson(res, 200, { theme: tokens.active, files: result });
      },
    ],
  ];
}

