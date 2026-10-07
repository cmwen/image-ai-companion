use serde::Deserialize;
use url::Url;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Destination {
    Chatgpt,
    Flow,
}
impl Destination {
    pub fn parse(id: &str) -> Result<Self, String> {
        match id {
            "chatgpt" => Ok(Self::Chatgpt),
            "flow" => Ok(Self::Flow),
            _ => Err("Unknown destination.".into()),
        }
    }
    pub fn id(self) -> &'static str {
        match self {
            Self::Chatgpt => "chatgpt",
            Self::Flow => "flow",
        }
    }
    pub fn label(self) -> String {
        format!("destination-{}", self.id())
    }
    pub fn url(self) -> &'static str {
        match self {
            Self::Chatgpt => "https://chatgpt.com/",
            Self::Flow => "https://flow.google.com/",
        }
    }
    /// WKWebView calls navigation policy for subframe bootstrap requests too.
    /// Permit only the exact empty about:blank document in addition to HTTPS hosts.
    pub fn allows_navigation(self, url: &Url) -> bool {
        url.as_str() == "about:blank" || self.allows(url)
    }
    pub fn allows(self, url: &Url) -> bool {
        url.scheme() == "https"
            && url.port_or_known_default() == Some(443)
            && url.username().is_empty()
            && url.password().is_none()
            && self.allows_host(url.host_str().unwrap_or_default())
    }
    pub(crate) fn allows_host(self, host: &str) -> bool {
        match self {
            Self::Chatgpt => matches!(
                host,
                "chatgpt.com"
                    | "auth.openai.com"
                    | "auth0.openai.com"
                    | "accounts.google.com"
                    | "login.live.com"
                    | "login.microsoftonline.com"
                    | "appleid.apple.com"
            ),
            Self::Flow => matches!(
                host,
                "flow.google.com" | "labs.google" | "accounts.google.com"
            ),
        }
    }
}
#[derive(Clone, Copy, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Bounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}
impl Bounds {
    pub fn validate(self, viewport_width: f64, viewport_height: f64) -> Result<Self, String> {
        if ![
            self.x,
            self.y,
            self.width,
            self.height,
            viewport_width,
            viewport_height,
        ]
        .iter()
        .all(|n| n.is_finite())
            || viewport_width < 1.0
            || viewport_height < 1.0
            || self.x < 0.0
            || self.y < 0.0
            || self.width < 1.0
            || self.height < 1.0
            || self.x + self.width > viewport_width + 1.0
            || self.y + self.height > viewport_height + 1.0
        {
            return Err("Destination bounds must fit inside the app window.".into());
        }
        Ok(self)
    }
}

pub fn is_companion(webview_label: &str, window_label: &str) -> bool {
    webview_label == "main" && window_label == "main"
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn only_main_companion_can_manage_native_destinations() {
        assert!(is_companion("main", "main"));
        for label in [
            "destination-chatgpt",
            "destination-flow",
            "auth-popup-chatgpt-0",
            "auth-smoke-0",
            "main-other",
        ] {
            assert!(!is_companion(label, "main"));
        }
        assert!(!is_companion("main", "other-window"));
    }
    #[test]
    fn fixed_destination_and_auth_host_policy() {
        for destination in [Destination::Chatgpt, Destination::Flow] {
            assert!(destination.allows(&Url::parse(destination.url()).unwrap()));
            assert!(destination.allows(
                &Url::parse("https://accounts.google.com/ServiceLogin?private=ignored").unwrap()
            ));
            for url in [
                "http://chatgpt.com",
                "https://chatgpt.com.evil.example",
                "https://accounts.google.com.evil.example",
                "https://evil.example/accounts.google.com",
                "file:///etc/passwd",
                "javascript:alert(1)",
                "https://accounts.google.com:8443",
                "https://name:secret@accounts.google.com/",
            ] {
                assert!(!destination.allows(&Url::parse(url).unwrap()), "{url}");
            }
        }
        assert!(Destination::parse("arbitrary-url").is_err());
        assert!(!Destination::Flow.allows(&Url::parse("https://chatgpt.com").unwrap()));
    }
    #[test]
    fn flow_canonical_and_legacy_redirect_hosts_are_allowed_without_subdomain_wildcards() {
        assert_eq!(Destination::Flow.url(), "https://flow.google.com/");
        for url in [
            "https://flow.google.com/",
            "https://flow.google.com/?redirect=ignored",
            "https://labs.google/fx/tools/flow",
            "https://accounts.google.com/ServiceLogin",
        ] {
            assert!(Destination::Flow.allows(&Url::parse(url).unwrap()));
        }
        for url in [
            "https://flow.google.com.evil.example/",
            "https://evil.flow.google.com/",
            "https://flow.google.com@evil.example/",
            "http://flow.google.com/",
            "https://flow.google.com:8443/",
        ] {
            assert!(!Destination::Flow.allows(&Url::parse(url).unwrap()));
        }
    }
    #[test]
    fn blank_bootstrap_is_allowed_for_navigation_but_never_a_destination_load() {
        for destination in [Destination::Flow, Destination::Chatgpt] {
            let blank = Url::parse("about:blank").unwrap();
            assert!(destination.allows_navigation(&blank));
            assert!(!destination.allows(&blank));
            for raw in [
                "about:srcdoc",
                "about:blank?private=ignored",
                "about:blank#fragment",
                "data:text/html,hello",
                "javascript:alert(1)",
            ] {
                assert!(!destination.allows_navigation(&Url::parse(raw).unwrap()));
            }
        }
    }
    #[test]
    fn bounds_reject_invalid_and_covering_coordinates() {
        let good = Bounds {
            x: 300.,
            y: 200.,
            width: 600.,
            height: 400.,
        };
        assert!(good.validate(1280., 850.).is_ok());
        for bad in [
            Bounds {
                x: f64::NAN,
                ..good
            },
            Bounds {
                width: f64::INFINITY,
                ..good
            },
            Bounds { x: -1., ..good },
            Bounds { height: 0., ..good },
            Bounds {
                width: 1200.,
                ..good
            },
        ] {
            assert!(bad.validate(1280., 850.).is_err());
        }
    }
}
