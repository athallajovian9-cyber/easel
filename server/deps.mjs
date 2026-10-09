// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// 끼운 보드 관계: 어느 화면이 어느 화면을 iframe(또는 dc-import 대응)으로 넣었는지. 원본이 바뀌면 끼운 쪽도 다시 그린다.
import fs from "node:fs/promises";
import path from "node:path";

const IFRAME_SRC = /<iframe\b[^>]*?\bsrc\s*=\s*["']([^"'#?]+\.html)/gi;

export function createDeps(screensDir) {
  const embeds = new Map(); // 끼운 파일 → Set(끼운 원본 파일)

  const refsOf = (file, html) => {
    const out = new Set();
    for (const m of html.matchAll(IFRAME_SRC)) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), m[1].replace(/^\.\//, "")));
      if (!target.startsWith("..")) out.add(target.replace(/^\/screens\//, "").replace(/^\//, ""));
    }
    return out;
  };

  async function update(file) {
    try {
      embeds.set(file, refsOf(file, await fs.readFile(path.join(screensDir, file), "utf8")));
    } catch {
      embeds.delete(file);
    }
  }

  async function init(files) {
    await Promise.all(files.map(update));
  }

  /** file을 (직접·간접으로) 끼운 화면들 */
  function dependents(file) {
    const out = new Set();
    const queue = [file];
    while (queue.length) {
      const f = queue.shift();
      for (const [host, refs] of embeds) if (refs.has(f) && !out.has(host) && host !== file) {
        out.add(host);
        queue.push(host);
      }
    }
    return [...out];
  }

  return { init, update, dependents, remove: (f) => embeds.delete(f) };
}
