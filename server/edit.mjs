// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// 원본 HTML 패치: 바뀐 구간만 문자열로 교체한다(다시 직렬화하지 않음). PLAN.md 0장·4장.
import { elementChildren, inspect, isElement, nodeAtPath, parseHtml } from "./html.mjs";

export class EditError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const escText = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
const splice = (html, start, end, text) => html.slice(0, start) + text + html.slice(end);

/** 대상 요소를 찾고 해시를 확인한다. 다르면 다른 사람·AI가 그사이 파일을 고친 것 */
function target(html, path, hash) {
  const info = inspect(html, path);
  if (!info) throw new EditError(409, "요소가 없어요(파일이 바뀜, 다시 선택)");
  if (hash && info.hash !== hash) throw new EditError(409, "파일이 바뀜, 다시 선택");
  return info;
}

/* ---------- style 속성 안 선언 다루기 ---------- */

/** "a:1; b: url(x;y)" → [{prop, value, start, end}] (괄호·따옴표 안의 ;는 무시) */
export function parseDecls(style) {
  const out = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  const push = (end) => {
    const seg = style.slice(start, end);
    const colon = seg.indexOf(":");
    if (colon > 0 && seg.trim()) out.push({ prop: seg.slice(0, colon).trim().toLowerCase(), value: seg.slice(colon + 1).trim(), start, end });
  };
  for (let i = 0; i < style.length; i++) {
    const ch = style[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if (ch === ";" && depth === 0) {
      push(i);
      start = i + 1;
    }
  }
  push(style.length);
  return out;
}

/** 선언 하나만 바꾼다. value가 빈 문자열이면 지운다. 나머지 선언의 글자는 그대로 둔다 */
export function setDecl(style, prop, value) {
  prop = prop.trim().toLowerCase();
  const decls = parseDecls(style);
  const d = decls.find((x) => x.prop === prop);
  const sep = /;\s/.test(style) ? "; " : ";";
  if (d) {
    if (value === "" || value == null) {
      // 뒤의 ;까지 함께 지운다
      let end = d.end;
      if (style[end] === ";") end++;
      while (style[end] === " ") end++;
      let s = style.slice(0, d.start) + style.slice(end);
      return s.replace(/;\s*$/, "").replace(/^\s+/, "");
    }
    const seg = style.slice(d.start, d.end);
    const colon = seg.indexOf(":");
    const lead = seg.slice(colon + 1).match(/^\s*/)[0];
    const trail = seg.match(/\s*$/)[0];
    const newSeg = seg.slice(0, colon + 1) + lead + value + trail;
    return style.slice(0, d.start) + newSeg + style.slice(d.end);
  }
  if (value === "" || value == null) return style;
  const base = style.replace(/\s*;?\s*$/, "");
  return base ? `${base}${sep}${prop}:${/:\s/.test(style) ? " " : ""}${value}` : `${prop}:${value}`;
}

/* ---------- 속성 구간 ---------- */
function startTagEnd(html, node) {
  const st = node.sourceCodeLocation?.startTag;
  if (!st) throw new EditError(422, "시작 태그 위치를 알 수 없어요");
  // '/>' 또는 '>' 바로 앞에 끼워 넣는다
  let i = st.endOffset - 1;
  if (html[i - 1] === "/") i--;
  while (html[i - 1] === " " || html[i - 1] === "\n") i--;
  return i;
}

function setAttrRaw(html, node, name, value) {
  const attrLoc = node.sourceCodeLocation?.attrs?.[name.toLowerCase()];
  if (attrLoc) {
    if (value == null) {
      // 앞 공백까지 지운다
      let s = attrLoc.startOffset;
      while (s > 0 && /\s/.test(html[s - 1])) s--;
      return splice(html, s, attrLoc.endOffset, "");
    }
    return splice(html, attrLoc.startOffset, attrLoc.endOffset, `${name}="${escAttr(value)}"`);
  }
  if (value == null) return html;
  const at = startTagEnd(html, node);
  return splice(html, at, at, ` ${name}="${escAttr(value)}"`);
}

/* ---------- 편집 연산 ---------- */

export function applyEdit(html, req) {
  const { op, path, hash } = req;
  if (op === "setText") {
    const { node } = target(html, path, hash);
    const kids = node.childNodes ?? [];
    if (elementChildren(node).length) throw new EditError(422, "글자 하나만 있는 요소만 바로 고칠 수 있어요");
    const texts = kids.filter((k) => k.nodeName === "#text");
    if (texts.length > 1 || kids.some((k) => k.nodeName !== "#text" && k.nodeName !== "#comment")) throw new EditError(422, "글자 하나만 있는 요소만 바로 고칠 수 있어요");
    const t = texts[0];
    if (t?.sourceCodeLocation) {
      const { startOffset, endOffset } = t.sourceCodeLocation;
      // 앞뒤 공백(들여쓰기)은 그대로 둔다
      const orig = html.slice(startOffset, endOffset);
      const lead = orig.match(/^\s*/)[0];
      const trail = orig.match(/\s*$/)[0];
      return splice(html, startOffset, endOffset, lead + escText(req.text) + trail);
    }
    const st = node.sourceCodeLocation?.startTag;
    if (!st) throw new EditError(422, "위치를 알 수 없어요");
    return splice(html, st.endOffset, st.endOffset, escText(req.text));
  }
  if (op === "setStyle") {
    const { node } = target(html, path, hash);
    const cur = node.attrs?.find((a) => a.name === "style")?.value ?? "";
    const next = setDecl(cur, String(req.prop), req.value == null ? "" : String(req.value));
    if (next === cur) return html;
    const loc = node.sourceCodeLocation?.attrs?.style;
    if (loc) {
      // 원래 따옴표를 지켜 값 부분만 바꾼다
      const raw = html.slice(loc.startOffset, loc.endOffset);
      const m = raw.match(/^(style\s*=\s*)(["']?)([\s\S]*?)\2$/i);
      if (!m) throw new EditError(422, "style 속성을 읽을 수 없어요");
      const q = m[2] || '"';
      if (!next) {
        let s = loc.startOffset;
        while (s > 0 && /\s/.test(html[s - 1])) s--;
        return splice(html, s, loc.endOffset, "");
      }
      const val = q === '"' ? next.replace(/"/g, "&quot;") : next.replace(/'/g, "&#39;");
      return splice(html, loc.startOffset, loc.endOffset, `${m[1]}${q}${val}${q}`);
    }
    return setAttrRaw(html, node, "style", next);
  }
  if (op === "setAttr") {
    const { node } = target(html, path, hash);
    if (!/^[a-zA-Z_:][-a-zA-Z0-9_:.]*$/.test(String(req.name ?? ""))) throw new EditError(400, "속성 이름이 잘못됐어요");
    return setAttrRaw(html, node, req.name, req.value == null ? null : String(req.value));
  }
  if (op === "delete") {
    const { range } = target(html, path, hash);
    let { start, end } = range;
    // 요소가 한 줄을 다 차지하면 그 줄을 지운다
    const lineStart = html.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = html.indexOf("\n", end);
    if (/^\s*$/.test(html.slice(lineStart, start)) && /^\s*$/.test(html.slice(end, lineEnd === -1 ? html.length : lineEnd))) {
      start = lineStart;
      end = lineEnd === -1 ? html.length : lineEnd + 1;
    }
    return splice(html, start, end, "");
  }
  if (op === "duplicate") {
    const { range, source } = target(html, path, hash);
    const lineStart = html.lastIndexOf("\n", range.start - 1) + 1;
    const indent = html.slice(lineStart, range.start);
    const sep = /^\s*$/.test(indent) ? "\n" + indent : "";
    return splice(html, range.end, range.end, sep + source);
  }
  if (op === "move") return moveElement(html, req);
  if (op === "wrap") return wrapElements(html, req);
  throw new EditError(400, `모르는 op: ${op}`);
}

/** 요소 구간을 잘라 대상 부모의 index 위치에 붙인다(같은 파일 안) */
function moveElement(html, { path, hash, toParentPath, index }) {
  const { range, source } = target(html, path, hash);
  if (String(toParentPath) === path || String(toParentPath).startsWith(path + "/")) throw new EditError(422, "자기 안으로는 옮길 수 없어요");
  const doc = parseHtml(html);
  const parent = nodeAtPath(doc, toParentPath ?? "");
  if (!parent || !isElement(parent)) throw new EditError(409, "옮길 곳이 없어요");
  const siblings = elementChildren(parent);
  const self = nodeAtPath(doc, path);
  const others = siblings.filter((s) => s !== self);
  const i = Math.max(0, Math.min(Number(index) || 0, others.length));
  let at;
  let indent = "";
  if (i < others.length) {
    at = others[i].sourceCodeLocation.startOffset;
    const ls = html.lastIndexOf("\n", at - 1) + 1;
    if (/^\s*$/.test(html.slice(ls, at))) {
      indent = html.slice(ls, at);
      at = ls;
    }
  } else if (others.length) {
    at = others[others.length - 1].sourceCodeLocation.endOffset;
  } else {
    at = parent.sourceCodeLocation.startTag.endOffset;
  }
  // 잘라낸 자리의 빈 줄도 함께 정리
  let cutStart = range.start;
  let cutEnd = range.end;
  const ls = html.lastIndexOf("\n", cutStart - 1) + 1;
  const le = html.indexOf("\n", cutEnd);
  const ownLine = /^\s*$/.test(html.slice(ls, cutStart)) && /^\s*$/.test(html.slice(cutEnd, le === -1 ? html.length : le));
  if (ownLine) {
    cutStart = ls;
    cutEnd = le === -1 ? html.length : le + 1;
  }
  const insert = indent && ownLine ? indent + source + "\n" : (i >= others.length && others.length && ownLine ? "\n" + html.slice(ls, range.start) + source : source);
  if (at >= cutEnd) {
    const shifted = at - (cutEnd - cutStart);
    const removed = html.slice(0, cutStart) + html.slice(cutEnd);
    return removed.slice(0, shifted) + insert + removed.slice(shifted);
  }
  if (at <= cutStart) {
    return html.slice(0, at) + insert + html.slice(at, cutStart) + html.slice(cutEnd);
  }
  throw new EditError(422, "옮길 위치가 잘못됐어요");
}

/** 같은 부모의 연속된 형제를 <div style="display:flex;gap:8px">로 감싼다 */
function wrapElements(html, { paths, hashes, display = "flex", direction }) {
  if (!Array.isArray(paths) || !paths.length) throw new EditError(400, "paths가 필요해요");
  const infos = paths.map((p, i) => target(html, p, hashes?.[i]));
  const parentOf = (p) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
  const parent = parentOf(paths[0]);
  if (paths.some((p) => parentOf(p) !== parent)) throw new EditError(422, "같은 부모 아래 요소만 감쌀 수 있어요");
  const idx = paths.map((p) => Number(p.split("/").pop())).sort((a, b) => a - b);
  if (idx.some((v, i) => i && v !== idx[i - 1] + 1)) throw new EditError(422, "연속된 형제만 감쌀 수 있어요");
  const start = Math.min(...infos.map((x) => x.range.start));
  const end = Math.max(...infos.map((x) => x.range.end));
  const style = display === "grid" ? "display:grid;gap:8px" : `display:flex;${direction === "column" ? "flex-direction:column;" : ""}gap:8px`;
  const ls = html.lastIndexOf("\n", start - 1) + 1;
  const indent = /^\s*$/.test(html.slice(ls, start)) ? html.slice(ls, start) : "";
  const inner = html.slice(start, end);
  if (indent && inner.includes("\n")) {
    const reindented = inner.replace(/\n/g, "\n  ");
    return splice(html, start, end, `<div style="${style}">\n${indent}  ${reindented}\n${indent}</div>`);
  }
  return splice(html, start, end, `<div style="${style}">${inner}</div>`);
}
