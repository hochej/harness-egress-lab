import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type HttpDecision = "host" | "wildcard" | "deny";
export type GitDecision = "repo" | "host" | "deny";

export function wildcardFor(hostname: string): string | null {
  if (!hostname.includes(".")) return null;
  const dot = hostname.indexOf(".");
  const parent = hostname.slice(dot + 1);
  if (!parent.includes(".")) return `*.${hostname}`;
  return `*.${parent}`;
}

export async function confirmWithNativePopupHttp(
  message: string,
  wildcardLabel: string | null,
): Promise<HttpDecision | null> {
  const buttons = wildcardLabel
    ? `{"Deny", "${wildcardLabel}", "Allow"}`
    : '{"Deny", "Allow"}';
  const defaultButton = '"Allow"';

  if (process.platform === "darwin") {
    try {
      const script = [
        "on run argv",
        "  set msg to item 1 of argv",
        `  display dialog msg with title "Gondolin" buttons ${buttons} default button ${defaultButton} cancel button "Deny"`,
        "end run",
      ].join("\n");
      const { stdout } = await execFileAsync("osascript", ["-e", script, "--", message], {
        timeout: 60_000,
      });
      if (stdout.includes("button returned:Allow")) return "host";
      if (wildcardLabel && stdout.includes(`button returned:${wildcardLabel}`)) {
        return "wildcard";
      }
      return "deny";
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (typeof code === "number" && code === 1) return "deny";
      return null;
    }
  }

  if (process.platform === "linux") {
    const choices = wildcardLabel
      ? ["Allow this host", `Allow ${wildcardLabel}`, "Deny"]
      : ["Allow", "Deny"];
    try {
      const { stdout } = await execFileAsync(
        "zenity",
        ["--list", "--title=Gondolin", `--text=${message}`, "--column=Action", ...choices],
        { timeout: 60_000 },
      );
      const picked = stdout.trim();
      if (picked === "Allow" || picked.startsWith("Allow this")) return "host";
      if (wildcardLabel && picked === `Allow ${wildcardLabel}`) return "wildcard";
      if (picked.startsWith("Allow *")) return "wildcard";
      return "deny";
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (typeof code === "number" && code === 1) return "deny";
    }

    try {
      await execFileAsync("kdialog", ["--title", "Gondolin", "--yesno", message], {
        timeout: 60_000,
      });
      return "host";
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (typeof code === "number" && code === 1) return "deny";
      return null;
    }
  }

  return null;
}

export async function confirmWithNativePopupGit(
  message: string,
  hostLabel: string,
  repoLabel: string,
): Promise<GitDecision | null> {
  const buttons = `{"Deny", "${hostLabel}", "${repoLabel}"}`;
  const defaultButton = `"${repoLabel}"`;

  if (process.platform === "darwin") {
    try {
      const script = [
        "on run argv",
        "  set msg to item 1 of argv",
        `  display dialog msg with title "Gondolin" buttons ${buttons} default button ${defaultButton} cancel button "Deny"`,
        "end run",
      ].join("\n");
      const { stdout } = await execFileAsync("osascript", ["-e", script, "--", message], {
        timeout: 60_000,
      });
      if (stdout.includes(`button returned:${repoLabel}`)) return "repo";
      if (stdout.includes(`button returned:${hostLabel}`)) return "host";
      return "deny";
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (typeof code === "number" && code === 1) return "deny";
      return null;
    }
  }

  if (process.platform === "linux") {
    try {
      const { stdout } = await execFileAsync(
        "zenity",
        [
          "--list",
          "--title=Gondolin",
          `--text=${message}`,
          "--column=Action",
          repoLabel,
          hostLabel,
          "Deny",
        ],
        { timeout: 60_000 },
      );
      const picked = stdout.trim();
      if (picked === repoLabel) return "repo";
      if (picked === hostLabel) return "host";
      return "deny";
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (typeof code === "number" && code === 1) return "deny";
    }
  }

  return null;
}
