//! Bounded anonymous native document-loading probe; never submits credentials,
//! inspects DOM, or reports cookies, paths, query strings, titles or auth success.
use crate::policy::Destination;
use serde::Serialize;
use std::{
    collections::BTreeSet,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tauri::{
    webview::{PageLoadEvent, WebviewBuilder},
    AppHandle, LogicalPosition, LogicalSize, Manager, Url, WebviewUrl,
};

#[derive(Default, Serialize)]
struct Case {
    id: &'static str,
    created: bool,
    navigation_count: usize,
    blocked_navigation_count: usize,
    load_started_count: usize,
    load_finished_count: usize,
    hosts: BTreeSet<String>,
    blocked_hosts: BTreeSet<String>,
    blocked_schemes: BTreeSet<String>,
    timed_out: bool,
}
const CASES: [(&str, Destination, &str); 4] = [
    (
        "chatgpt-destination",
        Destination::Chatgpt,
        "https://chatgpt.com/",
    ),
    (
        "flow-destination",
        Destination::Flow,
        "https://flow.google.com/",
    ),
    (
        "chatgpt-sign-in",
        Destination::Chatgpt,
        "https://chatgpt.com/auth/login",
    ),
    (
        "google-sign-in",
        Destination::Flow,
        "https://accounts.google.com/ServiceLogin",
    ),
];

pub fn start(app: &AppHandle) -> tauri::Result<()> {
    let main = app.get_window("main").expect("configured main window");
    let observations = Arc::new(Mutex::new(
        CASES
            .iter()
            .map(|(id, _, _)| Case {
                id,
                ..Case::default()
            })
            .collect::<Vec<_>>(),
    ));
    for (index, (_, destination, url)) in CASES.iter().enumerate() {
        let navigation = observations.clone();
        let loads = observations.clone();
        let destination = *destination;
        let builder = WebviewBuilder::new(
            format!("auth-smoke-{index}"),
            WebviewUrl::External(Url::parse(url).expect("constant URL")),
        )
        // Probe a fresh anonymous store even when launched on a user's machine.
        // Normal destination views deliberately retain their persistent stores.
        .incognito(true)
        .on_navigation(move |url| {
            let allowed = destination.allows_navigation(url);
            if let Ok(mut cases) = navigation.lock() {
                if allowed {
                    cases[index].navigation_count += 1;
                    if let Some(host) = url.host_str() {
                        cases[index].hosts.insert(host.to_owned());
                    }
                } else {
                    cases[index].blocked_navigation_count += 1;
                    cases[index].blocked_schemes.insert(url.scheme().to_owned());
                    if let Some(host) = url.host_str() {
                        // Anonymous smoke only: host and scheme, never path/query/userinfo.
                        cases[index].blocked_hosts.insert(host.to_owned());
                    }
                }
            }
            allowed
        })
        .on_new_window(|_, _| tauri::webview::NewWindowResponse::Deny)
        .on_page_load(move |_, payload| {
            if !destination.allows(payload.url()) {
                return;
            }
            if let Ok(mut cases) = loads.lock() {
                if let Some(host) = payload.url().host_str() {
                    cases[index].hosts.insert(host.to_owned());
                }
                match payload.event() {
                    PageLoadEvent::Started => cases[index].load_started_count += 1,
                    PageLoadEvent::Finished => cases[index].load_finished_count += 1,
                }
            }
        });
        let created = main
            .add_child(
                builder,
                LogicalPosition::new((index % 2) as f64 * 600., (index / 2) as f64 * 350.),
                LogicalSize::new(600., 350.),
            )
            .is_ok();
        if let Ok(mut cases) = observations.lock() {
            cases[index].created = created;
        }
    }
    let handle = app.clone();
    std::thread::spawn(move || {
        let deadline = Instant::now() + Duration::from_secs(60);
        loop {
            let complete = observations
                .lock()
                .map(|cases| {
                    cases
                        .iter()
                        .all(|case| !case.created || case.load_finished_count > 0)
                })
                .unwrap_or(false);
            if complete || Instant::now() >= deadline {
                break;
            }
            std::thread::sleep(Duration::from_millis(250));
        }
        if let Ok(mut cases) = observations.lock() {
            for case in cases.iter_mut() {
                case.timed_out = case.created && case.load_finished_count == 0;
            }
            let created = cases.iter().filter(|case| case.created).count();
            let loaded = cases
                .iter()
                .filter(|case| case.load_finished_count > 0)
                .count();
            let report = serde_json::json!({
                "kind": "anonymous-native-auth-smoke",
                "schema_version": 1,
                "deadline_seconds": 60,
                "created_count": created,
                "loaded_count": loaded,
                "login_verified": false,
                "interpretation": "Document-load events only; provider interstitials and network refusal require manual inspection. No credential login performed.",
                "cases": &*cases,
            });
            println!("AUTH_SMOKE_REPORT {report}");
            // Provider refusal/timeouts are observations, not application failure.
            // A native child-creation failure remains a structural smoke failure.
            handle.exit(if created == CASES.len() { 0 } else { 1 });
        } else {
            handle.exit(1);
        }
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn report_contains_only_fixed_case_ids_hostnames_and_counters() {
        for (id, destination, raw) in CASES {
            let url = Url::parse(raw).unwrap();
            assert!(destination.allows(&url));
            let case = Case {
                id,
                hosts: BTreeSet::from([url.host_str().unwrap().into()]),
                ..Case::default()
            };
            let report = serde_json::to_string(&case).unwrap();
            assert!(!report.contains("https://"));
            assert!(!report.contains("/auth/login"));
            assert!(!report.contains("ServiceLogin"));
        }
    }
}
