# harness-egress-lab

Standalone Gondolin-based lab for reproducible harness egress analysis inside monitored VMs.

Initial scope:
- profile: `claude-code`
- provider scenario: `openrouter`
- comparison modes: `openrouter-vanilla`, `openrouter-noextra`

## Prerequisites

- Node.js `>=23.6.0`
- `pnpm`
- Gondolin host requirements working locally
- `OPENROUTER_API_KEY` already present in your shell
- Gondolin guest sources available locally for image builds

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

## Useful flags

Exploration:

```bash
--confirm-mode first-host
--confirm-mode always
```

Strict host policy:

```bash
--allow-host openrouter.ai
--deny-host api.anthropic.com
```

Full-body capture for known telemetry endpoints:

```bash
--full-body-host api.anthropic.com
--full-body-path /api/event_logging/batch
```

## Reproducibility tips

- Reuse the same image for both runs
- Use the same workspace and roughly the same task flow
- Prefer `log-only` for comparisons
- Keep reports in `docs/reports/`

## Docs

- `docs/architecture.md` — code layout
- `docs/claude-code.md` — profile-specific config & caveats
- `docs/reports/claude-code-openrouter-manual.md` — main Claude Code findings
