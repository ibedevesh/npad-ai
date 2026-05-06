# Contributing

Thanks for taking a look. npad is a small project — bug fixes, docs improvements, and new agent integrations are all welcome.

If you're planning anything bigger than a fix, open an issue first so we can talk it through before you sink time into a PR.

## Setup

```bash
git clone https://github.com/ibedevesh/npad-ai
cd npad-ai
pnpm install
pnpm rebuild better-sqlite3   # one-time, native module
pnpm -r typecheck
```

Wire your local clone into Claude Code:

```bash
claude mcp add npad -- /full/path/to/npad-ai/node_modules/.bin/tsx \
  /full/path/to/npad-ai/packages/mcp/src/index.ts
```

## Sending a PR

- Branch off `main` (`feat/...`, `fix/...`, `docs/...`).
- Keep it focused — one change per PR.
- Run `pnpm -r typecheck` before pushing.
- In the PR description, say *what* changed and *why*.

## Code style

- TypeScript, ESM.
- Comments should explain *why*, not *what*. If the code is clear, skip the comment.
- Keep dependencies minimal. If you add one, mention why in the PR.

## Security

For anything sensitive (auth bypass, leaked credentials, etc.), please email me directly instead of filing a public issue.

## License

By contributing you agree your contributions are MIT-licensed, same as the project.
