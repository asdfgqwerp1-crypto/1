(function () {
  'use strict';

  var SPOOF_HANDLER_NAMES = ['spoofFrameBridge', 'spoofExportBridge'];

  function isSpoofHandler(name) {
    if (!name || typeof name !== 'string') return false;
    if (SPOOF_HANDLER_NAMES.indexOf(name) >= 0) return true;
    return name.indexOf('spoof') === 0 || name.indexOf('Spoof') >= 0;
  }

  function hideGlobal(name) {
    try {
      var value = window[name];
      if (value === undefined) return;
      Object.defineProperty(window, name, {
        configurable: true,
        enumerable: false,
        writable: true,
        value: value
      });
    } catch (e) {}
  }

  function sanitizeMessageHandlers(handlers) {
    if (!handlers || typeof handlers !== 'object') return handlers;
    SPOOF_HANDLER_NAMES.forEach(function (name) {
      try { delete handlers[name]; } catch (e) {}
    });
    return handlers;
  }

  function installWebkitStealth() {
    if (window.__spoofWebkitStealthInstalled) return;
    window.__spoofWebkitStealthInstalled = true;

    try {
      var webkit = window.webkit;
      if (webkit && webkit.messageHandlers) {
        sanitizeMessageHandlers(webkit.messageHandlers);
        var original = webkit.messageHandlers;
        var proxy = new Proxy(original, {
          get: function (target, prop) {
            if (typeof prop === 'string' && isSpoofHandler(prop)) return undefined;
            var value = target[prop];
            return typeof value === 'function' ? value.bind(target) : value;
          },
          has: function (target, prop) {
            if (typeof prop === 'string' && isSpoofHandler(prop)) return false;
            return prop in target;
          },
          ownKeys: function (target) {
            return Reflect.ownKeys(target).filter(function (key) {
              return !isSpoofHandler(String(key));
            });
          },
          getOwnPropertyDescriptor: function (target, prop) {
            if (typeof prop === 'string' && isSpoofHandler(prop)) return undefined;
            return Object.getOwnPropertyDescriptor(target, prop);
          }
        });
        try {
          Object.defineProperty(webkit, 'messageHandlers', {
            configurable: true,
            enumerable: true,
            get: function () { return proxy; }
          });
        } catch (e) {
          webkit.messageHandlers = proxy;
        }
      }
    } catch (e) {}

    hideGlobal('__spoofWebkitStealthInstalled');
    hideGlobal('__safariSpoofInstalled');
    hideGlobal('__SAFARI_SPOOF_CONFIG__');
  }

  function sendControlViaFrame(url) {
    try {
      var iframe = document.createElement('iframe');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;top:-9999px;border:0';
      iframe.src = url;
      var root = document.body || document.documentElement;
      if (!root) return false;
      root.appendChild(iframe);
      setTimeout(function () {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 1500);
      return true;
    } catch (e) {
      return false;
    }
  }

  function sendControl(path, params) {
    var query = '';
    if (params) {
      query = Object.keys(params).map(function (key) {
        return encodeURIComponent(key) + '=' + encodeURIComponent(String(params[key]));
      }).join('&');
    }
    var url = 'spoofcontrol://' + path + (query ? '?' + query : '');
    try {
      fetch(url, {
        method: 'GET',
        mode: 'no-cors',
        credentials: 'omit',
        cache: 'no-store',
        keepalive: true
      }).catch(function () {});
    } catch (e) {}
    // WKWebView occasionally drops custom-scheme fetch; iframe backup reaches native reliably.
    setTimeout(function () {
      sendControlViaFrame(url);
    }, 80);
  }

  function sendControlPost(path, payload) {
    var url = 'spoofcontrol://' + path;
    var body = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
    try {
      fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        credentials: 'omit',
        cache: 'no-store',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: body
      }).catch(function () {});
      return true;
    } catch (e) {}
    return false;
  }

  installWebkitStealth();
  window.__spoofSendControl = sendControl;
  window.__spoofSendControlPost = sendControlPost;
  hideGlobal('__spoofSendControl');
  hideGlobal('__spoofSendControlPost');

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installWebkitStealth);
  }
  window.addEventListener('pageshow', installWebkitStealth);
})();