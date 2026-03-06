# Claude Code via OpenRouter: observed egress

Two manual sessions using the `claude-code` profile with OpenRouter as the LLM provider:

- **vanilla** — default Claude Code configuration
- **noextra** — with `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`

The findings are consistent with Anthropic's [data usage documentation](https://docs.anthropic.com/en/docs/claude-code/data-usage).

## Hosts contacted

| Host | vanilla | noextra | Traffic type |
|---|---|---|---|
| `openrouter.ai` | yes | yes | LLM provider (expected) |
| `api.anthropic.com` | yes | no | Telemetry submission |
| `github.com` | yes | yes | Plugin repo fetches |
| `raw.githubusercontent.com` | yes | yes | Security/update metadata |

## Non-provider traffic in detail

### Anthropic telemetry (`api.anthropic.com`)

**Vanilla only.** Claude Code sends batched event logs to:

```
POST https://api.anthropic.com/api/event_logging/batch
```

This is outbound data submission — not metadata retrieval. Captured payloads contained session/runtime metadata with internal event names like `tengu_reset_pro_to_opus_default` and `tengu_paste_text`.

Anthropic's documentation states that non-essential traffic is disabled by default for Bedrock, Vertex, and Foundry. OpenRouter is not on that list — it routes through `ANTHROPIC_BASE_URL`, which Claude Code treats as the standard Claude API path. Our data confirms this: telemetry was active in vanilla mode despite using a third-party provider.

Completely eliminated by `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`.

### Plugin repository fetches (`github.com`)

**Both modes.** Git smart HTTP requests to:

```
https://github.com/anthropics/claude-plugins-official.git
```

This is retrieval of plugin configuration data, not telemetry.
**Not affected** by the disable flag.

### Security and update metadata (`raw.githubusercontent.com`)

**Both modes.** Fetches:

- `anthropics/claude-plugins-official/.../security/security.json` — security metadata (both modes)
- `anthropics/claude-code/.../main/CHANGELOG.md` — update check (vanilla only)

Read-only metadata retrieval. The CHANGELOG fetch was absent with the disable flag; the security fetch persisted.

## Key takeaway

Even when using a third-party provider, Claude Code is not provider-only. Unlike Bedrock, Vertex, and Foundry — where Anthropic disables non-essential traffic by default — OpenRouter and other `ANTHROPIC_BASE_URL`-based setups keep telemetry enabled. With default settings Claude Code submits telemetry to Anthropic and fetches plugin/security data from GitHub. Setting `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` removes the Anthropic telemetry, but GitHub-hosted metadata fetches remain in both modes.

## Sources

- Anthropic docs: <https://docs.anthropic.com/en/docs/claude-code/data-usage>
- Logs: `logs/claude-vanilla-manual.ndjson`, `logs/claude-noextra-manual.ndjson`
