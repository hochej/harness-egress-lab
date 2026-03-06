# Claude Code profile

The initial profile packages Claude Code into a Gondolin image and supports two modes:

- `openrouter-vanilla`
- `openrouter-noextra`

## OpenRouter wiring

OpenRouter mode sets:

- `ANTHROPIC_BASE_URL=https://openrouter.ai/api`
- `ANTHROPIC_AUTH_TOKEN=$OPENROUTER_API_KEY`
- `ANTHROPIC_API_KEY=""`

The `openrouter-noextra` mode also sets:

- `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`

## Reproducible workflow

### Build the image

```bash
GONDOLIN_GUEST_SRC=/tmp/gondolin/guest \
node dist/cli.js build-image claude-code \
  --output ./.artifacts/images/claude-code
```

### Run the vanilla session

```bash
node dist/cli.js run claude-code \
  --mode openrouter-vanilla \
  --image ./.artifacts/images/claude-code \
  --workspace . \
  --http-log ./logs/claude-vanilla.ndjson \
  --confirm-mode log-only \
  --shell
```

Inside the VM:

```bash
claude -p "Reply with exactly: vanilla-ok"
```

### Run the reduced-traffic session

```bash
node dist/cli.js run claude-code \
  --mode openrouter-noextra \
  --image ./.artifacts/images/claude-code \
  --workspace . \
  --http-log ./logs/claude-noextra.ndjson \
  --confirm-mode log-only \
  --shell
```

Inside the VM:

```bash
claude -p "Reply with exactly: noextra-ok"
```

### Analyze the results

```bash
node dist/cli.js summarize ./logs/claude-vanilla.ndjson --profile claude-code
node dist/cli.js summarize ./logs/claude-noextra.ndjson --profile claude-code
node dist/cli.js diff ./logs/claude-vanilla.ndjson ./logs/claude-noextra.ndjson --profile claude-code
node dist/cli.js report claude-code ./logs/claude-noextra.ndjson > docs/reports/claude-code-noextra.md
```

## What to expect

Typical findings so far:

- provider traffic to `openrouter.ai`
- some non-provider traffic such as `raw.githubusercontent.com`
- in vanilla mode, direct Anthropic telemetry may still appear at:
  - `api.anthropic.com/api/event_logging/batch`
- in `openrouter-noextra`, that direct telemetry may disappear while other non-provider traffic remains

## Helpful options

Use exploratory prompting when discovering new traffic:

```bash
--confirm-mode first-host
--confirm-mode always
```

Use stricter host policy when testing assumptions:

```bash
--allow-host openrouter.ai
--deny-host api.anthropic.com
```

Capture full response bodies for known telemetry endpoints:

```bash
--full-body-host api.anthropic.com
--full-body-path /api/event_logging/batch
```

## Known caveats

- OpenRouter auth failures usually mean the API key is bad or missing
- Claude Code may still contact GitHub, raw GitHub, npm, and other hosts
- `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` appears to reduce direct Anthropic telemetry, not all non-provider traffic
- custom image builds currently require Gondolin guest sources to be available locally
