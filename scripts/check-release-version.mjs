import { readFileSync } from "node:fs";
const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const version = json("package.json").version;
const cargo = readFileSync("src-tauri/Cargo.toml", "utf8").match(
  /^version\s*=\s*"([^"]+)"/m,
)?.[1];
const lock = readFileSync("src-tauri/Cargo.lock", "utf8").match(
  /name = "image-ai-companion"\nversion = "([^"]+)"/,
)?.[1];
const versions = [
  json("package-lock.json").version,
  json("package-lock.json").packages[""].version,
  json("src-tauri/tauri.conf.json").version,
  cargo,
  lock,
];
const tag = process.env.RELEASE_TAG;
if (
  !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version) ||
  versions.some((v) => v !== version) ||
  (tag && tag !== `v${version}`)
)
  throw new Error(
    `Release version mismatch: expected v${version}, received ${tag ?? "no tag"}, versions ${versions.join(", ")}`,
  );
console.log(`Release versions synchronized: v${version}`);
