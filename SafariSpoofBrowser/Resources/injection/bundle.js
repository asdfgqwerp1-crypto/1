// Auto-generated injection bundle

// --- fingerprint/webkit-stealth.js ---
(function () {
  'use strict';

  var SPOOF_HANDLER_NAMES = ['spoofFrameBridge', 'spoofExportBridge'];

  function isSpoofHandler(name) {
    if (!name || typeof name !== 'string') return false;
    if (SPOOF_HANDLER_NAMES.indexOf(name) >= 0) return true;
    return name.indexOf('spoof') === 0 || name.indexOf('Spoof') >= 0;
  }

  function hideGlobal(name) {
    try {
      var value = window[name];
      if (value === undefined) return;
      Object.defineProperty(window, name, {
        configurable: true,
        enumerable: false,
        writable: true,
        value: value
      });
    } catch (e) {}
  }

  function sanitizeMessageHandlers(handlers) {
    if (!handlers || typeof handlers !== 'object') return handlers;
    SPOOF_HANDLER_NAMES.forEach(function (name) {
      try { delete handlers[name]; } catch (e) {}
    });
    return handlers;
  }

  function schemeAuthKey() {
    var cfg = window.__SAFARI_SPOOF_CONFIG__;
    return (cfg && cfg.schemeAuthKey) || '';
  }

  function withSchemeAuth(url) {
    var key = schemeAuthKey();
    if (!key) return url;
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + 'k=' + encodeURIComponent(key);
  }

  function installWebkitStealth() {
    if (window.__spoofWebkitStealthInstalled) return;
    window.__spoofWebkitStealthInstalled = true;

    try {
      var webkit = window.webkit;
      if (webkit && webkit.messageHandlers) {
        var original = webkit.messageHandlers;
        var needsProxy = SPOOF_HANDLER_NAMES.some(function (name) {
          return original && original[name] != null;
        });
        if (!needsProxy) {
          hideGlobal('__spoofWebkitStealthInstalled');
          hideGlobal('__safariSpoofInstalled');
          hideGlobal('__SAFARI_SPOOF_CONFIG__');
          return;
        }
        sanitizeMessageHandlers(original);
        var proxy = new Proxy(original, {
          get: function (target, prop) {
            if (typeof prop === 'string' && isSpoofHandler(prop)) return undefined;
            var value = target[prop];
            return typeof value === 'function' ? value.bind(target) : value;
          },
          has: function (target, prop) {
            if (typeof prop === 'string' && isSpoofHandler(prop)) return false;
            return prop in target;
          },
          ownKeys: function (target) {
            return Reflect.ownKeys(target).filter(function (key) {
              return !isSpoofHandler(String(key));
            });
          },
          getOwnPropertyDescriptor: function (target, prop) {
            if (typeof prop === 'string' && isSpoofHandler(prop)) return undefined;
            return Object.getOwnPropertyDescriptor(target, prop);
          }
        });
        try {
          Object.defineProperty(webkit, 'messageHandlers', {
            configurable: true,
            enumerable: true,
            get: function () { return proxy; }
          });
        } catch (e) {
          webkit.messageHandlers = proxy;
        }
      }
    } catch (e) {}

    hideGlobal('__spoofWebkitStealthInstalled');
    hideGlobal('__safariSpoofInstalled');
    hideGlobal('__SAFARI_SPOOF_CONFIG__');
  }

  function sendControlViaFrame(url) {
    try {
      var iframe = document.createElement('iframe');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;top:-9999px;border:0';
      iframe.src = url;
      var root = document.body || document.documentElement;
      if (!root) return false;
      root.appendChild(iframe);
      setTimeout(function () {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 1500);
      return true;
    } catch (e) {
      return false;
    }
  }

  function sendControl(path, params) {
    var query = '';
    if (params) {
      query = Object.keys(params).map(function (key) {
        return encodeURIComponent(key) + '=' + encodeURIComponent(String(params[key]));
      }).join('&');
    }
    var url = withSchemeAuth('spoofcontrol://' + path + (query ? '?' + query : ''));
    try {
      fetch(url, {
        method: 'GET',
        mode: 'no-cors',
        credentials: 'omit',
        cache: 'no-store',
        keepalive: true
      }).catch(function () {});
    } catch (e) {}
    // WKWebView occasionally drops custom-scheme fetch; iframe backup reaches native reliably.
    setTimeout(function () {
      sendControlViaFrame(url);
    }, 80);
  }

  function sendControlPost(path, payload) {
    var url = withSchemeAuth('spoofcontrol://' + path);
    var body = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
    try {
      fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        credentials: 'omit',
        cache: 'no-store',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: body
      }).catch(function () {});
      return true;
    } catch (e) {}
    return false;
  }

  installWebkitStealth();
  window.__spoofSendControl = sendControl;
  window.__spoofSendControlPost = sendControlPost;
  hideGlobal('__spoofSendControl');
  hideGlobal('__spoofSendControlPost');

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installWebkitStealth);
  }
  window.addEventListener('pageshow', installWebkitStealth);
})();
// --- fingerprint/navigator.js ---
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
// --- fingerprint/screen.js ---
(function () {
  'use strict';
  var config = window.__SAFARI_SPOOF_CONFIG__;
  if (!config || !config.screen) return;

  var s = config.screen;
  var v = s.viewport || {};
  var innerW = v.innerWidth != null ? v.innerWidth : s.width;
  var innerH = v.innerHeight != null ? v.innerHeight : s.height;
  var outerW = v.outerWidth != null ? v.outerWidth : s.width;
  var outerH = v.outerHeight != null ? v.outerHeight : s.height;

  var layoutW = null;
  var layoutH = null;

  function captureLayoutLeak() {
    if (layoutH !== null) return;
    try {
      var proto = Element.prototype;
      var ch = Object.getOwnPropertyDescriptor(proto, 'clientHeight');
      var cw = Object.getOwnPropertyDescriptor(proto, 'clientWidth');
      if (document.documentElement && ch && ch.get) {
        layoutH = ch.get.call(document.documentElement);
      }
      if (document.documentElement && cw && cw.get) {
        layoutW = cw.get.call(document.documentElement);
      }
    } catch (e) {}
  }

  captureLayoutLeak();

  function defineGetter(proto, prop, value) {
    if (!proto) return;
    try {
      Object.defineProperty(proto, prop, {
        get: function () { return value; },
        configurable: true
      });
    } catch (e) {}
  }

  function patchScreen() {
    var screenObj = window.screen;
    if (!screenObj) return;
    var screenProto = Object.getPrototypeOf(screenObj);
    if (!screenProto || screenProto.__spoofScreenPatched) return;
    screenProto.__spoofScreenPatched = true;

    defineGetter(screenProto, 'width', s.width);
    defineGetter(screenProto, 'height', s.height);
    defineGetter(screenProto, 'availWidth', s.availWidth);
    defineGetter(screenProto, 'availHeight', s.availHeight);
    defineGetter(screenProto, 'colorDepth', s.colorDepth);
    defineGetter(screenProto, 'pixelDepth', s.colorDepth);
    defineGetter(screenProto, 'availTop', 0);
    defineGetter(screenProto, 'availLeft', 0);

    var orientation = screenObj.orientation;
    if (orientation) {
      var orientProto = Object.getPrototypeOf(orientation);
      if (orientProto && !orientProto.__spoofOrientPatched) {
        orientProto.__spoofOrientPatched = true;
        defineGetter(orientProto, 'type', s.orientation);
        defineGetter(orientProto, 'angle', 0);
      }
    }
  }

  function patchWindowMetrics() {
    defineGetter(window, 'devicePixelRatio', s.devicePixelRatio);
    defineGetter(window, 'innerWidth', innerW);
    defineGetter(window, 'innerHeight', innerH);
    defineGetter(window, 'outerWidth', outerW);
    defineGetter(window, 'outerHeight', outerH);
  }

  function patchVisualViewport() {
    var vv = window.visualViewport;
    if (!vv) return;
    var vvProto = Object.getPrototypeOf(vv);
    if (!vvProto || vvProto.__spoofVVPatched) return;
    vvProto.__spoofVVPatched = true;
    defineGetter(vvProto, 'width', innerW);
    defineGetter(vvProto, 'height', innerH);
  }

  function shouldSpoofElementSize(el, width, height) {
    if (el === document.documentElement || el === document.body) return true;
    if (width === innerW && height === innerH) return true;
    if (layoutH !== null && height === layoutH && width === innerW) return true;
    if (layoutW !== null && width === layoutW && height === layoutH) return true;
    // Full-width probe divs (BrowserLeaks etc.) — 362, 646, …
    if (width === innerW && height > 200 && height < innerH) return true;
    return false;
  }

  function patchElementGeometry() {
    var proto = Element.prototype;
    if (proto.__spoofGeomPatched) return;

    var chDesc = Object.getOwnPropertyDescriptor(proto, 'clientHeight');
    var cwDesc = Object.getOwnPropertyDescriptor(proto, 'clientWidth');
    if (!chDesc || !chDesc.get) return;

    var origClientHeight = chDesc.get;
    var origClientWidth = cwDesc && cwDesc.get;

    function readClientWidth(el) {
      return origClientWidth ? origClientWidth.call(el) : 0;
    }

    function patchedClientHeight() {
      var height = origClientHeight.call(this);
      var width = readClientWidth(this);
      if (shouldSpoofElementSize(this, width, height)) return innerH;
      return height;
    }

    function patchedClientWidth() {
      var width = origClientWidth ? origClientWidth.call(this) : 0;
      var height = origClientHeight.call(this);
      if (shouldSpoofElementSize(this, width, height)) return innerW;
      return width;
    }

    try {
      Object.defineProperty(proto, 'clientHeight', { get: patchedClientHeight, configurable: true });
      if (origClientWidth) {
        Object.defineProperty(proto, 'clientWidth', { get: patchedClientWidth, configurable: true });
      }
      proto.__spoofGeomPatched = true;
    } catch (e) {}
  }

  patchScreen();
  patchWindowMetrics();
  patchVisualViewport();
  patchElementGeometry();

  function refreshPatches() {
    captureLayoutLeak();
    patchElementGeometry();
    patchVisualViewport();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refreshPatches);
  }
  window.addEventListener('pageshow', refreshPatches);
})();
// --- fingerprint/webgl.js ---
(function () {
  'use strict';
  var config = window.__SAFARI_SPOOF_CONFIG__;
  if (!config || !config.webgl) return;

  var vendor = config.webgl.vendor;
  var renderer = config.webgl.renderer;
  var UNMASKED_VENDOR = 0x9245;
  var UNMASKED_RENDERER = 0x9246;

  function patchContext(proto) {
    if (!proto || proto.__spoofWebGLPatched) return;
    proto.__spoofWebGLPatched = true;
    var original = proto.getParameter;
    proto.getParameter = function (param) {
      if (param === UNMASKED_VENDOR) return vendor;
      if (param === UNMASKED_RENDERER) return renderer;
      return original.call(this, param);
    };
  }

  patchContext(WebGLRenderingContext && WebGLRenderingContext.prototype);
  patchContext(WebGL2RenderingContext && WebGL2RenderingContext.prototype);
})();
// --- fingerprint/canvas.js ---
(function () {
  'use strict';
  var config = window.__SAFARI_SPOOF_CONFIG__;
  if (!config || !config.webgl) return;

  var seed = config.webgl.canvasNoiseSeed || 1;

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  var rng = mulberry32(seed);
  var noise = (rng() * 2 - 1) * 0.0001;

  var originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function () {
    var ctx = this.getContext('2d');
    if (ctx && this.width > 0 && this.height > 0) {
      try {
        var imageData = ctx.getImageData(0, 0, this.width, this.height);
        var d = imageData.data;
        for (var i = 0; i < d.length; i += 4) {
          d[i] = Math.min(255, Math.max(0, d[i] + noise * 255));
        }
        ctx.putImageData(imageData, 0, 0);
      } catch (e) {}
    }
    return originalToDataURL.apply(this, arguments);
  };
})();
// --- fingerprint/audio.js ---
(function () {
  'use strict';
  var config = window.__SAFARI_SPOOF_CONFIG__;
  if (!config || !config.audio) return;

  var sampleRate = config.audio.sampleRate;
  var maxChannelCount = config.audio.maxChannelCount;

  var OriginalAudioContext = window.AudioContext || window.webkitAudioContext;
  if (!OriginalAudioContext) return;

  function SpoofedAudioContext() {
    var ctx = new OriginalAudioContext();
    try {
      Object.defineProperty(ctx, 'sampleRate', { get: function () { return sampleRate; } });
    } catch (e) {}
    return ctx;
  }
  SpoofedAudioContext.prototype = OriginalAudioContext.prototype;
  window.AudioContext = SpoofedAudioContext;
  if (window.webkitAudioContext) window.webkitAudioContext = SpoofedAudioContext;

  if (OriginalAudioContext.prototype.createAnalyser) {
    var originalCreateAnalyser = OriginalAudioContext.prototype.createAnalyser;
    OriginalAudioContext.prototype.createAnalyser = function () {
      var analyser = originalCreateAnalyser.call(this);
      try {
        Object.defineProperty(analyser, 'channelCount', { get: function () { return maxChannelCount; } });
      } catch (e) {}
      return analyser;
    };
  }
})();
// --- media/frameReceiver.js ---
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
  var pollFrameIndex = 0;
  var isDrawing = false;
  var rgbaBuffer = null;
  var nv12ScratchCanvas = null;
  var noiseScratchCanvas = null;
  var nv12GlRenderer = null;
  var uvUnpackBuffer = null;
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

  function activeCaps() {
    if (typeof window.__spoofGetActiveCaps === 'function') {
      return window.__spoofGetActiveCaps();
    }
    return caps;
  }

  function makeCanvas() {
    var active = activeCaps();
    var node = document.createElement('canvas');
    node.width = active.width;
    node.height = active.height;
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

  // WKWebView often hides X-Frame-* headers even with Access-Control-Expose-Headers.
  var fetchOptions = { cache: 'no-store', credentials: 'omit' };
  var MIN_REAL_FRAME_BYTES = 512;

  function schemeAuthKey() {
    return (config && config.schemeAuthKey) || '';
  }

  function withSchemeAuth(url) {
    var key = schemeAuthKey();
    var out = url;
    if (key) {
      out += (out.indexOf('?') >= 0 ? '&' : '?') + 'k=' + encodeURIComponent(key);
    }
    return out;
  }

  function frameURL() {
    var base = window.__SAFARI_SPOOF_FRAME_URL__ || 'spoofframe://frame/latest';
    return withSchemeAuth(base + (base.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now());
  }

  function partURL(index) {
    if (typeof window.__spoofPartURL__ === 'function') {
      return window.__spoofPartURL__(0, index);
    }
    return withSchemeAuth('spoofframe://frame/part?p=' + index + '&t=' + Date.now());
  }

  function jpegMirrorURL() {
    return withSchemeAuth('spoofframe://frame/jpeg?t=' + Date.now());
  }

  function fetchJpegMirror(meta, onDone) {
    window.__spoofFrameTransport = 'jpeg-mirror-fallback';
    fetch(jpegMirrorURL(), fetchOptions)
      .then(function (response) {
        if (!response.ok) throw new Error('bad jpeg mirror');
        return response.blob();
      })
      .then(function (blob) {
        drawBlobAsImage(blob, meta, function () {
          if (onDone) onDone(true);
        });
      })
      .catch(function () {
        if (onDone) onDone(false);
      });
  }

  function blobToArrayBuffer(blob) {
    if (typeof blob.arrayBuffer === 'function') {
      return blob.arrayBuffer();
    }
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    });
  }

  function noteRealFrame(meta, payloadBytes, pixelW, pixelH) {
    var bytes = payloadBytes || 0;
    var w = pixelW || 0;
    var h = pixelH || 0;
    if (bytes > MIN_REAL_FRAME_BYTES || (w > 32 && h > 32) || (meta && meta.seq > 0)) {
      window.__spoofGotRealFrame = true;
      window.__spoofLastFrameBytes = Math.max(bytes, window.__spoofLastFrameBytes || 0);
    }
  }

  function markFrameDrawn(meta, payloadBytes, pixelW, pixelH) {
    window.__spoofFrameCount = (window.__spoofFrameCount || 0) + 1;
    pollFrameIndex += 1;
    if (meta) {
      window.__spoofLastFrameSeq = meta.seq;
      window.__spoofLastPtsUs = meta.ptsUs;
    }
    noteRealFrame(meta, payloadBytes, pixelW, pixelH);
  }

  function seededRng(seed) {
    var state = seed >>> 0;
    return function () {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  function gaussian(rng) {
    var u = 0;
    var v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function noiseDownscaleFor(width, height) {
    var pixels = width * height;
    if (pixels >= 1244160) return 3;
    if (pixels >= 307200) return 2;
    return 1;
  }

  function applySensorNoise(ctx, width, height, frameSeed) {
    var noise = config.frameNoise;
    if (!noise || noise.enabled === false || !ctx || !canvas) return;

    var downscale = noiseDownscaleFor(width, height);
    var nw = Math.max(1, Math.round(width / downscale));
    var nh = Math.max(1, Math.round(height / downscale));
    var scratch = ensureNoiseScratchCanvas(nw, nh);
    var scratchCtx = scratch.getContext('2d');
    scratchCtx.drawImage(canvas, 0, 0, width, height, 0, 0, nw, nh);

    var rng = seededRng(((noise.seed || 0) ^ (frameSeed || 0)) >>> 0);
    var readSigma = noise.readSigma != null ? noise.readSigma : 1.0;
    var shotScale = noise.shotScale != null ? noise.shotScale : 2.5;
    var chromaR = noise.chromaR != null ? noise.chromaR : 1.0;
    var chromaG = noise.chromaG != null ? noise.chromaG : 0.85;
    var chromaB = noise.chromaB != null ? noise.chromaB : 1.3;
    var image = scratchCtx.getImageData(0, 0, nw, nh);
    var d = image.data;
    var inv255 = 1 / 255;

    for (var i = 0; i < d.length; i += 4) {
      var r = d[i];
      var g = d[i + 1];
      var b = d[i + 2];
      var luma = (0.299 * r + 0.587 * g + 0.114 * b) * inv255;
      var sigma = readSigma + shotScale * Math.sqrt(Math.max(luma, 0));
      var n = sigma * gaussian(rng);
      d[i] = clampByte(r + n * chromaR);
      d[i + 1] = clampByte(g + n * chromaG);
      d[i + 2] = clampByte(b + n * chromaB);
    }

    scratchCtx.putImageData(image, 0, 0);
    ctx.drawImage(scratch, 0, 0, nw, nh, 0, 0, width, height);
  }

  function ensureNoiseScratchCanvas(width, height) {
    if (!noiseScratchCanvas) {
      noiseScratchCanvas = document.createElement('canvas');
    }
    if (noiseScratchCanvas.width !== width || noiseScratchCanvas.height !== height) {
      noiseScratchCanvas.width = width;
      noiseScratchCanvas.height = height;
    }
    return noiseScratchCanvas;
  }

  function finishFrame(meta, onDone, payloadBytes, pixelW, pixelH) {
    if (ctx && canvas) {
      applySensorNoise(ctx, canvas.width, canvas.height, meta ? meta.seq : pollFrameIndex);
    }
    markFrameDrawn(meta, payloadBytes, pixelW, pixelH);
    if (onDone) onDone();
  }

  function nextPollDelayMs() {
    var timing = config.frameTiming || {};
    var fps = timing.targetFrameRate || 30;
    var ms = 1000 / fps;
    var jitter = Math.random() * ((timing.jitterMsMax || 14) - (timing.jitterMsMin || -8)) + (timing.jitterMsMin || -8);
    ms += jitter;
    var hitchEvery = timing.exposureHitchInterval || 60;
    var onHitch = hitchEvery > 0 && pollFrameIndex > 0 && pollFrameIndex % hitchEvery === 0;
    if (onHitch) {
      ms += Math.random() * ((timing.exposureHitchMsMax || 18) - (timing.exposureHitchMsMin || 6)) + (timing.exposureHitchMsMin || 6);
    }
    if (Math.random() < (timing.slowdownProbability || 0)) {
      ms *= Math.random() * ((timing.slowdownFactorMax || 1.32) - (timing.slowdownFactorMin || 1.1)) + (timing.slowdownFactorMin || 1.1);
    }
    if (!onHitch && timing.minDeliverFps) {
      ms = Math.min(ms, 1000 / timing.minDeliverFps);
    }
    return Math.max(28, ms);
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
      ptsUs: parseInt(headerValue(response, 'X-Frame-PTS-Us') || '0', 10),
      chunkCount: parseInt(headerValue(response, 'X-Frame-Chunks') || '0', 10)
    };
  }

  function fetchChunkedNV12(meta, onDone) {
    var parts = meta.chunkCount;
    if (!parts || parts < 2) {
      if (onDone) onDone(false);
      return;
    }
    window.__spoofFrameTransport = 'chunked-nv12';
    var buffers = new Array(parts);
    var failed = false;

    function fetchPart(index) {
      if (failed) return;
      if (index >= parts) {
        var total = 0;
        var i;
        for (i = 0; i < buffers.length; i++) {
          if (!buffers[i]) {
            fetchJpegMirror(meta, onDone);
            return;
          }
          total += buffers[i].byteLength;
        }
        var out = new Uint8Array(total);
        var offset = 0;
        for (i = 0; i < buffers.length; i++) {
          out.set(new Uint8Array(buffers[i]), offset);
          offset += buffers[i].byteLength;
        }
        if (drawNV12(out.buffer, meta)) {
          if (onDone) onDone(true);
        } else {
          fetchJpegMirror(meta, onDone);
        }
        return;
      }
      fetch(partURL(index), fetchOptions)
        .then(function (response) {
          if (!response.ok) throw new Error('bad chunk');
          return response.blob().then(function (blob) {
            return blobToArrayBuffer(blob);
          });
        })
        .then(function (buf) {
          buffers[index] = buf;
          fetchPart(index + 1);
        })
        .catch(function () {
          failed = true;
          fetchJpegMirror(meta, onDone);
        });
    }

    fetchPart(0);
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

  function coverCropRect(srcW, srcH, dstW, dstH) {
    if (!srcW || !srcH || !dstW || !dstH) {
      return { sx: 0, sy: 0, sw: srcW || dstW, sh: srcH || dstH };
    }
    var srcAspect = srcW / srcH;
    var dstAspect = dstW / dstH;
    var sw, sh, sx, sy;
    if (srcAspect > dstAspect) {
      sh = srcH;
      sw = srcH * dstAspect;
      sx = (srcW - sw) * 0.5;
      sy = 0;
    } else {
      sw = srcW;
      sh = srcW / dstAspect;
      sx = 0;
      sy = (srcH - sh) * 0.5;
    }
    return { sx: sx, sy: sy, sw: sw, sh: sh };
  }

  function drawImageCover(ctx, source, dstW, dstH) {
    var srcW = source.width;
    var srcH = source.height;
    if (!srcW || !srcH) return;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, dstW, dstH);
    if (srcW === dstW && srcH === dstH) {
      ctx.drawImage(source, 0, 0, dstW, dstH);
      return;
    }
    var crop = coverCropRect(srcW, srcH, dstW, dstH);
    ctx.drawImage(source, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, dstW, dstH);
  }

  function ensureScratchCanvas(width, height) {
    if (!nv12ScratchCanvas) {
      nv12ScratchCanvas = document.createElement('canvas');
    }
    if (nv12ScratchCanvas.width !== width || nv12ScratchCanvas.height !== height) {
      nv12ScratchCanvas.width = width;
      nv12ScratchCanvas.height = height;
    }
    return nv12ScratchCanvas;
  }

  function createShader(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return null;
    return shader;
  }

  function createNV12GlRenderer(width, height) {
    var node = document.createElement('canvas');
    node.width = width;
    node.height = height;
    var gl = node.getContext('webgl', { premultipliedAlpha: false, antialias: false });
    if (!gl) return null;

    var vs = createShader(gl, gl.VERTEX_SHADER, [
      'attribute vec2 a_pos;',
      'varying vec2 v_uv;',
      'void main(){',
      '  v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);',
      '  gl_Position = vec4(a_pos, 0.0, 1.0);',
      '}'
    ].join('\n'));
    var fs = createShader(gl, gl.FRAGMENT_SHADER, [
      'precision mediump float;',
      'varying vec2 v_uv;',
      'uniform sampler2D y_tex;',
      'uniform sampler2D uv_tex;',
      'void main(){',
      '  float y = texture2D(y_tex, v_uv).r;',
      '  vec2 uv = texture2D(uv_tex, v_uv).ra;',
      '  float c = max(y - 0.06274509803921569, 0.0);',
      '  float d = uv.r - 0.5;',
      '  float e = uv.g - 0.5;',
      '  float r = c + 1.5748 * e;',
      '  float g = c - 0.187324 * d - 0.468124 * e;',
      '  float b = c + 1.8556 * d;',
      '  gl_FragColor = vec4(clamp(r, 0.0, 1.0), clamp(g, 0.0, 1.0), clamp(b, 0.0, 1.0), 1.0);',
      '}'
    ].join('\n'));
    if (!vs || !fs) return null;

    var program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
    gl.useProgram(program);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    var yTex = gl.createTexture();
    var uvTex = gl.createTexture();

    function setupTex(tex, unit) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }
    setupTex(yTex, 0);
    setupTex(uvTex, 1);
    gl.uniform1i(gl.getUniformLocation(program, 'y_tex'), 0);
    gl.uniform1i(gl.getUniformLocation(program, 'uv_tex'), 1);

    return {
      canvas: node,
      gl: gl,
      width: width,
      height: height,
      yTex: yTex,
      uvTex: uvTex,
      unpackUV: function (nv12) {
        var ySize = width * height;
        var uvSrc = new Uint8Array(nv12, ySize);
        var uvW = width >> 1;
        var uvH = height >> 1;
        var need = uvW * uvH * 2;
        if (!uvUnpackBuffer || uvUnpackBuffer.length !== need) {
          uvUnpackBuffer = new Uint8Array(need);
        }
        var dst = uvUnpackBuffer;
        for (var row = 0; row < uvH; row++) {
          var srcRow = row * width;
          var dstRow = row * uvW * 2;
          for (var pair = 0; pair < uvW; pair++) {
            var src = srcRow + (pair << 1);
            var dstIdx = dstRow + (pair << 1);
            dst[dstIdx] = uvSrc[src];
            dst[dstIdx + 1] = uvSrc[src + 1];
          }
        }
        return dst;
      },
      draw: function (nv12) {
        var ySize = width * height;
        gl.viewport(0, 0, width, height);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, yTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, width, height, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array(nv12, 0, ySize));
        var uvData = this.unpackUV(nv12);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, uvTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE_ALPHA, width >> 1, height >> 1, 0, gl.LUMINANCE_ALPHA, gl.UNSIGNED_BYTE, uvData);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    };
  }

  function ensureNV12GlRenderer(width, height) {
    if (nv12GlRenderer && nv12GlRenderer.width === width && nv12GlRenderer.height === height) {
      return nv12GlRenderer;
    }
    nv12GlRenderer = createNV12GlRenderer(width, height);
    return nv12GlRenderer;
  }

  function blitNV12ToCanvas(buffer, width, height) {
    var renderer = ensureNV12GlRenderer(width, height);
    if (renderer) {
      renderer.draw(buffer);
      drawImageCover(ctx, renderer.canvas, canvas.width, canvas.height);
      return true;
    }
    var image = ensureRgbaBuffer(width, height);
    nv12ToRGBA(buffer, width, height, image);
    var scratch = ensureScratchCanvas(width, height);
    scratch.getContext('2d').putImageData(image, 0, 0);
    drawImageCover(ctx, scratch, canvas.width, canvas.height);
    return true;
  }

  function drawNV12(buffer, meta) {
    if (!ctx || !canvas) return false;
    var width = meta.width || canvas.width;
    var height = meta.height || canvas.height;
    if (buffer.byteLength < expectedNV12Bytes(width, height)) return false;
    blitNV12ToCanvas(buffer, width, height);
    if (meta.seq > lastFrameSeq) lastFrameSeq = meta.seq;
    if (meta.ptsUs >= lastPtsUs) lastPtsUs = meta.ptsUs;
    finishFrame(meta);
    return true;
  }

  function shouldUseNV12(meta, byteLength) {
    if (!preferNV12) return false;
    if (meta.formatHeader === 'jpeg') return false;
    if (meta.contentType.indexOf('jpeg') >= 0) return false;
    if (meta.formatHeader === 'nv12') return true;
    if (meta.contentType.indexOf('nv12') >= 0) return true;
    var width = meta.width || caps.width;
    var height = meta.height || caps.height;
    return byteLength >= expectedNV12Bytes(width, height);
  }

  function drawBitmap(bitmap, meta, onDone, payloadBytes) {
    if (!ctx || !canvas) {
      if (bitmap && bitmap.close) bitmap.close();
      if (onDone) onDone();
      return;
    }
    drawImageCover(ctx, bitmap, canvas.width, canvas.height);
    if (bitmap.close) bitmap.close();
    finishFrame(meta, onDone, payloadBytes || 0, bitmap.width, bitmap.height);
  }

  function drawImageSource(src, revoke, meta, onDone, payloadBytes) {
    if (!ctx || !canvas) {
      if (onDone) onDone();
      return;
    }
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      drawImageCover(ctx, img, canvas.width, canvas.height);
      if (revoke) URL.revokeObjectURL(src);
      finishFrame(meta, onDone, payloadBytes || 0, img.naturalWidth, img.naturalHeight);
    };
    img.onerror = function () {
      if (revoke) URL.revokeObjectURL(src);
      if (onDone) onDone();
    };
    img.src = src;
  }

  function drawBlobAsImage(blob, meta, onDone) {
    var blobSize = blob && blob.size ? blob.size : 0;
    if (typeof createImageBitmap === 'function') {
      createImageBitmap(blob).then(function (bitmap) {
        drawBitmap(bitmap, meta, onDone, blobSize);
      }).catch(function () {
        drawImageSource(URL.createObjectURL(blob), true, meta, onDone, blobSize);
      });
      return;
    }
    drawImageSource(URL.createObjectURL(blob), true, meta, onDone, blobSize);
  }

  function handleBuffer(buffer, meta, release) {
    if (isJpegBuffer(buffer)) {
      drawBlobAsImage(new Blob([buffer], { type: 'image/jpeg' }), meta, release);
      return;
    }
    if (shouldUseNV12(meta, buffer.byteLength)) {
      if (drawNV12(buffer, meta)) {
        release();
        return;
      }
    }
    drawBlobAsImage(new Blob([buffer], { type: 'image/jpeg' }), meta, release);
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

    if (typeof fetch !== 'function') {
      drawImageSource(frameURL(), false, null, release);
      return;
    }

    fetch(frameURL(), fetchOptions)
      .then(function (response) {
        if (!response.ok) throw new Error('bad status');
        var meta = parseFrameHeaders(response);
        if (meta.chunkCount > 1 && (meta.formatHeader === 'nv12' || preferNV12)) {
          fetchChunkedNV12(meta, function () {
            release();
          });
          return;
        }
        return response.blob().then(function (blob) {
          if (shouldUseNV12(meta, blob.size)) {
            return blobToArrayBuffer(blob).then(function (buf) {
              handleBuffer(buf, meta, release);
            });
          }
          window.__spoofFrameTransport = 'jpeg-blob';
          drawBlobAsImage(blob, meta, release);
        });
      })
      .catch(function () {
        drawImageSource(frameURL(), false, null, release);
      });
  }

  function schedulePoll() {
    if (!pollActive) return;
    var delay = nextPollDelayMs();
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
    pollFrameIndex = 0;
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
    window.__spoofGotRealFrame = false;
    window.__spoofLastFrameBytes = 0;
    drawPlaceholder();
  };

  window.__spoofStartFramePoll = function () {
    if (!canvas) window.__spoofResetCanvas();
    if (pollActive) return;
    streamStartPerf = performance.now();
    streamStartPtsUs = 0;
    if ((window.__spoofFrameCount || 0) === 0) {
      drawPlaceholder();
    }
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
// --- media/mediaStreamMock.js ---
(function () {
  'use strict';
  var config = window.__SAFARI_SPOOF_CONFIG__;
  if (!config) return;

  function nativeFn(name, impl) {
    impl.toString = function () {
      return 'function ' + name + '() { [native code] }';
    };
    return impl;
  }

  function installTrackPrototypePatch() {
    if (window.__spoofTrackProtoPatched) return;
    var proto = window.MediaStreamTrack && MediaStreamTrack.prototype;
    if (!proto) return;
    window.__spoofTrackProtoPatched = true;

    var origGetSettings = proto.getSettings;
    var origGetCapabilities = proto.getCapabilities;
    var origGetConstraints = proto.getConstraints;
    var origApplyConstraints = proto.applyConstraints;
    var origClone = proto.clone;

    proto.getSettings = nativeFn('getSettings', function () {
      if (this.__spoofSettings) return Object.assign({}, this.__spoofSettings);
      if (origGetSettings) {
        try { return origGetSettings.call(this); } catch (e) {}
      }
      return {};
    });

    proto.getCapabilities = nativeFn('getCapabilities', function () {
      if (this.__spoofCapabilities) return JSON.parse(JSON.stringify(this.__spoofCapabilities));
      if (origGetCapabilities) {
        try { return origGetCapabilities.call(this); } catch (e) {}
      }
      return {};
    });

    proto.getConstraints = nativeFn('getConstraints', function () {
      if (this.__spoofConstraints) return Object.assign({}, this.__spoofConstraints);
      if (origGetConstraints) {
        try { return origGetConstraints.call(this); } catch (e) {}
      }
      return {};
    });

    proto.applyConstraints = nativeFn('applyConstraints', function (constraints) {
      if (this.__spoofPatched) return Promise.resolve();
      if (origApplyConstraints) {
        try { return origApplyConstraints.call(this, constraints); } catch (e) {}
      }
      return Promise.resolve();
    });

    if (origClone) {
      proto.clone = nativeFn('clone', function () {
        var cloned = origClone.call(this);
        if (this.__spoofPatched && this.__spoofDevice) {
          window.__spoofPatchTrack(cloned, this.__spoofDevice, this.__spoofKind || this.kind);
        }
        return cloned;
      });
    }
  }

  installTrackPrototypePatch();

  function findCamera(facingMode) {
    var cameras = config.cameras || [];
    if (facingMode) {
      var match = cameras.find(function (c) { return c.facingMode === facingMode; });
      if (match) return match;
    }
    return cameras[0];
  }

  function activeCaps() {
    if (typeof window.__spoofGetActiveCaps === 'function') {
      return window.__spoofGetActiveCaps();
    }
    return config.mediaCapabilities;
  }

  function buildVideoSettings(device) {
    var caps = activeCaps();
    var extra = (config.videoTrackSpoof && config.videoTrackSpoof.settings) || {};
    return {
      width: caps.width,
      height: caps.height,
      frameRate: caps.frameRate,
      facingMode: device.facingMode,
      deviceId: device.deviceId,
      groupId: device.groupId,
      aspectRatio: extra.aspectRatio !== undefined ? extra.aspectRatio : (caps.width / caps.height),
      backgroundBlur: extra.backgroundBlur !== undefined ? extra.backgroundBlur : false,
      powerEfficient: extra.powerEfficient !== undefined ? extra.powerEfficient : false,
      whiteBalanceMode: extra.whiteBalanceMode || 'continuous',
      zoom: extra.zoom !== undefined ? extra.zoom : 1
    };
  }

  function buildVideoCapabilities(device) {
    var caps = config.mediaCapabilities;
    var active = activeCaps();
    var extra = (config.videoTrackSpoof && config.videoTrackSpoof.capabilities) || {};
    return {
      aspectRatio: {
        min: extra.aspectRatioMin !== undefined ? extra.aspectRatioMin : 0.00033,
        max: extra.aspectRatioMax !== undefined ? extra.aspectRatioMax : caps.widthMax
      },
      backgroundBlur: extra.backgroundBlur || [false],
      deviceId: device.deviceId,
      facingMode: [device.facingMode],
      frameRate: { min: caps.minFrameRate, max: caps.maxFrameRate },
      groupId: device.groupId,
      height: { min: caps.heightMin, max: caps.heightMax },
      powerEfficient: extra.powerEfficient || [false, true],
      whiteBalanceMode: extra.whiteBalanceMode || ['manual', 'continuous'],
      width: { min: caps.widthMin, max: caps.widthMax },
      zoom: {
        min: extra.zoomMin !== undefined ? extra.zoomMin : 1,
        max: extra.zoomMax !== undefined ? extra.zoomMax : 10
      }
    };
  }

  function buildAudioSettings(device) {
    var extra = (config.audioTrackSpoof && config.audioTrackSpoof.settings) || {};
    return {
      deviceId: device.deviceId,
      groupId: device.groupId,
      sampleRate: config.audio.sampleRate,
      echoCancellation: extra.echoCancellation !== undefined ? extra.echoCancellation : true,
      volume: extra.volume !== undefined ? extra.volume : 1
    };
  }

  function buildAudioCapabilities(device) {
    var extra = (config.audioTrackSpoof && config.audioTrackSpoof.capabilities) || {};
    return {
      deviceId: device.deviceId,
      groupId: device.groupId,
      echoCancellation: extra.echoCancellation || [true, false],
      sampleRate: {
        min: extra.sampleRateMin || 8000,
        max: extra.sampleRateMax || 96000
      },
      volume: {
        min: extra.volumeMin !== undefined ? extra.volumeMin : 0,
        max: extra.volumeMax !== undefined ? extra.volumeMax : 1
      }
    };
  }

  function patchTrack(track, device, kind) {
    if (!track || track.__spoofPatched) return track;
    track.__spoofPatched = true;
    installTrackPrototypePatch();

    track.__spoofSettings = kind === 'video' ? buildVideoSettings(device) : buildAudioSettings(device);
    track.__spoofCapabilities = kind === 'video' ? buildVideoCapabilities(device) : buildAudioCapabilities(device);
    track.__spoofConstraints = kind === 'video' ? { facingMode: device.facingMode } : {};
    track.__spoofLabel = device.label;
    track.__spoofDevice = device;
    track.__spoofKind = kind;

    try {
      Object.defineProperty(track, 'label', {
        get: function () { return this.__spoofLabel || device.label; },
        configurable: true
      });
    } catch (e) {}

    if (kind === 'video') {
      try {
        track.contentHint = 'motion';
      } catch (e) {}
    }

    try {
      Object.defineProperty(track, '__spoofPatched', { value: true, enumerable: false, configurable: true });
      Object.defineProperty(track, '__spoofSettings', { enumerable: false, configurable: true, writable: true });
      Object.defineProperty(track, '__spoofCapabilities', { enumerable: false, configurable: true, writable: true });
      Object.defineProperty(track, '__spoofConstraints', { enumerable: false, configurable: true, writable: true });
      Object.defineProperty(track, '__spoofLabel', { enumerable: false, configurable: true, writable: true });
    } catch (e) {}

    return track;
  }

  window.__spoofPatchTrack = patchTrack;
  window.__spoofFindCamera = findCamera;

  try {
    Object.defineProperty(window, '__spoofPatchTrack', { enumerable: false, configurable: true, writable: true });
    Object.defineProperty(window, '__spoofFindCamera', { enumerable: false, configurable: true, writable: true });
    Object.defineProperty(window, '__spoofTrackProtoPatched', { value: true, enumerable: false, configurable: true });
  } catch (e) {}
})();
// --- media/getUserMedia.js ---
(function () {
  'use strict';
  var config = window.__SAFARI_SPOOF_CONFIG__;
  if (!config) return;

  var installed = false;
  var mediaPermissionGranted = false;
  var originalGetUserMedia = null;
  var originalEnumerateDevices = null;
  var installTimer = null;

  function traceMedia(message, level) {
    if (typeof window.__spoofTrace === 'function') {
      window.__spoofTrace(level || 'info', message, 'gUM');
    }
  }

  function nativeFn(name, impl) {
    impl.toString = function () {
      return 'function ' + name + '() { [native code] }';
    };
    return impl;
  }

  function parseFacingMode(constraints) {
    if (!constraints || !constraints.video) return 'user';
    var v = constraints.video;
    if (typeof v === 'object' && v.facingMode) {
      return typeof v.facingMode === 'string' ? v.facingMode : v.facingMode.ideal || v.facingMode.exact || 'user';
    }
    return 'user';
  }

  function wantsVideo(constraints) {
    return !!(constraints && constraints.video);
  }

  function wantsAudio(constraints) {
    return !!(constraints && constraints.audio);
  }

  function constraintValue(video, key) {
    if (!video || typeof video !== 'object') return undefined;
    var v = video[key];
    if (v === undefined || v === null) return undefined;
    if (typeof v === 'number') return v;
    if (typeof v === 'object') {
      if (v.exact !== undefined) return v.exact;
      if (v.ideal !== undefined) return v.ideal;
      if (v.min !== undefined && v.max !== undefined) return (v.min + v.max) / 2;
      if (v.min !== undefined) return v.min;
      if (v.max !== undefined) return v.max;
    }
    return undefined;
  }

  function selectMediaPreset(constraints) {
    var presets = config.mediaPresets || [];
    var base = {
      id: 'default',
      width: config.mediaCapabilities.width,
      height: config.mediaCapabilities.height,
      frameRate: config.mediaCapabilities.frameRate,
      aspectRatio: config.mediaCapabilities.width / config.mediaCapabilities.height
    };
    if (!presets.length) return base;

    var video = constraints && constraints.video;
    var reqW = constraintValue(video, 'width');
    var reqH = constraintValue(video, 'height');
    var reqAspect = constraintValue(video, 'aspectRatio');

    var best = null;
    var bestScore = Infinity;
    presets.forEach(function (preset) {
      var aspect = preset.aspectRatio || (preset.width / preset.height);
      var score = 0;
      if (reqW) score += Math.abs(preset.width - reqW) * 2;
      if (reqH) score += Math.abs(preset.height - reqH) * 2;
      if (reqAspect) score += Math.abs(aspect - reqAspect) * 1000;
      if (reqW && reqH && preset.width === reqW && preset.height === reqH) score -= 10000;
      if (score < bestScore) {
        bestScore = score;
        best = preset;
      }
    });
    return best || base;
  }

  function applyMediaPreset(preset) {
    var active = {
      id: preset.id || 'default',
      width: preset.width,
      height: preset.height,
      frameRate: preset.frameRate || config.mediaCapabilities.frameRate || 30,
      aspectRatio: preset.aspectRatio || (preset.width / preset.height)
    };
    window.__spoofActiveMediaCapabilities = active;
    config.mediaCapabilities = Object.assign({}, config.mediaCapabilities, {
      width: active.width,
      height: active.height,
      frameRate: active.frameRate
    });
    return active;
  }

  function activeMediaCapabilities() {
    return window.__spoofActiveMediaCapabilities || {
      width: config.mediaCapabilities.width,
      height: config.mediaCapabilities.height,
      frameRate: config.mediaCapabilities.frameRate || 30,
      aspectRatio: config.mediaCapabilities.width / config.mediaCapabilities.height
    };
  }

  function startNativePipeline(active) {
    traceMedia('stream/start ' + active.width + 'x' + active.height + '@' + active.frameRate);
    if (window.__spoofStopFramePoll) {
      window.__spoofStopFramePoll();
    }
    if (window.__spoofResetCanvas) {
      window.__spoofResetCanvas();
    }
    window.__spoofFrameCount = 0;
    window.__spoofLastFrameSeq = 0;
    window.__spoofGotRealFrame = false;
    window.__spoofLastFrameBytes = 0;
    if (window.__spoofSendControl) {
      window.__spoofSendControl('stream/start', {
        width: active.width,
        height: active.height,
        frameRate: active.frameRate
      });
    }
    setTimeout(function () {
      if (window.__spoofStartFramePoll) {
        window.__spoofStartFramePoll();
      }
    }, 100);
  }

  function hasRealFrame() {
    return window.__spoofGotRealFrame === true;
  }

  function waitForFrames(minCount, timeoutMs) {
    return new Promise(function (resolve) {
      var deadline = Date.now() + timeoutMs;
      var timer = setInterval(function () {
        var ready = hasRealFrame() && (window.__spoofFrameCount || 0) >= minCount;
        if (ready || Date.now() >= deadline) {
          clearInterval(timer);
          if (!ready) {
            console.error('[spoof] waitForFrames timeout frames=' + (window.__spoofFrameCount || 0)
              + ' bytes=' + (window.__spoofLastFrameBytes || 0)
              + ' real=' + !!window.__spoofGotRealFrame);
          }
          resolve(ready);
        }
      }, 40);
    });
  }

  function attachTrackStopHandler(tracks) {
    if (tracks.length > 0 && tracks[0].addEventListener) {
      tracks[0].addEventListener('ended', function () {
        if (window.__spoofStopFramePoll) {
          window.__spoofStopFramePoll();
        }
        if (window.__spoofSendControl) {
          window.__spoofSendControl('stream/stop');
        }
      });
    }
  }

  function createSyntheticAudioTrack() {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    var ctx = new Ctx();
    var oscillator = ctx.createOscillator();
    var gain = ctx.createGain();
    var destination = ctx.createMediaStreamDestination();
    gain.gain.value = 0;
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start();
    var tracks = destination.stream.getAudioTracks();
    return tracks.length > 0 ? tracks[0] : null;
  }

  function buildSpoofDeviceList() {
    var devices = [];
    (config.cameras || []).forEach(function (c) {
      devices.push({
        deviceId: c.deviceId,
        groupId: c.groupId,
        kind: 'videoinput',
        label: c.label,
        toJSON: function () { return this; }
      });
    });
    (config.microphones || []).forEach(function (m) {
      devices.push({
        deviceId: m.deviceId,
        groupId: m.groupId,
        kind: 'audioinput',
        label: m.label,
        toJSON: function () { return this; }
      });
    });
    devices.push({ deviceId: 'default', groupId: '', kind: 'audiooutput', label: '', toJSON: function () { return this; } });
    return devices;
  }

  function buildPrePermissionDeviceList() {
    return [
      { deviceId: '', groupId: '', kind: 'audioinput', label: '', toJSON: function () { return this; } },
      { deviceId: '', groupId: '', kind: 'videoinput', label: '', toJSON: function () { return this; } }
    ];
  }

  function spoofEnumerateDevices() {
    return Promise.resolve(mediaPermissionGranted ? buildSpoofDeviceList() : buildPrePermissionDeviceList());
  }

  function resolveAudioOnlyStream() {
    return new Promise(function (resolve, reject) {
      var delay = 50 + Math.floor(Math.random() * 150);
      setTimeout(function () {
        try {
          if (!window.__spoofPatchTrack) {
            reject(new DOMException('Microphone not available', 'NotFoundError'));
            return;
          }
          var mic = (config.microphones || [])[0];
          var audioTrack = createSyntheticAudioTrack();
          if (!audioTrack) {
            reject(new DOMException('Microphone not available', 'NotFoundError'));
            return;
          }
          if (mic) {
            window.__spoofPatchTrack(audioTrack, mic, 'audio');
          }
          mediaPermissionGranted = true;
          var stream = new MediaStream();
          stream.addTrack(audioTrack);
          resolve(stream);
        } catch (err) {
          reject(err);
        }
      }, delay);
    });
  }

  function resolveVideoStream(constraints) {
    return new Promise(function (resolve, reject) {
      var delay = 50 + Math.floor(Math.random() * 150);
      setTimeout(function () {
        try {
          var canvas = window.__spoofCanvas;
          if (!canvas || !window.__spoofPatchTrack || !window.__spoofFindCamera) {
            reject(new DOMException('Camera not available', 'NotFoundError'));
            return;
          }

          var preset = selectMediaPreset(constraints);
          var active = applyMediaPreset(preset);
          startNativePipeline(active);
          canvas = window.__spoofCanvas;

          waitForFrames(1, 12000).then(function (gotFrame) {
            if (!gotFrame) {
              traceMedia('waitForFrames timeout bytes=' + (window.__spoofLastFrameBytes || 0), 'error');
              reject(new DOMException(
                'Camera failed to produce frames (bridge bytes=' + (window.__spoofLastFrameBytes || 0) + ')',
                'NotReadableError'
              ));
              return;
            }
            traceMedia('frames ready bytes=' + (window.__spoofLastFrameBytes || 0));
            try {
              var fps = Math.min(activeMediaCapabilities().frameRate || 30, 30);
              var stream;
              try {
                stream = canvas.captureStream(fps);
              } catch (captureErr) {
                traceMedia('captureStream failed: ' + (captureErr && captureErr.message), 'error');
                window.__spoofResetCanvas();
                reject(new DOMException(
                  captureErr && captureErr.message ? captureErr.message : 'Canvas capture failed',
                  'SecurityError'
                ));
                return;
              }
              var facingMode = parseFacingMode(constraints);
              var camera = window.__spoofFindCamera(facingMode);

              var tracks = stream.getVideoTracks();
              if (tracks.length > 0) {
                window.__spoofPatchTrack(tracks[0], camera, 'video');
                if (typeof tracks[0].requestFrame === 'function') {
                  var track = tracks[0];
                  var pumpActive = true;
                  function pumpFrame() {
                    if (!pumpActive || track.readyState === 'ended') return;
                    try { track.requestFrame(); } catch (e) {}
                    var timing = config.frameTiming || {};
                    var jitter = Math.random() * ((timing.jitterMsMax || 14) - (timing.jitterMsMin || -8)) + (timing.jitterMsMin || -8);
                    setTimeout(pumpFrame, Math.max(28, Math.round(1000 / fps) + jitter));
                  }
                  pumpFrame();
                  track.addEventListener('ended', function () { pumpActive = false; });
                }
              }

              attachTrackStopHandler(tracks);
              mediaPermissionGranted = true;

              if (wantsAudio(constraints)) {
                var mic = (config.microphones || [])[0];
                var audioTrack = createSyntheticAudioTrack();
                if (audioTrack) {
                  if (mic) window.__spoofPatchTrack(audioTrack, mic, 'audio');
                  stream.addTrack(audioTrack);
                }
              }

              traceMedia('stream ready tracks=' + stream.getVideoTracks().length);
              resolve(stream);
            } catch (err) {
              traceMedia('resolve error: ' + (err && err.message), 'error');
              reject(err);
            }
          });
        } catch (err) {
          traceMedia('setup error: ' + (err && err.message), 'error');
          reject(err);
        }
      }, delay);
    });
  }

  var spoofGetUserMedia = nativeFn('getUserMedia', function (constraints) {
    traceMedia('getUserMedia ' + JSON.stringify(constraints || {}));
    if (wantsVideo(constraints)) {
      return resolveVideoStream(constraints || {});
    }
    if (wantsAudio(constraints)) {
      return resolveAudioOnlyStream();
    }
    return Promise.reject(new DOMException('Requested device not found', 'NotFoundError'));
  });

  var spoofEnumerateDevicesFn = nativeFn('enumerateDevices', function () {
    return spoofEnumerateDevices();
  });

  function ensureNavigatorMediaDevices() {
    var md = navigator.mediaDevices;
    if (md) return md;

    var proto = window.MediaDevices && MediaDevices.prototype;
    md = proto ? Object.create(proto) : {};
    try {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        enumerable: true,
        writable: true,
        value: md
      });
    } catch (e) {
      navigator.mediaDevices = md;
    }
    return md;
  }

  function applyPatchesToMediaDevices(md) {
    if (!md || md.__spoofMediaPatched) return false;

    if (typeof md.getUserMedia === 'function') {
      originalGetUserMedia = md.getUserMedia.bind(md);
    }
    if (typeof md.enumerateDevices === 'function') {
      originalEnumerateDevices = md.enumerateDevices.bind(md);
    }

    md.getUserMedia = spoofGetUserMedia;
    md.enumerateDevices = spoofEnumerateDevicesFn;
    md.__spoofMediaPatched = true;

    var proto = window.MediaDevices && MediaDevices.prototype;
    if (proto && !proto.__spoofMediaPatched) {
      proto.getUserMedia = spoofGetUserMedia;
      proto.enumerateDevices = spoofEnumerateDevicesFn;
      proto.__spoofMediaPatched = true;
    }

    return true;
  }

  function installMediaSpoof() {
    if (installed) return true;
    var md = ensureNavigatorMediaDevices();
    if (!applyPatchesToMediaDevices(md)) return false;

    installed = true;
    traceMedia('mediaDevices patched @ ' + (location && location.href ? location.href : 'unknown'));
    if (installTimer) {
      clearInterval(installTimer);
      installTimer = null;
    }
    return true;
  }

  function hookNavigatorMediaDevices() {
    var current = ensureNavigatorMediaDevices();
    if (applyPatchesToMediaDevices(current)) {
      installed = true;
    }

    try {
      var desc = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
      if (desc && desc.get && !navigator.__spoofMediaDevicesHooked) {
        var origGet = desc.get;
        navigator.__spoofMediaDevicesHooked = true;
        Object.defineProperty(navigator, 'mediaDevices', {
          configurable: true,
          enumerable: desc.enumerable !== false,
          get: function () {
            var md = origGet.call(navigator) || ensureNavigatorMediaDevices();
            applyPatchesToMediaDevices(md);
            return md;
          }
        });
      }
    } catch (e) {}

    if (navigator.webkitGetUserMedia && !navigator.__spoofWebkitGumPatched) {
      navigator.__spoofWebkitGumPatched = true;
      var origWebkit = navigator.webkitGetUserMedia.bind(navigator);
      navigator.webkitGetUserMedia = function (constraints, success, error) {
        spoofGetUserMedia(constraints || {}).then(function (stream) {
          if (success) success(stream);
        }).catch(function (err) {
          if (error) error(err);
        });
      };
      navigator.webkitGetUserMedia.toString = function () {
        return 'function webkitGetUserMedia() { [native code] }';
      };
    }
  }

  function scheduleInstall() {
    hookNavigatorMediaDevices();
    if (installMediaSpoof()) return;

    var attempts = 0;
    installTimer = setInterval(function () {
      attempts += 1;
      hookNavigatorMediaDevices();
      if (installMediaSpoof() || attempts >= 100) {
        clearInterval(installTimer);
        installTimer = null;
      }
    }, 50);

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', hookNavigatorMediaDevices);
    }
    window.addEventListener('load', hookNavigatorMediaDevices);
    window.addEventListener('pageshow', hookNavigatorMediaDevices);
  }

  window.__spoofApplyMediaPreset = applyMediaPreset;
  window.__spoofGetActiveCaps = activeMediaCapabilities;
  window.__spoofSelectMediaPreset = selectMediaPreset;

  try {
    Object.defineProperty(window, '__spoofApplyMediaPreset', { enumerable: false, configurable: true, writable: true });
    Object.defineProperty(window, '__spoofGetActiveCaps', { enumerable: false, configurable: true, writable: true });
    Object.defineProperty(window, '__spoofSelectMediaPreset', { enumerable: false, configurable: true, writable: true });
  } catch (e) {}

  window.__spoofHookNavigatorMediaDevices = hookNavigatorMediaDevices;

  scheduleInstall();
})();// --- webrtc/enumerateDevices.js ---
(function () {
  'use strict';
  // enumerateDevices override is in getUserMedia.js
  // This module reserved for RTCPeerConnection patches if needed in v2

  if (window.RTCPeerConnection && RTCPeerConnection.prototype) {
    var orig = RTCPeerConnection.prototype.addTrack;
    if (orig) {
      RTCPeerConnection.prototype.addTrack = function (track, stream) {
        return orig.call(this, track, stream);
      };
    }
  }
})();