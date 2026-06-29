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