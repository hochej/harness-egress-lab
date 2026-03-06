# Claude Code profile

Profile name: `claude-code`

Modes: `openrouter-vanilla`, `openrouter-noextra`

## OpenRouter wiring

- `ANTHROPIC_BASE_URL=https://openrouter.ai/api`
- `ANTHROPIC_AUTH_TOKEN=$OPENROUTER_API_KEY`
- `ANTHROPIC_API_KEY=""`

`openrouter-noextra` additionally sets:

- `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`

## Known caveats

- Custom image builds require Gondolin guest sources locally
- OpenRouter auth failures usually mean the API key is bad or missing
- Claude Code may still contact GitHub and raw GitHub even with non-essential traffic disabled
- See `docs/reports/claude-code-openrouter-manual.md` for current findings
