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