# OpenCode via OpenRouter: observed egress

One manual session using the `opencode` profile with OpenRouter.

## Hosts contacted

| Host | Observed | Traffic type |
|---|---|---|
| `openrouter.ai` | yes | LLM provider traffic |
| `registry.npmjs.org` | yes | plugin, package, and LSP bootstrap |
| `models.dev` | yes | model catalog refresh |
| `api.github.com` | yes | release metadata check |

## Non-provider traffic in detail

### models.dev catalog refresh

OpenCode refreshed its model catalog from:

```text
GET https://models.dev/api.json
```

### npm registry bootstrap traffic

The dominant non-provider traffic was npm registry activity. Observed requests included package metadata and tarball fetches for:

- `@opencode-ai/plugin`
- `opencode-anthropic-auth`
- `@opencode-ai/sdk`
- `typescript-language-server`
- transitive dependencies such as `zod`, `hono`, `jose`, `aws4fetch`, `arctic`, and `@oslojs/*`

This was the main source of non-provider egress in the run.

### GitHub release check

A release metadata request was made to:

```text
GET https://api.github.com/repos/anomalyco/opencode/releases/latest
```

## LLM traffic shape

All model calls still went to `openrouter.ai`, but OpenCode used more than one model role during the session:

- `anthropic/claude-haiku-4.5` for title generation
- `anthropic/claude-sonnet-4.5` for the main assistant flow

The captured OpenRouter responses showed OpenRouter routing these requests upstream to providers such as `Amazon Bedrock` and `Google`, while guest-side egress still remained at the OpenRouter endpoint.

## Key takeaway

OpenCode worked correctly with OpenRouter, but it was **not close to provider-only** in this session: only **10 of 47 requests** were provider traffic. The main issue was not stray model traffic to other vendors; it was OpenCode's own startup and support behavior around model catalog refreshes, package/plugin bootstrap, and editor tooling downloads.

That means manual egress tests with OpenCode will currently mix user-task traffic with meaningful startup/bootstrap traffic unless this behavior is reduced further.

## Sources

- Log: `logs/opencode-openrouter.ndjson`
