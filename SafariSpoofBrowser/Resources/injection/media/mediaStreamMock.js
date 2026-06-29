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

    var settings = kind === 'video' ? buildVideoSettings(device) : buildAudioSettings(device);
    var capabilities = kind === 'video' ? buildVideoCapabilities(device) : buildAudioCapabilities(device);

    function defineTrackMethod(name, fn) {
      try {
        Object.defineProperty(track, name, { value: fn, configurable: true, writable: true });
      } catch (e) {
        track[name] = fn;
      }
    }

    try {
      Object.defineProperty(track, 'label', { get: function () { return device.label; }, configurable: true });
    } catch (e) {}

    defineTrackMethod('getSettings', function () { return Object.assign({}, settings); });
    defineTrackMethod('getCapabilities', function () { return JSON.parse(JSON.stringify(capabilities)); });
    defineTrackMethod('getConstraints', function () {
      return kind === 'video' ? { facingMode: device.facingMode } : {};
    });

    return track;
  }

  window.__spoofPatchTrack = patchTrack;
  window.__spoofFindCamera = findCamera;
})();