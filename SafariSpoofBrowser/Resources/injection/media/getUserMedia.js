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

  function notifyStreamStart(tracks) {
    if (window.__spoofStopFramePoll) {
      window.__spoofStopFramePoll();
    }
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.spoofFrameBridge) {
      window.webkit.messageHandlers.spoofFrameBridge.postMessage({ event: 'startStream' });
    }
    setTimeout(function () {
      if (window.__spoofStartFramePoll) {
        window.__spoofStartFramePoll();
      }
    }, 80);
    setTimeout(function () {
      if (window.__spoofStartFramePoll) {
        window.__spoofStartFramePoll();
      }
    }, 600);
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

            notifyStreamStart(tracks);
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