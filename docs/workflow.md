# Reproducible workflow

This repo is meant to make one workflow easy to rerun for any supported harness profile:

1. build or select an image
2. run one or more monitored sessions
3. collect NDJSON HTTP logs
4. summarize and diff the logs
5. generate a Markdown report for docs

The examples below use the current built-in profile:

- profile: `claude-code`
- provider: `openrouter`
- comparison modes:
  - `openrouter-vanilla`
  - `openrouter-noextra`

## Prerequisites

- Node.js `>=23.6.0`
- `pnpm`
- Gondolin host requirements working on your machine
- a valid `OPENROUTER_API_KEY` already present in your shell environment
- Gondolin guest sources available locally when building custom images

Install dependencies and build the CLI:

```bash
pnpm install
pnpm build
```

## 1. Build the image

Build the profile image once and reuse it across runs:

```bash
GONDOLIN_GUEST_SRC=/tmp/gondolin/guest \
node dist/cli.js build-image claude-code \
  --output ./.artifacts/images/claude-code
```

Result:
- image assets in `./.artifacts/images/claude-code`
- image tagged locally as `harness-egress-lab/claude-code:latest`

## 2. Run the baseline session

```bash
node dist/cli.js run claude-code \
  --mode openrouter-vanilla \
  --image ./.artifacts/images/claude-code \
  --workspace . \
  --http-log ./logs/claude-vanilla.ndjson \
  --confirm-mode log-only \
  --shell
```

Inside the VM, start the harness and do a small reproducible interaction.
For Claude Code, a good smoke test is:

```bash
claude -p "Reply with exactly: vanilla-ok"
```

You can also use interactive confirmation while exploring new behavior:

- `--confirm-mode first-host`
- `--confirm-mode always`

## 3. Run the comparison session

```bash
node dist/cli.js run claude-code \
  --mode openrouter-noextra \
  --image ./.artifacts/images/claude-code \
  --workspace . \
  --http-log ./logs/claude-noextra.ndjson \
  --confirm-mode log-only \
  --shell
```

Inside the VM, run the same or similar prompt:

```bash
claude -p "Reply with exactly: noextra-ok"
```

## 4. Summarize each run

```bash
node dist/cli.js summarize ./logs/claude-vanilla.ndjson --profile claude-code
node dist/cli.js summarize ./logs/claude-noextra.ndjson --profile claude-code
```

Look for:
- total request count
- hosts contacted
- provider vs non-provider traffic
- telemetry endpoints
- non-2xx responses

## 5. Diff the runs

```bash
node dist/cli.js diff \
  ./logs/claude-vanilla.ndjson \
  ./logs/claude-noextra.ndjson \
  --profile claude-code
```

This is the fastest way to confirm whether a mode removed or added traffic.

For Claude Code, the most important question is usually whether direct Anthropic telemetry remains present.

## 6. Generate a doc-ready report

```bash
node dist/cli.js report claude-code ./logs/claude-noextra.ndjson \
  > docs/reports/claude-code-noextra.md
```

The generated report includes:
- run metadata
- host counts
- endpoint category counts
- response statuses
- telemetry findings
- non-provider traffic summary
- a small Mermaid chart

## 7. Useful run options

### Auto-allow or auto-deny specific hosts

```bash
--allow-host openrouter.ai
--deny-host api.anthropic.com
--allow-host '*.githubusercontent.com'
```

### Capture full bodies for specific endpoints

```bash
--full-body-host api.anthropic.com
--full-body-path /api/event_logging/batch
```

### Run a non-interactive one-shot command

Instead of `--shell`, you can run a single command directly:

```bash
node dist/cli.js run claude-code \
  --mode openrouter-noextra \
  --image ./.artifacts/images/claude-code \
  --workspace . \
  --http-log ./logs/claude-noextra.ndjson \
  --confirm-mode log-only \
  --command 'claude -p "Reply with exactly: ok"'
```

## Reproducibility guidelines

To keep experiments easy to compare:

- reuse the same image for both runs
- keep the workspace mounted in the same place
- use the same prompt or interaction sequence across variants
- use `log-only` for batch comparisons
- use `first-host` or `always` when discovering unexpected traffic
- save reports under `docs/reports/` when findings are worth keeping

## Current Claude Code findings to expect

In this repo's current setup, `openrouter-noextra` is expected to:
- keep provider traffic to `openrouter.ai`
- still allow some non-provider traffic such as `raw.githubusercontent.com`
- remove direct Anthropic telemetry to `api.anthropic.com/api/event_logging/batch` compared with vanilla runs
