(function () {
  'use strict';
  var config = window.__SAFARI_SPOOF_CONFIG__;
  if (!config) return;

  var caps = config.mediaCapabilities;
  var preferNV12 = config.frameDelivery === 'nv12';
  var canvas = null;
  var ctx = null;
  var pollTimer = null;
  var pollActive = false;
  var pollBaseMs = Math.round(1000 / 16);
  var isDrawing = false;
  var rgbaBuffer = null;
  var lastFrameSeq = 0;
  var lastPtsUs = 0;
  var streamStartPtsUs = 0;
  var streamStartPerf = 0;

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

  function markFrameDrawn(meta) {
    window.__spoofFrameCount = (window.__spoofFrameCount || 0) + 1;
    if (meta) {
      window.__spoofLastFrameSeq = meta.seq;
      window.__spoofLastPtsUs = meta.ptsUs;
    }
  }

  function clampByte(v) {
    return v < 0 ? 0 : (v > 255 ? 255 : v);
  }

  function ensureRgbaBuffer(width, height) {
    if (!rgbaBuffer || rgbaBuffer.width !== width || rgbaBuffer.height !== height) {
      rgbaBuffer = new ImageData(width, height);
    }
    return rgbaBuffer;
  }

  function nv12ToRGBA(nv12, width, height, out) {
    var ySize = width * height;
    var y = new Uint8Array(nv12, 0, ySize);
    var uv = new Uint8Array(nv12, ySize);
    var rgba = out.data;
    var uvWidth = width;

    for (var row = 0; row < height; row++) {
      var yRow = row * width;
      var uvRow = (row >> 1) * uvWidth;
      for (var col = 0; col < width; col++) {
        var yVal = y[yRow + col];
        var uvIndex = uvRow + (col & ~1);
        var u = uv[uvIndex] - 128;
        var v = uv[uvIndex + 1] - 128;
        var c = yVal - 16;
        if (c < 0) c = 0;
        var r = (298 * c + 409 * v + 128) >> 8;
        var g = (298 * c - 100 * u - 208 * v + 128) >> 8;
        var b = (298 * c + 516 * u + 128) >> 8;
        var i = (yRow + col) * 4;
        rgba[i] = clampByte(r);
        rgba[i + 1] = clampByte(g);
        rgba[i + 2] = clampByte(b);
        rgba[i + 3] = 255;
      }
    }
  }

  function headerValue(response, name) {
    try {
      return response.headers.get(name) || response.headers.get(name.toLowerCase()) || '';
    } catch (e) {
      return '';
    }
  }

  function parseFrameHeaders(response) {
    var contentType = headerValue(response, 'Content-Type');
    var formatHeader = headerValue(response, 'X-Frame-Format');
    return {
      contentType: contentType,
      formatHeader: formatHeader,
      width: parseInt(headerValue(response, 'X-Frame-Width') || String(caps.width), 10),
      height: parseInt(headerValue(response, 'X-Frame-Height') || String(caps.height), 10),
      seq: parseInt(headerValue(response, 'X-Frame-Seq') || '0', 10),
      ptsUs: parseInt(headerValue(response, 'X-Frame-PTS-Us') || '0', 10)
    };
  }

  function expectedNV12Bytes(width, height) {
    return ((width * height * 3) / 2) | 0;
  }

  function isJpegBuffer(buffer) {
    if (!buffer || buffer.byteLength < 2) return false;
    var bytes = new Uint8Array(buffer, 0, 2);
    return bytes[0] === 0xFF && bytes[1] === 0xD8;
  }

  function detectFrameFormat(buffer, meta) {
    if (meta.formatHeader === 'nv12') return 'nv12';
    if (meta.formatHeader === 'jpeg') return 'jpeg';
    if (meta.contentType.indexOf('nv12') >= 0) return 'nv12';
    if (meta.contentType.indexOf('jpeg') >= 0) return 'jpeg';

    var width = meta.width || caps.width;
    var height = meta.height || caps.height;
    if (isJpegBuffer(buffer)) return 'jpeg';
    if (buffer.byteLength >= expectedNV12Bytes(width, height)) return 'nv12';
    if (preferNV12) return 'nv12';
    return 'jpeg';
  }

  function drawNV12(buffer, meta) {
    if (!ctx || !canvas) return false;
    var width = meta.width || canvas.width;
    var height = meta.height || canvas.height;
    if (buffer.byteLength < expectedNV12Bytes(width, height)) return false;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    var image = ensureRgbaBuffer(width, height);
    nv12ToRGBA(buffer, width, height, image);
    ctx.putImageData(image, 0, 0);
    if (meta.seq > lastFrameSeq) lastFrameSeq = meta.seq;
    if (meta.ptsUs >= lastPtsUs) lastPtsUs = meta.ptsUs;
    markFrameDrawn(meta);
    return true;
  }

  function drawJPEGFromBuffer(buffer, meta, onDone) {
    if (!ctx || !canvas) {
      if (onDone) onDone();
      return;
    }
    var url = URL.createObjectURL(new Blob([buffer], { type: 'image/jpeg' }));
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      markFrameDrawn(meta);
      if (onDone) onDone();
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      if (onDone) onDone();
    };
    img.src = url;
  }

  function drawJPEGURL(url, revoke, meta, onDone) {
    if (!ctx || !canvas) {
      if (onDone) onDone();
      return;
    }
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      if (revoke) URL.revokeObjectURL(url);
      markFrameDrawn(meta);
      if (onDone) onDone();
    };
    img.onerror = function () {
      if (revoke) URL.revokeObjectURL(url);
      if (onDone) onDone();
    };
    img.src = url;
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

    function handleBuffer(buffer, meta) {
      var format = detectFrameFormat(buffer, meta);
      if (format === 'nv12') {
        if (drawNV12(buffer, meta)) {
          release();
          return;
        }
        if (isJpegBuffer(buffer)) {
          drawJPEGFromBuffer(buffer, meta, release);
          return;
        }
      }
      drawJPEGFromBuffer(buffer, meta, release);
    }

    if (typeof fetch !== 'function') {
      drawJPEGURL(frameURL(), false, null, release);
      return;
    }

    fetch(frameURL(), { cache: 'no-store', mode: 'cors', credentials: 'omit' })
      .then(function (response) {
        if (!response.ok) throw new Error('bad status');
        var meta = parseFrameHeaders(response);
        return response.arrayBuffer().then(function (buf) {
          handleBuffer(buf, meta);
        });
      })
      .catch(function () {
        drawJPEGURL(frameURL(), false, null, release);
      });
  }

  function schedulePoll() {
    if (!pollActive) return;
    var jitter = Math.floor(Math.random() * 16) - 8;
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
    lastFrameSeq = 0;
    lastPtsUs = 0;
    streamStartPtsUs = 0;
    streamStartPerf = 0;
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
    streamStartPerf = performance.now();
    streamStartPtsUs = 0;
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