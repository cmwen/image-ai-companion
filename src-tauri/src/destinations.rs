//! Experimental native child views. No remote webview receives app capabilities.
use crate::policy::{is_companion, Bounds, Destination};
use serde::Serialize;
use std::sync::{
    atomic::{AtomicU64, Ordering},
    Mutex,
};
use tauri::{
    webview::{NewWindowFeatures, NewWindowResponse, WebviewBuilder},
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Rect, Url, Webview, WebviewUrl,
    WebviewWindowBuilder,
};

#[derive(Default)]
pub struct DestinationState {
    active: Mutex<Option<Destination>>,
    popup_counter: AtomicU64,
}
fn bounds_rect(bounds: Bounds) -> Rect {
    Rect {
        position: LogicalPosition::new(bounds.x, bounds.y).into(),
        size: LogicalSize::new(bounds.width, bounds.height).into(),
    }
}
fn authorize(caller: &Webview) -> Result<(), String> {
    if !is_companion(caller.label(), caller.window().label()) {
        return Err("Only the companion can manage destinations.".into());
    }
    Ok(())
}
fn validated_bounds(app: &AppHandle, bounds: Bounds) -> Result<Bounds, String> {
    let window = app
        .get_window("main")
        .ok_or("Companion window unavailable.")?;
    let size = window
        .inner_size()
        .map_err(|_| "Window size unavailable.")?
        .to_logical::<f64>(
            window
                .scale_factor()
                .map_err(|_| "Window scale unavailable.")?,
        );
    bounds.validate(size.width, size.height)
}
fn set_active(app: &AppHandle, destination: Option<Destination>) -> Result<(), String> {
    *app.state::<DestinationState>()
        .active
        .lock()
        .map_err(|_| "Destination state unavailable.")? = destination;
    Ok(())
}
fn hide_all(app: &AppHandle) -> Result<(), String> {
    set_active(app, None)?;
    for (label, view) in app.webviews() {
        if label.starts_with("destination-") {
            view.hide().map_err(|_| "Could not hide destination.")?;
        }
    }
    for (label, window) in app.webview_windows() {
        if label.starts_with("auth-popup-") {
            window
                .hide()
                .map_err(|_| "Could not hide authentication window.")?;
        }
    }
    Ok(())
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DestinationStatus {
    destination_id: &'static str,
    kind: &'static str,
    host: String,
}
fn status(app: &AppHandle, destination: Destination, kind: &'static str, url: &Url) {
    // Unknown hosts are deliberately redacted; never expose provider paths,
    // OAuth query parameters, credentials or user-controlled host fragments.
    let host = url
        .host_str()
        .filter(|host| destination.allows_host(host))
        .unwrap_or("unapproved-host")
        .to_owned();
    let _ = app.emit_to(
        "main",
        "destination-status",
        DestinationStatus {
            destination_id: destination.id(),
            kind,
            host,
        },
    );
}
fn restore_popups(app: &AppHandle, destination: Destination) -> Result<(), String> {
    for (label, window) in app.webview_windows() {
        if label.starts_with(&format!("auth-popup-{}-", destination.id())) {
            window
                .show()
                .map_err(|_| "Could not restore authentication window.")?;
        }
    }
    Ok(())
}
fn popup_handler(
    app: AppHandle,
    destination: Destination,
) -> impl Fn(Url, NewWindowFeatures) -> NewWindowResponse<tauri::Wry> + Send + 'static {
    move |url, features| {
        if !destination.allows_navigation(&url) {
            status(&app, destination, "popup-blocked", &url);
            return NewWindowResponse::Deny;
        }
        let state = app.state::<DestinationState>();
        if state
            .active
            .lock()
            .map(|active| *active != Some(destination))
            .unwrap_or(true)
            || app
                .webview_windows()
                .keys()
                .filter(|label| label.starts_with("auth-popup-"))
                .count()
                >= 4
        {
            status(&app, destination, "popup-blocked", &url);
            return NewWindowResponse::Deny;
        }
        let number = state.popup_counter.fetch_add(1, Ordering::Relaxed);
        let label = format!("auth-popup-{}-{number}", destination.id());
        // Critical: window_features connects the actual opener's WK configuration,
        // WebView2 environment, or WebKit related view. The engine loads its request
        // into this returned view and retains the opener; we never recreate the URL.
        let navigation_app = app.clone();
        let builder = WebviewWindowBuilder::new(
            &app,
            label,
            WebviewUrl::External(Url::parse("about:blank").expect("constant URL")),
        )
        .window_features(features)
        .title("Destination sign-in")
        .on_navigation(move |url| {
            let allowed = destination.allows_navigation(url);
            if !allowed {
                status(&navigation_app, destination, "navigation-blocked", url);
            }
            allowed
        })
        .on_new_window(popup_handler(app.clone(), destination));
        match builder.build() {
            Ok(window) => NewWindowResponse::Create { window },
            Err(_) => NewWindowResponse::Deny,
        }
    }
}
#[tauri::command]
pub async fn embed_destination(
    caller: Webview,
    app: AppHandle,
    id: String,
    bounds: Bounds,
) -> Result<(), String> {
    authorize(&caller)?;
    let destination = Destination::parse(&id)?;
    let bounds = validated_bounds(&app, bounds)?;
    hide_all(&app)?;
    if let Some(view) = app.get_webview(&destination.label()) {
        view.set_bounds(bounds_rect(bounds))
            .map_err(|_| "Could not position destination.")?;
        view.show().map_err(|_| "Could not show destination.")?;
    } else {
        let directory = app
            .path()
            .app_data_dir()
            .map_err(|_| "Local session directory unavailable.")?
            .join("destination-sessions")
            .join(destination.id());
        std::fs::create_dir_all(&directory)
            .map_err(|_| "Could not create destination session directory.")?;
        let navigation_app = app.clone();
        let load_app = app.clone();
        let builder = WebviewBuilder::new(
            destination.label(),
            WebviewUrl::External(Url::parse(destination.url()).expect("constant URL")),
        )
        .incognito(false)
        .data_directory(directory)
        .on_navigation(move |url| {
            let allowed = destination.allows_navigation(url);
            if !allowed {
                status(&navigation_app, destination, "navigation-blocked", url);
            }
            allowed
        })
        .on_page_load(move |_, payload| {
            if payload.event() == tauri::webview::PageLoadEvent::Finished
                && destination.allows(payload.url())
            {
                status(&load_app, destination, "document-loaded", payload.url());
            }
        })
        .on_new_window(popup_handler(app.clone(), destination));
        let window = app
            .get_window("main")
            .ok_or("Companion window unavailable.")?;
        window
            .add_child(
                builder,
                LogicalPosition::new(bounds.x, bounds.y),
                LogicalSize::new(bounds.width, bounds.height),
            )
            .map_err(|_| "Could not embed destination. Open it in your browser instead.")?;
    }
    set_active(&app, Some(destination))?;
    restore_popups(&app, destination)
}
#[tauri::command]
pub async fn update_destination_bounds(
    caller: Webview,
    app: AppHandle,
    id: String,
    bounds: Bounds,
) -> Result<(), String> {
    authorize(&caller)?;
    let destination = Destination::parse(&id)?;
    let bounds = validated_bounds(&app, bounds)?;
    if let Some(view) = app.get_webview(&destination.label()) {
        view.set_bounds(bounds_rect(bounds))
            .map_err(|_| "Could not position destination.")?;
    }
    Ok(())
}
#[tauri::command]
pub async fn hide_destination(caller: Webview, app: AppHandle) -> Result<(), String> {
    authorize(&caller)?;
    hide_all(&app)
}
#[tauri::command]
pub async fn reload_destination(caller: Webview, app: AppHandle, id: String) -> Result<(), String> {
    authorize(&caller)?;
    let destination = Destination::parse(&id)?;
    app.get_webview(&destination.label())
        .ok_or("Destination is not open.")?
        .reload()
        .map_err(|_| "Could not reload destination.".into())
}
#[tauri::command]
pub async fn focus_destination(caller: Webview, app: AppHandle, id: String) -> Result<(), String> {
    authorize(&caller)?;
    let destination = Destination::parse(&id)?;
    if *app
        .state::<DestinationState>()
        .active
        .lock()
        .map_err(|_| "Destination state unavailable.")?
        != Some(destination)
    {
        return Err("Destination is not visible.".into());
    }
    app.get_webview(&destination.label())
        .ok_or("Destination is not open.")?
        .set_focus()
        .map_err(|_| "Could not focus destination.".into())
}
#[tauri::command]
pub async fn close_destination(caller: Webview, app: AppHandle, id: String) -> Result<(), String> {
    authorize(&caller)?;
    let destination = Destination::parse(&id)?;
    let is_active = *app
        .state::<DestinationState>()
        .active
        .lock()
        .map_err(|_| "Destination state unavailable.")?
        == Some(destination);
    if is_active {
        set_active(&app, None)?;
    }
    for (label, window) in app.webview_windows() {
        if label.starts_with(&format!("auth-popup-{}-", destination.id())) {
            window
                .close()
                .map_err(|_| "Could not close authentication window.")?;
        }
    }
    if let Some(view) = app.get_webview(&destination.label()) {
        view.close().map_err(|_| "Could not close destination.")?;
    }
    Ok(())
}
