(function () {
  'use strict';

  function trace(level, message, source) {
    try {
      var text = String(message);
      if (text.length > 1500) text = text.slice(0, 1500) + '…';
      if (window.__spoofSendControl) {
        window.__spoofSendControl('debug/log', {
          level: level || 'info',
          message: text,
          source: source || 'spoof'
        });
        return;
      }
      if (window.__spoofSendControlPost) {
        window.__spoofSendControlPost('debug/log', {
          level: level || 'info',
          message: text,
          source: source || 'spoof'
        });
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

  trace('info', 'spoofTrace ready @ ' + (location && location.href ? location.href : 'unknown'), 'inject');
})();