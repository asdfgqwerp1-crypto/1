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
  define(navigator, 'webdriver', undefined);

  try {
    delete Navigator.prototype.webdriver;
  } catch (e) {}

  if (typeof window.safari === 'undefined') {
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
// --- media/frameReceiver.js ---
(function () {
  'use strict';
  var config = window.__SAFARI_SPOOF_CONFIG__;
  if (!config) return;

  var caps = config.mediaCapabilities;
  var canvas = document.createElement('canvas');
  canvas.width = caps.width;
  canvas.height = caps.height;
  var ctx = canvas.getContext('2d');
  var pendingImage = null;
  var isDecoding = false;

  window.__spoofCanvas = canvas;
  window.__spoofCanvasCtx = ctx;

  window.__spoofReceiveFrame = function (base64, width, height) {
    if (!ctx) return;
    if (isDecoding) {
      pendingImage = { base64: base64, width: width, height: height };
      return;
    }
    isDecoding = true;
    var img = new Image();
    img.onload = function () {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      isDecoding = false;
      if (pendingImage) {
        var p = pendingImage;
        pendingImage = null;
        window.__spoofReceiveFrame(p.base64, p.width, p.height);
      }
    };
    img.onerror = function () { isDecoding = false; };
    img.src = 'data:image/jpeg;base64,' + base64;
  };
})();
// --- media/mediaStreamMock.js ---
(function () {
  'use strict';
  var config = window.__SAFARI_SPOOF_CONFIG__;
  if (!config) return;

  function findCamera(facingMode) {
    var cameras = config.cameras || [];
    if (facingMode) {
      var match = cameras.find(function (c) { return c.facingMode === facingMode; });
      if (match) return match;
    }
    return cameras[0];
  }

  function patchTrack(track, device, kind) {
    if (!track || track.__spoofPatched) return track;
    track.__spoofPatched = true;

    var caps = config.mediaCapabilities;
    var settings = kind === 'video' ? {
      width: caps.width,
      height: caps.height,
      frameRate: caps.frameRate,
      facingMode: device.facingMode,
      deviceId: device.deviceId,
      groupId: device.groupId
    } : {
      deviceId: device.deviceId,
      groupId: device.groupId,
      sampleRate: config.audio.sampleRate,
      channelCount: config.audio.maxChannelCount
    };

    var capabilities = kind === 'video' ? {
      facingMode: [device.facingMode],
      width: { min: caps.widthMin, max: caps.widthMax },
      height: { min: caps.heightMin, max: caps.heightMax },
      frameRate: { min: caps.minFrameRate, max: caps.maxFrameRate }
    } : {
      sampleRate: { min: 44100, max: 48000 },
      channelCount: { min: 1, max: config.audio.maxChannelCount }
    };

    try {
      Object.defineProperty(track, 'label', { get: function () { return device.label; } });
    } catch (e) {}

    var origGetSettings = track.getSettings ? track.getSettings.bind(track) : null;
    track.getSettings = function () { return Object.assign({}, settings); };

    track.getCapabilities = function () { return JSON.parse(JSON.stringify(capabilities)); };
    track.getConstraints = function () { return {}; };

    return track;
  }

  window.__spoofPatchTrack = patchTrack;
  window.__spoofFindCamera = findCamera;
})();
// --- media/getUserMedia.js ---
(function () {
  'use strict';
  var config = window.__SAFARI_SPOOF_CONFIG__;
  if (!config || !navigator.mediaDevices) return;

  var originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  var originalEnumerate = navigator.mediaDevices.enumerateDevices
    ? navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices)
    : null;

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

  navigator.mediaDevices.getUserMedia = function (constraints) {
    var useSpoof = wantsVideo(constraints);

    if (!useSpoof) {
      return originalGetUserMedia(constraints);
    }

    return new Promise(function (resolve, reject) {
      var delay = 50 + Math.floor(Math.random() * 150);
      setTimeout(function () {
        try {
          var canvas = window.__spoofCanvas;
          if (!canvas) {
            reject(new DOMException('Camera not available', 'NotFoundError'));
            return;
          }

          var fps = config.mediaCapabilities.frameRate;
          var stream = canvas.captureStream(fps);
          var facingMode = parseFacingMode(constraints);
          var camera = window.__spoofFindCamera(facingMode);

          var tracks = stream.getVideoTracks();
          if (tracks.length > 0) {
            window.__spoofPatchTrack(tracks[0], camera, 'video');
          }

          if (wantsAudio(constraints)) {
            originalGetUserMedia({ audio: true }).then(function (audioStream) {
              audioStream.getAudioTracks().forEach(function (t) {
                var mic = (config.microphones || [])[0];
                if (mic) window.__spoofPatchTrack(t, mic, 'audio');
                stream.addTrack(t);
              });
              resolve(stream);
            }).catch(function () {
              resolve(stream);
            });
            return;
          }

          resolve(stream);
        } catch (err) {
          reject(err);
        }
      }, delay);
    });
  };

  if (originalEnumerate) {
    navigator.mediaDevices.enumerateDevices = function () {
      return originalEnumerate().then(function () {
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
      });
    };
  }
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