# OpenCode profile

Profile name: `opencode`

Mode: `openrouter`

## OpenRouter wiring

The profile passes through:

- `OPENROUTER_API_KEY`
- `HTTP_PROXY`
- `HTTPS_PROXY`
- `NO_PROXY`

Default launch command:

```bash
opencode --model openrouter/anthropic/claude-sonnet-4.5
```

## Image contents

- Alpine-based Gondolin image
- locally prepared OpenCode Linux arm64 musl binary under `/opt/opencode/bin/opencode.gz` (generated during `build-image`)
- wrapper installed as `/usr/local/bin/opencode`
- includes `bash`, `fd`, `git`, `nodejs`, `npm`, `openssh`, `ripgrep`, and `tmux`
- locally prepared `/var/cache/opencode` plugin cache from `manifests/opencode-cache/`
- default model state file at `/var/state/opencode/model.json`

## Known caveats

- `OPENROUTER_API_KEY` must be present in the host shell before `run`
- OpenCode may still refresh models from `models.dev` and may perform upgrade-related checks
- Runtime XDG directories are pinned to `/var/cache`, `/var/lib`, and `/var/state`
- Additional network activity can appear later if features like LSP downloads or sharing are used
