<div align="center">

<img src="assets/logo.png" alt="npad" width="120" />

# npad

**notepad for agents** — a scratchpad your AI agents read and write to, so knowledge survives across terminals, sessions, and tools.

[![npm](https://img.shields.io/npm/v/@npad/cli?color=F5A524&label=%40npad%2Fcli&labelColor=07070A)](https://www.npmjs.com/package/@npad/cli)
[![license](https://img.shields.io/badge/license-MIT-F5A524?labelColor=07070A)](LICENSE)
[![site](https://img.shields.io/badge/site-npad.run-F5A524?labelColor=07070A)](https://npad.run)

</div>

---

```
Terminal 1 (Claude Code):
  you:    save how we portforwarded Dumbledore
  claude: → note_write → saved (id: k7f2a)

Terminal 2 (Codex, two days later):
  you:    how did we portforward Dumbledore?
  codex:  → note_search "dumbledore" → finds k7f2a → reads it → continues
```

Every agent — Claude Code, Codex, Cursor, anything that speaks MCP — reads from and writes to the same notepad. **Save once, recall forever.**

## Why

- `CLAUDE.md` is local to one tool, project-scoped, and rots.
- Notion is for humans, not agents.
- npad is the missing layer: one place every agent writes to and reads from, with stable URLs you can hand to a teammate.

## Install

```bash
npm i -g @npad/cli                                       # CLI
npad login                                               # one-time sign-in
claude mcp add --scope user npad -- npx -y @npad/mcp     # wires up Claude Code
```

That's it. Local mode works offline forever, no signup. Run `npad login` only if you want sync across machines or shareable URLs.

## What you get

**6 MCP tools for your agents:**

| Tool | What it does |
|---|---|
| `note_write` | save a note with title + body + optional tags + visibility |
| `note_read` | fetch a note by id or URL |
| `note_append` | add a section to an existing note |
| `note_search` | keyword search across your vault |
| `note_fork` | copy any note (yours or unlisted) into your own vault |
| `note_delete` | remove a note (agent always confirms first) |

**A friendly CLI for humans:**

```
npad           # interactive menu
npad list      # recent notes
npad new       # opens VS Code / Cursor / nano
npad search    # keyword search
npad show ID
npad edit ID
npad rm ID
npad doctor    # diagnose your setup
npad login     # sign in (enables sync + sharing)
```

## Sharing

Mark a note `unlisted` and you get a stable URL like `npad.run/n/k7f2a`. Paste it anywhere — Slack, email, README. Anyone you send it to can:

1. **Open it in their agent** — their npad-equipped Claude/Codex calls `note_read` and gets the body.
2. **Open it in a browser** — they see the rendered note in a read-only "note.md" panel, so humans can verify before passing it to an agent.

Three visibility levels:

| Level | Who can read |
|---|---|
| `private` (default) | only you |
| `unlisted` | anyone with the URL |
| `domain` | signed-in users with the same email domain (e.g. `@yourcompany.com`) |

Recipients can't edit, only `note_fork` to their own vault — sharing stays clean and append-free.

## Architecture

```
[Claude / Codex / Cursor] ── MCP ──> npad-mcp (npx)
                                         │
                            ┌────────────┴────────────┐
                            ▼                          ▼
                     SqliteStore                  HttpStore
                  ~/.npad/npad.db              Hono on Vercel
                  (default, offline)            + Neon Postgres
                                                + Firebase Auth
```

Monorepo:

| Package | What |
|---|---|
| [`packages/core`](packages/core) | types, Store interface, id helpers |
| [`packages/mcp`](packages/mcp) | the `npx @npad/mcp` server with sqlite + http stores |
| [`packages/cli`](packages/cli) | the `npad` command for humans |
| [`api/`](api) | Hono API for hosted mode (Vercel entrypoint) |

## Star history

<a href="https://star-history.com/#ibedevesh/npad-ai&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=ibedevesh/npad-ai&type=Date&theme=dark" />
    <img alt="Star history" src="https://api.star-history.com/svg?repos=ibedevesh/npad-ai&type=Date" />
  </picture>
</a>

## License

MIT. Use it, fork it, sell it.
