import { afterEach, describe, expect, it } from "vitest";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSqlRepository, type PromptRecord } from "../src/lib/repository";

const migration = readFileSync(
  new URL("../src-tauri/migrations/001_initial.sql", import.meta.url),
  "utf8",
);
const databases: DatabaseSync[] = [];
const directories: string[] = [];
afterEach(() => {
  for (const db of databases.splice(0)) {
    try {
      db.close();
    } catch {
      /* already closed for reopen test */
    }
  }
  for (const dir of directories.splice(0))
    rmSync(dir, { recursive: true, force: true });
});
function open(path = ":memory:", foreignKeys = true) {
  const db = new DatabaseSync(path);
  databases.push(db);
  db.exec(`PRAGMA foreign_keys = ${foreignKeys ? 1 : 0}`);
  db.exec(migration);
  // Real SQLite bindings, with Tauri's $n parameter syntax and async result shape.
  function bindings(values: unknown[] = []) {
    return Object.fromEntries(
      values.map((value, index) => [`$${index + 1}`, value]),
    ) as Record<string, SQLInputValue>;
  }
  const repository = createSqlRepository({
    async select<T>(query: string, values?: unknown[]) {
      return db.prepare(query).all(bindings(values)) as T;
    },
    async execute(query: string, values?: unknown[]) {
      const result = db.prepare(query).run(bindings(values));
      return {
        rowsAffected: Number(result.changes),
        lastInsertId: Number(result.lastInsertRowid),
      };
    },
  });
  return { db, repository };
}
function prompt(projectId: string, id = "saved-prompt"): PromptRecord {
  return {
    id,
    projectId,
    prompt: "A portrait with warm natural light; keep the subject's features.",
    intent: {
      subject: "A portrait",
      environment: "",
      conceptIds: ["soft-light"],
      mood: "warm",
      constraints: "",
      destinationId: "flow",
    },
    conceptIds: ["soft-light"],
    destinationId: "flow",
    createdAt: "2026-10-07T12:00:00.000Z",
  };
}

describe("native SQLite repository and shipped migration", () => {
  it("persists project edits, prompts and destination settings across database reopening", async () => {
    const dir = mkdtempSync(join(tmpdir(), "image-companion-sqlite-"));
    directories.push(dir);
    const path = join(dir, "companion.db");
    const first = open(path);
    expect(await first.repository.settings.get()).toEqual({
      defaultDestination: "chatgpt",
    });
    const project = await first.repository.projects.create(
      "  Portrait 'study'  ",
      "First draft",
    );
    const edited = await first.repository.projects.update(
      project.id,
      "Portrait study",
      "Warm light",
    );
    expect(edited.createdAt).toBe(project.createdAt);
    expect(edited.updatedAt >= project.updatedAt).toBe(true);
    const record = prompt(project.id);
    await first.repository.prompts.save(record);
    await first.repository.prompts.save({
      ...record,
      id: "newer-prompt",
      createdAt: "2026-10-07T13:00:00.000Z",
    });
    await first.repository.settings.save({ defaultDestination: "flow" });
    first.db.close();
    const reopened = open(path).repository;
    expect(await reopened.projects.list()).toEqual([edited]);
    expect(await reopened.prompts.listByProject(project.id)).toEqual([
      { ...record, id: "newer-prompt", createdAt: "2026-10-07T13:00:00.000Z" },
      record,
    ]);
    expect(await reopened.settings.get()).toEqual({
      defaultDestination: "flow",
    });
  });

  it.each([true, false])(
    "deletes only the selected project history with foreign keys enabled=%s",
    async (foreignKeys) => {
      const { repository } = open(":memory:", foreignKeys);
      const a = await repository.projects.create("Delete me");
      const b = await repository.projects.create("Keep me");
      await repository.prompts.save(prompt(a.id, "a"));
      await repository.prompts.save(prompt(b.id, "b"));
      await repository.projects.delete(a.id);
      expect(await repository.projects.list()).toEqual([b]);
      expect(await repository.prompts.listByProject(a.id)).toEqual([]);
      expect(await repository.prompts.listByProject(b.id)).toEqual([
        prompt(b.id, "b"),
      ]);
      await expect(
        repository.prompts.save(prompt(a.id, "orphan")),
      ).rejects.toThrow("Project no longer exists");
      await expect(
        repository.projects.update(a.id, "Resurrect"),
      ).rejects.toThrow("Project no longer exists");
    },
  );

  it("rejects invalid writes without losing existing projects, history or settings", async () => {
    const { repository, db } = open();
    const project = await repository.projects.create("Original");
    const record = prompt(project.id);
    await repository.prompts.save(record);
    await expect(repository.projects.create(" ")).rejects.toThrow();
    await expect(
      repository.projects.update(project.id, "x".repeat(201)),
    ).rejects.toThrow();
    await expect(repository.prompts.save(record)).rejects.toThrow();
    await expect(
      repository.prompts.save({ ...record, id: "empty", prompt: "" }),
    ).rejects.toThrow();
    await expect(
      repository.settings.save({ defaultDestination: "invalid" } as never),
    ).rejects.toThrow();
    expect(await repository.projects.list()).toEqual([project]);
    expect(await repository.prompts.listByProject(project.id)).toEqual([
      record,
    ]);
    expect(await repository.settings.get()).toEqual({
      defaultDestination: "chatgpt",
    });
    // Constraints protect native storage even from writes outside the repository.
    expect(() =>
      db.exec("UPDATE settings SET default_destination = 'invalid'"),
    ).toThrow();
    expect(() =>
      db.exec("UPDATE prompt_history SET intent_json = '{broken'"),
    ).toThrow();
  });
});
