# harness-egress-lab

Standalone Gondolin-based lab for reproducible harness egress analysis inside monitored VMs.

**Initial scope:** `claude-code` profile with OpenRouter (`openrouter-vanilla` / `openrouter-noextra`).

## Prerequisites

- Node.js `>=23.6.0`
- `pnpm`
- Gondolin host requirements working locally
- `OPENROUTER_API_KEY` in your shell

## Quick start

Clone Gondolin (needed for guest image builds):

```bash
git clone https://github.com/earendil-works/gondolin.git /tmp/gondolin
```

Install and build:

```bash
pnpm install
pnpm build
```

Build the image (`GONDOLIN_GUEST_SRC` can point to any local Gondolin checkout):

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
