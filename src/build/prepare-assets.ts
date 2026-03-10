import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import { createGzip } from "node:zlib";

const execFileAsync = promisify(execFile);

const PI_MANIFEST_DIR = path.resolve("manifests/pi-coding-agent");
const PI_STAGING_DIR = path.resolve("staging/pi-coding-agent");
const PI_ARCHIVE_PATH = path.join(PI_STAGING_DIR, "node_modules.tar.gz");
const PI_MARKER_PATH = path.join(PI_STAGING_DIR, ".prepared-manifest-sha256");
const OPENCODE_CACHE_MANIFEST_DIR = path.resolve("manifests/opencode-cache");
const OPENCODE_CACHE_STAGING_DIR = path.resolve("staging/opencode-cache");
const OPENCODE_BINARY_STAGING_DIR = path.resolve("staging/opencode");
const OPENCODE_BINARY_PACKAGE = "opencode-linux-arm64-musl";
const OPENCODE_BINARY_VERSION = "1.2.24";
const OPENCODE_BINARY_MARKER = path.join(OPENCODE_BINARY_STAGING_DIR, ".prepared-version");

type PrepareAssetsOptions = {
  quiet?: boolean | undefined;
};

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function filesMatch(aPath: string, bPath: string): Promise<boolean> {
  if (!(await pathExists(aPath)) || !(await pathExists(bPath))) {
    return false;
  }

  const [a, b] = await Promise.all([readFile(aPath, "utf8"), readFile(bPath, "utf8")]);
  return a === b;
}

async function hashFiles(filePaths: string[]): Promise<string> {
  const hash = createHash("sha256");
  for (const filePath of filePaths) {
    hash.update(await readFile(filePath));
  }
  return hash.digest("hex");
}

async function runCommand(
  command: string,
  args: string[],
  options: { cwd?: string | undefined; quiet?: boolean | undefined } = {},
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: options.quiet ? "pipe" : "inherit",
    });

    let output = "";
    child.stdout?.on("data", (chunk) => {
      output += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      output += String(chunk);
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      const detail = output.trim();
      reject(
        new Error(
          detail.length > 0
            ? `Command failed (${command} ${args.join(" ")}):\n${detail}`
            : `Command failed (${command} ${args.join(" ")}) with exit code ${code}`,
        ),
      );
    });
  });
}

async function prepareInstalledTree(options: {
  manifestDir: string;
  targetDir: string;
  primaryPackagePath: string;
  quiet?: boolean | undefined;
  npmArgs?: string[] | undefined;
}): Promise<boolean> {
  const targetPackageJson = path.join(options.targetDir, "package.json");
  const targetPackageLock = path.join(options.targetDir, "package-lock.json");
  const sourcePackageJson = path.join(options.manifestDir, "package.json");
  const sourcePackageLock = path.join(options.manifestDir, "package-lock.json");

  const upToDate =
    (await pathExists(path.join(options.targetDir, options.primaryPackagePath))) &&
    (await filesMatch(sourcePackageJson, targetPackageJson)) &&
    (await filesMatch(sourcePackageLock, targetPackageLock));

  if (upToDate) {
    return false;
  }

  await rm(options.targetDir, { recursive: true, force: true });
  await mkdir(path.dirname(options.targetDir), { recursive: true });
  await cp(options.manifestDir, options.targetDir, { recursive: true });
  await runCommand(
    "npm",
    [
      "ci",
      "--prefix",
      options.targetDir,
      "--omit=dev",
      "--no-audit",
      "--no-fund",
      ...(options.npmArgs ?? []),
    ],
    { quiet: options.quiet },
  );
  return true;
}

async function prepareOpencodeBinary(options: PrepareAssetsOptions = {}): Promise<boolean> {
  const binaryPath = path.join(OPENCODE_BINARY_STAGING_DIR, "bin", "opencode.gz");
  const markerMatches =
    (await pathExists(OPENCODE_BINARY_MARKER)) &&
    (await readFile(OPENCODE_BINARY_MARKER, "utf8")) === `${OPENCODE_BINARY_PACKAGE}@${OPENCODE_BINARY_VERSION}\n`;

  if ((await pathExists(binaryPath)) && markerMatches) {
    return false;
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), "opencode-pack-"));
  try {
    const { stdout } = await execFileAsync(
      "npm",
      [
        "pack",
        `${OPENCODE_BINARY_PACKAGE}@${OPENCODE_BINARY_VERSION}`,
        "--pack-destination",
        tempDir,
        "--silent",
      ],
      {
        encoding: "utf8",
      },
    );
    const tarballName = stdout.trim().split(/\s+/).at(-1);
    if (!tarballName) {
      throw new Error(`npm pack did not return a tarball name for ${OPENCODE_BINARY_PACKAGE}`);
    }

    const tarballPath = path.join(tempDir, tarballName);
    const extractDir = path.join(tempDir, "extract");
    await mkdir(extractDir, { recursive: true });
    await execFileAsync("tar", ["-xzf", tarballPath, "-C", extractDir]);

    const sourceBinary = path.join(extractDir, "package", "bin", "opencode");
    if (!(await pathExists(sourceBinary))) {
      throw new Error(`Expected OpenCode binary at ${sourceBinary}`);
    }

    await rm(OPENCODE_BINARY_STAGING_DIR, { recursive: true, force: true });
    await mkdir(path.join(OPENCODE_BINARY_STAGING_DIR, "bin"), { recursive: true });
    await pipeline(
      createReadStream(sourceBinary),
      createGzip({ level: 9 }),
      createWriteStream(binaryPath),
    );
    await writeFile(
      OPENCODE_BINARY_MARKER,
      `${OPENCODE_BINARY_PACKAGE}@${OPENCODE_BINARY_VERSION}\n`,
      "utf8",
    );
    return true;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function preparePiCodingAgentAssets(
  options: PrepareAssetsOptions = {},
): Promise<boolean> {
  const manifestHash = await hashFiles([
    path.join(PI_MANIFEST_DIR, "package.json"),
    path.join(PI_MANIFEST_DIR, "package-lock.json"),
  ]);
  const markerMatches =
    (await pathExists(PI_MARKER_PATH)) &&
    (await readFile(PI_MARKER_PATH, "utf8")) === `${manifestHash}\n`;

  if ((await pathExists(PI_ARCHIVE_PATH)) && markerMatches) {
    return false;
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), "pi-coding-agent-install-"));
  const installDir = path.join(tempDir, "install");
  try {
    await cp(PI_MANIFEST_DIR, installDir, { recursive: true });
    await runCommand(
      "npm",
      ["ci", "--prefix", installDir, "--omit=dev", "--no-audit", "--no-fund"],
      { quiet: options.quiet },
    );

    await rm(PI_STAGING_DIR, { recursive: true, force: true });
    await mkdir(PI_STAGING_DIR, { recursive: true });
    await execFileAsync("tar", ["-czf", PI_ARCHIVE_PATH, "-C", installDir, "node_modules"]);
    await writeFile(PI_MARKER_PATH, `${manifestHash}\n`, "utf8");
    return true;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function prepareOpencodeAssets(
  options: PrepareAssetsOptions = {},
): Promise<boolean> {
  const [preparedBinary, preparedCache] = await Promise.all([
    prepareOpencodeBinary(options),
    prepareInstalledTree({
      manifestDir: OPENCODE_CACHE_MANIFEST_DIR,
      targetDir: OPENCODE_CACHE_STAGING_DIR,
      primaryPackagePath: path.join("node_modules", "opencode-anthropic-auth", "package.json"),
      quiet: options.quiet,
      npmArgs: ["--ignore-scripts"],
    }),
  ]);

  return preparedBinary || preparedCache;
}
