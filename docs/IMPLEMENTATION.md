# First implementation milestone

Date: 2026-10-07

## Document review

PRD and ADR agree on a Tauri + React + TypeScript local-first companion, educational data outside components, replaceable destinations and tutors, clipboard handoff, and a complete basic creation loop before secondary features. The phase lists could suggest building all foundational and learning features before proving this loop; this implementation deliberately delivers one bounded vertical slice instead.

The PRD includes model-generated tutoring, broad content, imported results, progress, optional embedding, and critique. These are separate milestones, not prerequisites for proving idea → concept → explained prompt → copy → destination → saved history. Offline generation must be explicit because deterministic templates do not provide semantic AI refinement or image analysis.

## Implemented

- Tauri 2 desktop scaffold, React/TypeScript/Vite, Create/Explore/Learn/Projects/Settings navigation.
- Twelve starter concepts spanning all six categories; three recipes and two exercises. Zod startup validation catches malformed content, duplicate identifiers, and missing references.
- Editable structured intent; three curated suggestions chosen with transparent deterministic subject matching; concise prompt building, per-section explanation, rebuilding, and simplification that preserves practical constraints.
- Native clipboard and external-browser destination adapters for ChatGPT and Flow. Browser preview uses browser clipboard and opening a tab. The app asks users to paste manually.
- Native SQLite version-one migration and repository interfaces, project CRUD, edited final prompt history with intent and concept references, persistent default destination. Browser preview uses separately versioned localStorage behind the same boundary and reports damaged data instead of clearing it.
- Typed validated saved intent, actionable UI errors, empty states, keyboard-accessible navigation/controls, responsive layout, local typography without network fonts.
- TutorModel boundary, deterministic offline helper, and separate tutor system prompt. No live tutor UI is implied.

## Boundaries and next milestones

This is an initial creation-loop milestone, not the full MVP. Destinations use the external-browser path already accepted by ADR sections 11–12. Embedded login has **not** been tested; no failure or impossibility is claimed. Before embedding, test login, cookies, redirects, popups, MFA, and handoff on target operating systems.

Next validate the clipboard workflow in a real native macOS build, package and smoke-test the app, then expand the content and introduce a selected tutor provider with OS credential storage and explicit data-send controls. Subsequent work includes retained images, multimodal critique, learning progress, comparison assets, shortcuts, theme/panel preferences, and optional WebViews. No API secrets are stored by this milestone.

## Validation

`npm test`: 12 passing tests covering content referential integrity, deterministic prompts and preserved constraints, destination capabilities, browser repository reload/CRUD/cascade/settings, malformed saved intent, and actual shipped SQLite migration plus repository queries, disk reopen, history ordering, and constraints.

`npm run build`: passed strict TypeScript and production Vite build. Dependency audit after upgrading the test runner: zero reported vulnerabilities.

`cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`: passed. `cargo check`: dependency resolution succeeded; native compilation is blocked by missing Linux GTK3 `gdk-3.0` development prerequisites on the execution host. Native launch, native clipboard/browser integration, and packaging remain unverified. SQL behavior is independently tested using Node's SQLite runtime.

Browser E2E covers create project → idea → suggested concept → explained prompt → manual edit → clipboard → save → page restart → restore → settings restart. Passed: one end-to-end test. Independent desktop and mobile browser smoke review found no page errors or horizontal overflow at 390px.

## Official integration references

- [Tauri SQL plugin](https://v2.tauri.app/plugin/sql/): registered Rust-side migrations and SQL plugin access.
- [Tauri clipboard plugin](https://v2.tauri.app/plugin/clipboard/): write permission and native text copying.
- [Tauri opener plugin](https://v2.tauri.app/plugin/opener/): opening destination URLs with scoped permission.

These boundaries do not inspect destination DOM, cookies, credentials, or browser sessions.
