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

  function notifyStreamStart(tracks) {
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.spoofFrameBridge) {
      window.webkit.messageHandlers.spoofFrameBridge.postMessage({ event: 'startStream' });
    }
    if (tracks.length > 0 && tracks[0].addEventListener) {
      tracks[0].addEventListener('ended', function () {
        if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.spoofFrameBridge) {
          window.webkit.messageHandlers.spoofFrameBridge.postMessage({ event: 'stopStream' });
        }
      });
    }
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
              notifyStreamStart(tracks);
              resolve(stream);
            }).catch(function () {
              notifyStreamStart(tracks);
              resolve(stream);
            });
            return;
          }

          notifyStreamStart(tracks);
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