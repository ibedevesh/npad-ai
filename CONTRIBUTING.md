# Contributing to npad

Thanks for the interest. npad is small, opinionated, and we'd like to keep it that way — but good PRs are very welcome.

## How to contribute

1. **Fork** this repo to your own GitHub account.
2. **Branch** off `main`: `git checkout -b feat/<short-description>` (or `fix/`, `docs/`, `chore/`).
3. **Code** — keep it focused. One PR per change.
4. **Test** — at minimum run `pnpm -r typecheck` and `pnpm --filter @npad/mcp exec tsx src/smoke.ts`.
5. **Open a PR** against `main`. Fill in the template (what + why).
6. A maintainer reviews, suggests changes if needed, and merges. **Direct pushes to `main` are blocked** — every change goes through review.

## Local development

```bash
git clone https://github.com/<you>/npad-ai
cd npad-ai
pnpm install
pnpm rebuild better-sqlite3                  # native module, one-time
pnpm -r typecheck                            # should pass clean

# wire your local clone into Claude Code:
claude mcp add npad -- /full/path/to/npad-ai/node_modules/.bin/tsx \
  /full/path/to/npad-ai/packages/mcp/src/index.ts
```

## What we're looking for

- **Bug fixes** — always welcome.
- **Cross-tool MCP integration examples** — Codex, Cursor, Zed, anything new.
- **CLI ergonomics** — better output, faster commands, more useful `npad doctor` checks.
- **Search quality** — pgvector / embedding integrations for hosted mode.
- **Documentation** — typos, clarifications, more examples.

## What we'll usually decline

- New visibility levels beyond `private` / `unlisted` / `domain` (premature complexity until users ask).
- "Workspaces" / per-project scopes — title encodes context, search filters by relevance. Discussed and decided.
- Anything that breaks the "URL is the share primitive" model.
- Heavy frontend frameworks for the hosted UI — server-rendered HTML is a feature, not a bug.

If you have an idea that touches design (not just bugs), open an issue first to discuss. Saves both of us from sunk-cost PR rewrites.

## Code style

- TypeScript everywhere. ESM only.
- No comments unless they explain *why*, not *what*.
- Keep dependencies tiny. If you add a new one, justify it in the PR description.
- Match the existing structure — look around before introducing new patterns.

## Issues & security

- File bugs and feature requests in [GitHub Issues](https://github.com/ibedevesh/npad-ai/issues).
- For security issues (exposed credentials, auth bypass, etc.), email the maintainer privately rather than opening a public issue.

## License

By contributing, you agree your contributions are licensed under the MIT License (same as the repo).
