import { mkdir } from "node:fs/promises";
import path from "node:path";

import {
  VM,
  RealFSProvider,
  createHttpHooks,
  getInfoFromSshExecRequest,
  type SshExecDecision,
  type SshExecRequest,
  type VMOptions,
} from "@earendil-works/gondolin";

import { mergeGuestEnv } from "./monitor/env.js";
import {
  confirmWithNativePopupGit,
  confirmWithNativePopupHttp,
  wildcardFor,
  type GitDecision,
  type HttpDecision,
} from "./monitor/popup-policy.js";
import { ShellTerminalAttach } from "./monitor/shell-attach.js";
import {
  appendNdjson,
  bodyPreview,
  summarizeHeaders,
  type BodyCaptureOptions,
} from "./monitor/traffic-log.js";
import type { HarnessProfile } from "./profiles/types.js";

export type ConfirmMode = "first-host" | "always" | "log-only";

export type RunProfileOptions = {
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

const DEFAULT_SHELL_COMMAND = ["/bin/bash", "--noprofile", "--norc", "-i"];

type GitOp = "clone" | "push";

function hostMatchesPattern(hostname: string, pattern: string): boolean {
  const normalizedHost = hostname.toLowerCase();
  const normalizedPattern = pattern.trim().toLowerCase();
  if (!normalizedPattern) return false;
  if (normalizedPattern === "*") return true;
  if (normalizedPattern.startsWith("*.")) {
    const suffix = normalizedPattern.slice(2);
    return normalizedHost === suffix || normalizedHost.endsWith(`.${suffix}`);
  }
  return normalizedHost === normalizedPattern;
}

function classifyGitService(service: string): GitOp | null {
  if (service === "git-upload-pack" || service === "git-upload-archive") {
    return "clone";
  }
  if (service === "git-receive-pack") return "push";
  return null;
}

function gitKey(op: GitOp, hostname: string, port: number, repo: string): string {
  return `${op}|${hostname}:${port}|${repo}`;
}

export async function runProfile(
  profile: HarnessProfile,
  options: RunProfileOptions,
): Promise<number> {
  const resolveInput = {} as {
    mode?: string;
    command?: string[];
    extraEnv?: Record<string, string>;
  };
  if (options.mode !== undefined) resolveInput.mode = options.mode;
  if (options.command !== undefined) resolveInput.command = options.command;
  if (options.extraEnv !== undefined) resolveInput.extraEnv = options.extraEnv;

  const resolution = profile.resolveRun(process.env, resolveInput);
  const workspace = options.workspace ? path.resolve(options.workspace) : undefined;
  const httpLogPath = path.resolve(options.httpLogPath);
  const sshAgent = options.enableSsh ? process.env.SSH_AUTH_SOCK : undefined;
  const captureOptions: BodyCaptureOptions = {
    hosts: options.fullBodyHosts,
    paths: options.fullBodyPaths,
  };

  await mkdir(path.dirname(httpLogPath), { recursive: true });

  let promptQueue: Promise<void> = Promise.resolve();
  let attach: ShellTerminalAttach | null = null;

  const guestEnv = mergeGuestEnv(resolution.env, options.extraEnv);
  const command = options.shell ? DEFAULT_SHELL_COMMAND : resolution.command;

  const httpDecisions = new Map<string, boolean>();
  const httpPending = new Map<string, Promise<boolean>>();

  const sshHostDecisions = new Map<string, boolean>();
  const sshHostPending = new Map<string, Promise<boolean>>();

  const gitDecisions = new Map<string, boolean>();
  const gitPending = new Map<string, Promise<boolean>>();

  function lookupHttpDecision(hostname: string, port: number): boolean | undefined {
    const exact = httpDecisions.get(`${hostname}:${port}`);
    if (exact !== undefined) return exact;

    const self = httpDecisions.get(`*.${hostname}:${port}`);
    if (self !== undefined) return self;

    let current = hostname;
    while (true) {
      const dot = current.indexOf(".");
      if (dot < 0 || dot === current.length - 1) break;
      const parent = current.slice(dot + 1);
      const wildcard = httpDecisions.get(`*.${parent}:${port}`);
      if (wildcard !== undefined) return wildcard;
      current = parent;
    }

    return undefined;
  }

  function explicitHostDecision(hostname: string): boolean | undefined {
    if (options.denyHosts.some((entry) => hostMatchesPattern(hostname, entry))) {
      return false;
    }
    if (options.allowHosts.some((entry) => hostMatchesPattern(hostname, entry))) {
      return true;
    }
    return undefined;
  }

  const { httpHooks } = createHttpHooks({
    onRequest: async (request) => {
      const startedAt = new Date().toISOString();
      let requestBodyPreview: string | null = null;
      try {
        const clone = request.clone();
        const bodyText = await clone.text();
        requestBodyPreview = bodyPreview(
          request.headers.get("content-type"),
          bodyText,
          new URL(request.url),
          captureOptions,
        );
      } catch {
        requestBodyPreview = null;
      }

      await appendNdjson(httpLogPath, {
        type: "request",
        startedAt,
        method: request.method,
        url: request.url,
        headers: summarizeHeaders(request.headers),
        bodyPreview: requestBodyPreview,
      });
      return undefined;
    },
    onResponse: async (response, request) => {
      const finishedAt = new Date().toISOString();
      let responseBodyPreview: string | null = null;
      try {
        const bodyText = await response.clone().text();
        responseBodyPreview = bodyPreview(
          response.headers.get("content-type"),
          bodyText,
          new URL(request.url),
          captureOptions,
        );
      } catch {
        responseBodyPreview = null;
      }

      await appendNdjson(httpLogPath, {
        type: "response",
        finishedAt,
        method: request.method,
        url: request.url,
        status: response.status,
        statusText: response.statusText,
        headers: summarizeHeaders(response.headers),
        bodyPreview: responseBodyPreview,
      });
      return undefined;
    },
    isRequestAllowed: async (request) => {
      const url = new URL(request.url);
      const protocol =
        url.protocol === "https:" ? "https" : url.protocol === "http:" ? "http" : null;
      if (!protocol) return false;

      const hostname = url.hostname.toLowerCase();
      const port = url.port ? Number(url.port) : protocol === "https" ? 443 : 80;
      if (!Number.isFinite(port) || port <= 0) return false;

      const staticDecision = explicitHostDecision(hostname);
      if (staticDecision !== undefined) return staticDecision;
      if (options.confirmMode === "log-only") return true;

      const key =
        options.confirmMode === "always"
          ? `${hostname}:${port}|${request.method}|${request.url}`
          : `${hostname}:${port}`;

      if (options.confirmMode !== "always") {
        const existing = lookupHttpDecision(hostname, port);
        if (existing !== undefined) return existing;
      }

      const inflight = httpPending.get(key);
      if (inflight) return inflight;

      const pending = (async () => {
        const runPrompt = async (): Promise<HttpDecision> => {
          const target = `${protocol.toUpperCase()} ${hostname}:${port}`;
          const wildcard = wildcardFor(hostname);
          const wildcardLabel = wildcard ? `${wildcard}:${port}` : null;
          const message = `Allow ${request.method} ${request.url} (${target})?`;

          if (attach) attach.pause();
          try {
            const popup = await confirmWithNativePopupHttp(message, wildcardLabel);
            if (popup !== null) return popup;
          } finally {
            if (attach) attach.resume();
          }

          if (attach) {
            const choices = wildcardLabel
              ? options.confirmMode === "always"
                ? `(a=allow once, w=allow ${wildcardLabel}, d=deny) [d]`
                : `(a=allow ${hostname}:${port}, w=allow ${wildcardLabel}, d=deny) [d]`
              : `(a=allow${options.confirmMode === "always" ? " once" : ""}, d=deny) [d]`;
            const answer = await attach.promptDecision(message, choices);
            if (answer === "a" || answer === "allow") return "host";
            if (wildcardLabel && (answer === "w" || answer === "wildcard")) {
              return "wildcard";
            }
          }

          return "deny";
        };

        const gate = promptQueue;
        let release!: () => void;
        promptQueue = new Promise<void>((resolve) => {
          release = resolve;
        });

        await gate;
        try {
          const decision = await runPrompt();
          const allow = decision !== "deny";
          if (options.confirmMode !== "always") {
            if (decision === "wildcard") {
              const wildcard = wildcardFor(hostname);
              if (wildcard) httpDecisions.set(`${wildcard}:${port}`, true);
            }
            httpDecisions.set(`${hostname}:${port}`, allow);
          }
          return allow;
        } finally {
          httpPending.delete(key);
          release();
        }
      })();

      httpPending.set(key, pending);
      return pending;
    },
  });

  function lookupGitDecision(
    op: GitOp,
    hostname: string,
    port: number,
    repo: string,
  ): boolean | undefined {
    const exact = gitDecisions.get(gitKey(op, hostname, port, repo));
    if (exact !== undefined) return exact;
    const hostWide = gitDecisions.get(gitKey(op, hostname, port, "*"));
    if (hostWide !== undefined) return hostWide;
    return undefined;
  }

  async function decideSshExec(req: SshExecRequest): Promise<SshExecDecision> {
    const hostname = req.hostname.toLowerCase();
    const port = req.port;

    const gitInfo = getInfoFromSshExecRequest(req);
    if (gitInfo) {
      const op = classifyGitService(gitInfo.service);
      if (op) {
        const existing = lookupGitDecision(op, hostname, port, gitInfo.repo);
        if (existing !== undefined) return { allow: existing };

        const promptKey = gitKey(op, hostname, port, gitInfo.repo);
        const inflight = gitPending.get(promptKey);
        if (inflight) return { allow: await inflight };

        const pending = (async () => {
          const runPrompt = async (): Promise<GitDecision> => {
            const target = `${hostname}:${port}`;
            const opLabel = op === "clone" ? "clone/fetch" : "push";
            const message = `Allow git ${opLabel} via SSH to ${target}?\nRepo: ${gitInfo.repo}`;
            const hostLabel = `Allow all repos on ${target}`;
            const repoLabel = `Allow ${gitInfo.repo}`;

            if (attach) attach.pause();
            try {
              const popup = await confirmWithNativePopupGit(message, hostLabel, repoLabel);
              if (popup !== null) return popup;
            } finally {
              if (attach) attach.resume();
            }

            if (attach) {
              const answer = await attach.promptDecision(
                message,
                `(r=allow repo, h=allow host(all repos), d=deny) [d]`,
              );
              if (answer === "r" || answer === "repo") return "repo";
              if (answer === "h" || answer === "host") return "host";
            }

            return "deny";
          };

          const gate = promptQueue;
          let release!: () => void;
          promptQueue = new Promise<void>((resolve) => {
            release = resolve;
          });

          await gate;
          try {
            const decision = await runPrompt();
            const allow = decision !== "deny";
            if (decision === "host") {
              gitDecisions.set(gitKey(op, hostname, port, "*"), true);
            } else if (decision === "repo") {
              gitDecisions.set(gitKey(op, hostname, port, gitInfo.repo), true);
            } else {
              gitDecisions.set(gitKey(op, hostname, port, gitInfo.repo), false);
            }
            return allow;
          } finally {
            gitPending.delete(promptKey);
            release();
          }
        })();

        gitPending.set(promptKey, pending);
        const allow = await pending;
        if (allow) return { allow: true };
        return {
          allow: false,
          exitCode: 1,
          message: `git ${op} denied by user: ${hostname}:${port} ${gitInfo.repo}`,
        };
      }
    }

    const hostKey = `${hostname}:${port}`;
    const existing = sshHostDecisions.get(hostKey);
    if (existing !== undefined) return { allow: existing };

    const inflight = sshHostPending.get(hostKey);
    if (inflight) return { allow: await inflight };

    const pending = (async () => {
      const runPrompt = async (): Promise<boolean> => {
        const message = `Allow SSH exec to ${hostKey}?\nCommand: ${req.command}`;
        if (attach) attach.pause();
        try {
          const popup = await confirmWithNativePopupHttp(message, null);
          if (popup !== null) return popup !== "deny";
        } finally {
          if (attach) attach.resume();
        }

        if (attach) {
          const answer = await attach.promptDecision(message, `(a=allow, d=deny) [d]`);
          return answer === "a" || answer === "allow";
        }
        return false;
      };

      const gate = promptQueue;
      let release!: () => void;
      promptQueue = new Promise<void>((resolve) => {
        release = resolve;
      });

      await gate;
      try {
        const allow = await runPrompt();
        sshHostDecisions.set(hostKey, allow);
        return allow;
      } finally {
        sshHostPending.delete(hostKey);
        release();
      }
    })();

    sshHostPending.set(hostKey, pending);
    const allow = await pending;
    if (allow) return { allow: true };
    return {
      allow: false,
      exitCode: 1,
      message: `ssh denied by user: ${hostKey}`,
    };
  }

  const vmOptions: VMOptions = {
    httpHooks,
    env: guestEnv,
  };

  if (options.imagePath) {
    vmOptions.sandbox = { imagePath: options.imagePath };
  }
  if (workspace) {
    vmOptions.vfs = {
      mounts: {
        "/workspace": new RealFSProvider(workspace),
      },
    };
  }
  if (sshAgent) {
    vmOptions.ssh = {
      allowedHosts: ["*"],
      agent: sshAgent,
      execPolicy: decideSshExec,
    };
  }

  const vm = await VM.create(vmOptions);

  try {
    process.stderr.write(
      `Running ${profile.name} (${resolution.mode})${options.imagePath ? ` image=${options.imagePath}` : ""}.\n`,
    );
    process.stderr.write(`HTTP log: ${httpLogPath}\n`);
    process.stderr.write(`Confirm mode: ${options.confirmMode}\n`);
    if (workspace) process.stderr.write(`Mounted ${workspace} at /workspace\n`);
    if (resolution.providerHosts.length > 0) {
      process.stderr.write(`Provider hosts: ${resolution.providerHosts.join(", ")}\n`);
    }
    for (const note of resolution.notes) {
      process.stderr.write(`Note: ${note}\n`);
    }
    if (!sshAgent) {
      process.stderr.write("SSH proxying disabled (SSH_AUTH_SOCK unset or --no-ssh used).\n");
    }

    const shellOptions: {
      attach: false;
      command: string[];
      cwd?: string;
    } = {
      attach: false,
      command,
    };
    if (workspace) shellOptions.cwd = "/workspace";

    const proc = vm.shell(shellOptions);
    attach = new ShellTerminalAttach(proc);
    attach.start();

    const result = await proc;
    return result.exitCode;
  } finally {
    attach?.stop();
    await vm.close();
  }
}
