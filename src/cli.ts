#!/usr/bin/env node

import path from "node:path";

import { diffLogs } from "./analysis/diff-logs.js";
import { readHttpLog } from "./analysis/log-parser.js";
import { renderMarkdownReport } from "./analysis/render-report.js";
import { summarizeLog } from "./analysis/summarize-log.js";
import { buildImage } from "./build-image.js";
import { getProfile, listProfiles } from "./profiles/index.js";
import { runProfile, type ConfirmMode } from "./run-profile.js";
import {
  getOption,
  getOptionValues,
  hasFlag,
  parseCliArgs,
  parseKeyValue,
} from "./utils/args.js";
import { formatPercent, formatTable } from "./utils/format.js";

function usage(): string {
  return [
    "Usage: harness-egress-lab <command> [options]",
    "",
    "Commands:",
    "  build-image <profile>                Build and tag the profile image",
    "  run <profile>                        Run a monitored VM session",
    "  summarize <log.ndjson>               Summarize a traffic log",
    "  diff <a.ndjson> <b.ndjson>           Diff two traffic logs",
    "  report <profile> <log.ndjson>        Render a Markdown report",
    "  profiles                             List available profiles",
  ].join("\n");
}

function summarizeUsage(): string {
  return [
    "Usage: harness-egress-lab summarize <log.ndjson> [--profile <name>]",
    "",
    "Examples:",
    "  harness-egress-lab summarize ./logs/claude.ndjson --profile claude-code",
  ].join("\n");
}

function runUsage(): string {
  return [
    "Usage: harness-egress-lab run <profile> [options]",
    "",
    "Options:",
    "  --mode <name>               Profile mode (e.g. openrouter-vanilla)",
    "  --provider <name>           Provider hint; openrouter defaults to openrouter-vanilla",
    "  --image <path|ref>          Gondolin asset dir or image ref",
    "  --workspace <path>          Mount host path at /workspace",
    "  --http-log <path>           NDJSON output path",
    "  --confirm-mode <mode>       first-host | always | log-only",
    "  --confirm-always            Alias for --confirm-mode always",
    "  --env KEY=VALUE             Extra guest env var (repeatable)",
    "  --command <shell-string>    Run via /bin/sh -lc",
    "  --shell                     Start an interactive shell instead of the profile command",
    "  --allow-host <host>         Auto-allow matching host or wildcard (repeatable)",
    "  --deny-host <host>          Auto-deny matching host or wildcard (repeatable)",
    "  --full-body-host <host>     Capture full bodies for matching host (repeatable)",
    "  --full-body-path <path>     Capture full bodies for matching path (repeatable)",
    "  --no-ssh                    Disable SSH interception even if SSH_AUTH_SOCK is set",
  ].join("\n");
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);

  if (!command || command === "help" || command === "--help") {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  if (command === "profiles") {
    for (const profile of listProfiles()) {
      process.stdout.write(`${profile.name}\t${profile.description}\n`);
      for (const mode of profile.modes) {
        process.stdout.write(`  - ${mode.name}: ${mode.description}\n`);
      }
    }
    return;
  }

  if (command === "build-image") {
    const parsed = parseCliArgs(rest);
    const profileName = parsed.positionals[0];
    if (!profileName) throw new Error("build-image requires <profile>");
    const profile = getProfile(profileName);
    const buildOptions = {
      quiet: hasFlag(parsed, "quiet"),
    } as {
      outputDir?: string;
      tag?: string;
      quiet?: boolean;
    };
    const outputDir = getOption(parsed, "output");
    const tag = getOption(parsed, "tag");
    if (outputDir !== undefined) buildOptions.outputDir = outputDir;
    if (tag !== undefined) buildOptions.tag = tag;
    await buildImage(profile, buildOptions);
    return;
  }

  if (command === "run") {
    const parsed = parseCliArgs(rest);
    const profileName = parsed.positionals[0];
    if (!profileName) throw new Error(`run requires <profile>\n\n${runUsage()}`);

    const profile = getProfile(profileName);
    const provider = getOption(parsed, "provider");
    const mode =
      getOption(parsed, "mode") ??
      (provider === "openrouter" ? profile.defaultMode ?? "openrouter-vanilla" : undefined);

    const httpLogPath = path.resolve(
      getOption(parsed, "http-log") ??
        path.join("logs", `${profile.name}-${mode ?? profile.defaultMode ?? "run"}.ndjson`),
    );

    const confirmMode = (hasFlag(parsed, "confirm-always")
      ? "always"
      : getOption(parsed, "confirm-mode") ?? "first-host") as ConfirmMode;

    if (!["first-host", "always", "log-only"].includes(confirmMode)) {
      throw new Error(`Unsupported confirm mode '${confirmMode}'`);
    }

    const commandText = getOption(parsed, "command");
    const runOptions = {
      httpLogPath,
      confirmMode,
      extraEnv: parseKeyValue(getOptionValues(parsed, "env")),
      shell: hasFlag(parsed, "shell"),
      allowHosts: getOptionValues(parsed, "allow-host"),
      denyHosts: getOptionValues(parsed, "deny-host"),
      fullBodyHosts: getOptionValues(parsed, "full-body-host"),
      fullBodyPaths: getOptionValues(parsed, "full-body-path"),
      enableSsh: !hasFlag(parsed, "no-ssh"),
    } as {
      mode?: string;
      imagePath?: string;
      workspace?: string;
      httpLogPath: string;
      confirmMode: ConfirmMode;
      extraEnv?: Record<string, string>;
      command?: string[];
      shell?: boolean;
      allowHosts: string[];
      denyHosts: string[];
      fullBodyHosts: string[];
      fullBodyPaths: string[];
      enableSsh: boolean;
    };
    const imagePath = getOption(parsed, "image");
    const workspace = getOption(parsed, "workspace");
    if (mode !== undefined) runOptions.mode = mode;
    if (imagePath !== undefined) runOptions.imagePath = imagePath;
    if (workspace !== undefined) runOptions.workspace = workspace;
    if (commandText) runOptions.command = ["/bin/sh", "-lc", commandText];
    const exitCode = await runProfile(profile, runOptions);
    process.exit(exitCode);
  }

  if (command === "summarize") {
    const parsed = parseCliArgs(rest);
    const logPath = parsed.positionals[0];
    if (!logPath) throw new Error(summarizeUsage());
    const profileName = getOption(parsed, "profile");
    const profile = profileName ? getProfile(profileName) : undefined;
    const summary = summarizeLog(await readHttpLog(logPath), profile);

    process.stdout.write(`Requests: ${summary.requestCount}\n`);
    process.stdout.write(`Responses: ${summary.responseCount}\n`);
    process.stdout.write(`Provider request ratio: ${formatPercent(summary.providerRequestRatio)}\n\n`);

    process.stdout.write(
      `${formatTable(
        ["Host", "Requests"],
        summary.hosts.map((entry) => [entry.host, String(entry.count)]),
      )}\n\n`,
    );

    if (summary.categoryCounts.length > 0) {
      process.stdout.write(
        `${formatTable(
          ["Category", "Requests"],
          summary.categoryCounts.map((entry) => [entry.category, String(entry.count)]),
        )}\n\n`,
      );
    }

    if (summary.non200.length > 0) {
      process.stdout.write("Non-2xx responses:\n");
      for (const entry of summary.non200) {
        process.stdout.write(`- ${entry.status} ${entry.method} ${entry.url}\n`);
      }
      process.stdout.write("\n");
    }

    if (summary.telemetryUrls.length > 0) {
      process.stdout.write("Telemetry endpoints:\n");
      for (const url of summary.telemetryUrls) {
        process.stdout.write(`- ${url}\n`);
      }
    }
    return;
  }

  if (command === "diff") {
    const parsed = parseCliArgs(rest);
    const aPath = parsed.positionals[0];
    const bPath = parsed.positionals[1];
    if (!aPath || !bPath) {
      throw new Error("diff requires <a.ndjson> <b.ndjson>");
    }
    const profileName = getOption(parsed, "profile");
    const profile = profileName ? getProfile(profileName) : undefined;
    const diff = diffLogs(
      await readHttpLog(aPath),
      await readHttpLog(bPath),
      profile,
    );

    process.stdout.write(`Hosts only in A: ${diff.onlyInAHosts.join(", ") || "(none)"}\n`);
    process.stdout.write(`Hosts only in B: ${diff.onlyInBHosts.join(", ") || "(none)"}\n\n`);

    if (diff.hostDeltas.length > 0) {
      process.stdout.write(
        `${formatTable(
          ["Host", "A", "B", "Delta"],
          diff.hostDeltas.map((entry) => [
            entry.host,
            String(entry.a),
            String(entry.b),
            String(entry.delta),
          ]),
        )}\n\n`,
      );
    }

    if (diff.endpointDeltas.length > 0) {
      process.stdout.write(
        `${formatTable(
          ["Endpoint", "A", "B", "Delta"],
          diff.endpointDeltas.slice(0, 20).map((entry) => [
            entry.endpoint,
            String(entry.a),
            String(entry.b),
            String(entry.delta),
          ]),
        )}\n\n`,
      );
    }

    process.stdout.write(
      `Telemetry in A: ${diff.telemetryInA.length ? "present" : "absent"}\nTelemetry in B: ${diff.telemetryInB.length ? "present" : "absent"}\n`,
    );
    return;
  }

  if (command === "report") {
    const parsed = parseCliArgs(rest);
    const profileName = parsed.positionals[0];
    const logPath = parsed.positionals[1];
    if (!profileName || !logPath) {
      throw new Error("report requires <profile> <log.ndjson>");
    }
    const profile = getProfile(profileName);
    const summary = summarizeLog(await readHttpLog(logPath), profile);
    process.stdout.write(renderMarkdownReport(profile, logPath, summary));
    return;
  }

  throw new Error(`Unknown command '${command}'\n\n${usage()}`);
}

main().catch((error) => {
  process.stderr.write(`Error: ${(error as Error).message}\n`);
  process.exit(1);
});
