import path from "node:path";

import { preparePiCodingAgentAssets } from "../build/prepare-assets.js";
import type {
  EndpointClassification,
  HarnessProfile,
  ProfileRunInput,
  ProfileRunResolution,
} from "./types.js";

const DEFAULT_OPENROUTER_MODEL = "anthropic/claude-sonnet-4.5";

function classifyPiUrl(url: URL): EndpointClassification {
  const host = url.hostname;
  const pathname = url.pathname;

  if (host === "openrouter.ai") {
    if (pathname.startsWith("/api/v1/chat/completions") || pathname.startsWith("/api/v1/responses")) {
      return { category: "provider", label: "provider traffic" };
    }
    return { category: "provider", label: "provider-adjacent traffic" };
  }

  if (host === "registry.npmjs.org") {
    return { category: "package-registry", label: "npm registry / version check" };
  }

  if (host === "github.com") {
    return { category: "git-fetch", label: "GitHub traffic" };
  }

  if (host === "api.github.com" || host === "release-assets.githubusercontent.com") {
    return { category: "update", label: "GitHub release metadata or downloads" };
  }

  if (host === "raw.githubusercontent.com") {
    return { category: "update", label: "raw GitHub metadata" };
  }

  return { category: "unknown", label: "unknown" };
}

function resolvePiRun(
  hostEnv: NodeJS.ProcessEnv,
  input: ProfileRunInput,
): ProfileRunResolution {
  const mode = input.mode ?? "openrouter";
  if (mode !== "openrouter") {
    throw new Error(`Unsupported pi-coding-agent mode: ${mode}`);
  }

  const env: Record<string, string> = {};
  for (const key of ["OPENROUTER_API_KEY", "HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY"]) {
    const value = hostEnv[key];
    if (value !== undefined) env[key] = value;
  }

  const notes: string[] = [];
  if (!env.OPENROUTER_API_KEY) {
    notes.push("OPENROUTER_API_KEY is unset; OpenRouter requests will likely fail.");
  }

  if (input.extraEnv) {
    Object.assign(env, input.extraEnv);
  }

  return {
    mode,
    env,
    command:
      input.command ?? ["pi", "--provider", "openrouter", "--model", DEFAULT_OPENROUTER_MODEL],
    providerHosts: ["openrouter.ai"],
    notes,
  };
}

export const piCodingAgentProfile: HarnessProfile = {
  name: "pi-coding-agent",
  description: "Pi coding agent in an Alpine Gondolin image with locally prepared assets",
  buildConfigPath: path.resolve("images/pi-coding-agent.json"),
  prepareBuildAssets: preparePiCodingAgentAssets,
  defaultCommand: ["pi", "--provider", "openrouter", "--model", DEFAULT_OPENROUTER_MODEL],
  defaultMode: "openrouter",
  modes: [
    {
      name: "openrouter",
      description: "Pi coding agent with OpenRouter via OPENROUTER_API_KEY",
    },
  ],
  resolveRun: resolvePiRun,
  classifyUrl: classifyPiUrl,
  reportNotes: [
    "Pi is launched with --provider openrouter and an explicit OpenRouter model id.",
    "Pi uses OPENROUTER_API_KEY directly; no Anthropic compatibility env rewriting is required.",
    "Pi may perform an npm registry version check on startup unless disabled separately.",
  ],
};
