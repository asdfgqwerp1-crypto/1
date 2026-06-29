(function () {
  'use strict';
  var config = window.__SAFARI_SPOOF_CONFIG__;
  if (!config || !config.navigator) return;

  var nav = config.navigator;
  var define = function (obj, prop, value) {
    try {
      Object.defineProperty(obj, prop, { get: function () { return value; }, configurable: true });
    } catch (e) {}
  };

  define(navigator, 'platform', nav.platform);
  define(navigator, 'vendor', nav.vendor);
  define(navigator, 'maxTouchPoints', nav.maxTouchPoints);
  define(navigator, 'hardwareConcurrency', nav.hardwareConcurrency);
  define(navigator, 'languages', Object.freeze(nav.languages.slice()));
  define(navigator, 'language', nav.languages[0]);
  define(navigator, 'cookieEnabled', nav.cookieEnabled);

  if (nav.webdriver === false) {
    define(navigator, 'webdriver', false);
  } else {
    define(navigator, 'webdriver', undefined);
    try { delete Navigator.prototype.webdriver; } catch (e) {}
  }

  if (config.emulateSafariObject !== false && typeof window.safari === 'undefined') {
    window.safari = { pushNotification: {} };
  }
})();