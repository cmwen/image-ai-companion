import { describe, it, expect } from "vitest";
import {
  concepts,
  recipes,
  exercises,
  validateContent,
} from "../src/lib/content";
import {
  buildPrompt,
  simplifyPrompt,
} from "../src/features/prompt-builder/builder";
import { createDestination } from "../src/features/destinations/adapters";
import { createPreviewRepository } from "../src/lib/repository";
const intent = {
  subject: "A robot",
  environment: "A station",
  conceptIds: ["soft-light", "rim-light", "low-angle"],
  mood: "Hopeful",
  constraints: "No text; transparent background",
  destinationId: "chatgpt" as const,
};
const storage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
    removeItem: (k: string) => values.delete(k),
    clear: () => values.clear(),
    key: () => null,
    get length() {
      return values.size;
    },
  };
};
describe("content and creation loop", () => {
  it("validates starter library across six categories", () => {
    expect(new Set(concepts.map((c) => c.category)).size).toBe(6);
    expect(exercises.length).toBeGreaterThan(0);
    expect(recipes.length).toBeGreaterThan(0);
  });
  it("rejects duplicate IDs and dangling references", () => {
    expect(() =>
      validateContent({
        concepts: [...concepts, concepts[0]],
        recipes,
        exercises,
      }),
    ).toThrow("Duplicate");
    expect(() =>
      validateContent({
        concepts,
        recipes: [
          { ...recipes[0], intent: { ...intent, conceptIds: ["missing"] } },
        ],
        exercises,
      }),
    ).toThrow("Unknown concept");
  });
  it("preserves intent and explains each selected direction", () => {
    const p = buildPrompt(intent);
    expect(p.text).toContain("A robot");
    expect(p.text).toContain("soft side lighting");
    expect(
      p.sections.find((s) => s.label === "Soft light")?.explanation,
    ).toBeTruthy();
    expect(buildPrompt(intent)).toEqual(p);
  });
  it("simplifies directions without losing practical constraints", () => {
    const p = simplifyPrompt(intent);
    expect(p.text).toContain(intent.constraints);
    expect(p.text).not.toContain("low-angle");
    expect(intent.conceptIds).toHaveLength(3);
  });
  it("supports clipboard and browser without claiming embedded integration", () => {
    for (const id of ["chatgpt", "flow"] as const) {
      const d = createDestination(id);
      expect(new URL(d.url).protocol).toBe("https:");
      expect(d.getCapabilities()).toEqual({
        clipboard: true,
        externalBrowser: true,
        embedded: false,
      });
    }
  });
  it("persists edited prompt, settings, and project CRUD across repository recreation", async () => {
    const s = storage(),
      r = createPreviewRepository(s);
    const p = await r.projects.create("Experiment", "Light study");
    const record = {
      id: "prompt1",
      projectId: p.id,
      prompt: "My edited wording.",
      intent,
      conceptIds: intent.conceptIds,
      destinationId: intent.destinationId,
      createdAt: new Date().toISOString(),
    };
    await r.prompts.save(record);
    await r.settings.save({ defaultDestination: "flow" });
    const reopened = createPreviewRepository(s);
    expect(await reopened.prompts.listByProject(p.id)).toEqual([record]);
    expect((await reopened.settings.get()).defaultDestination).toBe("flow");
    expect((await reopened.projects.update(p.id, "New title")).title).toBe(
      "New title",
    );
    await reopened.projects.delete(p.id);
    expect(await reopened.prompts.listByProject(p.id)).toEqual([]);
  });
  it("rejects invalid saved intent and surfaces damaged preview storage", async () => {
    const s = storage(),
      r = createPreviewRepository(s),
      p = await r.projects.create("Study");
    await expect(
      r.prompts.save({
        id: "a",
        projectId: p.id,
        prompt: "x",
        intent: { subject: 1 } as never,
        conceptIds: [],
        destinationId: "chatgpt",
        createdAt: new Date().toISOString(),
      }),
    ).rejects.toThrow();
    s.setItem("image-ai-companion.preview.v1", "broken");
    await expect(r.projects.list()).rejects.toThrow("could not be read");
  });
});
