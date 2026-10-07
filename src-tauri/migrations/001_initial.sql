CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200),
    description TEXT NOT NULL DEFAULT '' CHECK(length(description) <= 4000),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prompt_history (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL CHECK(length(trim(prompt)) BETWEEN 1 AND 20000),
    intent_json TEXT NOT NULL CHECK(json_valid(intent_json)),
    concept_ids_json TEXT NOT NULL CHECK(json_valid(concept_ids_json)),
    destination_id TEXT NOT NULL CHECK(destination_id IN ('chatgpt', 'flow')),
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS prompt_history_project_created
    ON prompt_history(project_id, created_at DESC);

-- Keep deletion atomic even if a future connection disables SQLite foreign keys.
CREATE TRIGGER IF NOT EXISTS delete_project_history
AFTER DELETE ON projects
BEGIN
    DELETE FROM prompt_history WHERE project_id = OLD.id;
END;

CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    default_destination TEXT NOT NULL CHECK(default_destination IN ('chatgpt', 'flow'))
);
INSERT OR IGNORE INTO settings (id, default_destination) VALUES (1, 'chatgpt');
