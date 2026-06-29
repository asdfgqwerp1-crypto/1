(function () {
  'use strict';
  var config = window.__SAFARI_SPOOF_CONFIG__;
  if (!config) return;

  var caps = config.mediaCapabilities;
  var canvas = document.createElement('canvas');
  canvas.width = caps.width;
  canvas.height = caps.height;
  var ctx = canvas.getContext('2d');
  var pendingImage = null;
  var isDecoding = false;

  window.__spoofCanvas = canvas;
  window.__spoofCanvasCtx = ctx;

  window.__spoofReceiveFrame = function (base64, width, height) {
    if (!ctx) return;
    if (isDecoding) {
      pendingImage = { base64: base64, width: width, height: height };
      return;
    }
    isDecoding = true;
    var img = new Image();
    img.onload = function () {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      isDecoding = false;
      if (pendingImage) {
        var p = pendingImage;
        pendingImage = null;
        window.__spoofReceiveFrame(p.base64, p.width, p.height);
      }
    };
    img.onerror = function () { isDecoding = false; };
    img.src = 'data:image/jpeg;base64,' + base64;
  };
})();