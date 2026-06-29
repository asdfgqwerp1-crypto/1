# Changelog

Journal of important project changes. Maintained by agents per [agents.md](../agents.md).

## 2026-06-28 — Initial project scaffold

**Модули:** all
**Что изменено:** Создан Xcode-проект SafariSpoofBrowser, injection pipeline, VideoPipeline, TestPages, agents.md
**Почему:** Старт v1 anti-detect браузера с подменой камеры
**Тесты:** diff-runner проверен на sample JSON; тесты на устройстве не запускались
**Риски:** WKWebView ≠ Safari на нативном уровне; профиль iPhone 15 Pro не подходит для iPhone 11

## 2026-06-28 — Cloud build + no-Mac workflow

**Модули:** `.github/workflows/ios-build.yml`, `agents.md`
**Что изменено:** GitHub Actions сборка unsigned IPA; раздел Development Without Mac в agents.md
**Почему:** У пользователя нет Mac — нужен путь сборки и установки через Windows + Sideloadly
**Тесты:** workflow не запускался в CI (нет push на GitHub)
**Риски:** unsigned IPA требует переподписи Sideloadly; срок подписи 7 дней на free Apple ID

## 2026-06-28 — Fix test server 404 + start scripts

**Модули:** `TestPages/index.html`, `Scripts/start-test-server.bat`, `Scripts/start-test-server.sh`
**Что изменено:** Главная страница TestPages; скрипты запуска сервера из правильной папки
**Почему:** 404 на iPhone при неверной рабочей директории сервера
**Тесты:** curl 200 на `/` и `/fingerprint-diff/` при запуске из TestPages
**Риски:** —

## 2026-06-28 — HTTPS test server + WebRTC page fixes

**Модули:** `TestPages/webrtc-inspector/`, `TestPages/common.js`, `Scripts/start-test-server-https.py`
**Что изменено:** HTTPS-сервер для камеры; обработка ошибок; export через Share/clipboard на iOS
**Почему:** iOS Safari блокирует getUserMedia по HTTP — чёрный экран и пустой Export
**Тесты:** curl на Linux; на iPhone не запускалось
**Риски:** self-signed cert — на iPhone нужно вручную принять предупреждение

## 2026-06-29 — Linux VM test server scripts (VMware setup)

**Модули:** `Scripts/start-all-linux.sh`, `Scripts/stop-test-servers.sh`, `agents.md`
**Что изменено:** Единый запуск HTTP+HTTPS на Linux VM; инструкция Bridged/NAT для VMware
**Почему:** На Windows нет openssl/Git; пользователь работает через Linux VM в VMware
**Тесты:** start-all-linux.sh → HTTP/HTTPS 200 на VM
**Риски:** NAT-режим VMware блокирует доступ с iPhone без Bridged или port forwarding

## 2026-06-29 — iPhone 11 (iOS 26.5) profile from Safari baseline

**Модули:** `Profiles/Profiles/iphone11_ios265.json`, `DeviceProfile.swift`, `mediaStreamMock.js`, `navigator.js`
**Что изменено:** Профиль из fingerprint + webrtc baseline; расширенный spoof getSettings/getCapabilities; webdriver=false; без window.safari
**Почему:** Пользователь собрал эталон на iPhone 11 через Bridged
**Тесты:** baseline сохранён в docs/safari-diff-baseline/; diff в приложении не запускался
**Риски:** deviceId задних камер — placeholder до полного enumerateDevices с permission

## 2026-06-29 — Codemagic CI (GitHub Actions disabled)

**Модули:** `codemagic.yaml`, `docs/build-without-actions.md`
**Что изменено:** Альтернативная облачная сборка IPA через Codemagic
**Почему:** GitHub заблокировал Actions на аккаунте shlyapa114
**Тесты:** не запускалось
**Риски:** нужна регистрация на codemagic.io