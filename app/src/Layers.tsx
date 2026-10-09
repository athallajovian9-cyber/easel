// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// 레이어 목록: 원본 HTML의 요소 트리. 클릭하면 선택, 끌어서 다른 항목 위에 놓으면 그 앞으로 옮긴다(move). PLAN.md 5장.
import { useEffect, useState } from "react";

import { api } from "./api";

type Node = { path: string; tag: string; cls?: string; text: string; children: Node[] };

const parentOf = (p: string) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
const indexOf = (p: string) => Number(p.split("/").pop());

export function Layers(props: { file: string; version: number; selected: string[]; onSelect: (path: string, add: boolean) => void; onMove: (path: string, toParentPath: string, index: number) => void }) {
  const [tree, setTree] = useState<Node[]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>({ "0": true });
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ tree: Node[] }>(`/api/outline?f=${encodeURIComponent(props.file)}`)
      .then((r) => setTree(r.tree))
      .catch(() => setTree([]));
  }, [props.file, props.version]);

  // 선택한 요소가 보이게 조상을 펼친다
  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const p of props.selected) {
      const parts = p.split("/");
      for (let i = 1; i < parts.length; i++) next[parts.slice(0, i).join("/")] = true;
    }
    if (Object.keys(next).length) setOpen((o) => ({ ...o, ...next }));
  }, [props.selected.join("|")]);

  const drop = (target: string) => {
    if (!dragging || dragging === target || target.startsWith(dragging + "/")) return;
    const toParent = parentOf(target);
    let index = indexOf(target);
    // 서버 index는 자기를 뺀 형제 순서다: 같은 부모에서 뒤로 옮길 때는 하나 줄인다
    if (parentOf(dragging) === toParent && indexOf(dragging) < index) index -= 1;
    props.onMove(dragging, toParent, index);
  };

  const row = (n: Node, depth: number) => {
    const has = n.children.length > 0;
    const isOpen = open[n.path];
    return (
      <li key={n.path}>
        <div
          className={`layer ${props.selected.includes(n.path) ? "on" : ""} ${over === n.path ? "over" : ""}`}
          style={{ paddingLeft: 4 + depth * 12 }}
          draggable
          onDragStart={(e) => {
            setDragging(n.path);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragEnd={() => {
            setDragging(null);
            setOver(null);
          }}
          onDragOver={(e) => {
            if (!dragging) return;
            e.preventDefault();
            setOver(n.path);
          }}
          onDragLeave={() => setOver((o) => (o === n.path ? null : o))}
          onDrop={(e) => {
            e.preventDefault();
            drop(n.path);
            setOver(null);
          }}
          onClick={(e) => props.onSelect(n.path, e.shiftKey)}
        >
          <button
            className="twisty"
            style={{ visibility: has ? "visible" : "hidden" }}
            onClick={(e) => {
              e.stopPropagation();
              setOpen((o) => ({ ...o, [n.path]: !isOpen }));
            }}
          >
            {isOpen ? "▾" : "▸"}
          </button>
          <code>{n.tag}</code>
          {n.cls && <span className="muted">.{n.cls}</span>}
          {n.text && <span className="layer-text">{n.text}</span>}
        </div>
        {has && isOpen && <ul>{n.children.map((c) => row(c, depth + 1))}</ul>}
      </li>
    );
  };

  return (
    <section className="layers">
      <h3>레이어</h3>
      <p className="muted small">끌어서 다른 항목 위에 놓으면 그 앞으로 옮겨요. Shift+클릭으로 여러 개(감싸기용).</p>
      <ul className="layer-tree">{tree.map((n) => row(n, 0))}</ul>
    </section>
  );
}
