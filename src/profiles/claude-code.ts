import path from "node:path";

import type {
  EndpointClassification,
  HarnessProfile,
  ProfileRunInput,
  ProfileRunResolution,
} from "./types.js";

const OPENROUTER_ANTHROPIC_BASE_URL = "https://openrouter.ai/api";

function classifyClaudeCodeUrl(url: URL): EndpointClassification {
  const host = url.hostname;
  const pathname = url.pathname;

  if (host === "openrouter.ai") {
    if (pathname.startsWith("/api/v1/messages")) {
      return { category: "provider", label: "provider traffic" };
    }
    return { category: "provider", label: "provider-adjacent traffic" };
  }

  if (host === "api.anthropic.com" && pathname === "/api/event_logging/batch") {
    return { category: "telemetry", label: "direct Anthropic telemetry" };
  }

  if (host === "raw.githubusercontent.com") {
    if (pathname.endsWith("/security.json")) {
      return { category: "security-metadata", label: "plugin/security metadata" };
    }
    return { category: "update", label: "raw GitHub metadata" };
  }

  if (host === "github.com") {
    if (pathname.includes("git-upload-pack") || pathname.includes("git-receive-pack")) {
      return { category: "git-fetch", label: "git smart HTTP" };
    }
    return { category: "git-fetch", label: "GitHub traffic" };
  }

  if (host === "registry.npmjs.org") {
    return { category: "package-registry", label: "npm registry" };
  }

  return { category: "unknown", label: "unknown" };
}

function resolveClaudeCodeRun(
  hostEnv: NodeJS.ProcessEnv,
  input: ProfileRunInput,
): ProfileRunResolution {
  const mode = input.mode ?? "openrouter-vanilla";
  const env: Record<string, string> = {};

  for (const key of [
    "ANTHROPIC_MODEL",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "NO_PROXY",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC",
  ]) {
    const value = hostEnv[key];
    if (value !== undefined) env[key] = value;
  }

  const notes: string[] = [];

  if (mode === "openrouter-vanilla" || mode === "openrouter-noextra") {
    env.ANTHROPIC_BASE_URL = OPENROUTER_ANTHROPIC_BASE_URL;
    if (hostEnv.OPENROUTER_API_KEY) {
      env.ANTHROPIC_AUTH_TOKEN = hostEnv.OPENROUTER_API_KEY;
    } else if (hostEnv.ANTHROPIC_AUTH_TOKEN) {
      env.ANTHROPIC_AUTH_TOKEN = hostEnv.ANTHROPIC_AUTH_TOKEN;
      notes.push("Using existing ANTHROPIC_AUTH_TOKEN because OPENROUTER_API_KEY was unset.");
    } else {
      notes.push("OPENROUTER_API_KEY is unset; OpenRouter requests will likely fail.");
    }
    env.ANTHROPIC_API_KEY = "";
  } else {
    throw new Error(`Unsupported claude-code mode: ${mode}`);
  }

  if (mode === "openrouter-noextra") {
    env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "1";
  }

  if (input.extraEnv) {
    Object.assign(env, input.extraEnv);
  }

  return {
    mode,
    env,
    command: input.command ?? ["claude"],
    providerHosts: ["openrouter.ai"],
    notes,
  };
}

export const claudeCodeProfile: HarnessProfile = {
  name: "claude-code",
  description: "Claude Code in a pre-staged Alpine Gondolin image",
  buildConfigPath: path.resolve("images/claude-code.json"),
  defaultCommand: ["claude"],
  defaultMode: "openrouter-vanilla",
  modes: [
    {
      name: "openrouter-vanilla",
      description: "Claude Code routed to OpenRouter with default traffic behavior",
    },
    {
      name: "openrouter-noextra",
      description: "OpenRouter plus CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1",
    },
  ],
  resolveRun: resolveClaudeCodeRun,
  classifyUrl: classifyClaudeCodeUrl,
  reportNotes: [
    "OpenRouter wiring uses ANTHROPIC_BASE_URL=https://openrouter.ai/api.",
    "ANTHROPIC_AUTH_TOKEN is preferred over ANTHROPIC_API_KEY for OpenRouter mode.",
    "ANTHROPIC_API_KEY is explicitly blank in OpenRouter modes.",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 appears to suppress direct Anthropic telemetry but not all non-provider traffic.",
  ],
};
