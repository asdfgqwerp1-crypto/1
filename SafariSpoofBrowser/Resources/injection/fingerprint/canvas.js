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
      try {
        var imageData = ctx.getImageData(0, 0, this.width, this.height);
        var d = imageData.data;
        for (var i = 0; i < d.length; i += 4) {
          d[i] = Math.min(255, Math.max(0, d[i] + noise * 255));
        }
        ctx.putImageData(imageData, 0, 0);
      } catch (e) {}
    }
    return originalToDataURL.apply(this, arguments);
  };
})();