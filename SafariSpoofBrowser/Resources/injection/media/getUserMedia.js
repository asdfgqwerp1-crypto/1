(function () {
  'use strict';
  var config = window.__SAFARI_SPOOF_CONFIG__;
  if (!config) return;

  var installed = false;
  var mediaPermissionGranted = false;
  var originalGetUserMedia = null;
  var originalEnumerateDevices = null;
  var installTimer = null;
  var videoStreamChain = Promise.resolve();

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

  function resolveCameraDevice(constraints) {
    var video = constraints && constraints.video;
    var deviceId = constraintValue(video, 'deviceId');
    if (deviceId && typeof window.__spoofFindCameraById === 'function') {
      var byId = window.__spoofFindCameraById(deviceId);
      if (byId) return byId;
    }
    return window.__spoofFindCamera(parseFacingMode(constraints));
  }

  function preWarmStreamPipeline() {
    if (window.__spoofStreamPreWarmed) return;
    window.__spoofStreamPreWarmed = true;
    traceMedia('preWarm flagged (no poll)', 'info');
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

  function describeRequestedVideo(constraints) {
    var video = constraints && constraints.video;
    if (!video || video === true) {
      return { label: 'default', width: null, height: null };
    }
    var reqW = constraintValue(video, 'width');
    var reqH = constraintValue(video, 'height');
    if (reqW != null && reqH != null) {
      return { label: Math.round(reqW) + '×' + Math.round(reqH), width: reqW, height: reqH };
    }
    if (reqW != null) {
      return { label: Math.round(reqW) + '×?', width: reqW, height: null };
    }
    if (reqH != null) {
      return { label: '?×' + Math.round(reqH), width: null, height: reqH };
    }
    return { label: 'default', width: null, height: null };
  }

  function reportMediaStatus(constraints, active) {
    if (typeof window.__spoofSendControl !== 'function') return;
    var req = describeRequestedVideo(constraints);
    var facing = parseFacingMode(constraints);
    traceMedia(
      'site request ' + req.label + ' facing=' + facing
        + ' → preset ' + active.width + 'x' + active.height + ' (' + (active.id || 'default') + ')',
      'info'
    );
    window.__spoofSendControl('media/status', {
      host: location.host || 'main',
      requested: req.label,
      reqWidth: req.width,
      reqHeight: req.height,
      facingMode: facing,
      preset: active.id || 'default',
      width: active.width,
      height: active.height,
      frameRate: active.frameRate
    });
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
    var existing = window.__spoofCanvas;
    var sizeChanged = !existing || existing.width !== active.width || existing.height !== active.height;
    if (sizeChanged) {
      if (window.__spoofStopFramePoll) window.__spoofStopFramePoll();
      if (window.__spoofGotRealFrame && window.__spoofSendControl) {
        window.__spoofSendControl('stream/stop', { localOnly: true });
      }
      if (window.__spoofResetCanvas) window.__spoofResetCanvas();
      window.__spoofFrameCount = 0;
      window.__spoofLastFrameSeq = 0;
      window.__spoofGotRealFrame = false;
      window.__spoofLastFrameBytes = 0;
      window.__spoofStreamPreWarmed = false;
    }
    window.__spoofIsDeliveryOwner = true;
    if (window.__spoofSendControl) {
      window.__spoofSendControl('stream/start', {
        width: active.width,
        height: active.height,
        frameRate: active.frameRate,
        href: location.href,
        claimOwner: true
      });
    }
    var pollDelayMs = 0;
    if (sizeChanged) {
      pollDelayMs = active.width >= 1280 ? 200 : 80;
    }
    setTimeout(function () {
      if (window.__spoofStartFramePoll) window.__spoofStartFramePoll();
    }, pollDelayMs);
  }

  var MIN_READY_FRAME_BYTES = 512;

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
        window.__spoofIsDeliveryOwner = false;
        if (window.__spoofStopFramePoll) {
          window.__spoofStopFramePoll();
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
    var devices = [];
    (config.cameras || []).forEach(function (c) {
      devices.push({
        deviceId: c.deviceId || '',
        groupId: c.groupId || '',
        kind: 'videoinput',
        label: c.label || '',
        toJSON: function () { return this; }
      });
    });
    if (!devices.length) {
      devices.push({
        deviceId: '',
        groupId: '',
        kind: 'videoinput',
        label: '',
        toJSON: function () { return this; }
      });
    }
    (config.microphones || []).forEach(function (m) {
      devices.push({
        deviceId: m.deviceId || '',
        groupId: m.groupId || '',
        kind: 'audioinput',
        label: m.label || '',
        toJSON: function () { return this; }
      });
    });
    if (!devices.some(function (d) { return d.kind === 'audioinput'; })) {
      devices.push({
        deviceId: '',
        groupId: '',
        kind: 'audioinput',
        label: '',
        toJSON: function () { return this; }
      });
    }
    return devices;
  }

  function spoofEnumerateDevices() {
    if (!mediaPermissionGranted) preWarmStreamPipeline();
    var list = mediaPermissionGranted ? buildSpoofDeviceList() : buildPrePermissionDeviceList();
    traceMedia(
      'enumerateDevices count=' + list.length + ' granted=' + mediaPermissionGranted,
      'info'
    );
    return Promise.resolve(list);
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

  function resolveVideoStreamInner(constraints) {
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
          reportMediaStatus(constraints, active);
          startNativePipeline(active);
          canvas = window.__spoofCanvas;

          var frameWaitMs = active.width >= 1920 ? 12000 : 8000;
          waitForFrames(1, frameWaitMs).then(function (gotFrame) {
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
              if (window.__spoofCanvasTainted && window.__spoofResetCanvas) {
                window.__spoofResetCanvas();
                canvas = window.__spoofCanvas;
              }
              var fps = Math.min(activeMediaCapabilities().frameRate || 30, 30);
              var stream;
              try {
                stream = canvas.captureStream(fps);
              } catch (captureErr) {
                var captureMsg = captureErr && captureErr.message ? captureErr.message : 'Canvas capture failed';
                traceMedia('captureStream failed: ' + captureMsg, 'error');
                if (captureMsg.indexOf('tainted') >= 0 || captureMsg.indexOf('Tainted') >= 0) {
                  window.__spoofCanvasTainted = true;
                }
                if (window.__spoofResetCanvas) window.__spoofResetCanvas();
                reject(new DOMException(captureMsg, 'SecurityError'));
                return;
              }
              var camera = resolveCameraDevice(constraints);

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

  function resolveVideoStream(constraints) {
    var job = videoStreamChain.then(function () {
      return resolveVideoStreamInner(constraints);
    });
    videoStreamChain = job.catch(function () {});
    return job;
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
})();