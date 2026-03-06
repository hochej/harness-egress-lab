# AGENTS

## Conventions
- Runtime: Node.js ESM + TypeScript
- Package manager: pnpm
- Build output: `dist/`
- CLI entrypoint: `src/cli.ts`
- Keep runner logic profile-based and reusable
- Keep canonical traffic logs in NDJSON
- Prefer small focused modules under `src/monitor`, `src/profiles`, and `src/analysis`

## Commands
- `pnpm build`
- `pnpm dev -- <command>`
- `pnpm start -- <command>`

## Style
- Never use emojis in code, docs, or commit messages

## Notes
- Claude Code image assets live in `images/` and `staging/`
- Generated logs belong in `logs/` and are ignored by git by default
