# Reports

This directory stores generated or curated Markdown reports derived from captured harness egress logs.

Current reports:

- `claude-code-openrouter.md` — early smoke-test summary of Claude Code OpenRouter runs
- `claude-code-openrouter-manual.md` — longer manual-session comparison of vanilla vs `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`

Source logs currently used for the Claude Code report:

- `logs/claude-vanilla-e2e.ndjson`
- `logs/claude-noextra-e2e.ndjson`
- `logs/e2e-claude-custom.ndjson`

To generate a fresh single-run report from a log:

```bash
node dist/cli.js report claude-code ./logs/claude-noextra.ndjson \
  > docs/reports/claude-code-noextra.md
```

To compare two runs, first inspect:

```bash
node dist/cli.js diff ./logs/claude-vanilla.ndjson ./logs/claude-noextra.ndjson --profile claude-code
```
