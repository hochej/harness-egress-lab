# Claude Code via OpenRouter: non-provider endpoints observed

This note summarizes two longer manual `harness-egress-lab` runs for the `claude-code` profile using OpenRouter:

- `openrouter-vanilla`
- `openrouter-noextra` (`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`)

The observed behavior is consistent with Anthropic's documentation:

- Claude Code's [data usage documentation](https://code.claude.com/docs/en/data-usage.md) describes provider traffic plus additional telemetry, error reporting, bug reporting, and related product behavior.
- The same page also documents that `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` can be used to opt out of non-essential traffic.

These runs therefore should be read as an empirical check of that documented behavior in an OpenRouter-backed setup, not as evidence of undocumented exfiltration.

## Main result

In these runs, Claude Code contacted:

- `openrouter.ai` for model requests
- `api.anthropic.com` for telemetry in vanilla mode only
- `github.com` for plugin repository fetches
- `raw.githubusercontent.com` for security/update metadata fetches

With `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`, the direct Anthropic telemetry seen in the vanilla run disappeared, while GitHub-owned metadata and plugin fetch traffic remained.

## Endpoint classes observed

### 1. Provider traffic

Observed in both modes:

- `POST https://openrouter.ai/api/v1/messages?beta=true`

This is the main model request path.

Counts:

- vanilla: 23 requests
- noextra: 28 requests

### 2. Anthropic telemetry

Observed in vanilla mode only:

- `POST https://api.anthropic.com/api/event_logging/batch`

This was outbound data submission rather than metadata retrieval.
The captured payloads contained internal event batches and session/runtime metadata.

Examples visible in the logged payload previews included event names such as:

- `tengu_reset_pro_to_opus_default`
- `tengu_paste_text`

Counts:

- vanilla: 13 requests
- noextra: 0 requests

This aligns with Anthropic's documented statement that non-essential traffic can be disabled with `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`.

### 3. GitHub plugin repository fetches

Observed in both modes:

- `GET https://github.com/anthropics/claude-plugins-official.git/info/refs?service=git-upload-pack`
- `POST https://github.com/anthropics/claude-plugins-official.git/git-upload-pack`

These look like plugin repository fetches over Git smart HTTP.
They are best classified as **retrieval of repository/configuration data**, not telemetry submission.

Counts:

- vanilla: 3 requests
- noextra: 3 requests

### 4. Raw GitHub security metadata

Observed in both modes:

- `GET https://raw.githubusercontent.com/anthropics/claude-plugins-official/refs/heads/security/security.json`

This is best classified as **retrieval of security/configuration metadata**.

Counts:

- vanilla: 1 request
- noextra: 1 request

### 5. Raw GitHub changelog/update metadata

Observed in vanilla mode:

- `GET https://raw.githubusercontent.com/anthropics/claude-code/refs/heads/main/CHANGELOG.md`

This is best classified as **retrieval of update metadata**.

Counts:

- vanilla: 1 request
- noextra: 0 requests

## Concise comparison

### Vanilla

Observed hosts:

- `openrouter.ai` — 23 requests
- `api.anthropic.com` — 13 requests
- `github.com` — 3 requests
- `raw.githubusercontent.com` — 2 requests

Observed categories:

- provider traffic
- telemetry submission
- plugin repository fetches
- security/update metadata fetches

### `openrouter-noextra`

Observed hosts:

- `openrouter.ai` — 28 requests
- `github.com` — 3 requests
- `raw.githubusercontent.com` — 1 request

Observed categories:

- provider traffic
- plugin repository fetches
- security metadata fetches

No direct Anthropic telemetry endpoint was observed in this run.

## Conclusion

For this OpenRouter-backed configuration:

- Claude Code was not provider-only in either run.
- The non-provider traffic observed fell into two broad groups:
  - **data submission**: Anthropic telemetry in vanilla mode
  - **metadata/config retrieval**: GitHub and raw GitHub plugin/security/update fetches
- `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` removed the direct Anthropic telemetry observed in the vanilla run.
- The flag did not eliminate GitHub-owned metadata and plugin fetch traffic.

## Sources

- Anthropic documentation: <https://code.claude.com/docs/en/data-usage.md>
- Logs:
  - `logs/claude-vanilla-manual.ndjson`
  - `logs/claude-noextra-manual.ndjson`
