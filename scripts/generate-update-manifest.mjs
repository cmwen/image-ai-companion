import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
export function updateManifest({
  version,
  repository,
  filename,
  signature,
  notes,
  date,
}) {
  if (!/^\d+\.\d+\.\d+$/.test(version))
    throw new Error("Expected a stable semantic version");
  if (
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) ||
    repository.includes("..")
  )
    throw new Error("Invalid GitHub repository");
  if (
    !/^[A-Za-z0-9_.-]+\.app\.tar\.gz$/.test(filename) ||
    filename.includes("..") ||
    !signature.trim()
  )
    throw new Error("A signed macOS update bundle is required");
  if (!Number.isFinite(Date.parse(date)))
    throw new Error("Invalid publication date");
  const platform = {
    signature: signature.trim(),
    url: `https://github.com/${repository}/releases/download/v${version}/${encodeURIComponent(filename)}`,
  };
  return {
    version,
    notes,
    pub_date: date,
    platforms: { "darwin-aarch64": platform, "darwin-x86_64": platform },
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const [directory, repository] = process.argv.slice(2);
  if (!directory || !repository)
    throw new Error(
      "Usage: generate-update-manifest.mjs <release-assets> <owner/repo>",
    );
  const { version } = JSON.parse(
    readFileSync("src-tauri/tauri.conf.json", "utf8"),
  );
  if (process.env.RELEASE_TAG !== `v${version}`)
    throw new Error("Release tag must match app version");
  const bundles = readdirSync(directory).filter((name) =>
    name.endsWith(".app.tar.gz"),
  );
  if (bundles.length !== 1)
    throw new Error("Expected exactly one universal macOS update bundle");
  const filename = bundles[0],
    signature = readFileSync(join(directory, `${filename}.sig`), "utf8");
  const manifest = updateManifest({
    version,
    repository,
    filename,
    signature,
    notes: `Image AI Companion v${version}. Experimental embedded workspace and signed desktop updates.`,
    date: new Date().toISOString(),
  });
  writeFileSync(
    join(directory, "latest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  console.log(`Generated signed universal updater manifest for v${version}.`);
}
