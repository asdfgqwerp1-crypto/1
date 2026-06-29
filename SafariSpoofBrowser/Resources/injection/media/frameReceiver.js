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
  var pollIntervalMs = Math.round(1000 / 10);
  var frameImage = new Image();
  var isDrawing = false;

  canvas.style.cssText = 'position:fixed;width:2px;height:2px;opacity:0.01;pointer-events:none;left:0;bottom:0;z-index:-1';
  if (document.documentElement) {
    document.documentElement.appendChild(canvas);
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      if (canvas.parentNode !== document.documentElement) {
        document.documentElement.appendChild(canvas);
      }
    });
  }

  window.__spoofCanvas = canvas;
  window.__spoofCanvasCtx = ctx;

  function drawPlaceholder() {
    ctx.fillStyle = '#1b4332';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px -apple-system, sans-serif';
    ctx.fillText('Camera loading…', 16, 32);
  }

  drawPlaceholder();

  function frameURL() {
    var base = window.__SAFARI_SPOOF_FRAME_URL__ || 'spoofframe://frame/latest';
    return base + (base.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now();
  }

  function drawFrame() {
    if (isDrawing) return;
    isDrawing = true;
    var released = false;
    function release() {
      if (released) return;
      released = true;
      isDrawing = false;
    }
    setTimeout(release, 500);
    frameImage.onload = function () {
      ctx.drawImage(frameImage, 0, 0, canvas.width, canvas.height);
      release();
    };
    frameImage.onerror = release;
    frameImage.src = frameURL();
  }

  window.__spoofStartFramePoll = function () {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    drawPlaceholder();
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