import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type { BuildConfig } from "@earendil-works/gondolin";

const execFileAsync = promisify(execFile);

type BuildConfigWithCopy = BuildConfig & {
  postBuild?: {
    copy?: Array<{
      src: string;
      dest: string;
    }>;
  };
};

type PostBuildCopyEntry = NonNullable<
  NonNullable<BuildConfigWithCopy["postBuild"]>["copy"]
>[number];

async function runDebugfs(rootfsPath: string, command: string): Promise<void> {
  try {
    await execFileAsync("debugfs", ["-w", "-R", command, rootfsPath], {
      timeout: 120_000,
    });
  } catch (error) {
    const message = (error as Error).message;
    throw new Error(`debugfs command failed: ${command}\n${message}`);
  }
}

async function pathExistsOnHost(targetPath: string): Promise<boolean> {
  try {
    await fs.lstat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureGuestDir(rootfsPath: string, guestDir: string): Promise<void> {
  const normalized = path.posix.normalize(guestDir);
  if (normalized === "/") return;
  const parts = normalized.split("/").filter(Boolean);
  let current = "";
  for (const part of parts) {
    current += `/${part}`;
    try {
      await runDebugfs(rootfsPath, `mkdir ${current}`);
    } catch (error) {
      const message = (error as Error).message;
      if (!message.includes("Ext2 directory already exists") && !message.includes("File exists")) {
        throw error;
      }
    }
  }
}

async function removeGuestPathIfPresent(rootfsPath: string, guestPath: string): Promise<void> {
  try {
    await runDebugfs(rootfsPath, `rm ${guestPath}`);
  } catch {
    // Ignore missing paths; we only want overwrite semantics for files.
  }
}

async function copyFileToRootfs(
  rootfsPath: string,
  sourcePath: string,
  guestPath: string,
): Promise<void> {
  await ensureGuestDir(rootfsPath, path.posix.dirname(guestPath));
  await removeGuestPathIfPresent(rootfsPath, guestPath);
  await runDebugfs(rootfsPath, `write ${sourcePath} ${guestPath}`);
}

async function copyDirectoryContentsToRootfs(
  rootfsPath: string,
  sourceDir: string,
  guestDir: string,
): Promise<void> {
  await ensureGuestDir(rootfsPath, guestDir);
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const childSource = path.join(sourceDir, entry.name);
    const childGuest = path.posix.join(guestDir, entry.name);
    if (entry.isDirectory()) {
      await copyDirectoryContentsToRootfs(rootfsPath, childSource, childGuest);
      continue;
    }
    if (entry.isFile()) {
      await copyFileToRootfs(rootfsPath, childSource, childGuest);
      continue;
    }
  }
}

async function applyCopyEntry(
  rootfsPath: string,
  entry: PostBuildCopyEntry,
  configDir: string,
): Promise<void> {
  const sourcePath = path.resolve(configDir, entry.src);
  if (!(await pathExistsOnHost(sourcePath))) {
    throw new Error(`postBuild.copy source not found: ${sourcePath}`);
  }

  const stat = await fs.lstat(sourcePath);
  const guestDest = path.posix.normalize(entry.dest);
  if (stat.isDirectory()) {
    await copyDirectoryContentsToRootfs(rootfsPath, sourcePath, guestDest);
    return;
  }

  const targetPath = guestDest.endsWith("/")
    ? path.posix.join(guestDest, path.basename(sourcePath))
    : guestDest;
  await copyFileToRootfs(rootfsPath, sourcePath, targetPath);
}

export async function applyPublishedPackagePostBuildCopyWorkaround(
  config: BuildConfig,
  configPath: string,
  outputDir: string,
  rootfsAssetName: string,
): Promise<boolean> {
  const entries = (config as BuildConfigWithCopy).postBuild?.copy ?? [];
  if (entries.length === 0) return false;

  const rootfsPath = path.join(outputDir, rootfsAssetName);
  const configDir = path.dirname(configPath);

  for (const entry of entries) {
    await applyCopyEntry(rootfsPath, entry, configDir);
  }

  return true;
}
