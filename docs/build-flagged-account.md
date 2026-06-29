# Сборка при заблокированном GitHub

Симптомы:
- GitHub Actions отключены
- `This account is flagged, and therefore cannot authorize a third party application`

OAuth-сервисы (Codemagic через GitHub, Bitrise) **не подойдут**. Варианты ниже.

---

## Вариант A — Облачный Mac + zip (рекомендуется)

### 1. Упаковать проект (Linux VM)

```bash
cd "/mnt/hgfs/IOS SPOOFING"
./Scripts/package-for-mac.sh
```

Файл: `ios-spoofing-build.zip` (в корне проекта, виден на Windows в папке IOS SPOOFING).

### 2. Арендовать Mac на 1 час

- https://www.macincloud.com (от ~$4/час)
- https://www.macstadium.com
- Любой VPS с macOS

Регистрация **не через GitHub** — email на сервисе.

### 3. На облачном Mac

1. Загрузить `ios-spoofing-build.zip` (браузер / Google Drive / USB)
2. Распаковать
3. Открыть `SafariSpoofBrowser/SafariSpoofBrowser.xcodeproj` в **Xcode**
4. Меню **Product → Build** (⌘B) — проверка
5. Подключить iPhone по USB **или** собрать IPA:
   - **Product → Archive**
   - **Distribute App → Development** → сохранить `.ipa`
6. Скачать IPA на Windows → **Sideloadly**

### 4. Сборка из терминала (без Archive)

```bash
cd SafariSpoofBrowser
xcodebuild -project SafariSpoofBrowser.xcodeproj \
  -scheme SafariSpoofBrowser \
  -destination 'generic/platform=iOS' \
  -configuration Release \
  CODE_SIGNING_ALLOWED=NO \
  build

# IPA вручную:
APP=$(find ~/Library/Developer/Xcode/DerivedData -name "SafariSpoofBrowser.app" -type d | head -1)
mkdir -p /tmp/ipa/Payload && cp -r "$APP" /tmp/ipa/Payload/
cd /tmp/ipa && zip -r ~/Desktop/SafariSpoofBrowser.ipa Payload
```

---

## Вариант B — Codemagic без GitHub OAuth

1. Регистрация на https://codemagic.io через **email** (не «Sign up with GitHub»)
2. **Add application** → **Other** → URL репозитория:
   ```
   https://github.com/shlyapa114/ios-spoofing.git
   ```
   (публичный репо — клонирование без OAuth)
3. Указать ветку `main`, файл `codemagic.yaml`
4. Start build → скачать IPA

Если Codemagic всё равно требует GitHub — используйте Вариант A.

---

## Вариант C — Другой человек с Mac

Отправить `ios-spoofing-build.zip` → собрать IPA → вернуть файл для Sideloadly.

---

## Установка (Windows + Sideloadly)

1. iTunes / Apple Devices установлены
2. iPhone USB
3. Sideloadly → IPA → Apple ID → Start
4. iPhone: доверить разработчику в Настройках
5. SafariSpoof → Settings → iPhone 11 (iOS 26.5)

---

## Новый GitHub-аккаунт?

Создание аккаунта только ради CI часто тоже блокируется. Надёжнее **Вариант A** (облачный Mac + zip).