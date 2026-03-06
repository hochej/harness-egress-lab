# Claude Code profile

Profile name: `claude-code`

Supported modes:
- `openrouter-vanilla`
- `openrouter-noextra`

## OpenRouter wiring

This profile uses the OpenRouter-compatible Claude Code configuration:

- `ANTHROPIC_BASE_URL=https://openrouter.ai/api`
- `ANTHROPIC_AUTH_TOKEN=$OPENROUTER_API_KEY`
- `ANTHROPIC_API_KEY=""`

`openrouter-noextra` additionally sets:

- `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`

## What this profile is for

Use this profile to compare:

- provider traffic to OpenRouter
- direct Anthropic telemetry behavior
- GitHub/raw GitHub plugin, security, or update fetches

## Typical commands

Build:

```bash
GONDOLIN_GUEST_SRC=/tmp/gondolin/guest \
node dist/cli.js build-image claude-code \
  --output ./.artifacts/images/claude-code
```

Run:

```bash
node dist/cli.js run claude-code \
  --mode openrouter-vanilla \
  --image ./.artifacts/images/claude-code \
  --workspace . \
  --http-log ./logs/claude-vanilla.ndjson \
  --confirm-mode log-only \
  --shell
```

## Known caveats

- custom image builds currently require Gondolin guest sources locally
- OpenRouter auth failures usually mean the API key is bad or missing
- Claude Code may still contact GitHub and raw GitHub even when non-essential traffic is reduced
- for the current findings, see `docs/reports/claude-code-openrouter-manual.md`
