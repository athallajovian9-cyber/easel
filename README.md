# design-canvas — local design canvas

A local tool that shows screen designs written as HTML files as boards, and writes edits made on the canvas straight back to the source HTML. It connects to Claude Code and Codex through MCP and an in-app chat. There is no export step.

- Each `screens/*.html` file in the design folder is one board. When an AI writes HTML, it shows up on the canvas right away.
- Edits on the canvas change only that part of the source HTML. The file is never rewritten as a whole, so its formatting stays intact.
- Layout is saved in `board.json`, comments in `comments.json`, and tokens in `tokens.json` (once registered), all shared through git.

This is a **standalone repo**. It was first built as `tools/design-canvas` in a [team project](https://github.com/snuhcs-course/swpp-2026-project-team-06) (DEV-26) and moved here with its history. Projects use it as a git submodule. Plans and decisions are in [PLAN.md](PLAN.md), the comparison with Claude Design's core features is in [PARITY.md](PARITY.md), and the work log is in [tasks.md](tasks.md).

## Using it in another project (submodule)

When the design folder is `<project>/docs/design` (with `screens/` inside):

```bash
git submodule add https://github.com/nemodleo/design-canvas.git tools/design-canvas
```

Add scripts to the project root `package.json`.

```json
{
  "scripts": {
    "design:install": "git submodule update --init tools/design-canvas && npm --prefix tools/design-canvas install",
    "design": "npm --prefix tools/design-canvas start"
  }
}
```

```bash
npm run design:install   # once (fetch submodule + install)
npm run design           # http://localhost:4317
```

- The default `--dir` is **`../../docs/design` relative to this tool's folder**. With the submodule at `tools/design-canvas`, it opens the project's `docs/design` directly. Otherwise use `npm --prefix tools/design-canvas start -- --dir <design folder> --port <port>`.
- It is a standalone package installed separately from the project app, so it does not affect app install, build, or deploy. It also does not affect CI that skips submodules (the `actions/checkout` default).
- Screenshots and thumbnails use `playwright`. Without a downloaded Chromium it uses the installed Chrome. If neither exists, only those features are unavailable.

### Updating the submodule

1. Push changes to this repo (nemodleo/design-canvas). To change the tool, open a PR here.
2. In the project, run `git submodule update --remote tools/design-canvas`
3. Commit the updated submodule pointer: `git add tools/design-canvas && git commit -m "chore: update design-canvas"`

Teammates get the same commit with `git submodule update --init tools/design-canvas` (or `npm run design:install`) after `git pull`.

## Running standalone

```bash
npm install
npm start -- --dir <design folder>
```

## How to use

The comparison with Claude Design's core features and its evidence are in [PARITY.md](PARITY.md); per-screen check screenshots are in `.out/ux/` (local).

| To do this | How |
| --- | --- |
| Pan and zoom | Drag empty space, Space, or Hand (H); trackpad scroll; ⌘+wheel or pinch (4–400%). ⇧1 Fit all, ⇧2 selection, ⌘0 Zoom to 100%, Minimap (M) |
| Find | Left "Boards" tab: ⌘K search and list; pages (drag to reorder; right-click to rename, delete, or set the start page) |
| Boards | Draw with the board tool (B) or use a "New board" template (Blank · Mobile screen · Desktop screen · Document), or drop an HTML file on the canvas. Duplicate ⌘D, rename F2 (renaming the file offers to update references), Delete (confirm, trash, undo), Bring to front / Send to back ⌘] ⌘[ |
| Multiple items | Drag on empty space to marquee-select or use Shift; move together (snap guides, Alt to disable); arrow keys 1, Shift 10, Option 100 |
| Board options | Right "Properties": position, size, Radius, Frameless, Interactive (Play), Fill window (page-style), Open as launch screen, Layout guides (Columns · Rows · Grid, 6 total, ⌃G), Tweaks |
| View | Focus view (F, ←→), Play in place (P or ▶, Esc), Play full screen (right-click) |
| Notes and shapes | Title (T), sticky note (N, 8 colors, size, bold, italic), Rectangle (R), Oval (O), Line (L), Arrow (A), Pen (P, same key as board Play; works when no board is selected), image (Assets or paste) |
| Edit mode | Double-click or E. Click or Shift, Esc for parent, Enter for child, ↑↓ for siblings, Option+↑↓ to reorder, ⌘A for all siblings, ⌘G Wrap in flex |
| Direct editing | Move with handles (Alt keeps inside the box) and resize, 6 align options, double-click text (Shift+Enter for line break), Properties panel (token chips, ⚠, contrast ratio), Replace image, ⌘C/⌘V to paste into another board |
| Undo | ⌘Z / ⌘⇧Z. Canvas actions, HTML edits, and board create/delete share one history (100 entries) |
| Design system | Register tokens (docs/design/tokens.json) and themes in the left "Tokens" tab, Theme menu in the toolbar, Token check and Accessibility lists on the right |
| Collaboration | Comments (Reply, Resolve, author), Snapshot menu (git-commits only the design folder) |
| AI | Right "AI" (⌘J): choose Claude Code or Codex; selection, board, visible boards, comments, and references are sent as context; N variants; Ask AI for a review |
| Screen | F6 to move between regions, Tab to move between boards, ⌘\\ to hide panels, Appearance (System · Light · Dark) |

If someone else or an AI changed the same element in the meantime, the edit is rejected (hash check). Select it again after the screen redraws.

## Connecting AI agents (MCP)

Use it while the app (`npm run design`) is running. Through MCP, agents can look (`list_boards`, `read_board`, `screenshot`, `list_errors`, `get_tokens`, `check_tokens`), point (`get_selection`, comments and replies), and arrange the canvas (`place_board`, `create_board`, notes and pages, `save_snapshot`). Agents write HTML files directly. The in-app chat (⌘J) launches the same agents with `claude -p` and `codex exec`.

- **Claude Code**: put this in `.mcp.json` at the project root. When you open Claude Code in the project, approve the `design-canvas` server once.

  ```json
  { "mcpServers": { "design-canvas": { "type": "stdio", "command": "node", "args": ["tools/design-canvas/bin/mcp.mjs", "--port", "4317"] } } }
  ```
- **Codex**: each person registers it once in `~/.codex/config.toml`.

  ```toml
  [mcp_servers.design-canvas]
  command = "node"
  args = ["<absolute repo path>/tools/design-canvas/bin/mcp.mjs", "--port", "4317"]
  # This server's tools only view, comment, and arrange, so skip the prompt each time (without this, codex exec blocks the calls)
  default_tools_approval_mode = "approve"
  ```

Example requests: "Fix what I selected on the canvas: change the text to 'Send inquiry'", "Create a new screen scr-34.html (390×844)". A new HTML file with `<meta name="board-size" content="390x844">` is placed automatically at that size in the "new screens" row, and `place_board` can set its title and position.

## Development

- `npm test` (unit), `npm run test:e2e` (Playwright; by default uses the small folder in `test/fixtures/design`. To run against a real folder, set `DESIGN_CANVAS_E2E_DIR=<docs/design>`).
- `test/fixtures/design/` intentionally keeps Korean screen content and board titles: it mimics real user content and is needed to test Korean text input and rendering.

```bash
npm --prefix tools/design-canvas test        # source patch unit tests
npm --prefix tools/design-canvas run typecheck
```

| Folder | Contents |
| --- | --- |
| `bin/` | `server.mjs` (app server), `mcp.mjs` (MCP stdio) |
| `server/` | API (`index.mjs`, `routes.mjs`), board.json (`board.mjs`), file watching (`watch.mjs`), element paths and hashes (`html.mjs`), source patching (`edit.mjs`) |
| `app/` | Canvas UI (Vite + React + TypeScript) |
| `test/` | `node --test` |
