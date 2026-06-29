(function () {
  'use strict';
  var config = window.__SAFARI_SPOOF_CONFIG__;
  if (!config) return;

  var installed = false;
  var mediaPermissionGranted = false;
  var originalGetUserMedia = null;
  var originalEnumerateDevices = null;
  var installTimer = null;

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

  function startNativePipeline() {
    if (window.__spoofStopFramePoll) {
      window.__spoofStopFramePoll();
    }
    if (window.__spoofResetCanvas) {
      window.__spoofResetCanvas();
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

          startNativePipeline();
          canvas = window.__spoofCanvas;

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
                  var pumpActive = true;
                  function pumpFrame() {
                    if (!pumpActive || track.readyState === 'ended') return;
                    try { track.requestFrame(); } catch (e) {}
                    var jitter = Math.floor(Math.random() * 18) - 6;
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
  }

  var spoofGetUserMedia = nativeFn('getUserMedia', function (constraints) {
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

  function applyPatchesToMediaDevices(md) {
    if (!md || md.__spoofMediaPatched) return false;
    if (typeof md.getUserMedia !== 'function') return false;

    originalGetUserMedia = md.getUserMedia.bind(md);
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
    if (!navigator.mediaDevices) return false;
    if (!applyPatchesToMediaDevices(navigator.mediaDevices)) return false;

    installed = true;
    if (installTimer) {
      clearInterval(installTimer);
      installTimer = null;
    }
    return true;
  }

  function hookNavigatorMediaDevices() {
    var current = navigator.mediaDevices;
    if (current) {
      applyPatchesToMediaDevices(current);
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
            var md = origGet.call(navigator);
            if (md) applyPatchesToMediaDevices(md);
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

  scheduleInstall();
})();