# Architecture

`harness-egress-lab` is organized around three layers:

1. `src/run-profile.ts`
    - generic Gondolin runner
    - workspace mount support
    - HTTP interception and NDJSON logging
    - interactive HTTP and SSH confirmation

2. `src/profiles/*`
    - harness-specific image and environment wiring
    - mode selection
    - endpoint classification heuristics

3. `src/analysis/*`
    - parse NDJSON logs
    - summarize hosts, endpoints, statuses, telemetry
    - diff two runs
    - render Markdown reports

The initial profile is `claude-code`, with OpenRouter-focused modes.
