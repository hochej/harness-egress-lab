# Pi coding agent via OpenRouter: observed egress

One manual session using the `pi-coding-agent` profile with OpenRouter.

## Hosts contacted

| Host | Observed | Traffic type |
|---|---|---|
| `openrouter.ai` | yes | LLM provider traffic |
| `registry.npmjs.org` | yes | startup version check |

## Non-provider traffic in detail

### npm registry version check

A single startup request was made to:

```text
GET https://registry.npmjs.org/@mariozechner/pi-coding-agent/latest
```

This is package metadata retrieval, not model traffic.

## Key takeaway

In this run, Pi was close to provider-only: **14 of 15 requests** went to `openrouter.ai`, and the only non-provider request was a single npm version check. No GitHub, models catalog, plugin bootstrap, or LSP download traffic was observed.

A useful nuance from the captured OpenRouter responses: the upstream provider selected by OpenRouter appeared as `Google` in this run, but the guest itself still only egressed to `openrouter.ai` for model calls.

## Sources

- Log: `logs/pi-coding-agent-openrouter.ndjson`
