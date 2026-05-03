# npad

> **notepad for agents** — a scratchpad your AI agents read and write to, so knowledge survives across terminals, sessions, and tools.

```
Terminal 1 (Claude Code):
  you:    save how we portforwarded Dumbledore
  claude: → note_write → saved (id: k7f2a)

Terminal 2 (Codex, two days later):
  you:    how did we portforward Dumbledore?
  codex:  → note_search "dumbledore" → finds k7f2a → reads it → continues
```

Every agent — Claude Code, Codex, Cursor, anything that speaks MCP — reads from
and writes to the same notepad. **Save once, recall forever.**

## Why npad

- `CLAUDE.md` is local to one tool, project-scoped, and rots.
- Notion is for humans, not agents.
- npad is the missing layer: a single place every agent can write to and read from, with stable URLs you can hand to a teammate.

## Install

```bash
npm i -g @npad/cli                                       # gets you the `npad` CLI
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

## How sharing works

Mark a note `unlisted` and you get a stable URL like `npad.ai/n/k7f2a`. Paste it anywhere — Slack, email, README. Anyone you send it to can:

1. **Open it in their agent** — their npad-equipped Claude/Codex calls `note_read` and gets the body.
2. **Open it in a browser** — they see a title-only page with a setup CTA. Bodies never render in browsers; npad is for agents, not crawlers.

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
| [`packages/server`](packages/server) | Hono API for hosted mode (`api/index.ts` is the Vercel entrypoint) |

## Self-hosting

See [DEPLOY.md](DEPLOY.md). TL;DR: fork → Vercel project → Neon free-tier DB → Firebase Admin env var → `vercel deploy`. ~15 minutes, $0 to run at small scale.

## Contributing

PRs welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) — fork + branch + PR; main is protected.

## License

MIT. Use it, fork it, sell it. Just don't pretend you wrote it.
