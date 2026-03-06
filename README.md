# harness-egress-lab

Standalone Gondolin-based lab for reproducible harness egress analysis inside monitored VMs.

Initial scope:
- profile: `claude-code`
- provider scenario: `openrouter`
- comparison modes:
  - `openrouter-vanilla`
  - `openrouter-noextra`

## Quick start

```bash
pnpm install
pnpm build
```

Build the image:

```bash
GONDOLIN_GUEST_SRC=/tmp/gondolin/guest \
node dist/cli.js build-image claude-code \
  --output ./.artifacts/images/claude-code
```

Run vanilla:

```bash
node dist/cli.js run claude-code \
  --mode openrouter-vanilla \
  --image ./.artifacts/images/claude-code \
  --workspace . \
  --http-log ./logs/claude-vanilla.ndjson \
  --confirm-mode log-only \
  --shell
```

Run reduced-traffic mode:

```bash
node dist/cli.js run claude-code \
  --mode openrouter-noextra \
  --image ./.artifacts/images/claude-code \
  --workspace . \
  --http-log ./logs/claude-noextra.ndjson \
  --confirm-mode log-only \
  --shell
```

Analyze:

```bash
node dist/cli.js summarize ./logs/claude-vanilla.ndjson --profile claude-code
node dist/cli.js summarize ./logs/claude-noextra.ndjson --profile claude-code
node dist/cli.js diff ./logs/claude-vanilla.ndjson ./logs/claude-noextra.ndjson --profile claude-code
```

Generate a report:

```bash
node dist/cli.js report claude-code ./logs/claude-noextra.ndjson \
  > docs/reports/claude-code-noextra.md
```

## Commands
- `build-image <profile>`
- `run <profile>`
- `summarize <log.ndjson>`
- `diff <a.ndjson> <b.ndjson>`
- `report <profile> <log.ndjson>`
- `profiles`

## Docs
- `docs/workflow.md` — the reproducible workflow
- `docs/claude-code.md` — profile-specific notes
- `docs/reports/claude-code-openrouter-manual.md` — main Claude Code findings
- `docs/architecture.md` — code layout

## Notes
- HTTP is the main focus in v1
- `log-only` is best for reproducible comparisons
- `first-host` and `always` are better for exploratory runs
- SSH git/exec confirmation is supported when `SSH_AUTH_SOCK` is set
