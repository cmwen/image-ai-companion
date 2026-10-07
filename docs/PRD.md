# PRD — AI Visual Creation Companion

## 1. Product Summary

Build a native desktop application that helps beginners learn how to create better images with AI tools such as ChatGPT Images and Google Flow.

The application itself does **not** generate images and does **not** call image-generation APIs.

Instead, it acts as a companion around existing AI creative web applications.

The app should:

- Embed or open supported AI creative web apps.
- Teach users visual creation concepts while they work.
- Help users discover styles, terminology, composition techniques, lighting concepts, camera language, colour choices, and art-direction concepts.
- Generate and refine prompts that users can send to ChatGPT or Google Flow.
- Provide inspiration and guided exercises.
- Help users understand why a generated result works or does not work.
- Keep the learning experience lightweight and closely connected to actual creation.

Core principle:

> Learn the language of visual creation by creating with AI.

The goal is not to teach traditional drawing. The goal is to help users become better directors of AI image-generation systems.

---

## 2. Problem

AI image generators are increasingly capable, but beginners often do not know how to communicate what they want.

A beginner may type:

> Create a cool robot in a city.

An experienced visual creator may think in terms of:

- shot size
- camera angle
- composition
- subject separation
- colour palette
- visual hierarchy
- lighting
- materials
- perspective
- focal length
- mood
- art style
- negative space
- silhouette
- depth
- texture

The main barrier is not prompt syntax. The barrier is that users do not know what visual possibilities exist, so they do not know what to ask for.

Existing prompt libraries partially solve this by providing copyable prompts, but they do not necessarily teach users why those prompts work.

This application should turn image creation itself into a learning process.

---

## 3. Target User

Primary target user:

A technically capable person who uses AI tools but has little formal experience with:

- illustration
- photography
- graphic design
- visual composition
- cinematography
- art direction

Typical behaviours:

- Uses ChatGPT Images.
- Uses or wants to use Google Flow.
- Experiments with AI-generated UI assets, illustrations, icons, posters, characters, diagrams, or visual concepts.
- Often knows approximately what they want but does not know the visual terminology required to describe it.
- Learns better by experimenting than by reading long theory documents.

---

## 4. Product Positioning

The application is **not**:

- Photoshop.
- Canva.
- A canvas editor.
- A Stable Diffusion frontend.
- A ComfyUI replacement.
- An image-generation API wrapper.
- A giant static prompt library.
- A traditional drawing course.

The application **is**:

- A visual-creation tutor.
- A prompt companion.
- An inspiration tool.
- A terminology explorer.
- A guided experimentation environment.
- A bridge into ChatGPT Images, Google Flow, and potentially other creative AI applications.

Think of it as:

> A teacher standing beside the user while ChatGPT or Flow acts as the studio.

---

## 5. Primary Product Loop

```text
Idea
  ↓
Explore visual directions
  ↓
Learn relevant terminology
  ↓
Build/refine prompt
  ↓
Send/copy prompt to ChatGPT or Flow
  ↓
Generate result
  ↓
Review result
  ↓
Learn what could improve
  ↓
Create next prompt
  ↓
Repeat
```

The product should encourage iteration instead of one-shot prompt generation.

---

## 6. Platform

Initial platform:

- Desktop.
- macOS first is acceptable.
- Architecture should remain portable to Windows.

Preferred framework:

- Tauri.
- Frontend: TypeScript.
- UI framework: React or equivalent.
- Rust for native shell capabilities where useful.

Reasons for Tauri:

- The product may need embedded WebViews.
- Strong clipboard integration.
- Local filesystem support.
- SQLite/local persistence.
- Native window controls.
- Hotkeys.
- Potential side-panel/floating companion behaviour.
- Smaller runtime footprint than a full Electron application.

---

## 7. Core Architecture

```text
┌───────────────────────────────────────────────────┐
│                 Tauri Desktop App                 │
│                                                   │
│ ┌────────────────────┐ ┌────────────────────────┐ │
│ │ Creative Companion │ │ Embedded Creative App  │ │
│ │                    │ │                        │ │
│ │ Tutor              │ │ ChatGPT               │ │
│ │ Prompt Builder     │ │ Google Flow           │ │
│ │ Inspiration        │ │ future destinations   │ │
│ │ Terminology        │ │                        │ │
│ │ Learning Progress  │ │                        │ │
│ └────────────────────┘ └────────────────────────┘ │
│                                                   │
│        Local storage / clipboard / settings       │
└───────────────────────────────────────────────────┘
```

Treat external creative tools as destinations.

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

MVP only requires:

- `open()`
- `getCapabilities()`
- `copyPrompt()`

Do not make DOM automation a core dependency.

---

## 8. Important Technical Constraint

The application must **not** depend on undocumented DOM structures from ChatGPT or Google Flow for basic functionality.

Initial integration should work using:

- WebView navigation where supported.
- Clipboard.
- Drag/drop.
- Manual paste.
- Optional external browser fallback.

Deeper integrations may later be implemented as adapters.

Each integration must degrade gracefully.

---

## 9. Authentication Constraint

The application should not implement custom authentication against ChatGPT or Google unless officially supported.

For embedded web destinations:

- Allow users to authenticate directly in the destination WebView if supported.
- Preserve browser session/cookies where safely supported.
- Do not extract authentication tokens.
- Do not inspect or expose credentials.

If a service blocks embedded WebView authentication:

- Open that destination in the system browser.
- Keep the companion app functional beside it.

Authentication feasibility should be treated as an early technical spike.

---

## 10. Companion Model

The application may use a separate language/vision model to power the tutor.

Possible providers:

- GPT fast models.
- GLM Flash-class models.
- Local models.
- LiteLLM-compatible endpoints.
- OpenRouter-compatible providers.

The application must not tightly couple the tutor to a specific provider.

```ts
interface TutorModel {
  chat(request: TutorChatRequest): Promise<TutorResponse>;

  analyseImage?(
    image: ImageInput,
    context?: TutorContext
  ): Promise<ImageAnalysis>;

  buildPrompt(
    creativeIntent: CreativeIntent
  ): Promise<GeneratedPrompt>;
}
```

The model is replaceable infrastructure. Product value should live in curriculum structure, terminology, exercises, prompt recipes, guidance, progression, and interaction design.

---

## 11. MVP Features

### 11.1 Creative Destination Panel

Support:

- ChatGPT
- Google Flow

Allow:

- switching destinations
- opening selected service
- optional WebView display
- external browser fallback

Do not attempt deep automation in MVP.

### 11.2 Companion Panel

Persistent or collapsible side panel.

Primary actions:

- Ask Tutor
- Inspire Me
- Build Prompt
- Explore Styles
- Learn a Concept

The panel should remain lightweight.

---

## 12. Explore Visual Vocabulary

Initial categories:

### Style

- pixel art
- anime
- watercolor
- gouache
- clay
- 3D render
- comic
- editorial illustration
- photorealistic
- cinematic
- retro-futuristic
- minimal
- collage
- printmaking
- isometric

### Composition

- rule of thirds
- centred composition
- symmetry
- asymmetry
- framing
- leading lines
- negative space
- visual hierarchy
- foreground/background layering
- silhouette

### Camera

- close-up
- medium shot
- wide shot
- establishing shot
- overhead
- eye-level
- low angle
- high angle
- profile
- three-quarter view
- wide-angle perspective
- telephoto compression
- shallow depth of field
- deep focus

### Lighting

- soft light
- hard light
- rim light
- backlight
- key light
- fill light
- side lighting
- golden hour
- overcast light
- low-key lighting
- high-key lighting
- neon lighting

### Colour

- warm palette
- cool palette
- complementary colours
- analogous colours
- monochrome
- limited palette
- high saturation
- muted palette
- high contrast
- low contrast

### Art Direction

- mood
- era
- texture
- material
- shape language
- environment
- visual density
- realism level
- stylisation
- consistency

---

## 13. Concept Card

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

Each concept should answer:

1. What is it?
2. Why does it matter?
3. What does it visually change?
4. When might I use it?
5. How do I describe it to an AI model?

Avoid long academic explanations.

---

## 14. Prompt Builder

Represent creative intent as structured data.

```ts
interface CreativeIntent {
  subject?: string;
  environment?: string;
  style?: string[];
  composition?: string[];
  camera?: string[];
  lighting?: string[];
  colour?: string[];
  mood?: string[];
  materials?: string[];
  constraints?: string[];
  destination?: string;
}
```

Example:

```text
Subject
small friendly robot

Environment
futuristic train station

Style
cinematic illustration

Shot
low-angle medium shot

Lighting
soft rim lighting

Colour
warm orange + cool blue

Mood
lonely but hopeful
```

Users must be able to:

- edit final prompt
- copy prompt
- regenerate prompt
- simplify prompt
- ask why wording was included

---

## 15. Prompt Explanation

The app should optionally annotate prompt sections by intent.

```text
A small friendly robot
↑ subject

waiting alone in a futuristic train station
↑ environment

low-angle medium shot
↑ camera + composition

soft warm rim lighting
↑ lighting

cool blue environment with orange highlights
↑ palette

cinematic illustration, quiet and hopeful mood
↑ style + emotional direction
```

The user should understand the prompt rather than blindly copy it.

---

## 16. Inspire Me

Provide guided visual experiments. Do not generate random prompts without teaching value.

Exercise example:

```text
Experiment: Scale

Goal:
Learn how scale cues change an image.

Challenge:
Make an ordinary object appear enormous.

Starter idea:
A tiny explorer standing beside an enormous mechanical keyboard key.

Concepts:
- scale
- perspective
- foreground/background relationship
```

```ts
interface LearningExercise {
  id: string;
  title: string;
  summary: string;
  objective: string;
  starterPrompt?: string;
  conceptIds: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
}
```

---

## 17. Prompt Recipes

Initial recipes:

- Character portrait
- Full character design
- Environment concept
- Product shot
- Poster
- Icon
- Pixel-art sprite
- Infographic
- App illustration
- Social image
- Cinematic scene

Recipes define useful dimensions rather than fixed prompts.

Example:

```text
Cinematic Character

Subject
+
Environment
+
Shot
+
Composition
+
Lighting
+
Colour
+
Mood
+
Style
```

---

## 18. Learn by Comparing

Comparison should be a key mechanism.

Examples:

- soft light vs hard light
- eye-level vs low-angle
- wide shot vs close-up
- muted vs saturated colour
- symmetrical vs asymmetric composition

For MVP, comparison can use curated example assets or descriptive illustrations.

---

## 19. Critique Mode

Include in MVP if straightforward; otherwise immediate post-MVP.

Image input:

- drag/drop
- clipboard paste
- file selection

Preferred critique format:

```text
What is working

- Clear subject
- Strong silhouette
- Good colour harmony

One thing to improve

The character blends into the background.

Why

This is a subject-separation / visual-hierarchy problem.

Try one of these:

A. Increase value contrast
B. Simplify the background
C. Add rim lighting
```

After user selects a direction:

```text
Suggested next instruction:

"Add a subtle warm rim light around the character,
clearly separating the silhouette from the darker background."
```

Teach one or two concepts at a time.

---

## 20. Learning Progress

Keep progress lightweight.

```ts
interface LearningProgress {
  encounteredConcepts: string[];
  practisedConcepts: string[];
  favouriteConcepts: string[];
  completedExercises: string[];
  promptHistoryCount: number;
}
```

Possible UI:

```text
You've practised:

Composition      6
Lighting         4
Colour           3
Camera           2
Art direction    1
```

No heavy gamification in MVP.

---

## 21. History

Persist locally:

- prompts
- prompt variants
- destination used
- concepts attached to prompt
- exercises
- optional imported/generated images
- critique sessions

Users should be able to revisit:

```text
Project
  ↓
Prompt
  ↓
Generated result
  ↓
Critique
  ↓
Next prompt
```

Do not attempt to automatically reconstruct ChatGPT/Flow histories.

---

## 22. Projects

Simple local project grouping.

```ts
interface Project {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}
```

Keep project management intentionally minimal.

---

## 23. Persistence

Use local-first storage.

Suggested:

- SQLite for metadata.
- Application data directory for assets.

Store:

- settings
- projects
- prompts
- concept progress
- exercises
- imported assets
- model provider configuration

No cloud account required for MVP.

---

## 24. UI Direction

The app should feel closer to:

- modern browser side panel
- Raycast
- Arc sidebar
- developer companion
- lightweight learning workspace

and less like:

- Photoshop
- Blender
- LMS
- enterprise dashboard

Primary layout:

```text
┌──────────────────────────────────────────────────────────────┐
│ Learn   Explore   Create                      Destination ▾  │
├────────────────┬─────────────────────────────────────────────┤
│                │                                             │
│ Companion      │                                             │
│                │              ChatGPT / Flow                 │
│ Tutor          │                                             │
│ Ideas          │                                             │
│ Prompt         │                                             │
│ Concepts       │                                             │
│                │                                             │
│                │                                             │
├────────────────┴─────────────────────────────────────────────┤
│ Project / history                                            │
└──────────────────────────────────────────────────────────────┘
```

Companion should optionally collapse into a floating panel.

Suggested shortcut:

```text
Cmd/Ctrl + Shift + Space
```

---

## 25. Navigation

Initial top-level navigation:

- Create
- Explore
- Learn
- Projects
- Settings

Create is the default view.

Avoid deep nested navigation.

---

## 26. Settings

### Destination

- ChatGPT URL
- Flow URL
- open internally / externally

### Tutor provider

- provider
- model
- endpoint
- API key / authentication if applicable

Credentials should use secure OS storage where practical.

### Application

- theme
- panel width
- default destination
- global shortcut

---

## 27. Tutor Behaviour

The tutor must optimise for learning, not maximum verbosity.

Rules:

1. Do not rewrite every user idea into an enormous prompt automatically.
2. Introduce relevant visual terminology naturally.
3. Explain terminology briefly.
4. Prefer one meaningful concept over ten weak suggestions.
5. When possible, give users choices.
6. Help users understand trade-offs.
7. Do not imply there is one objectively correct visual style.
8. Encourage experimentation.
9. Explain why prompt changes may alter the result.
10. Do not make users learn model-specific prompt hacks unless necessary.

---

## 28. AI System Prompt

```text
You are a visual-creation tutor helping beginners learn how to direct
AI image-generation systems.

Your goal is not merely to produce prompts.

Teach users visual language through practical creation.

Introduce relevant concepts such as composition, lighting, colour,
camera language, perspective, style, visual hierarchy, shape language,
materials, mood, and art direction.

When improving an image or prompt:

- identify the highest-impact concept
- explain it briefly
- offer a few clear choices
- help the user apply one
- generate concise prompt wording afterward

Do not overwhelm beginners with terminology.

Prefer learning through experimentation.

Do not require traditional drawing knowledge.

Assume the final image will be generated in another application such
as ChatGPT Images or Google Flow.

Never claim that you generated an image unless you actually did.

Treat prompts as communication with a creative model, not as magic
keyword strings.
```

Store this separately from application code.

---

## 29. Content Architecture

Content should primarily be data-driven.

```text
content/

  concepts/
    composition/
    lighting/
    colour/
    camera/
    style/
    art-direction/

  recipes/
    character.json
    environment.json
    poster.json
    icon.json
    product.json

  exercises/
    lighting-comparison.json
    scale.json
    silhouette.json
    negative-space.json
```

Do not hardcode content into React components.

---

## 30. Suggested Repository Structure

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
├── tests/
└── docs/
```

Prefer feature-based organisation.

---

## 31. MVP User Journey

1. User launches app.
2. App explains the product in one sentence.
3. User chooses ChatGPT or Google Flow.
4. User selects Create something.
5. Companion asks what they are trying to make.
6. User enters a rough idea.
7. Companion identifies 2–3 relevant visual areas.
8. User explores concepts/styles.
9. User builds prompt.
10. User copies prompt into ChatGPT/Flow.
11. User generates image.
12. User can drag result back into companion.
13. Companion critiques one major dimension.
14. Companion creates next refinement instruction.
15. User repeats.

---

## 32. MVP Acceptance Criteria

The MVP is complete when a new user can:

1. Launch the desktop application.
2. Open ChatGPT or Flow through the app or externally.
3. Enter a rough image idea.
4. Receive relevant visual concepts.
5. Browse beginner-friendly explanations.
6. Use a structured prompt builder.
7. Generate a final natural-language prompt.
8. Copy the prompt with one action.
9. Paste/use it in the destination.
10. Save the prompt locally.
11. Browse at least 30 curated visual concepts.
12. Use at least 10 guided exercises.
13. Use at least 5 prompt recipes.
14. Persist projects and settings.
15. Restart the application without losing history.

Stretch criteria:

16. User can paste/drop a generated image.
17. Tutor can analyse it with a multimodal model.
18. Tutor identifies one high-impact improvement.
19. Tutor produces a next-step prompt.

---

## 33. Initial Content Requirement

Seed MVP with approximately:

- 30–50 visual concepts
- 10–15 exercises
- 8–10 prompt recipes
- 10–20 example starter ideas

Quality is more important than volume.

---

## 34. Non-Goals for MVP

Do not build:

- image canvas
- masking
- layers
- drawing tools
- image generation API
- image model hosting
- ComfyUI workflow integration
- account system
- cloud sync
- collaboration
- marketplace
- social sharing
- automatic scraping of ChatGPT history
- automatic scraping of Flow history
- browser-extension support
- sophisticated gamification
- autonomous DOM control
- Lightroom-like asset management

Avoid scope creep.

---

## 35. Post-MVP Possibilities

Potential future features:

- Destination adapters with safe prompt insertion.
- Optional result detection.
- Reference image analysis: “Why do I like this?”
- Style explorer.
- Personal visual vocabulary.
- Curriculum paths.
- Local tutor models.
- MCP integration.

MCP is explicitly out of MVP scope.

---

## 36. Engineering Principles

Prefer:

- local-first
- modular providers
- explicit interfaces
- data-driven content
- graceful degradation
- minimal dependency on third-party DOM internals
- straightforward UX
- testable state transitions
- typed domain models

Avoid:

- premature plugin systems
- overly generic abstractions
- microservices
- backend infrastructure
- complex cloud deployment
- proprietary content formats

---

## 37. Testing Requirements

At minimum implement tests for:

- prompt structure serialization
- project persistence
- concept loading
- exercise loading
- recipe loading
- destination abstraction
- tutor-provider abstraction
- settings persistence

Where feasible add end-to-end tests for:

```text
create project
→ enter idea
→ select concepts
→ generate prompt
→ copy prompt
→ persist history
→ restart app
→ reload history
```

Mock external destinations.

---

## 38. Privacy

Default to local storage.

Do not upload prompts, images, history, or project data unless required by the configured tutor provider.

Clearly distinguish:

- local application data
- content sent to tutor model
- content entered into ChatGPT/Flow

Never send destination cookies or authentication information to the tutor model.

---

## 39. First Technical Spikes

### Spike A — Tauri WebView authentication

Determine whether:

- ChatGPT login works reliably in Tauri WebView.
- Google authentication / Flow works reliably in Tauri WebView.
- sessions persist.
- popup/new-window flows work.
- OAuth restrictions break embedding.

If embedding is unreliable, use system browser integration instead.

### Spike B — Clipboard workflow

Prototype:

```text
Companion prompt
→ copy
→ destination
→ paste
```

Ensure low friction.

### Spike C — Multimodal critique

Prototype:

```text
drop image
→ model analysis
→ identify visual concept
→ generate next-step instruction
```

Evaluate latency and usefulness.

---

## 40. Implementation Order

```text
Phase 1
Tauri shell
Navigation
Settings
Local persistence

Phase 2
Concept content model
Concept explorer
Recipes
Exercises

Phase 3
Prompt builder
Tutor abstraction
Tutor chat

Phase 4
ChatGPT / Flow destination handling
Clipboard workflow

Phase 5
Projects
Prompt/history persistence

Phase 6
Image import
Multimodal critique

Phase 7
Polish
Keyboard shortcuts
Onboarding
Packaging
```

Do not start with deep WebView automation.

---

## 41. Initial Development Goal

The first useful milestone should answer this scenario:

> I have almost no visual-design vocabulary.
>
> I want to make an image using ChatGPT.
>
> I type a rough idea into the companion.
>
> The application introduces two or three relevant visual concepts.
>
> I can explore them, understand what they mean, and build a better prompt.
>
> I copy the prompt into ChatGPT and generate the image.
>
> I feel that I learned something I can reuse next time.

If this experience works, the core product works.

---

## 42. Success Metric

The strongest qualitative success criterion is:

> After several sessions, the user starts using visual terminology without the tutor suggesting it first.

Example progression:

From:

> Make it look cooler.

To:

> Keep the composition, but use softer side lighting, more negative space, and a muted warm palette.

That behavioural change represents the real product value.

---

## 43. Coding Agent Instructions

1. Do not expand scope beyond the stated MVP without a clear reason.
2. Keep external creative destinations loosely coupled.
3. Do not depend on undocumented ChatGPT/Flow DOM structures.
4. Use explicit TypeScript types for core domain objects.
5. Keep educational content outside presentation components.
6. Prefer local storage and simple architecture.
7. Create ADRs for significant deviations from this PRD.
8. If WebView authentication proves unreliable, implement an external-browser workflow instead of hacking around authentication.
9. Design APIs so multimodal critique can be added without restructuring the product.
10. Build the complete basic creation loop before polishing secondary screens.
