// AI-generated with Claude Code, 2026-10-09, reviewed by Hyun Park
// Embedded board relations: which screen embeds which screen via iframe (or dc-import). When the source changes, the embedding screen is redrawn too.
import fs from "node:fs/promises";
import path from "node:path";

const IFRAME_SRC = /<iframe\b[^>]*?\bsrc\s*=\s*["']([^"'#?]+\.html)/gi;

export function createDeps(screensDir) {
  const embeds = new Map(); // embedding file → Set(embedded source files)

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

  /** Screens that embed file (directly or indirectly) */
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
