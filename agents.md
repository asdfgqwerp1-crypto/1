# SafariSpoofBrowser — Agent Guide

Operational guide for AI agents developing and testing the iOS anti-detect browser with camera spoofing.

## Project Goal

Build a standalone iOS WKWebView browser that is **indistinguishable from Safari** for fingerprint and camera APIs. Camera video is replaced in realtime via a native→JS pipeline without jailbreak.

### Success Criteria (v1)

- 0 FAIL on critical signals in Safari diff tests (navigator, screen, WebGL, UA, camera metadata)
- `enumerateDevices()` returns iOS camera labels from active profile
- `getSettings()` on video track matches profile `mediaCapabilities`
- Realtime spoof ≥ 24 fps with natural timing jitter
- No automation/WebDriver markers on CreepJS/BrowserLeaks

## Architecture

```
SafariSpoofBrowser/
├── App/              SwiftUI shell, settings, operator UI
├── Browser/          WKWebView wrapper, navigation, coordinator
├── Profiles/         Device fingerprint profiles (JSON + Swift loader)
├── Injection/        WKUserScript bundling and injection
├── VideoPipeline/    AVFoundation capture, network ingest, frame processing
├── Bridge/           WKScriptMessageHandler frame transport
└── Resources/injection/
    ├── fingerprint/  navigator, screen, WebGL, canvas, audio patches
    ├── media/        getUserMedia intercept, MediaStream synthesis
    └── webrtc/       enumerateDevices, track metadata spoofing
```

### Data Flow

1. **ProfileEngine** loads `DeviceProfile` JSON → configures User-Agent, viewport, JS config
2. **InjectionManager** injects bundled JS at `documentStart` (all frames)
3. **VideoPipeline** captures realtime video → encodes frames → **FrameBridge** → JS canvas
4. Site calls `getUserMedia()` → intercepted → returns `canvas.captureStream()` with spoofed metadata

### Single Source of Truth

`DeviceProfile` JSON drives **both** native (User-Agent, frame dimensions) and JS (navigator, WebGL, camera labels). Never hardcode fingerprint values outside profiles.

## Agent Autonomy

**Работай самостоятельно** — не спрашивай подтверждение на каждый шаг. Уточнение у пользователя требуется **только при координальных архитектурных вопросах**, например:

- Смена базового подхода (jailbreak vs standalone, другой механизм подмены камеры)
- Замена ключевого стека (WKWebView → другой движок, отказ от profile-based fingerprint)
- Изменение scope v1 (убрать WebRTC spoof, отказаться от realtime pipeline)
- Компромисс, влияющий на незаметность 1в1 (например, отказ от перехвата `getUserMedia`)

Во всех остальных случаях — реализуй, тестируй, логируй, двигайся дальше без запроса одобрения.

## Change Logging

**Все важные изменения обязаны логироваться.** Агент ведёт журнал в `docs/changelog.md` (создать, если файла нет).

### Что логировать (обязательно)

- Новые/изменённые device profiles
- Изменения injection-скриптов (fingerprint, media, webrtc)
- Правки VideoPipeline / FrameBridge (формат кадров, FPS, latency)
- Обнаруженные векторы детекта и их статус (patched / risk / unfixable)
- Результаты diff-тестов против Safari baseline (PASS/WARN/FAIL summary)
- Архитектурные решения и причина выбора

### Формат записи

```markdown
## YYYY-MM-DD — Краткий заголовок

**Модули:** `Profiles/`, `Resources/injection/media/`
**Что изменено:** ...
**Почему:** ...
**Тесты:** diff-runner → 0 FAIL; webrtc-inspector → OK
**Риски:** ...
```

### Правила

- Лог пишется **до или сразу после** коммита, не откладывать
- Одна запись = одна логическая задача
- Если тест не прогнан на устройстве — указать явно: `Тесты: не запускались (нет устройства)`
- Не логировать мелочи (форматирование, переименование без изменения поведения)

## Agent Workflow

### 1. Before Making Changes

- Read the module you are touching and its dependencies
- Check `docs/detection-vectors.md` for related detection risks
- Confirm changes preserve profile consistency (Swift ↔ JS)
- If the change is important (see Change Logging), plan the `docs/changelog.md` entry

### 2. Development Loop

```bash
# On macOS with Xcode installed:
cd SafariSpoofBrowser
xcodebuild -scheme SafariSpoofBrowser -destination 'platform=iOS,name=YOUR_DEVICE' build

# Serve test pages locally (for simulator/device on same network):
cd ../TestPages
python3 -m http.server 8080

# Run fingerprint diff (after collecting Safari baseline):
cd ../Scripts
./diff-runner.sh docs/safari-diff-baseline/iphone15pro.json path/to/spoof-report.json
```

### 3. After Making Changes

Run regression checklist (see below). Update `docs/detection-vectors.md` if you discover new detection vectors. **Add entry to `docs/changelog.md`** for every important change.

### 4. Commit Rules

- One logical change per commit
- Never commit real KYC credentials or production URLs
- Include test evidence for fingerprint/media changes (diff report snippet)

## Build & Run

| Action | Command |
|--------|---------|
| Build (device) | `xcodebuild -scheme SafariSpoofBrowser -destination 'generic/platform=iOS' build` |
| Build (simulator) | `xcodebuild -scheme SafariSpoofBrowser -destination 'platform=iOS Simulator,name=iPhone 15 Pro' build` |
| Run unit tests | `xcodebuild test -scheme SafariSpoofBrowser -destination 'platform=iOS Simulator,name=iPhone 15 Pro'` |
| Serve test pages | `python3 -m http.server 8080` from `TestPages/` |
| Cloud build (no Mac) | Push to GitHub → Actions workflow `ios-build.yml` → скачать IPA из Artifacts |

**Important:** Camera and fingerprint tests **must** run on a **real iPhone**. Simulator lacks real camera and produces false fingerprints.

## Development Without Mac

Xcode работает **только на macOS**. Без Mac локальная сборка невозможна. Доступные пути:

### Схема: Windows + Linux VM (VMware) + iPhone

Тест-серверы запускать **в Linux VM**, не на Windows (там нет openssl без Git).

```bash
cd "/mnt/hgfs/IOS SPOOFING"
./Scripts/start-all-linux.sh
```

Скрипт выведет IP VM и URL. **iPhone должен достучаться до VM:**

| Режим VMware | Что делать |
|--------------|------------|
| **Bridged** (рекомендуется) | VM получает IP в вашей Wi‑Fi (например `192.168.1.x`) — открывать на iPhone этот IP |
| **NAT** (по умолчанию) | iPhone **не видит** IP VM (`192.168.16.x`). Варианты: переключить на Bridged **или** Port Forwarding в VMware Virtual Network Editor (порты 8080, 8443 → IP VM) и на iPhone использовать **IP Windows-хоста** |

### Что можно сделать сразу (Linux VM + iPhone)

1. `./Scripts/start-all-linux.sh` в Linux VM
2. iPhone в той же Wi‑Fi → Safari → fingerprint (HTTP :8080), webrtc (HTTPS :8443)
3. Diff на VM или Windows: `Scripts/diff-runner.sh baseline.json spoof.json`

Это не требует Mac и нужно **до** теста приложения — для эталонного fingerprint.

### Как получить приложение на iPhone без Mac

**Вариант A — GitHub Actions (рекомендуется, бесплатно для public repo)**

1. Залить проект на GitHub
2. Actions → workflow **iOS Build** соберёт unsigned IPA
3. Скачать `SafariSpoofBrowser-unsigned-ipa` из Artifacts
4. На **Windows**: [Sideloadly](https://sideloadly.io/) + USB + Apple ID → установить IPA на iPhone
5. На iPhone: Настройки → Основные → VPN и управление устройством → доверить разработчику

Сертификат Sideloadly действует ~7 дней (бесплатный Apple ID), потом переустановить.

**Вариант B — Аренда облачного Mac (1 сессия)**

- MacinCloud, MacStadium, Scaleway Mac Mini (~$1–5 за час)
- Полный Xcode: сборка, установка по USB, отладка

**Вариант C — Попросить собрать на Mac**

- Передать репозиторий, установить через Xcode на iPhone по USB

### Ограничения без Mac

- Нет локальной отладки Xcode / Instruments
- Переустановка через Sideloadly при истечении подписи
- Профиль устройства нужно собрать из Safari baseline на реальном iPhone 11

## Testing Matrix

| Test | Simulator | Real Device | Priority |
|------|-----------|-------------|----------|
| fingerprint-diff | Partial (no real WebGL GPU) | Required | Critical |
| webrtc-inspector | Partial | Required | Critical |
| media-timing | No (no camera) | Required | Critical |
| permission-behavior | Partial | Required | High |
| CreepJS / BrowserLeaks | Partial | Required | High |
| KYC sandbox | No | Required | Medium |

### Collecting Safari Baseline

1. On target iPhone, open Safari
2. Navigate to `http://<dev-machine-ip>:8080/fingerprint-diff/`
3. Tap "Export JSON" → save to `docs/safari-diff-baseline/<profile-id>.json`
4. Repeat for webrtc-inspector, media-timing

### Running Diff

1. Open same pages in SafariSpoofBrowser with matching profile selected
2. Export JSON from each test page
3. Run `Scripts/diff-runner.sh baseline.json spoof.json`
4. Fix all FAIL items before proceeding

## Regression Checklist (pre-commit)

- [ ] Active profile User-Agent matches `navigator.userAgent` in JS
- [ ] `screen.width/height/devicePixelRatio` match profile
- [ ] WebGL vendor/renderer match profile
- [ ] `enumerateDevices()` returns profile cameras with correct labels
- [ ] Video track `getSettings()` returns profile resolution and frameRate
- [ ] Frame bridge delivers ≥ 24 fps on device
- [ ] No `navigator.webdriver === true`
- [ ] Permission prompt delay 50–200 ms
- [ ] Profile switch does not leak previous profile values

## Module Ownership

| Module | Responsibility | Do NOT |
|--------|---------------|--------|
| `Profiles/` | Profile schema, loading, validation | Inject JS directly |
| `Injection/` | Script bundling, injection timing | Modify fingerprint values |
| `Resources/injection/fingerprint/` | Navigator/screen/WebGL patches | Touch native video code |
| `Resources/injection/media/` | getUserMedia intercept | Hardcode device IDs |
| `VideoPipeline/` | Capture, resize, encode | Modify WKWebView config |
| `Bridge/` | Frame transport, metrics | Parse or modify web content |
| `Browser/` | WKWebView lifecycle, navigation | Store profile data |
| `App/` | UI, settings, operator controls | Implement spoofing logic |

## Adding a New Device Profile

1. Copy `Profiles/Profiles/iphone15pro_ios174.json` as template
2. Fill accurate Safari User-Agent for target iOS version
3. Set screen, WebGL, camera labels from real device capture
4. Generate stable `deviceId` hashes (use `Scripts/generate-device-ids.sh`)
5. Collect Safari baseline on that device
6. Verify 0 FAIL diff

## Debugging Tips

- Enable verbose logging: `BrowserCoordinator.logLevel = .debug` in DEBUG builds
- Check frame bridge FPS in operator UI status bar
- Use webrtc-inspector page to dump track properties live
- If site still accesses real camera, check for iframe injection (`forMainFrameOnly: false` is required)

## Known Limitations (v1)

- WKWebView is not 100% identical to Safari at native level; some diffs are documented in `docs/detection-vectors.md`
- Canvas-based MediaStream may be detected by advanced ML liveness; mitigated via correct metadata and timing
- Native KYC SDKs (non-web) are out of scope
- RTMP ingest is MVP; full OBS Virtual Camera equivalent is not possible on iOS without jailbreak

## File Index

| Path | Purpose |
|------|---------|
| `agents.md` | This file |
| `docs/changelog.md` | Journal of important changes (agent-maintained) |
| `docs/detection-vectors.md` | Detection vector checklist |
| `docs/safari-diff-baseline/` | Safari reference fingerprints |
| `TestPages/` | Local HTML test suite |
| `Scripts/diff-runner.sh` | Baseline comparison tool |
| `Scripts/bundle-injection.sh` | Concatenate JS modules for injection |