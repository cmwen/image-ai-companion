# Visual Companion

A local-first desktop companion for learning visual language while building prompts for ChatGPT and Google Flow. It does not generate images. This first milestone provides a complete offline creation loop using curated educational content.

## Download and open on macOS

Open the [GitHub Releases page](https://github.com/cmwen/image-ai-companion/releases) and select the `v0.1.4` release (or a later release). Download `Image-AI-Companion_v0.1.4_universal.dmg` and `SHA256SUMS`. The universal app supports Apple Silicon and Intel Macs. An `.app.tar.gz` is also provided if you prefer extracting the application directly.

In Terminal, change to your download directory and compare the file’s SHA-256 with its entry in `SHA256SUMS`:

```sh
shasum -a 256 Image-AI-Companion_v0.1.4_universal.dmg
```

Open the DMG, drag **Image AI Companion.app** to Applications, and eject the disk image. For the tar.gz, extract it and move the app to Applications.

This testing build is **ad-hoc signed**, sometimes described as self-signed. It is not signed with an Apple Developer ID certificate and is not notarized. There is no certificate to install or trust. CI verifies the signature and both CPU architectures before publishing. [Tauri explains ad-hoc signing](https://v2.tauri.app/distribute/sign/macos/).

If macOS blocks the first launch because the developer cannot be verified, attempt to open the app once, then use **System Settings → Privacy & Security → Open Anyway**, and confirm **Open**. Only do this for the release you trust and whose checksum you checked. Follow [Apple’s instructions for opening an app from an unidentified developer](https://support.apple.com/en-au/102445).

If the normal exception flow is unavailable and you have verified this specific release, you can remove the quarantine attribute from **only this installed application**, then open it again:

```sh
xattr -dr com.apple.quarantine "/Applications/Image AI Companion.app"
```

Do not disable Gatekeeper globally or override a malware warning. For a damaged or modified-app warning, download a fresh copy and recheck its checksum before proceeding. Managed Macs may require your administrator’s help.

## Automatic desktop updates

Install **v0.1.4 manually once** to enable OTA; versions 0.1.3 and earlier do not contain an updater. Copy the app out of the DMG into a writable Applications location and launch that copy. Future releases check on startup and every six hours, download and install in the background, and show **Restart to update** when ready. Restart happens only when you choose it. The footer also provides **Check for updates**. Automatic checks stay quiet when offline; manual failures and failed installs offer a retry. Browser preview does not check for updates.

The app fetches the public [latest updater manifest](https://github.com/cmwen/image-ai-companion/releases/latest/download/latest.json). Tauri verifies each archive against this app’s embedded public key before installation. Updater signatures protect OTA payload integrity; they are separate from Apple Developer ID signing and notarization. Builds remain ad-hoc signed, so the macOS first-install instructions still apply. No certificate installation is needed for OTA.

Release maintainers must keep the app-specific private signing key and password in GitHub Actions secrets named `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. This workspace’s restricted backup is at `/home/cmwen/dev/tauri-apps/.updater/image-ai-companion`, excluded from Git. Never commit or publish the private key/password, reuse another app’s key, or re-create an archive after Tauri signs it. Losing this key prevents existing installations from trusting future updates; changing the public key requires a planned migration or another manual install. The public key in the Tauri configuration is safe to distribute.

The release contains six assets: DMG, signed `.app.tar.gz`, its `.sig`, `latest.json`, `AUTH-SMOKE.json`, and `SHA256SUMS`. Both `darwin-aarch64` and `darwin-x86_64` in the manifest point to the same universal archive. GitHub must remain public and the release must be published as latest (not draft/prerelease) for anonymous desktop update checks. The workflow fails before building if the encrypted signing key or its password is missing, validates all artifacts, then publishes the completed draft as latest.

## Publishing a new release

The `.github/workflows/release.yml` workflow runs on a pushed `v*` tag or through **Actions → macOS testing release → Run workflow**, with an existing version tag. It requires no Apple signing credentials. Versions use stable semantic tags and publish as GitHub’s latest release so the public updater endpoint resolves. The product and embedded authentication remain experimental.

Update the version together in `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, and `src-tauri/tauri.conf.json`; commit the changes, then create and push the matching tag:

```sh
node scripts/check-release-version.mjs
RELEASE_TAG=v0.1.5 node scripts/check-release-version.mjs # after updating to 0.1.5
git tag v0.1.5
git push origin v0.1.5
```

The workflow checks the tag and versions, runs frontend tests/build and native tests, builds a universal app and DMG, verifies ad-hoc signatures and the mounted DMG contents, runs an anonymous native page-load smoke probe, then copies Tauri’s signed app archive and detached signature byte for byte, generates latest.json for both macOS architectures, and publishes AUTH-SMOKE.json plus checksums. The report does not verify credential login or MFA. Assets upload to a draft; the release becomes public only after all six assets are present. Existing releases are never replaced automatically. Failed publishing attempts clean up their draft so partial assets do not appear as a public release.

## Run

Requires Node.js 22.12+ (Node 24 recommended for the SQLite integration tests).

```sh
npm ci
npm run dev        # browser preview at http://127.0.0.1:1420
npm run tauri dev  # native desktop app
```

Signed release bundles require the updater signing environment variables described above. For a local native bundle without release secrets, explicitly disable updater artifact creation (this bundle is not an OTA release):

```sh
npm run tauri -- build --config '{"bundle":{"createUpdaterArtifacts":false}}'
```

Native development also requires Rust 1.90+ and [Tauri platform prerequisites](https://v2.tauri.app/start/prerequisites/). On Linux, install GTK3 and WebKitGTK 4.1 development packages. macOS is the primary packaging target; the release workflow verifies packaging and signatures, while GUI launch still needs a manual smoke test on your Mac.

## Embedded creative workspace (experimental)

The native desktop app now offers **Embed (experimental)** in Create. ChatGPT or Google Flow appears in the same window beside the companion. Build your prompt, use **Copy & focus destination**, and paste it on the right. Reload and close controls manage the workspace. Destination navigation, login, and related authentication popups remain owned by the provider; no credentials are handled by the companion.

Embedded sessions are separate from your system browser. If a provider refuses embedded sign-in, choose **Open in browser** and sign in there separately. Google can reject embedded OAuth. Complete sign-in, MFA, and session restart behavior have not been interactively verified. See [the authentication spike and test checklist](docs/AUTH-SPIKE.md) for exact observations and remaining tests. The browser development preview supports only the browser handoff.

## Use

Create a project in Projects, enter a subject in Create, choose a few suggested visual concepts, and build a prompt. Read the explanations, edit or simplify the wording, then copy it and open ChatGPT or Google Flow. Paste it in the destination to generate your image. Save prompt versions to your project and restore them from history.

Explore provides a searchable starter vocabulary. Learn offers two controlled comparison exercises. Settings persists your default destination. Use Create’s destination controls to choose an experimental embedded workspace or external browser handoff. Desktop data uses SQLite in the application config directory; browser preview data uses localStorage on the current origin. They are separate stores.

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

The tutor interface and separate `prompts/visual-tutor-system.md` define the future model boundary. The included offline helper offers deterministic guidance; no model endpoint, API key, network tutor request, image critique, result import, or destination DOM automation is implemented. See [implementation notes](docs/IMPLEMENTATION.md) for boundaries and remaining spikes.
