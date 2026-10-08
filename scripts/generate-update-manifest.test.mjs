import { test } from "node:test";
import assert from "node:assert/strict";
import { updateManifest } from "./generate-update-manifest.mjs";
const input = {
  version: "0.1.4",
  repository: "cmwen/image-ai-companion",
  filename: "Image-AI-Companion_v0.1.4_universal.app.tar.gz",
  signature: "signed-payload\n",
  notes: "Release",
  date: "2026-10-08T01:00:00.000Z",
};
test("both mac architectures target the identical signed universal release payload", () => {
  const m = updateManifest(input);
  assert.deepEqual(m.platforms["darwin-aarch64"], m.platforms["darwin-x86_64"]);
  assert.equal(m.platforms["darwin-aarch64"].signature, "signed-payload");
  assert.equal(
    m.platforms["darwin-aarch64"].url,
    `https://github.com/cmwen/image-ai-companion/releases/download/v0.1.4/${input.filename}`,
  );
  assert.equal(m.version, "0.1.4");
});
test("rejects unsigned, invalid, nonstable, and path-traversal manifest inputs", () => {
  for (const change of [
    { signature: "" },
    { version: "0.1.4-beta" },
    { filename: "../payload.app.tar.gz" },
    { filename: "unsigned.dmg" },
    { repository: "../repo" },
    { date: "invalid" },
  ])
    assert.throws(() => updateManifest({ ...input, ...change }));
});
