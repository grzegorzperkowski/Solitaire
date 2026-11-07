# T039 — Context7 research and isolated history probe

2026-11-07. Assigned by the coordinator: “use context7 - spróbuj znaleźć jakiś sposób!”. Starting `master` at `12b6b66`; preserve the restored full-width layout and both diagnostic JSON files. Research only: production files and deployments are unchanged in this investigation.

## Finding

The promising PWA experiment is a persistent Playground document with a game view, so Back is a same-document traversal. It is not another CSS margin or card-input patch. Modern Navigation API can cancel that class of traversal under restrictions; it cannot cancel the current cross-document transition back from Solitaire to Playground. A browser probe confirms this distinction. It does **not** prove that Android/iOS will yield an edge gesture early enough for card dragging.

No universal PWA manifest flag disables native Back gestures: the proposal is still open in the [manifest standards repository](https://github.com/w3c/manifest/issues/1041). The related [Pointer Events issue](https://github.com/w3c/pointerevents/issues/358) also distinguishes native navigation from DOM panning/zooming; reported touch-event workarounds are not a platform guarantee.

## Documentation checked

Used Context7 `resolve-library-id` for MDN Web Docs and selected `/mdn/content`. Queried three focused concepts: touch interception/default actions; Navigation API traversal cancellation; iframe/session history and location replacement.

- [MDN TouchEvent](https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent) requires explicit non-passive listeners for cancellation in browsers with passive root defaults. Canceling touch events can suppress compatibility mouse clicks. This does not establish control over OS navigation.
- [MDN touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action) covers browser panning/zooming and requires values to be set before a gesture. The app already supplies card-specific values; changing them mid-gesture cannot reclaim input.
- Context7's [MDN Navigation API note](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API) broadly describes traversal cancellation as unavailable. The [Navigation API explainer](https://github.com/WICG/navigation-api/blob/main/README.md#canceling-navigations) is more precise: cross-document traversal cannot be canceled; same-document cancellation is restricted to the top window and, for browser-initiated Back, consumable activation. Repeated Back must remain an escape. Chromium measurements below agree with this narrower rule.
- Current primary [MDN compatibility data](https://github.com/mdn/browser-compat-data/blob/main/api/Navigation.json) lists Navigation API support from Chrome 102, Safari/iOS 26.2 and Firefox 147. [NavigateEvent data](https://github.com/mdn/browser-compat-data/blob/main/api/NavigateEvent.json) lists current `intercept()` from Chrome 105 and Safari 26.2. API availability does not guarantee identical native gesture behavior. Exact user device versions were requested and remain unknown at delivery.
- [MDN location.replace](https://developer.mozilla.org/en-US/docs/Web/API/Location/replace) replaces an entry rather than adding one. This removes a launcher Back destination, but does not block Back: our probe returns to the preceding outside document instead. It must not be presented as a complete fix.
- [Manifest display modes](https://w3c.github.io/manifest/#display-modes) concern presentation, not a native-gesture cancellation contract. [Chromium's Android architecture](https://chromium.googlesource.com/chromium/src/+/HEAD/components/webapps/docs/android_architecture.md#display-modes-and-immersive-mode) maps fullscreen WebAPKs to immersive presentation; that alone does not establish Back suppression on both platforms. Separately, this repository's `src/storage-scope.js` recognizes only initial standalone mode: blindly changing the manifest to fullscreen would select the browser save namespace. Do not do that as an untested workaround.

## Executed browser probe

Reproducible artifact: [T039-history-probe.mjs](T039-history-probe.mjs).

Command: `node .project/reports/T039-history-probe.mjs`. Uses installed Playwright and an ephemeral loopback HTTP server; no game build, persistent browser profile, real save or external endpoint. Final result: PASS for all four strategies and their assertions.

| Strategy | Measured history | Back/result |
| --- | --- | --- |
| Ordinary document link (current navigation pattern) | 2 → 3 | Returns to launcher; traversal `sameDocument:false`, `cancelable:false`. |
| `location.replace()` | 2 → 2 | Back leaves the tested app to `about:blank`; not a gesture fix. |
| Initially created iframe | 2 → 2 | Top stays on launcher; frame is the full 320px width. Does not itself solve OS Back at the app root. |
| Same-document game view using `pushState()` | 2 → 3 | Navigation API reports `sameDocument:true`, `cancelable:true`; programmatic Back rejects with `AbortError` after cancellation. Explicit Playground link still works. |

Initial probe used `page.goBack()` for a deliberately canceled same-document navigation and timed out waiting for a committed load. The final probe correctly asserts the cancellation through `navigation.back().finished`. The successful same-document row therefore proves **programmatic** cancellation, not a swipe or browser-toolbar Back. Other rows use browser history traversal through Playwright. No Android/iPhone, Safari or OS gesture simulation is claimed. `node --check .project/reports/T039-history-probe.mjs` and `git diff --check` also passed.

## Concrete next experiment

Prototype a PWA-only Playground shell for Solitaire: retain the launcher document; show the existing game in a borderless full-viewport iframe; use one real same-document game route (for example a fragment, to preserve reload behavior), not hidden dummy entries. Put a feature-detected navigation handler in the **top window**, with cancellation only when an actual card gesture is being protected. The existing Playground control must still provide an explicit exit.

This is a hypothesis requiring actual hardware, not authorization to ship an architectural change. Verify event arrival before the native transition, browser-initiated activation restrictions, repeated Back, iframe removal/lock release, saved state, PWA namespace, offline/update flow, refresh/deep links, focus, safe areas and pinch. Prefer a small opt-in prototype before changing the default launcher. If the OS claims input before DOM events, same-document cancellation will not necessarily restore the attempted card drag.

## Native control boundary

Apple exposes [WKWebView.allowsBackForwardNavigationGestures](https://developer.apple.com/documentation/webkit/wkwebview/allowsbackforwardnavigationgestures) to native hosts, not page JavaScript. Android exposes [system gesture exclusion rectangles](https://developer.android.com/develop/ui/views/touch-and-input/gestures/gesturenav); its [View API](https://developer.android.com/reference/android/view/View#setSystemGestureExclusionRects(java.util.List%3Candroid.graphics.Rect%3E)) normally limits vertical exclusion to 200dp, with exceptions such as sticky immersive mode. These are native integration options with their own constraints, not a PWA setting or a request to add a wrapper dependency now.

Conclusion: preserve production build `f016fa5c08a6`. Research establishes a specific same-document route to test and rejects location replacement/fullscreen/CSS as proven universal fixes. Original T039 remains unaccepted until an actual Android/iPhone gesture test passes with full-width readable cards.
