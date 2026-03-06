import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import {
  buildAssets,
  importImageFromDirectory,
  parseBuildConfig,
  tagImage,
} from "@earendil-works/gondolin";

import { applyPublishedPackagePostBuildCopyWorkaround } from "./build/post-build-copy.js";
import type { HarnessProfile } from "./profiles/types.js";

export type BuildImageOptions = {
  outputDir?: string;
  tag?: string;
  quiet?: boolean;
};

export async function buildImage(
  profile: HarnessProfile,
  options: BuildImageOptions,
): Promise<void> {
  if (!profile.buildConfigPath) {
    throw new Error(`Profile '${profile.name}' does not define a build config`);
  }

  const configPath = path.resolve(profile.buildConfigPath);
  const outputDir = path.resolve(
    options.outputDir ?? path.join(".artifacts", "images", profile.name),
  );
  const tag = options.tag ?? `harness-egress-lab/${profile.name}:latest`;

  await mkdir(outputDir, { recursive: true });

  const config = parseBuildConfig(await readFile(configPath, "utf8"));
  const result = await buildAssets(config, {
    outputDir,
    configDir: path.dirname(configPath),
    verbose: !options.quiet,
  });

  const appliedCopyWorkaround =
    await applyPublishedPackagePostBuildCopyWorkaround(
      config,
      configPath,
      result.outputDir,
      result.manifest.assets.rootfs,
    );

  const imported = importImageFromDirectory(result.outputDir);
  tagImage(imported.buildId, tag, imported.arch);

  process.stdout.write(`Built image for ${profile.name}\n`);
  process.stdout.write(`Config: ${configPath}\n`);
  process.stdout.write(`Output: ${result.outputDir}\n`);
  process.stdout.write(`Build ID: ${imported.buildId}\n`);
  process.stdout.write(`Tag: ${tag}\n`);
  if (appliedCopyWorkaround) {
    process.stdout.write(
      "Applied postBuild.copy rootfs patch workaround for published gondolin package.\n",
    );
  }
}
