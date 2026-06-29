(function () {
  'use strict';
  var config = window.__SAFARI_SPOOF_CONFIG__;
  if (!config || !config.screen) return;

  var s = config.screen;
  var define = function (obj, prop, value) {
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
})();