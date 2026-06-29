# Сборка IPA без GitHub Actions

GitHub отключил Actions на аккаунте — используйте один из вариантов ниже.

## Вариант 1 — Codemagic (рекомендуется, бесплатно)

1. Зарегистрируйтесь: https://codemagic.io/signup (через GitHub)
2. **Add application** → выберите репозиторий `shlyapa114/ios-spoofing`
3. Codemagic найдёт `codemagic.yaml` в корне
4. **Start new build** → ветка `main`
5. После сборки (~10 мин) → **Artifacts** → скачайте `SafariSpoofBrowser.ipa`
6. Windows + **Sideloadly** → установка на iPhone

Подпись: unsigned IPA — Sideloadly переподпишет вашим Apple ID.

---

## Вариант 2 — Аренда Mac (1 час)

- MacinCloud, MacStadium (~$1–5/час)
- Скачать проект → Xcode → Product → Archive → Distribute → Development → IPA
- Sideloadly на Windows

---

## Вариант 3 — Попросить собрать

Передать zip проекта тому, у кого есть Mac + Xcode.

---

## Sideloadly (установка на iPhone)

1. Скачать `.ipa` на Windows
2. iPhone USB → доверить компьютеру
3. Установить iTunes / Apple Devices (драйверы)
4. Sideloadly → перетащить IPA → Apple ID → **Start**
5. iPhone: **Настройки → VPN и управление устройством** → доверить
6. Запустить **SafariSpoof** → Settings → **iPhone 11 (iOS 26.5)**

Подпись бесплатного Apple ID: ~7 дней, потом переустановить.