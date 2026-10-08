mod auth_smoke;
mod destinations;
mod policy;

use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let auth_smoke = std::env::args().any(|arg| arg == "--auth-smoke");
    tauri::Builder::default()
        .manage(destinations::DestinationState::default())
        .invoke_handler(tauri::generate_handler![
            destinations::embed_destination,
            destinations::update_destination_bounds,
            destinations::hide_destination,
            destinations::reload_destination,
            destinations::focus_destination,
            destinations::close_destination,
        ])
        .setup(move |app| {
            if auth_smoke {
                auth_smoke::start(app.handle())?;
            } else {
                // A release's anonymous smoke must never update its freshly built bundle.
                app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())?;
            }
            Ok(())
        })
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(
                    "sqlite:image-ai-companion.db",
                    vec![Migration {
                        version: 1,
                        description: "projects_prompt_history_and_settings",
                        sql: include_str!("../migrations/001_initial.sql"),
                        kind: MigrationKind::Up,
                    }],
                )
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running Image AI Companion");
}
