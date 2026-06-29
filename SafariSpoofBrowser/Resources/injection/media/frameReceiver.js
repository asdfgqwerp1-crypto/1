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
  var pollIntervalMs = Math.round(1000 / 8);
  var frameImage = new Image();
  var isDrawing = false;

  window.__spoofCanvas = canvas;
  window.__spoofCanvasCtx = ctx;

  function frameURL() {
    var base = window.__SAFARI_SPOOF_FRAME_URL__ || 'spoofframe://frame/latest';
    return base + (base.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now();
  }

  function drawFrame() {
    if (isDrawing) return;
    isDrawing = true;
    frameImage.onload = function () {
      ctx.drawImage(frameImage, 0, 0, canvas.width, canvas.height);
      isDrawing = false;
    };
    frameImage.onerror = function () { isDrawing = false; };
    frameImage.src = frameURL();
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