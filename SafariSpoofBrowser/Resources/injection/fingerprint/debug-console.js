(function () {
  'use strict';
  if (window.__spoofDebugConsoleInstalled) return;
  window.__spoofDebugConsoleInstalled = true;

  var MAX_LEN = 4000;

  function truncate(value) {
    var text = value === null || value === undefined ? '' : String(value);
    return text.length > MAX_LEN ? text.slice(0, MAX_LEN) + '…' : text;
  }

  function formatArgs(args) {
    return Array.prototype.map.call(args, function (item) {
      if (item instanceof Error) {
        return item.stack || item.message || String(item);
      }
      if (typeof item === 'object') {
        try { return JSON.stringify(item); } catch (e) { return String(item); }
      }
      return String(item);
    }).join(' ');
  }

  function emit(level, message, source) {
    var payload = {
      level: level,
      message: truncate(message),
      source: source || 'page'
    };
    if (window.__spoofSendControl) {
      window.__spoofSendControl('debug/log', payload);
      return;
    }
    if (window.__spoofSendControlPost) {
      window.__spoofSendControlPost('debug/log', payload);
    }
  }

  function wrapConsole(level, original) {
    return function () {
      try {
        emit(level, formatArgs(arguments), 'console.' + level);
      } catch (e) {}
      return original.apply(console, arguments);
    };
  }

  ['log', 'info', 'warn', 'error', 'debug'].forEach(function (level) {
    if (!console[level]) return;
    var original = console[level].bind(console);
    console[level] = wrapConsole(level, original);
  });

  var lastOnErrorKey = '';
  var lastOnErrorAt = 0;
  window.addEventListener('error', function (event) {
    var msg = (event.message || 'Script error') +
      (event.filename ? ' @ ' + event.filename : '') +
      (event.lineno ? ':' + event.lineno : '');
    var now = Date.now();
    if (msg === lastOnErrorKey && now - lastOnErrorAt < 3000) return;
    lastOnErrorKey = msg;
    lastOnErrorAt = now;
    emit('error', msg, 'window.onerror');
  });

  window.addEventListener('unhandledrejection', function (event) {
    var reason = event.reason;
    var text = reason instanceof Error ? (reason.stack || reason.message) : String(reason);
    emit('error', 'Unhandled rejection: ' + text, 'promise');
  });

  try {
    Object.defineProperty(window, '__spoofDebugConsoleInstalled', {
      configurable: true,
      enumerable: false,
      writable: true,
      value: true
    });
  } catch (e) {}
})();