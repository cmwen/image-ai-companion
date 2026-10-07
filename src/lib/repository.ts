import { isTauri } from "@tauri-apps/api/core";
import type Database from "@tauri-apps/plugin-sql";

import {
  creativeIntentSchema,
  type CreativeIntent,
  type DestinationId,
} from "../types/domain";
export interface Project {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}
export interface PromptRecord {
  id: string;
  projectId: string;
  prompt: string;
  intent: CreativeIntent;
  conceptIds: string[];
  destinationId: DestinationId;
  createdAt: string;
}
export interface Settings {
  defaultDestination: DestinationId;
}
export interface Repository {
  projects: {
    list(): Promise<Project[]>;
    create(title: string, description?: string): Promise<Project>;
    update(id: string, title: string, description?: string): Promise<Project>;
    delete(id: string): Promise<void>;
  };
  prompts: {
    listByProject(projectId: string): Promise<PromptRecord[]>;
    save(record: PromptRecord): Promise<void>;
  };
  settings: {
    get(): Promise<Settings>;
    save(settings: Settings): Promise<void>;
  };
}

const previewKey = "image-ai-companion.preview.v1";
const defaults: Settings = { defaultDestination: "chatgpt" };
function text(
  value: unknown,
  label: string,
  max: number,
  allowEmpty = false,
): string {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (!allowEmpty && !value.trim())
  ) {
    throw new Error(
      `${label} must ${allowEmpty ? "" : "not be empty and "}contain at most ${max} characters.`,
    );
  }
  return value;
}
function destination(value: unknown): DestinationId {
  if (value !== "chatgpt" && value !== "flow")
    throw new Error("Unknown creative destination.");
  return value;
}
function date(value: unknown): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)))
    throw new Error("Invalid saved date.");
  return value;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid saved data.");
  return value as Record<string, unknown>;
}
function parseProject(value: unknown): Project {
  const p = object(value);
  return {
    id: text(p.id, "Project ID", 100),
    title: text(p.title, "Project title", 200),
    description: text(p.description, "Description", 4000, true),
    createdAt: date(p.createdAt),
    updatedAt: date(p.updatedAt),
  };
}
function parsePrompt(value: unknown): PromptRecord {
  const p = object(value);
  if (!Array.isArray(p.conceptIds)) throw new Error("Invalid saved concepts.");
  // JSON serialization also rejects cycles and unsupported values before writing.
  const intentJson = JSON.stringify(p.intent);
  if (intentJson === undefined)
    throw new Error("Prompt intent must be JSON serializable.");
  return {
    id: text(p.id, "Prompt ID", 100),
    projectId: text(p.projectId, "Project ID", 100),
    prompt: text(p.prompt, "Prompt", 20000),
    intent: creativeIntentSchema.parse(JSON.parse(intentJson)),
    conceptIds: p.conceptIds.map((id) => text(id, "Concept ID", 100)),
    destinationId: destination(p.destinationId),
    createdAt: date(p.createdAt),
  };
}
function parseSettings(value: unknown): Settings {
  return { defaultDestination: destination(object(value).defaultDestination) };
}
function newProject(title: string, description = ""): Project {
  const now = new Date().toISOString();
  return parseProject({
    id: crypto.randomUUID(),
    title: title.trim(),
    description,
    createdAt: now,
    updatedAt: now,
  });
}

interface PreviewData {
  version: 1;
  projects: Project[];
  prompts: PromptRecord[];
  settings: Settings;
}
// The browser preview uses the same boundary as desktop; storage failures remain visible.
export function createPreviewRepository(storage: Storage): Repository {
  function read(): PreviewData {
    const raw = storage.getItem(previewKey);
    if (!raw)
      return {
        version: 1,
        projects: [],
        prompts: [],
        settings: { ...defaults },
      };
    let data: Record<string, unknown>;
    try {
      data = object(JSON.parse(raw));
      if (
        data.version !== 1 ||
        !Array.isArray(data.projects) ||
        !Array.isArray(data.prompts)
      )
        throw new Error("Unsupported preview data version.");
      const projects = data.projects.map(parseProject);
      const prompts = data.prompts.map(parsePrompt);
      if (
        new Set(projects.map((p) => p.id)).size !== projects.length ||
        new Set(prompts.map((p) => p.id)).size !== prompts.length ||
        prompts.some(
          (p) => !projects.some((project) => project.id === p.projectId),
        )
      )
        throw new Error("Invalid project history.");
      return {
        version: 1,
        projects,
        prompts,
        settings: parseSettings(data.settings),
      };
    } catch {
      throw new Error(
        "Saved browser preview data could not be read. Export or clear this site’s storage to recover.",
      );
    }
  }
  function write(data: PreviewData) {
    storage.setItem(previewKey, JSON.stringify(data));
  }
  return {
    projects: {
      async list() {
        return read().projects.sort((a, b) =>
          b.updatedAt.localeCompare(a.updatedAt),
        );
      },
      async create(title, description) {
        const data = read();
        const project = newProject(title, description);
        data.projects.push(project);
        write(data);
        return project;
      },
      async update(id, title, description = "") {
        const data = read();
        const index = data.projects.findIndex((p) => p.id === id);
        if (index < 0) throw new Error("Project no longer exists.");
        const project = parseProject({
          ...data.projects[index],
          title: title.trim(),
          description,
          updatedAt: new Date().toISOString(),
        });
        data.projects[index] = project;
        write(data);
        return project;
      },
      async delete(id) {
        const data = read();
        data.projects = data.projects.filter((p) => p.id !== id);
        data.prompts = data.prompts.filter((p) => p.projectId !== id);
        write(data);
      },
    },
    prompts: {
      async listByProject(projectId) {
        return read()
          .prompts.filter((p) => p.projectId === projectId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      },
      async save(record) {
        const prompt = parsePrompt(record);
        const data = read();
        if (!data.projects.some((p) => p.id === prompt.projectId))
          throw new Error("Project no longer exists.");
        if (data.prompts.some((p) => p.id === prompt.id))
          throw new Error("Prompt is already saved.");
        data.prompts.push(prompt);
        write(data);
      },
    },
    settings: {
      async get() {
        return read().settings;
      },
      async save(settings) {
        const data = read();
        data.settings = parseSettings(settings);
        write(data);
      },
    },
  };
}

interface ProjectRow {
  id: string;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
}
interface PromptRow {
  id: string;
  project_id: string;
  prompt: string;
  intent_json: string;
  concept_ids_json: string;
  destination_id: string;
  created_at: string;
}
function fromProjectRow(row: ProjectRow): Project {
  return parseProject({
    ...row,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
export function createSqlRepository(
  db: Pick<Database, "select" | "execute">,
): Repository {
  return {
    projects: {
      async list() {
        return (
          await db.select<ProjectRow[]>(
            "SELECT * FROM projects ORDER BY updated_at DESC",
          )
        ).map(fromProjectRow);
      },
      async create(title, description) {
        const p = newProject(title, description);
        await db.execute(
          "INSERT INTO projects (id, title, description, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)",
          [p.id, p.title, p.description, p.createdAt, p.updatedAt],
        );
        return p;
      },
      async update(id, title, description = "") {
        const rows = await db.select<ProjectRow[]>(
          "SELECT * FROM projects WHERE id = $1",
          [id],
        );
        if (!rows[0]) throw new Error("Project no longer exists.");
        const p = parseProject({
          ...fromProjectRow(rows[0]),
          title: title.trim(),
          description,
          updatedAt: new Date().toISOString(),
        });
        const result = await db.execute(
          "UPDATE projects SET title = $1, description = $2, updated_at = $3 WHERE id = $4",
          [p.title, p.description, p.updatedAt, id],
        );
        if (!result.rowsAffected) throw new Error("Project no longer exists.");
        return p;
      },
      async delete(id) {
        await db.execute("DELETE FROM projects WHERE id = $1", [id]);
      },
    },
    prompts: {
      async listByProject(projectId) {
        const rows = await db.select<PromptRow[]>(
          "SELECT * FROM prompt_history WHERE project_id = $1 ORDER BY created_at DESC",
          [projectId],
        );
        return rows.map((row) =>
          parsePrompt({
            id: row.id,
            projectId: row.project_id,
            prompt: row.prompt,
            intent: JSON.parse(row.intent_json) as unknown,
            conceptIds: JSON.parse(row.concept_ids_json) as unknown,
            destinationId: row.destination_id,
            createdAt: row.created_at,
          }),
        );
      },
      async save(record) {
        const p = parsePrompt(record);
        // INSERT … SELECT checks parent existence atomically, also when FK checks are disabled.
        const result = await db.execute(
          "INSERT INTO prompt_history (id, project_id, prompt, intent_json, concept_ids_json, destination_id, created_at) SELECT $1, $2, $3, $4, $5, $6, $7 WHERE EXISTS (SELECT 1 FROM projects WHERE id = $2)",
          [
            p.id,
            p.projectId,
            p.prompt,
            JSON.stringify(p.intent),
            JSON.stringify(p.conceptIds),
            p.destinationId,
            p.createdAt,
          ],
        );
        if (!result.rowsAffected) throw new Error("Project no longer exists.");
      },
    },
    settings: {
      async get() {
        const rows = await db.select<{ default_destination: string }[]>(
          "SELECT default_destination FROM settings WHERE id = 1",
        );
        return rows[0]
          ? parseSettings({ defaultDestination: rows[0].default_destination })
          : { ...defaults };
      },
      async save(settings) {
        const s = parseSettings(settings);
        await db.execute(
          "INSERT INTO settings (id, default_destination) VALUES (1, $1) ON CONFLICT(id) DO UPDATE SET default_destination = excluded.default_destination",
          [s.defaultDestination],
        );
      },
    },
  };
}

export async function createRepository(): Promise<Repository> {
  if (!isTauri()) return createPreviewRepository(window.localStorage);
  const { default: SqlDatabase } = await import("@tauri-apps/plugin-sql");
  // Native failures must surface; never silently switch a desktop user to preview storage.
  return createSqlRepository(
    await SqlDatabase.load("sqlite:image-ai-companion.db"),
  );
}
