(function () {
  'use strict';
  var config = window.__SAFARI_SPOOF_CONFIG__;
  if (!config) return;

  var caps = config.mediaCapabilities;
  var canvas = null;
  var ctx = null;
  var pollTimer = null;
  var pollActive = false;
  var pollBaseMs = Math.round(1000 / 16);
  var isDrawing = false;
  var noiseSeed = (config.webgl && config.webgl.canvasNoiseSeed) || 284739102;
  var framesSinceNoise = 0;

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
    framesSinceNoise += 1;
    if (framesSinceNoise >= 2) {
      framesSinceNoise = 0;
      addSubtleNoise();
    }
  }

  function addSubtleNoise() {
    if (!ctx || !canvas) return;
    try {
      var w = canvas.width;
      var h = canvas.height;
      var imageData = ctx.getImageData(0, 0, w, h);
      var d = imageData.data;
      var step = 16;
      for (var y = 0; y < h; y += step) {
        for (var x = 0; x < w; x += step) {
          var i = (y * w + x) * 4;
          var n = ((noiseSeed + i + window.__spoofFrameCount) % 5) - 2;
          d[i] = Math.min(255, Math.max(0, d[i] + n));
          d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + n));
          d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + n));
        }
      }
      ctx.putImageData(imageData, 0, 0);
    } catch (e) {}
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

  function schedulePoll() {
    if (!pollActive) return;
    var jitter = Math.floor(Math.random() * 24) - 12;
    var delay = Math.max(48, pollBaseMs + jitter);
    pollTimer = setTimeout(function () {
      drawFrame();
      schedulePoll();
    }, delay);
  }

  window.__spoofResetCanvas = function () {
    pollActive = false;
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
    isDrawing = false;
    framesSinceNoise = 0;
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
    pollActive = false;
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
    drawPlaceholder();
    drawFrame();
    pollActive = true;
    schedulePoll();
  };

  window.__spoofStopFramePoll = function () {
    pollActive = false;
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
    window.__spoofFrameCount = 0;
  };

  window.__spoofReceiveFrame = function () {};

  window.__spoofResetCanvas();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (canvas && !canvas.parentNode) mountCanvas(canvas);
    });
  }

  ['__spoofCanvas', '__spoofCanvasCtx', '__spoofFrameCount', '__spoofStartFramePoll',
    '__spoofStopFramePoll', '__spoofResetCanvas', '__spoofReceiveFrame'].forEach(function (key) {
    try {
      var val = window[key];
      Object.defineProperty(window, key, {
        value: val,
        enumerable: false,
        configurable: true,
        writable: true
      });
    } catch (e) {}
  });
})();