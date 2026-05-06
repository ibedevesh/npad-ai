<div align="center">

<img src="assets/logo.png" alt="npad" width="120" />

# npad

**notepad for agents** — one shared notepad your agents read, write, and pick up where another left off.

[![npm](https://img.shields.io/npm/v/@npad/cli?color=F5A524&label=%40npad%2Fcli&labelColor=07070A)](https://www.npmjs.com/package/@npad/cli)
[![license](https://img.shields.io/badge/license-MIT-F5A524?labelColor=07070A)](LICENSE)
[![site](https://img.shields.io/badge/site-npad.run-F5A524?labelColor=07070A)](https://npad.run)

</div>

---

```
> new to the team — can you set up the checkout service locally?
  here's our runbook: npad.run/n/k7f2a

claude: → note_read("k7f2a") → reads runbook
        → clone, vault pull, docker compose, migrate, seed
        → handles the gotcha the runbook flagged
        → "Done. Checkout running locally with tenant acme-test."
```

One link. Your agent skips the figuring-out — and the tokens it would've burned getting there.

## npad isn't memory

| Memory | npad |
|---|---|
| What an agent remembers about *you* | What you tell an agent to *save* |
| Implicit, private, account-bound | Explicit. Has an id. Has a URL. |
| Stays in your account | Goes into a Slack thread, a teammate's agent, a public link |

**Memory remembers you. npad remembers the work.** They coexist.

## What you can do with it

- **Across your terminals** — fix it in Claude today, recall it in Codex tomorrow. Same notepad, every tool.
- **Across your team** — paste `npad.run/n/k7f2a`. Their agent reads it directly, picks up where yours finished.
- **Across agents (saves tokens)** — Claude figures something out once. Cursor doesn't re-explore the same paths next week — it reads the note and ships.

## Install · 3 commands

```bash
npm i -g @npad/cli
npad login
claude mcp add --scope user npad -- npx -y @npad/mcp
```

Restart your agent. Done — your Claude Code / Codex / Cursor now has 6 npad tools. Works offline against a local SQLite DB. Sign in only when you want sync or shareable URLs.

## The 6 MCP tools your agent gets

| Tool | What it does |
|---|---|
| `note_write` | save a note (title, body, tags, visibility) |
| `note_read` | fetch a note by id or URL |
| `note_append` | add a section to an existing note |
| `note_update` | edit an existing note |
| `note_search` | keyword search across the vault |
| `note_fork` | copy any note (yours or unlisted) into your own vault |
| `note_delete` | remove a note (agent confirms first) |

## Sharing

Mark a note `unlisted` and you get a stable URL like `npad.run/n/k7f2a`. Send it anywhere:

1. **Their agent** — npad-equipped Claude/Codex calls `note_read` and gets the body.
2. **A browser** — humans see a rendered read-only view, can verify before passing to an agent.

| Visibility | Who can read |
|---|---|
| `private` (default) | only you |
| `unlisted` | anyone with the URL |
| `domain` | signed-in users with the same email domain |

Recipients can't edit — only `note_fork` to their own vault. Sharing stays clean and append-free.

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

| Package | What |
|---|---|
| [`packages/core`](packages/core) | types, Store interface, id helpers |
| [`packages/mcp`](packages/mcp) | the `npx @npad/mcp` server with sqlite + http stores |
| [`packages/cli`](packages/cli) | the `npad` command for humans |
| [`api/`](api) | Hono API for hosted mode (Vercel entrypoint) |

## What's next

A public layer — agents hit an error, search npad, find a fix another agent shipped last week. Knowledge compounds across teams, not just within them. Star the repo if that's interesting.

## Star history

<a href="https://star-history.com/#ibedevesh/npad-ai&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=ibedevesh/npad-ai&type=Date&theme=dark" />
    <img alt="Star history" src="https://api.star-history.com/svg?repos=ibedevesh/npad-ai&type=Date" />
  </picture>
</a>

## License

MIT.
