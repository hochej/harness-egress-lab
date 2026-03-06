# Workflow

This repo is built around a simple loop:

1. build an image
2. run one or more monitored sessions
3. collect NDJSON logs
4. summarize and diff the logs
5. write a short report

Current example profile:
- `claude-code`
- provider: `openrouter`

## Prerequisites

- Node.js `>=23.6.0`
- `pnpm`
- Gondolin host requirements working locally
- `OPENROUTER_API_KEY` already present in your shell
- Gondolin guest sources available locally for image builds

## Build

```bash
pnpm install
pnpm build

GONDOLIN_GUEST_SRC=/tmp/gondolin/guest \
node dist/cli.js build-image claude-code \
  --output ./.artifacts/images/claude-code
```

## Run vanilla

```bash
node dist/cli.js run claude-code \
  --mode openrouter-vanilla \
  --image ./.artifacts/images/claude-code \
  --workspace . \
  --http-log ./logs/claude-vanilla.ndjson \
  --confirm-mode log-only \
  --shell
```

Inside the VM, run your manual session.

## Run reduced-traffic mode

```bash
node dist/cli.js run claude-code \
  --mode openrouter-noextra \
  --image ./.artifacts/images/claude-code \
  --workspace . \
  --http-log ./logs/claude-noextra.ndjson \
  --confirm-mode log-only \
  --shell
```

Inside the VM, run the same or very similar session.

## Analyze

```bash
node dist/cli.js summarize ./logs/claude-vanilla.ndjson --profile claude-code
node dist/cli.js summarize ./logs/claude-noextra.ndjson --profile claude-code
node dist/cli.js diff ./logs/claude-vanilla.ndjson ./logs/claude-noextra.ndjson --profile claude-code
```

## Report

```bash
node dist/cli.js report claude-code ./logs/claude-noextra.ndjson \
  > docs/reports/claude-code-noextra.md
```

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

- reuse the same image for both runs
- use the same workspace and roughly the same task flow
- prefer `log-only` for comparisons
- keep reports in `docs/reports/`
