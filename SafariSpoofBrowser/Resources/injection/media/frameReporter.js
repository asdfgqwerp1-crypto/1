(function () {
  'use strict';
  try {
    if (window.__spoofHookNavigatorMediaDevices) {
      window.__spoofHookNavigatorMediaDevices();
    }
    var md = navigator.mediaDevices;
    var patched = !!(md && md.__spoofMediaPatched);
    var installed = !!window.__safariSpoofInstalled;
    var hasSend = typeof window.__spoofSendControl === 'function';
    var label = window === window.top ? 'TOP' : 'IFRAME';
    var msg = label + ' installed=' + installed + ' patched=' + patched + ' send=' + hasSend + ' ' + (location.href || '');
    if (hasSend) {
      window.__spoofSendControl('debug/log', { level: 'info', message: msg, source: 'probe' });
    } else if (window.__spoofTrace) {
      window.__spoofTrace('info', msg, 'probe');
    }
  } catch (e) {
    try {
      if (window.__spoofSendControl) {
        window.__spoofSendControl('debug/log', {
          level: 'error',
          message: 'frameReporter err: ' + (e && e.message ? e.message : String(e)),
          source: 'probe'
        });
      }
    } catch (e2) {}
  }
})();