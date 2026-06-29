// Auto-generated injection bundle

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
  var define = function (obj, prop, value) {
    try {
      Object.defineProperty(obj, prop, { get: function () { return value; }, configurable: true });
    } catch (e) {}
  };

  define(window, 'devicePixelRatio', s.devicePixelRatio);
  define(screen, 'width', s.width);
  define(screen, 'height', s.height);
  define(screen, 'availWidth', s.availWidth);
  define(screen, 'availHeight', s.availHeight);
  define(screen, 'colorDepth', s.colorDepth);
  define(screen, 'pixelDepth', s.colorDepth);

  if (screen.orientation) {
    define(screen.orientation, 'type', s.orientation);
  }
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
      var imageData = ctx.getImageData(0, 0, this.width, this.height);
      var d = imageData.data;
      for (var i = 0; i < d.length; i += 4) {
        d[i] = Math.min(255, Math.max(0, d[i] + noise * 255));
      }
      ctx.putImageData(imageData, 0, 0);
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
// --- media/mediaStreamMock.js ---
(function () {
  'use strict';
  var config = window.__SAFARI_SPOOF_CONFIG__;
  if (!config) return;

  function installTrackPrototypePatch() {
    if (window.__spoofTrackProtoPatched) return;
    var proto = window.MediaStreamTrack && MediaStreamTrack.prototype;
    if (!proto) return;
    window.__spoofTrackProtoPatched = true;

    var origGetSettings = proto.getSettings;
    var origGetCapabilities = proto.getCapabilities;
    var origGetConstraints = proto.getConstraints;

    proto.getSettings = function () {
      if (this.__spoofSettings) return Object.assign({}, this.__spoofSettings);
      if (origGetSettings) {
        try { return origGetSettings.call(this); } catch (e) {}
      }
      return {};
    };

    proto.getCapabilities = function () {
      if (this.__spoofCapabilities) return JSON.parse(JSON.stringify(this.__spoofCapabilities));
      if (origGetCapabilities) {
        try { return origGetCapabilities.call(this); } catch (e) {}
      }
      return {};
    };

    proto.getConstraints = function () {
      if (this.__spoofConstraints) return Object.assign({}, this.__spoofConstraints);
      if (origGetConstraints) {
        try { return origGetConstraints.call(this); } catch (e) {}
      }
      return {};
    };
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

  function buildVideoSettings(device) {
    var caps = config.mediaCapabilities;
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

    try {
      Object.defineProperty(track, 'label', {
        get: function () { return this.__spoofLabel || device.label; },
        configurable: true
      });
    } catch (e) {}

    return track;
  }

  window.__spoofPatchTrack = patchTrack;
  window.__spoofFindCamera = findCamera;
})();
// --- media/getUserMedia.js ---
(function () {
  'use strict';
  var config = window.__SAFARI_SPOOF_CONFIG__;
  if (!config) return;

  var installed = false;
  var mediaPermissionGranted = false;
  var originalGetUserMedia = null;
  var installTimer = null;

  function parseFacingMode(constraints) {
    if (!constraints || !constraints.video) return 'user';
    var v = constraints.video;
    if (typeof v === 'object' && v.facingMode) {
      return typeof v.facingMode === 'string' ? v.facingMode : v.facingMode.ideal || v.facingMode.exact || 'user';
    }
    return 'user';
  }

  function wantsVideo(constraints) {
    return constraints && constraints.video;
  }

  function wantsAudio(constraints) {
    return constraints && constraints.audio;
  }

  function drawPlaceholder(canvas) {
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#1b4332';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px -apple-system, sans-serif';
    ctx.fillText('Camera loading…', 16, 32);
  }

  function startNativePipeline() {
    if (window.__spoofStopFramePoll) {
      window.__spoofStopFramePoll();
    }
    window.__spoofFrameCount = 0;
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.spoofFrameBridge) {
      window.webkit.messageHandlers.spoofFrameBridge.postMessage({ event: 'startStream' });
    }
    if (window.__spoofStartFramePoll) {
      window.__spoofStartFramePoll();
    }
    setTimeout(function () {
      if (window.__spoofStartFramePoll) {
        window.__spoofStartFramePoll();
      }
    }, 500);
    setTimeout(function () {
      if (window.__spoofStartFramePoll) {
        window.__spoofStartFramePoll();
      }
    }, 1500);
  }

  function waitForFrames(minCount, timeoutMs) {
    return new Promise(function (resolve) {
      var deadline = Date.now() + timeoutMs;
      var timer = setInterval(function () {
        if ((window.__spoofFrameCount || 0) >= minCount || Date.now() >= deadline) {
          clearInterval(timer);
          resolve((window.__spoofFrameCount || 0) >= minCount);
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
        if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.spoofFrameBridge) {
          window.webkit.messageHandlers.spoofFrameBridge.postMessage({ event: 'stopStream' });
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
    devices.push({ deviceId: 'default', groupId: '', kind: 'audiooutput', label: '' });
    return devices;
  }

  function buildPrePermissionDeviceList() {
    return [
      { deviceId: '', groupId: '', kind: 'audioinput', label: '', toJSON: function () { return this; } },
      { deviceId: '', groupId: '', kind: 'videoinput', label: '', toJSON: function () { return this; } }
    ];
  }

  function installMediaSpoof() {
    if (installed) return true;
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      return false;
    }

    originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

    navigator.mediaDevices.getUserMedia = function (constraints) {
      if (!installed) installMediaSpoof();

      var useSpoof = wantsVideo(constraints);
      if (!useSpoof) {
        return originalGetUserMedia(constraints);
      }

      return new Promise(function (resolve, reject) {
        var delay = 50 + Math.floor(Math.random() * 150);
        setTimeout(function () {
          try {
            var canvas = window.__spoofCanvas;
            if (!canvas || !window.__spoofPatchTrack || !window.__spoofFindCamera) {
              reject(new DOMException('Camera not available', 'NotFoundError'));
              return;
            }

            drawPlaceholder(canvas);
            startNativePipeline();

            waitForFrames(1, 4000).then(function () {
              try {
                var fps = Math.min(config.mediaCapabilities.frameRate || 30, 30);
                var stream = canvas.captureStream(fps);
                var facingMode = parseFacingMode(constraints);
                var camera = window.__spoofFindCamera(facingMode);

                var tracks = stream.getVideoTracks();
                if (tracks.length > 0) {
                  window.__spoofPatchTrack(tracks[0], camera, 'video');
                  if (typeof tracks[0].requestFrame === 'function') {
                    var track = tracks[0];
                    var frameInterval = Math.max(33, Math.round(1000 / fps));
                    var framePump = setInterval(function () {
                      if (track.readyState === 'ended') {
                        clearInterval(framePump);
                        return;
                      }
                      try { track.requestFrame(); } catch (e) {}
                    }, frameInterval);
                    track.addEventListener('ended', function () { clearInterval(framePump); });
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

                resolve(stream);
              } catch (err) {
                reject(err);
              }
            });
          } catch (err) {
            reject(err);
          }
        }, delay);
      });
    };

    navigator.mediaDevices.enumerateDevices = function () {
      if (!installed) installMediaSpoof();
      var list = mediaPermissionGranted ? buildSpoofDeviceList() : buildPrePermissionDeviceList();
      return Promise.resolve(list);
    };

    installed = true;
    if (installTimer) {
      clearInterval(installTimer);
      installTimer = null;
    }
    return true;
  }

  function scheduleInstall() {
    if (installMediaSpoof()) return;

    var attempts = 0;
    installTimer = setInterval(function () {
      attempts += 1;
      if (installMediaSpoof() || attempts >= 100) {
        clearInterval(installTimer);
        installTimer = null;
      }
    }, 50);

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', installMediaSpoof);
    }
    window.addEventListener('load', installMediaSpoof);
    window.addEventListener('pageshow', installMediaSpoof);
  }

  scheduleInstall();
})();
// --- webrtc/enumerateDevices.js ---
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