(function () {
  'use strict';
  var config = window.__SAFARI_SPOOF_CONFIG__;
  if (!config) return;

  var caps = config.mediaCapabilities;
  var canvas = document.createElement('canvas');
  canvas.width = caps.width;
  canvas.height = caps.height;
  var ctx = canvas.getContext('2d');
  var pollTimer = null;
  var pollIntervalMs = Math.round(1000 / 12);
  var isDrawing = false;

  window.__spoofCanvas = canvas;
  window.__spoofCanvasCtx = ctx;

  function frameURL() {
    var base = window.__SAFARI_SPOOF_FRAME_URL__ || 'spoofframe://frame/latest';
    return base + (base.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now();
  }

  function drawWithImage(url) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(true);
      };
      img.onerror = function () { resolve(false); };
      img.src = url;
    });
  }

  function drawWithFetch(url) {
    if (!window.fetch) return Promise.resolve(false);
    return fetch(url, { cache: 'no-store' })
      .then(function (r) { return r.blob(); })
      .then(function (blob) {
        if (window.createImageBitmap) {
          return createImageBitmap(blob).then(function (bitmap) {
            ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            if (bitmap.close) bitmap.close();
            return true;
          });
        }
        return drawWithImage(URL.createObjectURL(blob));
      })
      .catch(function () { return false; });
  }

  function drawFrame() {
    if (isDrawing) return;
    isDrawing = true;
    var url = frameURL();
    drawWithFetch(url).then(function (ok) {
      if (!ok) return drawWithImage(url);
      return ok;
    }).finally(function () {
      isDrawing = false;
    });
  }

  window.__spoofStartFramePoll = function () {
    if (pollTimer) return;
    drawFrame();
    pollTimer = setInterval(drawFrame, pollIntervalMs);
  };

  window.__spoofStopFramePoll = function () {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  window.__spoofReceiveFrame = function () {};
})();