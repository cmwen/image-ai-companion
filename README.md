# Visual Companion

A local-first desktop companion for learning visual language while building prompts for ChatGPT and Google Flow. It does not generate images. This first milestone provides a complete offline creation loop using curated educational content.

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
