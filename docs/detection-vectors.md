# Detection Vectors Checklist

Known vectors used by fingerprint services, WebRTC inspectors, and KYC providers.

## Fingerprint

| Vector | Status | Notes |
|--------|--------|-------|
| `navigator.userAgent` | Patched | From profile, synced with WKWebView customUserAgent |
| `navigator.platform` | Patched | Must be `iPhone` |
| `navigator.vendor` | Patched | `Apple Computer, Inc.` |
| `navigator.webdriver` | Patched | Must be undefined |
| `navigator.maxTouchPoints` | Patched | 5 for iPhone |
| `navigator.hardwareConcurrency` | Patched | Matches SoC core count |
| `screen.width/height` | Patched | CSS pixels, not physical |
| `devicePixelRatio` | Patched | 2 or 3 per device |
| WebGL vendor/renderer | Patched | Apple GPU strings |
| Canvas hash | Patched | Deterministic noise per profile seed |
| AudioContext sampleRate | Patched | 48000 Hz typical |
| `window.safari` | Patched | Stub object present |

## Media / Camera

| Vector | Status | Notes |
|--------|--------|-------|
| `getUserMedia` source | Intercepted | Returns canvas.captureStream, not native camera |
| `enumerateDevices` labels | Patched | iOS-specific: "Front Camera", "Back Triple Camera" |
| `deviceId` / `groupId` | Patched | Stable per profile |
| `track.getSettings()` | Patched | width, height, frameRate, facingMode, deviceId |
| `track.getCapabilities()` | Patched | iPhone resolution ranges |
| `track.label` | Patched | Matches iOS camera name |
| Canvas default 300x150 | Mitigated | Canvas pre-sized to profile resolution |
| Frame timing jitter | Mitigated | Native bridge targets 30fps with natural variance |
| Permission prompt timing | Mitigated | 50–200ms delay |

## WebRTC

| Vector | Status | Notes |
|--------|--------|-------|
| SDP codec list | Native | Not modified; WebKit handles |
| ICE candidates | Native | Not modified |
| Synthetic track detection | Risk | Advanced ML may detect canvas origin |

## Known Unfixable (v1)

| Vector | Reason |
|--------|--------|
| WKWebView internal markers | No jailbreak access to WebKit internals |
| TrueDepth / Face ID metadata | Not available in web API spoof |
| Native KYC SDK camera path | Bypasses JavaScript entirely |

## Regression Priority

1. Critical: navigator, screen, WebGL, UA, camera metadata
2. High: frame timing, permission behavior
3. Medium: canvas hash stability, audio fingerprint
4. Low: Client Hints (rare on iOS Safari)