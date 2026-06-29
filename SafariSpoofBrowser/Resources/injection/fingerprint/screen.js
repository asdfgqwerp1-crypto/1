(function () {
  'use strict';
  var config = window.__SAFARI_SPOOF_CONFIG__;
  if (!config || !config.screen) return;

  var s = config.screen;
  var v = s.viewport || {};
  var innerW = v.innerWidth != null ? v.innerWidth : s.width;
  var innerH = v.innerHeight != null ? v.innerHeight : s.height;
  var outerW = v.outerWidth != null ? v.outerWidth : innerW;
  var outerH = v.outerHeight != null ? v.outerHeight : innerH;

  var define = function (obj, prop, value) {
    if (!obj) return;
    try {
      Object.defineProperty(obj, prop, { get: function () { return value; }, configurable: true });
    } catch (e) {}
  };

  define(window, 'devicePixelRatio', s.devicePixelRatio);
  define(screen, 'width', s.width);
  define(screen, 'height', s.height);
  define(screen, 'availWidth', s.availWidth);
  define(screen, 'availHeight', s.availHeight);
  define(screen, 'colorDepth', s.colorDepth);
  define(screen, 'pixelDepth', s.colorDepth);

  if (screen.orientation) {
    define(screen.orientation, 'type', s.orientation);
  }

  define(window, 'innerWidth', innerW);
  define(window, 'innerHeight', innerH);
  define(window, 'outerWidth', outerW);
  define(window, 'outerHeight', outerH);

  function patchVisualViewport() {
    var vv = window.visualViewport;
    if (!vv) return;
    define(vv, 'width', innerW);
    define(vv, 'height', innerH);
  }

  function patchDocumentClientSize() {
    var docEl = document.documentElement;
    var body = document.body;
    if (docEl) {
      define(docEl, 'clientWidth', innerW);
      define(docEl, 'clientHeight', innerH);
    }
    if (body) {
      define(body, 'clientWidth', innerW);
      define(body, 'clientHeight', innerH);
    }
  }

  patchVisualViewport();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchDocumentClientSize);
  } else {
    patchDocumentClientSize();
  }
  window.addEventListener('pageshow', patchDocumentClientSize);
})();