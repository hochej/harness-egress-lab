# Pi coding agent profile

Profile name: `pi-coding-agent`

Mode: `openrouter`

## OpenRouter wiring

The profile passes through:

- `OPENROUTER_API_KEY`
- `HTTP_PROXY`
- `HTTPS_PROXY`
- `NO_PROXY`

Default launch command:

```bash
pi --provider openrouter --model anthropic/claude-sonnet-4.5
```

## Image contents

- Alpine-based Gondolin image
- locally prepared `@mariozechner/pi-coding-agent` archive at `/opt/pi-coding-agent/node_modules.tar.gz` (generated from `manifests/pi-coding-agent/` during `build-image`)
- wrapper installed as `/usr/local/bin/pi`
- includes `bash`, `fd`, `git`, `nodejs`, `npm`, `openssh`, `ripgrep`, and `tmux`

## Known caveats

- `OPENROUTER_API_KEY` must be present in the host shell before `run`
- Pi may contact `registry.npmjs.org` for startup version checks unless separately disabled
- Sessions and agent state are stored inside the guest home directory by default
