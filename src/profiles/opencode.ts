import path from "node:path";

import { prepareOpencodeAssets } from "../build/prepare-assets.js";
import type {
  EndpointClassification,
  HarnessProfile,
  ProfileRunInput,
  ProfileRunResolution,
} from "./types.js";

const DEFAULT_OPENROUTER_MODEL = "openrouter/anthropic/claude-sonnet-4.5";

function classifyOpencodeUrl(url: URL): EndpointClassification {
  const host = url.hostname;
  const pathname = url.pathname;

  if (host === "openrouter.ai") {
    if (pathname.startsWith("/api/v1/chat/completions") || pathname.startsWith("/api/v1/responses")) {
      return { category: "provider", label: "provider traffic" };
    }
    return { category: "provider", label: "provider-adjacent traffic" };
  }

  if (host === "models.dev") {
    return { category: "model-catalog", label: "models.dev catalog refresh" };
  }

  if (host === "opencode.ai" || host === "app.opencode.ai") {
    return { category: "service", label: "OpenCode service traffic" };
  }

  if (host === "registry.npmjs.org") {
    return { category: "package-registry", label: "package registry / upgrade metadata" };
  }

  if (
    host === "api.github.com" ||
    host === "github.com" ||
    host === "raw.githubusercontent.com" ||
    host === "release-assets.githubusercontent.com"
  ) {
    return { category: "update", label: "GitHub-hosted metadata or downloads" };
  }

  return { category: "unknown", label: "unknown" };
}

function resolveOpencodeRun(
  hostEnv: NodeJS.ProcessEnv,
  input: ProfileRunInput,
): ProfileRunResolution {
  const mode = input.mode ?? "openrouter";
  if (mode !== "openrouter") {
    throw new Error(`Unsupported opencode mode: ${mode}`);
  }

  const env: Record<string, string> = {};
  for (const key of ["OPENROUTER_API_KEY", "HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY"]) {
    const value = hostEnv[key];
    if (value !== undefined) env[key] = value;
  }
  env.XDG_CACHE_HOME = "/var/cache";
  env.XDG_DATA_HOME = "/var/lib";
  env.XDG_STATE_HOME = "/var/state";

  const notes: string[] = [
    `Default model is passed on the CLI (${DEFAULT_OPENROUTER_MODEL}).`,
    "XDG cache/data/state are pinned to /var so startup caches persist in the image.",
  ];
  if (!env.OPENROUTER_API_KEY) {
    notes.push("OPENROUTER_API_KEY is unset; OpenRouter requests will likely fail.");
  }

  if (input.extraEnv) {
    Object.assign(env, input.extraEnv);
  }

  return {
    mode,
    env,
    command: input.command ?? ["opencode", "--model", DEFAULT_OPENROUTER_MODEL],
    providerHosts: ["openrouter.ai"],
    notes,
  };
}

export const opencodeProfile: HarnessProfile = {
  name: "opencode",
  description: "OpenCode in an Alpine Gondolin image with locally prepared assets",
  buildConfigPath: path.resolve("images/opencode.json"),
  prepareBuildAssets: prepareOpencodeAssets,
  defaultCommand: ["opencode", "--model", DEFAULT_OPENROUTER_MODEL],
  defaultMode: "openrouter",
  modes: [
    {
      name: "openrouter",
      description: "OpenCode with OpenRouter and a default Claude Sonnet model",
    },
  ],
  resolveRun: resolveOpencodeRun,
  classifyUrl: classifyOpencodeUrl,
  reportNotes: [
    "OpenCode is launched with an explicit OpenRouter model id on the CLI.",
    "OpenCode may refresh models from models.dev and may perform upgrade-related checks depending on runtime behavior.",
    "The build prepares a cached OpenCode plugin directory and default model state before the image is assembled.",
    "OpenRouter requests include OpenCode-specific referer/title headers upstream.",
  ],
};
