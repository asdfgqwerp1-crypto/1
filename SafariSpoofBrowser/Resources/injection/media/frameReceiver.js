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
  var isDrawing = false;

  canvas.style.cssText = 'position:fixed;width:2px;height:2px;opacity:0.01;pointer-events:none;left:0;bottom:0;z-index:-1';
  function mountCanvas() {
    if (document.documentElement && canvas.parentNode !== document.documentElement) {
      document.documentElement.appendChild(canvas);
    }
  }
  mountCanvas();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountCanvas);
  }

  window.__spoofCanvas = canvas;
  window.__spoofCanvasCtx = ctx;
  window.__spoofFrameCount = 0;

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

  function markFrameDrawn() {
    window.__spoofFrameCount = (window.__spoofFrameCount || 0) + 1;
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
    setTimeout(release, 800);

    function onBitmapLoaded(bitmap) {
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      markFrameDrawn();
      release();
    }

    function drawViaImageUrl(url, revoke) {
      var img = new Image();
      img.onload = function () {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        markFrameDrawn();
        if (revoke) URL.revokeObjectURL(url);
        release();
      };
      img.onerror = release;
      img.src = url;
    }

    if (typeof fetch === 'function') {
      fetch(frameURL(), { cache: 'no-store' })
        .then(function (response) {
          if (!response.ok) throw new Error('bad status');
          return response.blob();
        })
        .then(function (blob) {
          if (typeof createImageBitmap === 'function') {
            return createImageBitmap(blob).then(onBitmapLoaded);
          }
          drawViaImageUrl(URL.createObjectURL(blob), true);
        })
        .catch(function () {
          drawViaImageUrl(frameURL(), false);
        });
      return;
    }

    drawViaImageUrl(frameURL(), false);
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
    window.__spoofFrameCount = 0;
  };

  window.__spoofReceiveFrame = function () {};
})();