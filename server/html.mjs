// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// 원본 HTML에서 요소 경로·원본 구간·해시를 찾는다. PLAN.md 3장.
// 경로: <body>의 자식 요소부터, 요소 자식만 센 인덱스를 "/"로 잇는다. 브라우저 DOM과 같은 규칙.
import crypto from "node:crypto";

import { parse } from "parse5";

export function parseHtml(html) {
  return parse(html, { sourceCodeLocationInfo: true });
}

export const isElement = (n) => !!n && typeof n.tagName === "string";
export const elementChildren = (n) => (n.tagName === "template" && n.content ? n.content.childNodes : n.childNodes ?? []).filter(isElement);

export function findBody(doc) {
  const html = doc.childNodes.find((n) => n.tagName === "html");
  return html?.childNodes.find((n) => n.tagName === "body") ?? null;
}

/** "0/1/3" → 요소 노드(없으면 null) */
export function nodeAtPath(doc, path) {
  let node = findBody(doc);
  if (!node) return null;
  if (path === "" || path == null) return node;
  for (const part of String(path).split("/")) {
    const i = Number(part);
    if (!Number.isInteger(i) || i < 0) return null;
    node = elementChildren(node)[i];
    if (!node) return null;
  }
  return node;
}

/** 요소의 원본 구간 [start, end) */
export function rangeOf(node) {
  const loc = node.sourceCodeLocation;
  if (!loc) return null;
  return { start: loc.startOffset, end: loc.endOffset, loc };
}

export const hashText = (s) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 12);

/** 경로의 요소 정보: 원본 outerHTML, 해시, 태그, 텍스트 */
export function inspect(html, path) {
  const doc = parseHtml(html);
  const node = nodeAtPath(doc, path);
  if (!node || node.tagName === "body") return null;
  const r = rangeOf(node);
  if (!r) return null;
  const source = html.slice(r.start, r.end);
  return { node, doc, source, hash: hashText(source), tag: node.tagName, text: textOf(node).replace(/\s+/g, " ").trim(), range: r };
}

export function textOf(node) {
  if (node.nodeName === "#text") return node.value;
  if (node.tagName === "script" || node.tagName === "style") return "";
  return (node.childNodes ?? []).map(textOf).join("");
}

/** 레이어 목록용 트리(깊이 제한) */
export function outline(html, maxDepth = 12) {
  const doc = parseHtml(html);
  const body = findBody(doc);
  const walk = (node, path, depth) =>
    elementChildren(node).map((c, i) => {
      const p = path ? `${path}/${i}` : String(i);
      const cls = c.attrs?.find((a) => a.name === "class")?.value;
      const text = textOf(c).replace(/\s+/g, " ").trim().slice(0, 40);
      return {
        path: p,
        tag: c.tagName,
        cls: cls ? cls.split(/\s+/)[0] : undefined,
        text,
        children: depth < maxDepth ? walk(c, p, depth + 1) : [],
      };
    });
  return body ? walk(body, "", 0) : [];
}
