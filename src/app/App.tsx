import { useEffect, useState } from "react";
import Updater from "../features/updater/Updater";
import { isTauri } from "@tauri-apps/api/core";
import { nativeEmbeddedBridge } from "../features/destinations/embedded";
import DestinationWorkspace from "../features/destinations/DestinationWorkspace";
import { concepts, recipes, exercises } from "../lib/content";
import {
  buildPrompt,
  simplifyPrompt,
} from "../features/prompt-builder/builder";
import { createDestination } from "../features/destinations/adapters";
import {
  createRepository,
  type Repository,
  type Project,
  type PromptRecord,
} from "../lib/repository";
import type { CreativeIntent } from "../types/domain";
const initial: CreativeIntent = {
  subject: "",
  environment: "",
  mood: "",
  constraints: "",
  conceptIds: [],
  destinationId: "chatgpt",
};
const tabs = ["Create", "Explore", "Learn", "Projects", "Settings"] as const;
export default function App() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Create"),
    [intent, setIntent] = useState(initial),
    [prompt, setPrompt] = useState(""),
    [sections, setSections] = useState(buildPrompt(initial).sections),
    [repo, setRepo] = useState<Repository>(),
    [projects, setProjects] = useState<Project[]>([]),
    [projectId, setProjectId] = useState(""),
    [history, setHistory] = useState<PromptRecord[]>([]),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [search, setSearch] = useState(""),
    [rename, setRename] = useState("");
  const [embedded, setEmbedded] = useState(false);
  const native = isTauri();
  const selectedProject = projects.find((p) => p.id === projectId);
  const report = async (action: () => Promise<void>) => {
    setError("");
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "This action could not be completed. Try again.",
      );
    }
  };
  useEffect(() => {
    let active = true;
    createRepository()
      .then(async (r) => {
        const [p, s] = await Promise.all([r.projects.list(), r.settings.get()]);
        if (active) {
          setRepo(r);
          setProjects(p);
          setProjectId(p[0]?.id ?? "");
          setIntent((x) => ({ ...x, destinationId: s.defaultDestination }));
        }
      })
      .catch((e) =>
        setError(`Local storage could not be opened: ${e.message}`),
      );
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    setHistory([]);
    if (repo && projectId)
      repo.prompts
        .listByProject(projectId)
        .then((records) => {
          if (active) setHistory(records);
        })
        .catch(() => {
          if (active) setError("History could not be loaded.");
        });
    return () => {
      active = false;
    };
  }, [repo, projectId]);
  useEffect(() => {
    setRename(selectedProject?.title ?? "");
  }, [selectedProject?.id, selectedProject?.title]);
  const setField = (field: keyof CreativeIntent, value: string) =>
    setIntent((x) => ({ ...x, [field]: value }));
  const toggle = (id: string) =>
    setIntent((x) => ({
      ...x,
      conceptIds: x.conceptIds.includes(id)
        ? x.conceptIds.filter((v) => v !== id)
        : [...x.conceptIds, id],
    }));
  const suggestedIds = /poster|text|logo/i.test(intent.subject)
    ? ["negative-space", "limited-palette", "soft-light"]
    : /character|robot|person/i.test(intent.subject)
      ? ["shape-language", "soft-light", "cinematic"]
      : ["rule-thirds", "soft-light", "limited-palette"];
  const build = (simple = false) => {
    const result = simple ? simplifyPrompt(intent) : buildPrompt(intent);
    setPrompt(result.text);
    setSections(result.sections);
    setNotice(
      simple
        ? "Simplified to two concepts; your idea is unchanged."
        : "Prompt built from your choices. Edit any wording below.",
    );
  };
  const save = () =>
    report(async () => {
      if (!repo || !projectId)
        throw new Error("Create or select a project before saving.");
      if (!prompt.trim()) throw new Error("Build a prompt before saving.");
      await repo.prompts.save({
        id: crypto.randomUUID(),
        projectId,
        prompt,
        intent,
        conceptIds: intent.conceptIds,
        destinationId: intent.destinationId,
        createdAt: new Date().toISOString(),
      });
      setHistory(await repo.prompts.listByProject(projectId));
      setNotice("Prompt saved to your project.");
    });
  const useRecipe = (index: number) => {
    setIntent(recipes[index].intent);
    setPrompt("");
    setSections([]);
    setTab("Create");
    setNotice("Starter loaded. Make it your own, then build your prompt.");
  };
  return (
    <div className="app">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab("Create");
          }}
        >
          <span className="brand-icon">✳</span>
          <span>
            Visual
            <br />
            Companion
          </span>
        </a>
        <p className="eyebrow">YOUR CREATIVE SIDEKICK</p>
        <nav aria-label="Main navigation">
          {tabs.map((t, i) => (
            <button
              key={t}
              aria-current={tab === t ? "page" : undefined}
              onClick={() => setTab(t)}
            >
              <span aria-hidden="true">{["✦", "◉", "↗", "▦", "⚙"][i]}</span>
              {t}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="dot" /> Offline guidance
          <p>
            Small experiments.
            <br />
            Better visual instincts.
          </p>
        </div>
      </aside>
      <main>
        <header>
          <div className="breadcrumb">
            Workspace <span>/</span> {tab}
          </div>
          <div className="destination">
            <button
              className="small"
              aria-pressed={embedded}
              disabled={!native}
              title={
                native
                  ? "Show destination beside your prompt"
                  : "Embedding is available in the native desktop app"
              }
              onClick={() => setEmbedded((value) => !value)}
            >
              {embedded ? "Hide workspace" : "Embed (experimental)"}
            </button>
            <label htmlFor="destination">Create with</label>
            <select
              id="destination"
              value={intent.destinationId}
              onChange={(e) => setField("destinationId", e.target.value)}
            >
              <option value="chatgpt">ChatGPT</option>
              <option value="flow">Google Flow</option>
            </select>
            <button
              className="small"
              onClick={() =>
                report(async () => {
                  await createDestination(intent.destinationId).open();
                  setNotice(
                    "Destination opened in your browser. Paste your copied prompt there.",
                  );
                })
              }
            >
              Open ↗
            </button>
          </div>
        </header>
        <div
          className={
            embedded && tab === "Create" ? "content embedded-layout" : "content"
          }
        >
          <div className="page-title">
            <p className="eyebrow">LEARN BY MAKING</p>
            <h1>
              {tab === "Create"
                ? "Give your idea a direction."
                : tab === "Explore"
                  ? "Find your visual language."
                  : tab === "Learn"
                    ? "One small experiment."
                    : tab === "Projects"
                      ? "Keep your creative threads."
                      : "Make yourself at home."}
            </h1>
            <p>
              {tab === "Create"
                ? "Start with a subject. Choose a few visual ideas. See what changes."
                : tab === "Explore"
                  ? "Useful concepts, plain explanations, and wording you can try."
                  : tab === "Learn"
                    ? "Change one thing at a time, and learn from the difference."
                    : tab === "Projects"
                      ? "Save your prompts locally and pick up where you left off."
                      : "Local storage and a destination of your choice."}
            </p>
          </div>
          {error && (
            <div role="alert" className="alert">
              {error}
            </div>
          )}
          {notice && (
            <div role="status" className="notice">
              {notice}
            </div>
          )}
          {tab === "Create" && (
            <>
              <div className="create-grid">
                <section className="card">
                  <div className="section-head">
                    <h2>Your idea</h2>
                    <span className="step">01</span>
                  </div>
                  <label htmlFor="subject">What do you want to create?</label>
                  <textarea
                    id="subject"
                    placeholder="A small friendly robot waiting for a train…"
                    value={intent.subject}
                    onChange={(e) => setField("subject", e.target.value)}
                  />
                  <label htmlFor="environment">Where is it?</label>
                  <input
                    id="environment"
                    placeholder="A futuristic station at dusk"
                    value={intent.environment}
                    onChange={(e) => setField("environment", e.target.value)}
                  />
                  <div className="field-grid">
                    <div>
                      <label htmlFor="mood">How should it feel?</label>
                      <input
                        id="mood"
                        placeholder="Quiet and hopeful"
                        value={intent.mood}
                        onChange={(e) => setField("mood", e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor="constraints">Any requirements?</label>
                      <input
                        id="constraints"
                        placeholder="No text, square image…"
                        value={intent.constraints}
                        onChange={(e) =>
                          setField("constraints", e.target.value)
                        }
                      />
                    </div>
                  </div>
                  <div className="section-head space">
                    <h2>Choose a direction</h2>
                    <span className="step">02</span>
                  </div>
                  <p className="hint">
                    Two or three choices are a good place to start.
                  </p>
                  <p className="hint">Curated suggestions for your idea:</p>
                  <div className="chips">
                    {suggestedIds.map((id) => (
                      <button
                        key={id}
                        className="chip"
                        onClick={() => {
                          if (!intent.conceptIds.includes(id)) toggle(id);
                        }}
                      >
                        {concepts.find((c) => c.id === id)?.title} +
                      </button>
                    ))}
                  </div>
                  <details>
                    <summary>Explore all directions</summary>
                    <div className="chips">
                      {concepts.map((c) => (
                        <button
                          key={c.id}
                          title={c.shortDescription}
                          aria-pressed={intent.conceptIds.includes(c.id)}
                          className={
                            intent.conceptIds.includes(c.id)
                              ? "chip selected"
                              : "chip"
                          }
                          onClick={() => toggle(c.id)}
                        >
                          {c.title}
                          {intent.conceptIds.includes(c.id) ? " ✓" : " +"}
                        </button>
                      ))}
                    </div>
                  </details>
                  <div className="chips">
                    {intent.conceptIds.map((id) => (
                      <button
                        key={id}
                        className="chip selected"
                        onClick={() => toggle(id)}
                      >
                        {concepts.find((c) => c.id === id)?.title} ×
                      </button>
                    ))}
                  </div>
                  <button
                    className="primary wide"
                    disabled={!intent.subject.trim()}
                    onClick={() => build()}
                  >
                    Build my prompt <span>→</span>
                  </button>
                </section>
                <section className="card prompt-card">
                  <div className="section-head">
                    <h2>Your prompt</h2>
                    <span className="badge">Offline builder</span>
                  </div>
                  <p className="hint">
                    Built from your choices. No model request is made.
                  </p>
                  <label className="sr-only" htmlFor="prompt">
                    Final prompt
                  </label>
                  <textarea
                    id="prompt"
                    className="final-prompt"
                    placeholder="Your idea takes shape here…"
                    value={prompt}
                    onChange={(e) => {
                      setPrompt(e.target.value);
                      setSections([]);
                    }}
                  />
                  <div className="actions">
                    <button
                      disabled={!prompt}
                      onClick={() =>
                        report(async () => {
                          await createDestination(
                            intent.destinationId,
                          ).copyPrompt(prompt);
                          if (embedded && native)
                            await (
                              await nativeEmbeddedBridge()
                            ).focus(intent.destinationId);
                          setNotice(
                            embedded && native
                              ? "Prompt copied. Paste it into the destination beside your companion."
                              : "Prompt copied. Open your destination and paste it to create an image.",
                          );
                        })
                      }
                    >
                      {embedded && native
                        ? "Copy & focus destination"
                        : "Copy prompt"}
                    </button>
                    <button disabled={!prompt} onClick={() => build(true)}>
                      Simplify
                    </button>
                    <button
                      disabled={!intent.subject.trim()}
                      onClick={() => build()}
                    >
                      Rebuild
                    </button>
                  </div>
                  <details open={sections.length > 0}>
                    <summary>Why these words?</summary>
                    {sections.length ? (
                      sections.map((s, i) => (
                        <div className="explanation" key={i}>
                          <strong>{s.label}</strong>
                          <p>{s.explanation}</p>
                        </div>
                      ))
                    ) : (
                      <p className="hint">
                        Build a prompt to see explanations. Edited wording is
                        yours; rebuild restores the structured version.
                      </p>
                    )}
                  </details>
                  <div className="save-row">
                    <label htmlFor="project">Save to project</label>
                    <select
                      id="project"
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value)}
                    >
                      <option value="">Select a project</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                    <button
                      disabled={!repo || !projectId || !prompt.trim()}
                      onClick={save}
                    >
                      Save prompt
                    </button>
                  </div>
                  {!projects.length && (
                    <button
                      className="text-button"
                      onClick={() => setTab("Projects")}
                    >
                      Create your first project →
                    </button>
                  )}
                </section>
              </div>
              <section className="starter-section">
                <div className="section-head">
                  <h2>A little inspiration</h2>
                  <span className="hint">A starting point, not a formula</span>
                </div>
                <div className="recipe-grid">
                  {recipes.map((r, i) => (
                    <button
                      className="recipe"
                      key={r.id}
                      onClick={() => useRecipe(i)}
                    >
                      <span
                        className={`recipe-art art-${i}`}
                        aria-hidden="true"
                      >
                        {["◒", "✿", "◡"][i]}
                      </span>
                      <strong>{r.title}</strong>
                      <p>{r.summary}</p>
                      <span className="text-button">Try this direction ↗</span>
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}
          {tab === "Explore" && (
            <>
              <label htmlFor="search">Find a concept</label>
              <input
                id="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Try lighting, colour, composition…"
              />
              <div className="concept-grid">
                {concepts
                  .filter((c) =>
                    `${c.title} ${c.category} ${c.shortDescription}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((c) => (
                    <article className="card" key={c.id}>
                      <span className="eyebrow">{c.category}</span>
                      <h2>{c.title}</h2>
                      <p>{c.shortDescription}</p>
                      <p className="hint">{c.whyItMatters}</p>
                      <p className="example">“{c.promptExamples[0]}”</p>
                      <p className="hint">Try for: {c.whenToUse.join(", ")}</p>
                      <button
                        aria-pressed={intent.conceptIds.includes(c.id)}
                        onClick={() => {
                          toggle(c.id);
                          setNotice(
                            intent.conceptIds.includes(c.id)
                              ? "Concept removed from your idea."
                              : "Concept added to your idea.",
                          );
                        }}
                      >
                        {intent.conceptIds.includes(c.id)
                          ? "Remove from idea"
                          : "Add to my idea +"}
                      </button>
                    </article>
                  ))}
              </div>
            </>
          )}
          {tab === "Learn" && (
            <div className="concept-grid">
              {exercises.map((e) => (
                <article className="card" key={e.id}>
                  <span className="eyebrow">
                    GUIDED EXPERIMENT · {e.difficulty}
                  </span>
                  <h2>{e.title}</h2>
                  <p>{e.summary}</p>
                  <p className="example">{e.objective}</p>
                  <p className="hint">Start with: {e.starterPrompt}</p>
                  <div className="chips">
                    {e.conceptIds.map((id) => (
                      <span className="chip" key={id}>
                        {concepts.find((c) => c.id === id)?.title}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      setIntent({
                        ...initial,
                        subject: e.starterPrompt,
                        conceptIds: [e.conceptIds[0]],
                        destinationId: intent.destinationId,
                      });
                      setPrompt("");
                      setSections([]);
                      setTab("Create");
                      setNotice(
                        "Experiment loaded. Build your first version, then change one concept.",
                      );
                    }}
                  >
                    Try this experiment →
                  </button>
                </article>
              ))}
            </div>
          )}
          {tab === "Projects" && (
            <div className="create-grid">
              <section className="card">
                <h2>New project</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void report(async () => {
                      if (!repo) return;
                      const p = await repo.projects.create(
                        title.trim(),
                        description.trim(),
                      );
                      setProjects(await repo.projects.list());
                      setProjectId(p.id);
                      setTitle("");
                      setDescription("");
                      setNotice("Project created.");
                    });
                  }}
                >
                  <label htmlFor="title">Project name</label>
                  <input
                    id="title"
                    required
                    maxLength={120}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="My visual experiments"
                  />
                  <label htmlFor="description">Description (optional)</label>
                  <input
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                  <button className="primary" disabled={!repo || !title.trim()}>
                    Create project
                  </button>
                </form>
                <h2 className="space">Your projects</h2>
                {projects.length ? (
                  projects.map((p) => (
                    <button
                      className="project-item"
                      aria-pressed={projectId === p.id}
                      key={p.id}
                      onClick={() => {
                        setProjectId(p.id);
                        setRename(p.title);
                      }}
                    >
                      <strong>{p.title}</strong>
                      <small>
                        {p.description || "A fresh creative thread"}
                      </small>
                    </button>
                  ))
                ) : (
                  <p className="hint">
                    Your first project starts here. Prompts stay on this device.
                  </p>
                )}
              </section>
              <section className="card">
                <h2>{selectedProject?.title ?? "Choose a project"}</h2>
                {selectedProject && (
                  <>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void report(async () => {
                          await repo!.projects.update(
                            projectId,
                            rename.trim(),
                            selectedProject.description,
                          );
                          setProjects(await repo!.projects.list());
                          setNotice("Project renamed.");
                        });
                      }}
                    >
                      <label htmlFor="rename">Rename project</label>
                      <input
                        id="rename"
                        value={rename}
                        onChange={(e) => setRename(e.target.value)}
                      />
                      <div className="actions">
                        <button disabled={!rename.trim()}>Rename</button>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => {
                            if (
                              window.confirm(
                                "Delete this project and all its saved prompts?",
                              )
                            )
                              void report(async () => {
                                await repo!.projects.delete(projectId);
                                const list = await repo!.projects.list();
                                setProjects(list);
                                setProjectId(list[0]?.id ?? "");
                                setNotice("Project deleted.");
                              });
                          }}
                        >
                          Delete project
                        </button>
                      </div>
                    </form>
                    <h3>Prompt history</h3>
                    {history.length ? (
                      history.map((h) => (
                        <article className="history" key={h.id}>
                          <small>
                            {new Date(h.createdAt).toLocaleString()} ·{" "}
                            {h.destinationId === "flow"
                              ? "Google Flow"
                              : "ChatGPT"}
                          </small>
                          <p>{h.prompt}</p>
                          <button
                            onClick={() => {
                              setPrompt(h.prompt);
                              setIntent(h.intent as CreativeIntent);
                              setSections([]);
                              setTab("Create");
                              setNotice("Saved prompt restored.");
                            }}
                          >
                            Continue this prompt →
                          </button>
                        </article>
                      ))
                    ) : (
                      <p className="hint">
                        Build and save your first prompt in Create.
                      </p>
                    )}
                  </>
                )}
              </section>
            </div>
          )}
          {tab === "Settings" && (
            <section className="card settings">
              <h2>Your destinations</h2>
              <label htmlFor="default">Default destination</label>
              <select
                id="default"
                value={intent.destinationId}
                onChange={(e) => {
                  const destinationId = e.target
                    .value as CreativeIntent["destinationId"];
                  setField("destinationId", destinationId);
                  void report(async () => {
                    await repo!.settings.save({
                      defaultDestination: destinationId,
                    });
                    setNotice("Default destination saved.");
                  });
                }}
                disabled={!repo}
              >
                <option value="chatgpt">ChatGPT</option>
                <option value="flow">Google Flow</option>
              </select>
              <p className="hint">
                Destinations open in your system browser. Copy your prompt, then
                paste it there.
              </p>
              <hr />
              <h2>Guidance & privacy</h2>
              <p>
                This milestone uses curated concepts and an offline prompt
                builder. No AI tutor is connected and no image is generated or
                analysed here.
              </p>
              <p>
                Desktop projects, history, and settings use local SQLite. The
                browser preview uses this browser’s local storage. No account or
                API key is needed.
              </p>
              <p className="hint">
                Embedding, model providers, result import, and image critique
                are planned next.
              </p>
            </section>
          )}
          <footer>
            <span>Visual language, one idea at a time.</span>
            <span>Local first · Starter library</span>
            <Updater />
          </footer>
        </div>
        {native && (
          <DestinationWorkspace
            id={intent.destinationId}
            enabled={embedded}
            active={tab === "Create"}
            onClose={() => setEmbedded(false)}
          />
        )}
      </main>
    </div>
  );
}
