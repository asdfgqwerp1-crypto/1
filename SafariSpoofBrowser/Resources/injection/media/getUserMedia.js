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
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.spoofFrameBridge) {
      window.webkit.messageHandlers.spoofFrameBridge.postMessage({ event: 'startStream' });
    }
    setTimeout(function () {
      if (window.__spoofStartFramePoll) {
        window.__spoofStartFramePoll();
      }
    }, 80);
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

          drawPlaceholder(canvas);

          var fps = Math.min(config.mediaCapabilities.frameRate || 12, 12);
          var stream = canvas.captureStream(fps);
          var facingMode = parseFacingMode(constraints);
          var camera = window.__spoofFindCamera(facingMode);

          var tracks = stream.getVideoTracks();
          if (tracks.length > 0) {
            window.__spoofPatchTrack(tracks[0], camera, 'video');
          }

          notifyStreamStart(tracks);

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