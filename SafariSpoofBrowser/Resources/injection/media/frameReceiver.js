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

  function drawFrameFromURL() {
    if (isDrawing) return;
    isDrawing = true;
    var img = new Image();
    img.onload = function () {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      isDrawing = false;
    };
    img.onerror = function () { isDrawing = false; };
    var frameBase = window.__SAFARI_SPOOF_FRAME_URL__ || 'spoofframe://frame/latest';
    img.src = frameBase + (frameBase.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now();
  }

  window.__spoofStartFramePoll = function () {
    if (pollTimer) return;
    drawFrameFromURL();
    pollTimer = setInterval(drawFrameFromURL, pollIntervalMs);
  };

  window.__spoofStopFramePoll = function () {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  // Legacy fallback if native still calls receiveFrame directly
  window.__spoofReceiveFrame = function () {};
})();