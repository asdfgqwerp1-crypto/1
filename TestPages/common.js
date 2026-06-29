function isSecureContextForMedia() {
  return window.isSecureContext === true;
}

function checkMediaEnvironment() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return { ok: false, message: 'mediaDevices API недоступен в этом браузере.' };
  }
  if (!isSecureContextForMedia()) {
    return {
      ok: false,
      message: 'Камера заблокирована: нужен HTTPS.\n\n'
        + 'Откройте страницу как:\n'
        + 'https://ВАШ_IP:8443/webrtc-inspector/\n\n'
        + 'Запуск на ПК:\n'
        + 'Scripts/start-test-server-https.bat'
    };
  }
  return { ok: true, message: '' };
}

function showOutput(text) {
  document.getElementById('output').textContent = text;
}

async function exportReport(report, filename) {
  if (!report) {
    alert('Сначала запустите тест (Collect / Start Camera Test / Measure).');
    return;
  }

  const json = JSON.stringify(report, null, 2);

  if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.spoofExportBridge) {
    window.webkit.messageHandlers.spoofExportBridge.postMessage({ filename: filename, json: json });
    return;
  }

  if (navigator.share) {
    try {
      const file = new File([json], filename, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return;
      }
      await navigator.share({ title: filename, text: json });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }

  try {
    await navigator.clipboard.writeText(json);
    alert('JSON скопирован. Вставьте в Notes → Share → Save to Files.');
    return;
  } catch (e) {}

  const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
  const opened = window.open(dataUrl, '_blank');
  if (opened) return;

  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
}