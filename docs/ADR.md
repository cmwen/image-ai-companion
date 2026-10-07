# ADR — Architecture for AI Visual Creation Companion

- Status: Proposed
- Date: 2026-10-07
- Decision owners: Project maintainers
- Scope: MVP desktop architecture

## 1. Context

We are building a native desktop companion that helps beginners learn how to direct AI image-generation systems such as ChatGPT Images and Google Flow.

The application itself is not an image editor and does not need to host image-generation models. Its primary responsibilities are:

- teach visual terminology
- provide guided exercises and inspiration
- build and explain prompts
- launch or embed creative destinations such as ChatGPT and Google Flow
- optionally analyse generated images using a separate multimodal tutor model
- persist local projects, prompts, learning progress, and settings

The app should feel lightweight and native, but it must also work closely with web-based creative tools.

This ADR establishes the initial technical architecture for the MVP.

---

## 2. Decision Summary

Use the following architecture:

- **Tauri** for desktop application shell.
- **TypeScript + React** for the UI.
- **Rust/Tauri commands** only for native capabilities that materially benefit from Rust.
- **Local-first persistence** using SQLite plus filesystem storage for imported images/assets.
- **Destination adapter abstraction** for ChatGPT, Google Flow, and future creative web apps.
- **Clipboard-first integration** with destinations.
- **Embedded WebView where feasible, external browser fallback where not.**
- **No dependency on undocumented destination DOM structures for core functionality.**
- **Tutor-provider abstraction** for model independence.
- **Data-driven learning content** stored outside UI components.
- **No backend service in MVP.**

---

## 3. Architectural Goals

The architecture must optimise for:

1. Low implementation complexity.
2. Fast iteration.
3. Local-first privacy.
4. Replaceable tutor models.
5. Replaceable creative destinations.
6. Graceful degradation when WebView embedding fails.
7. Minimal coupling to third-party DOM internals.
8. Cross-platform portability.
9. Testable application logic.
10. Easy extension without premature plugin infrastructure.

---

## 4. Non-Goals

This ADR does not design:

- an image canvas
- image masking or layers
- image-generation APIs
- local image diffusion inference
- cloud sync
- collaboration
- account/auth backend
- browser extension architecture
- plugin marketplace
- autonomous DOM control
- MCP integration

These are explicitly outside the MVP architecture.

---

## 5. Decision: Tauri as Desktop Shell

### Chosen

Use Tauri.

### Why

The application benefits from:

- embedded WebViews
- native application windows
- clipboard access
- drag/drop
- local filesystem
- secure credential storage integrations
- global shortcuts
- cross-platform packaging
- lower overhead than Electron

The product is fundamentally a native companion around web-based creative environments, making Tauri a strong fit.

### Alternatives considered

#### Electron

Pros:

- mature ecosystem
- predictable browser runtime
- broad tooling

Cons:

- larger runtime footprint
- higher memory/storage overhead
- unnecessary bundled Chromium for this product if system WebView is sufficient

Rejected for MVP.

#### GPUI

Pros:

- native rendering
- potentially excellent performance

Cons:

- embedded web experience becomes significantly more complex
- product relies heavily on web-based destinations
- fewer mature patterns for this use case

Rejected because WebView integration is central, not incidental.

---

## 6. Decision: React + TypeScript for UI

Use React + TypeScript.

Reasons:

- fast iteration
- strong component ecosystem
- good fit with Tauri
- convenient state management
- easier rendering of data-driven educational content
- mature testing tools

Avoid introducing a second frontend framework.

---

## 7. Decision: Rust Only at Native Boundary

Use Rust primarily for:

- native shell integration
- file operations
- SQLite access if using a Rust-side DB layer
- secure storage helpers
- OS shortcuts
- system-browser launches
- clipboard/native window operations where Tauri APIs require it

Do not move ordinary application business logic into Rust without a clear reason.

Primary application/domain logic should stay in TypeScript for faster iteration.

---

## 8. Decision: Local-First Persistence

Use:

- SQLite for structured metadata.
- Application data directory for imported images/assets.

Store:

- settings
- projects
- prompts
- prompt versions
- exercise progress
- concept progress
- critique sessions
- model-provider configuration
- destination preferences

### Rationale

The product does not require a server to deliver core value.

Local-first keeps:

- architecture simple
- privacy strong
- cost low
- offline functionality possible

Cloud sync can be added later behind a repository abstraction.

---

## 9. Suggested Data Access Boundary

Define repository interfaces in TypeScript.

```ts
interface ProjectRepository {
  list(): Promise<Project[]>;
  get(id: string): Promise<Project | null>;
  create(input: CreateProjectInput): Promise<Project>;
  update(id: string, input: UpdateProjectInput): Promise<Project>;
  delete(id: string): Promise<void>;
}

interface PromptRepository {
  listByProject(projectId: string): Promise<PromptRecord[]>;
  save(record: PromptRecord): Promise<void>;
}
```

Do not expose raw SQLite calls directly to React components.

---

## 10. Decision: Destination Adapter Abstraction

External creative tools should be modelled as destinations.

```ts
interface CreativeDestination {
  id: string;
  name: string;
  open(): Promise<void>;
  getCapabilities(): DestinationCapabilities;
  copyPrompt(prompt: string): Promise<void>;
  insertPrompt?(prompt: string): Promise<void>;
  importResult?(): Promise<ImportedAsset | null>;
}
```

Initial implementations:

- `ChatGPTDestination`
- `GoogleFlowDestination`
- `ExternalBrowserDestination`

### Core rule

MVP must only depend on:

- `open()`
- `getCapabilities()`
- `copyPrompt()`

Optional deeper capabilities must not be required for the core loop.

---

## 11. Decision: Clipboard-First Destination Integration

The default workflow is:

```text
Companion
→ build prompt
→ copy prompt
→ destination
→ paste
```

This is the most robust integration because it does not depend on:

- DOM selectors
- hidden APIs
- unsupported authentication token reuse
- service-specific internal events

Clipboard-first is therefore the required MVP integration baseline.

---

## 12. Decision: WebView Optional, External Browser Required Fallback

The application should support embedded destination views where feasible.

However, destination authentication may fail inside embedded WebViews because of provider restrictions.

Therefore:

- WebView embedding is optional capability.
- External browser fallback is mandatory.
- Product functionality must remain intact when destination is external.

### Required early spike

Test:

- ChatGPT login in Tauri WebView.
- Google/Flow login in Tauri WebView.
- session persistence.
- popup handling.
- multi-factor auth flows.
- new-window links.

Document results before relying on embedding.

---

## 13. Decision: No Core Dependency on DOM Automation

The MVP must not require direct DOM manipulation of ChatGPT or Google Flow.

Reasons:

- DOM changes are frequent.
- maintenance cost would be high.
- authentication and product changes could break the app.
- undocumented automation may create compatibility or policy issues.

Future destination-specific adapters may optionally support prompt insertion or result detection, but those features must degrade gracefully.

---

## 14. Decision: Tutor Provider Abstraction

The tutor must be independent of any single model provider.

```ts
interface TutorModel {
  chat(request: TutorChatRequest): Promise<TutorResponse>;
  buildPrompt(intent: CreativeIntent): Promise<GeneratedPrompt>;
  analyseImage?(
    image: ImageInput,
    context?: TutorContext
  ): Promise<ImageAnalysis>;
}
```

Possible implementations:

- OpenAI-compatible tutor
- OpenRouter-compatible tutor
- LiteLLM-compatible tutor
- GLM provider
- local OpenAI-compatible endpoint

### Rationale

The tutor model is infrastructure, not core product differentiation.

The app should be able to switch providers without reworking the UI or domain model.

---

## 15. Decision: Keep Tutor Prompt Separate from Code

Store tutor behaviour/system prompt in a dedicated file, for example:

```text
prompts/visual-tutor-system.md
```

This allows:

- iteration without touching application logic
- A/B testing
- provider-specific variants later
- easier review by product/UX owners

---

## 16. Decision: Data-Driven Learning Content

Learning content must live outside React components.

Recommended structure:

```text
content/
  concepts/
  recipes/
  exercises/
```

Use JSON, YAML, or Markdown-with-frontmatter.

Preferred MVP choice: JSON or Markdown with strongly validated metadata.

Example concept shape:

```ts
interface VisualConcept {
  id: string;
  title: string;
  category: ConceptCategory;
  shortDescription: string;
  whyItMatters: string;
  whenToUse: string[];
  promptExamples: string[];
  relatedConceptIds: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
}
```

---

## 17. Decision: Domain-First TypeScript Models

Core domain objects should be explicit and serializable.

Key objects:

- `Project`
- `CreativeIntent`
- `VisualConcept`
- `LearningExercise`
- `PromptRecipe`
- `PromptRecord`
- `CritiqueSession`
- `LearningProgress`
- `DestinationCapabilities`
- `TutorResponse`

React components should consume these domain types rather than ad hoc objects.

---

## 18. Decision: Feature-Based Frontend Structure

Recommended structure:

```text
src/
  app/
  components/
  features/
    tutor/
    prompt-builder/
    concepts/
    inspiration/
    critique/
    projects/
    destinations/
  lib/
  stores/
  types/
```

This keeps product capabilities grouped by feature instead of technical layer.

---

## 19. State Management

Use a simple client-side state manager only if React state becomes cumbersome.

Good candidates:

- Zustand
- Jotai

Avoid Redux unless requirements materially grow.

Persisted data belongs in repositories, not global UI state.

---

## 20. Image Import Path

For critique mode, support:

- drag/drop
- paste from clipboard
- file picker

Imported images should be copied into application-managed storage when retained by a project.

Temporary images may be processed without persistence.

Do not attempt to scrape generated images from destination pages in MVP.

---

## 21. Privacy Boundary

The application must clearly separate three data zones:

### Local app data

- projects
- prompts
- learning progress
- imported assets

### Tutor-provider data

Only content intentionally sent for:

- chat guidance
- prompt generation
- image critique

### Destination data

Content entered directly into:

- ChatGPT
- Google Flow
- future creative services

Never send destination cookies, auth tokens, or browser-session data to the tutor provider.

---

## 22. Credential Storage

If the user configures a tutor API key:

- store it using OS-native secure storage where practical
- do not store plaintext secrets in project files
- never expose keys to destination WebViews

If secure storage integration is unavailable in an early prototype, isolate the implementation behind a `SecretStore` abstraction.

---

## 23. Error Handling

Use structured application errors.

Examples:

- `DestinationUnavailableError`
- `EmbeddedLoginUnsupportedError`
- `ClipboardWriteError`
- `TutorProviderError`
- `TutorAuthenticationError`
- `ContentValidationError`
- `PersistenceError`

The UI should provide actionable fallback behaviour.

Example:

> Google Flow could not be opened inside the app. Open it in your browser instead?

Avoid surfacing raw stack traces to end users.

---

## 24. Testing Strategy

### Unit tests

Test:

- domain serialization
- prompt-builder transformations
- content validators
- repository behaviour
- destination capability resolution
- tutor-provider request shaping

### Integration tests

Test:

- SQLite persistence
- project lifecycle
- history persistence
- image import
- settings persistence

### E2E tests

Cover the internal flow:

```text
create project
→ enter idea
→ select concepts
→ build prompt
→ copy
→ save history
→ restart app
→ reload project
```

Do not make deterministic tests depend on live ChatGPT or Flow pages.

Use mocks for external destination behaviour.

---

## 25. Logging and Observability

Use lightweight structured logging.

Log:

- application startup
- destination launch failures
- persistence failures
- tutor-provider failures
- content parsing/validation failures

Do not log:

- API keys
- cookies
- auth headers
- full private prompts by default
- user images

Detailed telemetry is out of MVP scope.

---

## 26. Packaging

Initial packaging target:

- macOS app bundle

Architecture must remain compatible with:

- Windows

Do not optimise Linux packaging until there is a concrete need.

---

## 27. Migration Strategy

Use versioned database migrations from the beginning.

Even with a small MVP, schema evolution is likely for:

- projects
- prompt history
- critique sessions
- learning progress

Avoid destructive schema resets after user data exists.

---

## 28. Content Validation

All concepts, recipes, and exercises should be validated at startup or build time.

Recommended:

- Zod schemas in TypeScript
- CI validation of content files

Invalid content should fail clearly during development.

---

## 29. Recommended Repository Layout

```text
visual-companion/
├── src/
│   ├── app/
│   ├── components/
│   ├── features/
│   │   ├── tutor/
│   │   ├── prompt-builder/
│   │   ├── concepts/
│   │   ├── inspiration/
│   │   ├── critique/
│   │   ├── projects/
│   │   └── destinations/
│   ├── lib/
│   ├── stores/
│   └── types/
├── src-tauri/
│   └── src/
├── content/
│   ├── concepts/
│   ├── recipes/
│   └── exercises/
├── prompts/
│   └── visual-tutor-system.md
├── tests/
└── docs/
    ├── PRD.md
    └── ADR.md
```

---

## 30. Implementation Sequence

### Phase 1 — Foundation

- Tauri app
- React shell
- settings
- SQLite
- repository layer
- basic navigation

### Phase 2 — Learning content

- content schemas
- concept explorer
- recipes
- exercises

### Phase 3 — Prompt system

- `CreativeIntent`
- prompt builder
- prompt explanation
- tutor-provider abstraction

### Phase 4 — Destination integration

- destination abstraction
- ChatGPT destination
- Google Flow destination
- clipboard workflow
- external-browser fallback

### Phase 5 — Projects/history

- project CRUD
- prompt persistence
- recent history

### Phase 6 — Critique

- image import
- multimodal tutor request
- critique workflow

### Phase 7 — Polish

- shortcuts
- onboarding
- packaging
- UI refinement

---

## 31. Technical Spikes Before Full Implementation

### Spike 1 — Embedded authentication

Prototype minimal Tauri WebViews for ChatGPT and Google Flow.

Document:

- login behaviour
- session persistence
- popup behaviour
- redirects
- MFA
- external auth browser handoff

### Spike 2 — Clipboard handoff

Validate that the main product loop remains pleasant with only copy/paste.

This determines whether WebView embedding is necessary for MVP or merely convenient.

### Spike 3 — Multimodal critique quality

Given the same test images, evaluate at least one tutor model on:

- identifying one meaningful issue
- mapping it to a visual concept
- explaining it simply
- producing a useful next-step instruction

Do not optimise for broad critique lists.

---

## 32. Consequences

### Positive

- Small architecture.
- No backend required.
- Low operational cost.
- Tutor and destinations are replaceable.
- Core product remains useful even if embedded WebViews fail.
- Reduced maintenance risk from external DOM changes.
- Privacy is straightforward.
- Cross-platform path remains open.

### Negative

- Clipboard workflow is less seamless than direct integration.
- Embedded login behaviour may differ by OS.
- Some users may expect automatic result import.
- Provider abstraction adds modest upfront complexity.
- Local-first architecture does not provide cross-device sync initially.

These trade-offs are accepted for MVP.

---

## 33. Revisit Triggers

Revisit this ADR if any of the following becomes true:

1. Embedded ChatGPT/Flow proves impossible or unreliable across target OSes.
2. Users strongly demand automatic prompt insertion.
3. Users strongly demand automatic result capture.
4. Cloud sync becomes a product requirement.
5. Local models become the default tutor deployment.
6. Browser extension integration becomes strategically important.
7. A destination publishes a stable official desktop integration API.
8. The product expands beyond desktop.

Any major change should create a new ADR rather than silently mutating this decision.

---

## 34. Final Decision

Proceed with a **Tauri + React + TypeScript local-first desktop architecture**.

Keep the MVP centered on:

- learning content
- prompt construction
- lightweight tutor interaction
- clipboard-based handoff
- robust destination fallback

Do not let WebView automation, account integration, or image-editor features become critical-path dependencies.
