(function () {
  'use strict';

  function trace(level, message, source) {
    try {
      if (window.__spoofSendControlPost) {
        window.__spoofSendControlPost('debug/log', {
          level: level || 'info',
          message: String(message),
          source: source || 'spoof'
        });
        return;
      }
    } catch (e) {}
  }

  window.__spoofTrace = trace;

  try {
    Object.defineProperty(window, '__spoofTrace', {
      value: trace,
      enumerable: false,
      configurable: true,
      writable: true
    });
  } catch (e) {}
})();