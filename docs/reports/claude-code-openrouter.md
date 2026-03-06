# Claude Code via OpenRouter egress report

## Scope

This report summarizes local `harness-egress-lab` runs for the `claude-code` profile using OpenRouter, comparing:

- `openrouter-vanilla`
- `openrouter-noextra` (`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`)

Source logs:

- `logs/claude-vanilla-e2e.ndjson`
- `logs/claude-noextra-e2e.ndjson`
- `logs/e2e-claude-custom.ndjson`

## Reproduction commands

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

Inside the VM:

```bash
claude -p "Reply with exactly: vanilla-ok"
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

Inside the VM:

```bash
claude -p "Reply with exactly: noextra-ok"
```

## OpenRouter wiring used

- `ANTHROPIC_BASE_URL=https://openrouter.ai/api`
- `ANTHROPIC_AUTH_TOKEN=$OPENROUTER_API_KEY`
- `ANTHROPIC_API_KEY=""`

## Observed results

### Vanilla run

Observed request hosts:

| host | requests |
| --- | ---: |
| raw.githubusercontent.com | 1 |
| openrouter.ai | 1 |
| api.anthropic.com | 1 |

Observed categories:

| category | requests |
| --- | ---: |
| security-metadata | 1 |
| provider | 1 |
| telemetry | 1 |

Observed telemetry endpoint:

- `https://api.anthropic.com/api/event_logging/batch`

### Reduced-traffic run

Observed request hosts:

| host | requests |
| --- | ---: |
| raw.githubusercontent.com | 1 |
| openrouter.ai | 1 |

Observed categories:

| category | requests |
| --- | ---: |
| security-metadata | 1 |
| provider | 1 |

Observed telemetry endpoints:

- none detected

### Additional custom-image smoke test

A separate run against the custom built image confirmed that Claude Code runs successfully inside the VM:

```bash
claude -p "Reply with exactly: custom-image-ok"
claude -p "Reply with exactly this JSON: {\"ok\":true}" --output-format text
```

Observed output:

- `custom-image-ok`
- `{"ok":true}`

The corresponding log (`logs/e2e-claude-custom.ndjson`) showed:

| host | requests |
| --- | ---: |
| openrouter.ai | 2 |
| raw.githubusercontent.com | 1 |

## Diff summary

Vanilla vs reduced-traffic mode:

- host removed: `api.anthropic.com`
- endpoint removed: `api.anthropic.com/api/event_logging/batch`
- telemetry status changed: present -> absent

## Interpretation

From these runs:

- Claude Code does successfully operate through OpenRouter in this setup.
- Vanilla OpenRouter-backed operation is not provider-only.
- A direct Anthropic telemetry request was observed in vanilla mode.
- `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` removed that direct Anthropic telemetry in the comparison run.
- Non-provider traffic still remained, specifically `raw.githubusercontent.com`.

## Conclusion

For the current `claude-code` profile:

- OpenRouter model traffic works.
- `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` appears meaningful.
- The flag reduces direct Anthropic telemetry, but does not eliminate all non-provider egress.
