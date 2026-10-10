<div align="center">

# design-canvas

**An infinite canvas for HTML screens. Your AI agent writes the designs; you see and tweak them live.**

[![License: MIT](https://img.shields.io/badge/license-MIT-black.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-black.svg)](package.json)
[![MCP](https://img.shields.io/badge/MCP-20%20tools-3E7BFA.svg)](#connect-your-ai-agent)
[![Works with](https://img.shields.io/badge/works%20with-Claude%20Code%20·%20Codex-3E7BFA.svg)](#connect-your-ai-agent)

<img src="docs/screenshots/overview.png" alt="design-canvas showing a habit tracker app: five mobile screens on an infinite canvas with notes, flow arrows, a board list and a properties panel with token and accessibility checks" width="100%">

</div>

design-canvas turns a folder of plain HTML files into a design canvas. Claude Code or Codex writes a screen, and it shows up on the canvas a moment later. Drag, resize, retype or restyle anything on the canvas, and **only that part of the source file changes**. There is no export step and no proprietary file format: your designs stay in your repo as HTML and merge with git like any other code.

## Try it in 30 seconds

```bash
git clone https://github.com/nemodleo/design-canvas.git
cd design-canvas
npm install
npm run demo        # opens the "Tidy" habit tracker demo at http://localhost:4317
```

Then open the **AI** tab (⌘J) and ask Claude Code or Codex for a change, or double-click a screen and start editing.

## Why design-canvas

- **HTML is the source of truth.** Each `screens/*.html` file is one board. What you see is exactly what ships to the browser, and there's nothing to export or keep in sync.
- **Built for AI agents.** An MCP server with 20 tools lets agents see the boards, read what you selected, leave comments, check tokens and arrange the canvas. An in-app chat runs `claude -p` or `codex exec` with your selection as context.
- **Surgical edits.** Changes are patched into the exact source range (parse5 locations), so formatting, comments and the rest of the file stay untouched. If an agent edits the same element first, your edit is rejected instead of overwriting it.
- **Git-friendly by design.** Layout, notes and comments live in small JSON files written one entry per line, so two branches moving different boards merge without conflicts.
- **Local-first.** It runs on `127.0.0.1` and works directly on the files in your repo. No account, no cloud, no lock-in.

## Features

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/edit-mode.png" alt="Edit mode: an element selected inside a mobile screen with handles, and a properties panel with token chips"></td>
    <td width="50%"><img src="docs/screenshots/ai-chat.png" alt="AI chat panel: a streamed reply from Claude Code with Read and Edit tool lines, and the edited Stats screen on the canvas"></td>
  </tr>
  <tr>
    <td><b>Edit in place.</b> Select any element, drag it, resize it, align it, retype its text or change its styles. Layers, wrap in flex/grid, cross-board copy and paste.</td>
    <td><b>Chat with your agent.</b> Pick Claude Code or Codex, send the selection, boards and comments as context, watch the edit stream in, ask for N variants side by side.</td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/dark-mode.png" alt="Dark mode with a board context menu: Edit, Play in place, Ask AI for a review, Focus view, Rename, Duplicate, Bring to front, Delete"></td>
    <td width="50%">
      <b>Everything a canvas should do.</b>
      <ul>
        <li>Pan, zoom and minimap; thumbnails keep ~100 boards smooth (60 fps)</li>
        <li>Notes, sticky notes, shapes, arrows and images</li>
        <li>Pages, layout guides, focus view and Play in place</li>
        <li>Design tokens with off-token warnings and an accessibility check</li>
        <li>Comments with replies, git snapshots, and one undo history for canvas actions and HTML edits</li>
        <li>Context menus and keyboard shortcuts for everything; light and dark themes</li>
      </ul>
    </td>
  </tr>
</table>

## Connect your AI agent

Keep the canvas running (`npm run demo` or `npm start`). Agents write HTML files directly; the MCP server lets them **see** (`list_boards`, `read_board`, `screenshot`, `list_errors`), **know what you mean** (`get_selection` with the selected element, visible boards and the current page), **talk** (comments and replies) and **arrange** (`place_board`, `create_board`, notes, pages, `check_tokens`, `save_snapshot`).

**Claude Code**: add `.mcp.json` to your project root:

```json
{ "mcpServers": { "design-canvas": { "type": "stdio", "command": "node", "args": ["tools/design-canvas/bin/mcp.mjs", "--port", "4317"] } } }
```

**Codex**: add to `~/.codex/config.toml`:

```toml
[mcp_servers.design-canvas]
command = "node"
args = ["<absolute path>/tools/design-canvas/bin/mcp.mjs", "--port", "4317"]
default_tools_approval_mode = "approve"  # the tools only view, comment and arrange
```

Then try:

> "Fix what I selected on the canvas: make the button text shorter."
> "Make three variants of the Stats screen."
> "Create an onboarding screen at 390×844 and put it next to Today."

New files with `<meta name="board-size" content="390x844">` are placed on the canvas automatically at that size.

## Add it to your project

design-canvas is meant to live next to your code as a git submodule. With your designs in `<project>/docs/design/screens/`:

```bash
git submodule add https://github.com/nemodleo/design-canvas.git tools/design-canvas
```

```json
{
  "scripts": {
    "design:install": "git submodule update --init tools/design-canvas && npm --prefix tools/design-canvas install",
    "design": "npm --prefix tools/design-canvas start"
  }
}
```

```bash
npm run design:install   # once: fetch the submodule and install
npm run design           # http://localhost:4317
```

- The default design folder is `../../docs/design` relative to the tool, so `tools/design-canvas` opens your `docs/design` with no flags. Anywhere else: `npm --prefix tools/design-canvas start -- --dir <design folder> --port <port>`.
- It installs separately from your app, so it never touches your app's dependencies, build or deploy, and CI that skips submodules (the `actions/checkout` default) is unaffected.
- To update: push to this repo, then run `git submodule update --remote tools/design-canvas` in your project and commit the new pointer. Teammates run `npm run design:install` after `git pull`.

Running it on any folder works too: `npm start -- --dir <design folder>`.

<details>
<summary><b>Keyboard shortcuts and how-tos</b></summary>

| To do this | How |
| --- | --- |
| Pan and zoom | Drag empty space, Space, or Hand (H); trackpad scroll; ⌘+wheel or pinch (4–400%). ⇧1 Fit all, ⇧2 selection, ⌘0 Zoom to 100%, Minimap (M) |
| Find | Left "Boards" tab: ⌘K search and list; pages (drag to reorder; right-click to rename, delete, or set the launch page) |
| Boards | Draw with the board tool (B), use a "New board" template (Blank · Mobile screen · Desktop screen · Document), or drop an HTML file on the canvas. Duplicate ⌘D, rename F2 (renaming the file offers to update references), Delete (confirm, trash, undo), Bring to front / Send to back ⌘] ⌘[ |
| Multiple items | Drag on empty space to marquee-select or use Shift; move together (snap guides, Alt to disable); arrow keys 1, Shift 10, Option 100 |
| Board options | Right "Properties": position, size, Radius, Frameless, Interactive (Play), Fill window (page-style), Open as launch screen, Layout guides (Columns · Rows · Grid, up to 6, ⌃G), Tweaks |
| View | Focus view (F, ←→), Play in place (P or ▶, Esc), Play full screen (right-click) |
| Notes and shapes | Title (T), sticky note (N, 8 colors, size, bold, italic), Rectangle (R), Oval (O), Line (L), Arrow (A), Pen (P when no board is selected), image (Assets or paste) |
| Edit mode | Double-click or E. Click or Shift, Esc for parent, Enter for child, ↑↓ for siblings, Option+↑↓ to reorder, ⌘A for all siblings, ⌘G Wrap in flex |
| Direct editing | Move with handles (Alt drops inside a box) and resize, 6 align options, double-click text (Shift+Enter for a line break), Properties panel (token chips, ⚠, contrast ratio), Replace image, ⌘C/⌘V to paste into another board |
| Undo | ⌘Z / ⌘⇧Z. Canvas actions, HTML edits and board create/delete share one history (100 entries) |
| Design system | Register tokens (`tokens.json`) and themes in the left "Tokens" tab, Theme menu in the toolbar, Token check and Accessibility lists on the right |
| Collaboration | Comments (Reply, Resolve, author), Snapshot menu (git-commits only the design folder) |
| AI | Right "AI" tab (⌘J): Claude Code or Codex; selection, boards, visible boards, comments and references go along as context; N variants; Ask AI for a review |
| Screen | F6 to move between regions, Tab to move between boards, ⌘\\ to hide panels, Appearance (System · Light · Dark) |

</details>

## How it works

```
your-project/docs/design/
├── screens/*.html   ← one board per file; agents and you both edit these
├── board.json       ← positions, titles, pages, notes, shapes (one line per entry)
├── comments.json    ← comment threads pinned to elements
└── tokens.json      ← optional design tokens and themes
```

- A small Node server watches the folder (chokidar) and tells the browser which board changed, so only that board reloads, keeping scroll and selection.
- Element paths and hashes are computed from the source with parse5. Every edit is a minimal string patch into that range, written atomically.
- The canvas is a Vite + React app. Each board is an iframe of the real HTML, so scripts, links and CSS behave exactly as in a browser.

## Development

```bash
npm test             # unit tests (source patching, board format, chat parsing, tokens…)
npm run test:e2e     # Playwright end-to-end tests against test/fixtures/design
npm run typecheck
```

- `test/fixtures/design/` intentionally keeps Korean screen content and board titles: it mimics real user content and is needed to test Korean text input (IME) and rendering. Set `DESIGN_CANVAS_E2E_DIR=<folder>` to run the e2e tests against another design folder.
- `examples/demo/` is the "Tidy" demo used for the screenshots above.

| Folder | Contents |
| --- | --- |
| `bin/` | `server.mjs` (app server), `mcp.mjs` (MCP stdio server) |
| `server/` | API and routes, board.json, file watching, element paths and hashes, source patching, history, chat runner, tokens |
| `app/` | Canvas UI (Vite + React + TypeScript); all UI text lives in `app/src/strings.ts` |
| `test/` | `node --test` unit tests and Playwright e2e tests |

The project started as `tools/design-canvas` inside a [team project](https://github.com/snuhcs-course/swpp-2026-project-team-06) and moved here with its history. The original plan is in [PLAN.md](PLAN.md), a feature-by-feature comparison with Claude Design is in [PARITY.md](PARITY.md), and the work log is in [tasks.md](tasks.md).

Contributions are welcome: open an issue or a pull request.

## License

[MIT](LICENSE) © Hyun Park
