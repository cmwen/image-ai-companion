# Experimental embedded destination authentication

## What changed in 0.1.2

The desktop app can place ChatGPT or Google Flow in a native child WebView on the right side of the same application window. The companion scrolls independently on the left. Select **Embed (experimental)** in Create, copy a prompt with **Copy & focus destination**, then paste it into the destination. Browser preview cannot embed native views.

The controls reload, close, or open the destination in the system browser. Navigation away from Create, hidden pages, and modal dialogs hide the child view. Returning to Create restores it. Destination sessions persist in the operating system WebView profile; these sessions are separate from the system browser’s cookies. Reloading or switching tabs does not clear the session. Closing a child view closes the displayed workspace without deliberately deleting the profile.

This is a feasibility spike, not a guarantee that either provider supports embedded authentication. No user agent spoofing, cookie/token extraction, DOM scraping, automatic prompt insertion, or authentication bypass is used. Authentication popup windows use Tauri’s related-window features so the WebView engine can preserve opener/session relationships. External navigation is restricted to explicitly approved HTTPS destination and authentication hosts; denied navigation is reported without its query string. New providers or authentication hosts require review of that allowlist.

Remote views do not inherit the local companion’s native capabilities. Capabilities are scoped to the main WebView label, and destination commands reject callers other than that main local view.

## Anonymous native smoke

The compiled native executable accepts `--auth-smoke`. It opens anonymous destination and login-entry pages in native WebViews and exits within a fixed time limit. It emits sanitized destination identifiers, host names, load/navigation markers, and timeout outcomes. No URL query string, credentials, cookies, DOM contents, or private prompt text is logged. The smoke context is isolated from the normal user session.

These observations can establish that the native child view was created and that the engine attempted navigation or reported document loading. A completed page load may still be an error, challenge, or blocked page. It does **not** establish successful sign-in, MFA, session restart persistence, or image generation. Hosted CI can be treated differently by providers than a person’s Mac.

The release workflow runs the actual native smoke on macOS and publishes its sanitized AUTH-SMOKE.json report alongside the installers. The report explicitly sets login_verified to false. Its reported outcomes must be reviewed separately from the mandatory native build, tests, signatures, and packaging checks. Authentication availability is inconclusive until an interactive test is completed.

## macOS CI observations from 0.1.2

The published 0.1.2 native build and anonymous smoke created all four child WebViews. Three cases emitted a document-load completion. The release's AUTH-SMOKE.json recorded:

| Anonymous case        | Finished document loads | Blocked navigations | Timeout |
| --------------------- | ----------------------: | ------------------: | ------- |
| ChatGPT destination   |                       1 |                   0 | No      |
| Flow destination      |                       0 |                   1 | Yes     |
| ChatGPT sign-in entry |                       1 |                   1 | No      |
| Google sign-in entry  |                       1 |                   1 | No      |

These are document-load observations, not proof of authentication. No credentials were submitted. Sign-in, MFA, popup completion, restart persistence, and image generation remain unverified.

A separate public-page check found the legacy Flow entry at `labs.google/fx/tools/flow` redirects to Google's canonical [Flow site](https://flow.google.com/). The 0.1.2 policy did not allow that destination host. Version 0.1.3 therefore opens `https://flow.google.com/` directly and allows that exact hostname, retaining the legacy entry and Google account host for navigation. This addresses the identified Flow redirect; further provider restrictions may still occur. Version 0.1.3 also permits exact `about:blank` navigation for WebView subframe/popup bootstrap, retaining strict HTTPS destination checks for page-load completion. Other about documents, data URLs, and JavaScript URLs remain denied; blank bootstrap never counts as a loaded destination.

The 0.1.3 anonymous smoke additionally records blocked hostname and scheme sets, without URL paths, query strings, fragments, usernames, or passwords, so remaining navigation restrictions can be diagnosed. Blocked navigation in the two sign-in cases was not identified by the older report and remains inconclusive until the new report is reviewed. The normal workspace continues to redact unapproved hosts from status events.

## Interactive macOS checklist

Use the 0.1.3 universal testing release on a real Mac. Enter credentials only into the destination’s own native page; never provide them to the companion.

| Check                                                          | ChatGPT                                  | Google Flow                              |
| -------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------- |
| Destination landing page renders                               | Not yet interactively verified           | Not yet interactively verified           |
| Sign-in navigation and related popup render                    | Not yet interactively verified           | Not yet interactively verified           |
| Login with selected account method completes                   | Not yet interactively verified           | Not yet interactively verified           |
| MFA completes where required                                   | Not yet interactively verified           | Not yet interactively verified           |
| Switch destination and return with session intact              | Not yet interactively verified           | Not yet interactively verified           |
| Navigate to Explore and return; destination is hidden/restored | Native behavior pending Mac verification | Native behavior pending Mac verification |
| Quit and restart; expected sign-in session remains             | Not yet interactively verified           | Not yet interactively verified           |
| Copy, paste, and generate through the destination              | Not yet interactively verified           | Not yet interactively verified           |
| Browser fallback remains usable after a blocked login          | Not yet interactively verified           | Not yet interactively verified           |

Record the macOS version, account method (without account identifiers), whether a popup appeared, and any provider error category. Do not share passwords, MFA codes, cookie values, session URLs, or screenshots containing account details. If embedding fails, use **Open in browser** and sign in there separately.

Google documents `disallowed_useragent` for OAuth requests made from some embedded user agents. Treat that restriction as a supported browser-fallback outcome; do not try to bypass it. See [Google OAuth documentation](https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow).

## Validation boundaries

Frontend tests cover viewport clipping, insufficient view area, serialized activation/hiding, destination switching, reuse on resize, teardown, retry, and late-show races. Native tests cover the command/capability boundary, navigation policy, popup mechanics, and bounds where possible. Browser E2E continues to verify the companion’s offline copy/save/history flow. Linux execution cannot verify macOS WebKit authentication. Native API behavior is based on locked Tauri 2.12.1; see [WebviewBuilder](https://docs.rs/tauri/2.12.1/tauri/webview/struct.WebviewBuilder.html) and [WebviewWindowBuilder](https://docs.rs/tauri/2.12.1/tauri/webview/struct.WebviewWindowBuilder.html).
