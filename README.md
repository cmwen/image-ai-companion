# Visual Companion

A local-first desktop companion for learning visual language while building prompts for ChatGPT and Google Flow. It does not generate images. This first milestone provides a complete offline creation loop using curated educational content.

## Download and open on macOS

Open the [GitHub Releases page](https://github.com/cmwen/image-ai-companion/releases) and select the `v0.1.0` testing prerelease (or a later release). Download `Image-AI-Companion_v0.1.0_universal.dmg` and `SHA256SUMS`. The universal app supports Apple Silicon and Intel Macs. An `.app.tar.gz` is also provided if you prefer extracting the application directly.

In Terminal, change to your download directory and compare the file’s SHA-256 with its entry in `SHA256SUMS`:

```sh
shasum -a 256 Image-AI-Companion_v0.1.0_universal.dmg
```

Open the DMG, drag **Image AI Companion.app** to Applications, and eject the disk image. For the tar.gz, extract it and move the app to Applications.

This testing build is **ad-hoc signed**, sometimes described as self-signed. It is not signed with an Apple Developer ID certificate and is not notarized. There is no certificate to install or trust. CI verifies the signature and both CPU architectures before publishing. [Tauri explains ad-hoc signing](https://v2.tauri.app/distribute/sign/macos/).

If macOS blocks the first launch because the developer cannot be verified, attempt to open the app once, then use **System Settings → Privacy & Security → Open Anyway**, and confirm **Open**. Only do this for the release you trust and whose checksum you checked. Follow [Apple’s instructions for opening an app from an unidentified developer](https://support.apple.com/en-au/102445).

If the normal exception flow is unavailable and you have verified this specific release, you can remove the quarantine attribute from **only this installed application**, then open it again:

```sh
xattr -dr com.apple.quarantine "/Applications/Image AI Companion.app"
```

Do not disable Gatekeeper globally or override a malware warning. For a damaged or modified-app warning, download a fresh copy and recheck its checksum before proceeding. Managed Macs may require your administrator’s help.

## Publishing a new release

The `.github/workflows/release.yml` workflow runs on a pushed `v*` tag or through **Actions → macOS testing release → Run workflow**, with an existing version tag. It requires no Apple signing credentials. `v0.1.0` and tags containing a prerelease suffix are published as prereleases.

Update the version together in `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, and `src-tauri/tauri.conf.json`; commit the changes, then create and push the matching tag:

```sh
node scripts/check-release-version.mjs
RELEASE_TAG=v0.1.1 node scripts/check-release-version.mjs # after updating to 0.1.1
git tag v0.1.1
git push origin v0.1.1
```

The workflow checks the tag and versions, runs frontend tests/build and native tests, builds a universal app and DMG, verifies ad-hoc signatures and the mounted DMG contents, then packages the app and SHA-256 checksums. Assets upload to a draft; the release becomes public only after all three assets are present. Existing releases are never replaced automatically. Failed publishing attempts clean up their draft so partial assets do not appear as a public release.

## Run

Requires Node.js 22.12+ (Node 24 recommended for the SQLite integration tests).

```sh
npm ci
npm run dev        # browser preview at http://127.0.0.1:1420
npm run tauri dev  # native desktop app
```

Native development also requires Rust 1.90+ and [Tauri platform prerequisites](https://v2.tauri.app/start/prerequisites/). On Linux, install GTK3 and WebKitGTK 4.1 development packages. macOS is the primary packaging target; platform packaging has not been verified yet.

## Use

Create a project in Projects, enter a subject in Create, choose a few suggested visual concepts, and build a prompt. Read the explanations, edit or simplify the wording, then copy it and open ChatGPT or Google Flow. Paste it in the destination to generate your image. Save prompt versions to your project and restore them from history.

Explore provides a searchable starter vocabulary. Learn offers two controlled comparison exercises. Settings persists your default destination. Desktop data uses SQLite in the application config directory; browser preview data uses localStorage on the current origin. They are separate stores.

## Validate

```sh
npm test          # content, prompt logic, preview persistence, actual SQLite repositories
npm run build     # strict TypeScript + production frontend
npx playwright install chromium # if no browser is installed
npm run test:e2e   # browser creation/copy/save/reload flow
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo check --manifest-path src-tauri/Cargo.toml
```

## Architecture

`src/types` contains serializable domain models. `content/library.json` is validated by Zod, including unique IDs and concept references. Prompt transformations and destination adapters live under `src/features`. React talks only to the repository interface; native SQL migrations are registered in Rust. Destinations use explicit clipboard and system-browser capabilities with a restricted URL allowlist.

The tutor interface and separate `prompts/visual-tutor-system.md` define the future model boundary. The included offline helper offers deterministic guidance; no model endpoint, API key, network tutor request, image critique, embedding, result import, or destination DOM automation is implemented. See [implementation notes](docs/IMPLEMENTATION.md) for boundaries and remaining spikes.
