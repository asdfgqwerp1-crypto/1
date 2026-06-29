# VMware NAT — доступ с iPhone

## Почему не работает

При **NAT** IP VM (`192.168.16.129`) — это **внутренняя** сеть VMware.
iPhone в Wi‑Fi (`192.168.1.x` и т.д.) **не может** открыть этот адрес напрямую.

## Решение 1 — Bridged (проще всего)

1. **Выключить** Linux VM (Power Off)
2. VMware → **VM → Settings → Network Adapter**
3. **Bridged** + галочка **Replicate physical network connection**
4. Запустить VM
5. `./Scripts/start-all-linux.sh` — взять **новый IP** из вывода
6. На iPhone: `http://НОВЫЙ_IP:8080/...`

---

## Решение 2 — Port Forwarding (оставить NAT)

Пробросить порты с **Windows-хоста** на VM.

### Шаг A — IP VM (гостя)

В Linux VM:
```bash
hostname -I
# обычно 192.168.16.129
```

### Шаг B — VMware Virtual Network Editor

1. VMware Workstation → **Edit → Virtual Network Editor**
2. Выберите сеть **VMnet8 (NAT)** → **NAT Settings...**
3. **Add** два правила:

| Host port | Type | Virtual machine IP | Virtual port | Description |
|-----------|------|-------------------|--------------|-------------|
| 8080 | TCP | 192.168.16.129 | 8080 | SafariSpoof HTTP |
| 8443 | TCP | 192.168.16.129 | 8443 | SafariSpoof HTTPS |

4. OK → Apply

*(Нужны права администратора на Windows)*

### Шаг C — IP Windows в Wi‑Fi

На **Windows** (cmd):
```bat
ipconfig
```
Найдите **IPv4** адаптера Wi‑Fi (например `192.168.1.100`).

### Шаг D — URL на iPhone

Не адрес VM! Адрес **Windows**:

- `http://192.168.1.100:8080/fingerprint-diff/`
- `https://192.168.1.100:8443/webrtc-inspector/`

### Шаг E — Firewall Windows

Разрешить входящие TCP **8080** и **8443**:
- Панель управления → Брандмауэр → Доп. параметры → Правила для входящих → Создать → Порт → TCP 8080, 8443

---

## Проверка с iPhone

1. VM: `./Scripts/status-test-servers.sh` → RUNNING
2. Windows: браузер `http://localhost:8080/` — если VMware forward работает, откроется страница
3. iPhone в той же Wi‑Fi: `http://IP_WINDOWS:8080/`