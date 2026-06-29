(function () {
  'use strict';
  var config = window.__SAFARI_SPOOF_CONFIG__;
  if (!config) return;

  var caps = config.mediaCapabilities;
  var canvas = null;
  var ctx = null;
  var pollTimer = null;
  var pollIntervalMs = Math.round(1000 / 10);
  var isDrawing = false;

  function mountCanvas(node) {
    node.style.cssText = 'position:fixed;width:2px;height:2px;opacity:0.01;pointer-events:none;left:0;bottom:0;z-index:-1';
    if (document.documentElement) {
      document.documentElement.appendChild(node);
    }
  }

  function makeCanvas() {
    var node = document.createElement('canvas');
    node.width = caps.width;
    node.height = caps.height;
    mountCanvas(node);
    return node;
  }

  function drawPlaceholder() {
    if (!ctx || !canvas) return;
    ctx.fillStyle = '#1b4332';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px -apple-system, sans-serif';
    ctx.fillText('Camera loading…', 16, 32);
  }

  function frameURL() {
    var base = window.__SAFARI_SPOOF_FRAME_URL__ || 'spoofframe://frame/latest';
    return base + (base.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now();
  }

  function markFrameDrawn() {
    window.__spoofFrameCount = (window.__spoofFrameCount || 0) + 1;
  }

  function drawFrame() {
    if (!ctx || !canvas || isDrawing) return;
    isDrawing = true;
    var released = false;
    function release() {
      if (released) return;
      released = true;
      isDrawing = false;
    }
    setTimeout(release, 800);

    function drawBitmap(bitmap) {
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      if (bitmap.close) bitmap.close();
      markFrameDrawn();
      release();
    }

    function drawViaImage(url, revoke) {
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        if (revoke) URL.revokeObjectURL(url);
        markFrameDrawn();
        release();
      };
      img.onerror = release;
      img.src = url;
    }

    if (typeof fetch === 'function') {
      fetch(frameURL(), { cache: 'no-store', mode: 'cors', credentials: 'omit' })
        .then(function (response) {
          if (!response.ok) throw new Error('bad status');
          return response.blob();
        })
        .then(function (blob) {
          drawViaImage(URL.createObjectURL(blob), true);
        })
        .catch(function () {
          drawViaImage(frameURL(), false);
        });
      return;
    }

    drawViaImage(frameURL(), false);
  }

  window.__spoofResetCanvas = function () {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    isDrawing = false;
    if (canvas && canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
    }
    canvas = makeCanvas();
    ctx = canvas.getContext('2d');
    window.__spoofCanvas = canvas;
    window.__spoofCanvasCtx = ctx;
    window.__spoofFrameCount = 0;
    drawPlaceholder();
  };

  window.__spoofStartFramePoll = function () {
    if (!canvas) window.__spoofResetCanvas();
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

  window.__spoofResetCanvas();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (!canvas.parentNode) mountCanvas(canvas);
    });
  }
})();