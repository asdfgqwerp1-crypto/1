# Detection Vectors Checklist

Known vectors used by fingerprint services, WebRTC inspectors, and KYC providers.

## Safari vs WKWebView — что видит сайт

| Уровень проверки | Вердикт для SafariSpoof v15 |
|------------------|----------------------------|
| Fingerprint diff (navigator, screen, WebGL, UA) | **Близко к Safari** — PASS на iPhone 11 baseline |
| WebRTC metadata (deviceId, getSettings, enumerateDevices) | **Как Safari** — при актуальном профиле |
| Обычный KYC web (getUserMedia + upload selfie) | **Скорее как Safari** — metadata OK, живое видео с реальной камеры |
| CreepJS / BrowserLeaks fingerprint | **Частично** — нет 100% совпадения WKWebView≡Safari |
| WebRTC getStats / ML liveness | **Риск** — canvas pipeline, синтетический audio |
| Native KYC SDK (не web) | **FAIL** — обходит JS, вне scope |

**Вывод:** для типичного сайта, который смотрит UA + fingerprint + camera labels/deviceId — браузер выглядит как Safari на iPhone 11. Продвинутый антифрод может заметить canvas-stream и нестандартный WKWebView.

## Fingerprint

| Vector | Status | Notes |
|--------|--------|-------|
| `navigator.userAgent` | Patched | From profile, synced with WKWebView customUserAgent |
| `navigator.platform` | Patched | Must be `iPhone` |
| `navigator.vendor` | Patched | `Apple Computer, Inc.` |
| `navigator.webdriver` | Patched | `false` per iOS 26 Safari baseline |
| `navigator.maxTouchPoints` | Patched | 5 for iPhone |
| `navigator.hardwareConcurrency` | Patched | Matches SoC core count |
| `screen.width/height` | Patched | CSS pixels, not physical |
| `window.innerWidth/innerHeight` | Patched v17 | Profile viewport (Safari layout, not WKWebView chrome) |
| `window.outerHeight` | Patched v18 | 896 on iPhone 11 (screen height, not inner) |
| `Screen.prototype` width/height | Patched v18 | Instance patch broke BL → prototype patch |
| `div.clientHeight` probe | Patched v18 | Element.prototype + layout-leak heuristic |
| `visualViewport` / `clientWidth` | Patched v17–v18 | Matches inner dimensions from profile |
| `devicePixelRatio` | Patched | 2 or 3 per device |
| WebGL vendor/renderer | Patched | Apple GPU strings |
| Canvas hash | Patched | Deterministic noise per profile seed |
| AudioContext sampleRate | Patched | 48000 Hz typical |
| `window.safari` | Off | Profile `emulateSafariObject: false` matches iPhone 11 baseline |

## Media / Camera

| Vector | Status | Notes |
|--------|--------|-------|
| `getUserMedia` source | Intercepted | Real camera → NV12 (v19) or JPEG fallback → canvas → captureStream |
| Frame PTS monotonicity | Patched v19 | CMSampleBuffer presentationTime → X-Frame-PTS-Us |
| JPEG compression artifacts | Mitigated v19 | NV12 path skips JPEG when frameDelivery=nv12 |
| `enumerateDevices` labels | Patched v29.10.6 | Pre-gUM: profile camera labels + empty deviceIds (Regula/KYC); post-gUM: full profile devices (never native) |
| `deviceId` / `groupId` | Patched | Stable per profile; prototype getSettings |
| `track.getSettings()` | Patched | width, height, frameRate, facingMode, deviceId |
| `track.getCapabilities()` | Patched | iPhone resolution ranges |
| `track.label` | Patched | Matches iOS camera name |
| `getSettings.toString()` | Patched v15 | Returns `[native code]` |
| `applyConstraints` | Patched v15 | Resolves on spoofed tracks |
| `__spoof*` globals | Mitigated v15 | Non-enumerable on window |
| Canvas stream origin | Risk | Advanced: canvas.captureStream vs AVFoundation |
| Frame timing regularity | Patched v29 | VFR ~30fps target + exposure hitch + slowdown bursts; min 24fps |
| Frame sensor noise | Patched v29 | read+shot+chroma noise per frame (profile seed); scratch→drawImage |
| Resolution presets | Patched v29 | vga/hd/fhd presets; gUM constraints → native encode + getSettings |
| Permission prompt timing | Mitigated | 50–200ms delay |
| Synthetic audio | Patched v16 metadata / Risk spectrum | audio-only + video+audio return profile deviceId; silent oscillator — not real mic spectrum |
| `navigator.mediaDevices` race | Mitigated v16 | Getter hook + prototype patch at documentStart |
| Legacy `webkitGetUserMedia` | Patched v16 | Routed through spoof handler |

## WebRTC

| Vector | Status | Notes |
|--------|--------|-------|
| SDP codec list | Native | WebKit handles |
| ICE candidates | Native | Not modified |
| RTCRtpSender.getStats | Risk | May differ canvas vs direct camera |
| ML liveness (blink, depth) | Risk | Video is real face but re-encoded via JPEG |

## CSP / Strict Sites (v29.11)

| Vector | Status | Notes |
|--------|--------|-------|
| Strict CSP blocks `spoofcontrol://` / `spoofframe://` | Mitigated v29.11 | Primary transport: `webkit.messageHandlers.ssbControl` + native JPEG push |
| Regula faceapi.regulaforensics.com | Mitigated v29.11 | CSP connect-src/frame-src allowlist only |

## WKWebView Stealth (v29.8)

| Vector | Status | Notes |
|--------|--------|-------|
| `window.webkit.messageHandlers.spoofFrameBridge` | Patched v29.8 | Handlers removed; JS→native via `spoofcontrol://` scheme |
| `window.webkit.messageHandlers.spoofExportBridge` | Patched v29.8 | Export via `spoofcontrol://export` POST |
| `webkit.messageHandlers` enumeration | Mitigated v29.8 | Proxy hides spoof* handler names if present |
| Custom URL schemes (`spoofframe`, `spoofcontrol`) | Mitigated v29.10 | Requests without profile `schemeAuthKey` (`k=` query) fail like unknown host; page probes should not get 200 |
| `permissions.query({name:'camera'})` | Patched v29.10 | Returns `granted` for camera/microphone |
| `webkit.messageHandlers` Proxy getter | Mitigated v29.10 | Proxy only installed when legacy spoof handlers present; otherwise untouched |

## Known Unfixable (v1)

| Vector | Reason |
|--------|--------|
| WKWebView internal markers | No jailbreak access to WebKit internals |
| TrueDepth / Face ID metadata | Not available in web API spoof |
| Native KYC SDK camera path | Bypasses JavaScript entirely |
| 100% byte-identical Safari WebKit | Apple does not ship Safari engine to third-party apps |

## Regression Priority

1. Critical: navigator, screen, WebGL, UA, camera metadata
2. High: frame timing jitter, permission behavior, repeat gUM
3. Medium: canvas hash stability, toString hardening
4. Low: Client Hints (rare on iOS Safari)