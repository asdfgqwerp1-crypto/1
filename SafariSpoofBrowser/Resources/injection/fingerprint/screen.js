(function () {
  'use strict';
  var config = window.__SAFARI_SPOOF_CONFIG__;
  if (!config || !config.screen) return;

  var s = config.screen;
  var v = s.viewport || {};
  var innerW = v.innerWidth != null ? v.innerWidth : s.width;
  var innerH = v.innerHeight != null ? v.innerHeight : s.height;
  var outerW = v.outerWidth != null ? v.outerWidth : s.width;
  var outerH = v.outerHeight != null ? v.outerHeight : s.height;

  var layoutW = null;
  var layoutH = null;

  function captureLayoutLeak() {
    if (layoutH !== null) return;
    try {
      var proto = Element.prototype;
      var ch = Object.getOwnPropertyDescriptor(proto, 'clientHeight');
      var cw = Object.getOwnPropertyDescriptor(proto, 'clientWidth');
      if (document.documentElement && ch && ch.get) {
        layoutH = ch.get.call(document.documentElement);
      }
      if (document.documentElement && cw && cw.get) {
        layoutW = cw.get.call(document.documentElement);
      }
    } catch (e) {}
  }

  captureLayoutLeak();

  function defineGetter(proto, prop, value) {
    if (!proto) return;
    try {
      Object.defineProperty(proto, prop, {
        get: function () { return value; },
        configurable: true
      });
    } catch (e) {}
  }

  function patchScreen() {
    var screenObj = window.screen;
    if (!screenObj) return;
    var screenProto = Object.getPrototypeOf(screenObj);
    if (!screenProto || screenProto.__spoofScreenPatched) return;
    screenProto.__spoofScreenPatched = true;

    defineGetter(screenProto, 'width', s.width);
    defineGetter(screenProto, 'height', s.height);
    defineGetter(screenProto, 'availWidth', s.availWidth);
    defineGetter(screenProto, 'availHeight', s.availHeight);
    defineGetter(screenProto, 'colorDepth', s.colorDepth);
    defineGetter(screenProto, 'pixelDepth', s.colorDepth);
    defineGetter(screenProto, 'availTop', 0);
    defineGetter(screenProto, 'availLeft', 0);

    var orientation = screenObj.orientation;
    if (orientation) {
      var orientProto = Object.getPrototypeOf(orientation);
      if (orientProto && !orientProto.__spoofOrientPatched) {
        orientProto.__spoofOrientPatched = true;
        defineGetter(orientProto, 'type', s.orientation);
        defineGetter(orientProto, 'angle', 0);
      }
    }
  }

  function patchWindowMetrics() {
    defineGetter(window, 'devicePixelRatio', s.devicePixelRatio);
    defineGetter(window, 'innerWidth', innerW);
    defineGetter(window, 'innerHeight', innerH);
    defineGetter(window, 'outerWidth', outerW);
    defineGetter(window, 'outerHeight', outerH);
  }

  function patchVisualViewport() {
    var vv = window.visualViewport;
    if (!vv) return;
    var vvProto = Object.getPrototypeOf(vv);
    if (!vvProto || vvProto.__spoofVVPatched) return;
    vvProto.__spoofVVPatched = true;
    defineGetter(vvProto, 'width', innerW);
    defineGetter(vvProto, 'height', innerH);
  }

  function shouldSpoofElementSize(el, width, height) {
    if (el === document.documentElement || el === document.body) return true;
    if (width === innerW && height === innerH) return true;
    if (layoutH !== null && height === layoutH && (width === innerW || width === layoutW)) return true;
    if (width === innerW && height > 500 && height < 900 && height !== innerH) return true;
    return false;
  }

  function patchElementGeometry() {
    var proto = Element.prototype;
    if (proto.__spoofGeomPatched) return;

    var chDesc = Object.getOwnPropertyDescriptor(proto, 'clientHeight');
    var cwDesc = Object.getOwnPropertyDescriptor(proto, 'clientWidth');
    if (!chDesc || !chDesc.get) return;

    var origClientHeight = chDesc.get;
    var origClientWidth = cwDesc && cwDesc.get;

    function readClientWidth(el) {
      return origClientWidth ? origClientWidth.call(el) : 0;
    }

    function patchedClientHeight() {
      var height = origClientHeight.call(this);
      var width = readClientWidth(this);
      if (shouldSpoofElementSize(this, width, height)) return innerH;
      return height;
    }

    function patchedClientWidth() {
      var width = origClientWidth ? origClientWidth.call(this) : 0;
      var height = origClientHeight.call(this);
      if (shouldSpoofElementSize(this, width, height)) return innerW;
      return width;
    }

    try {
      Object.defineProperty(proto, 'clientHeight', { get: patchedClientHeight, configurable: true });
      if (origClientWidth) {
        Object.defineProperty(proto, 'clientWidth', { get: patchedClientWidth, configurable: true });
      }
      proto.__spoofGeomPatched = true;
    } catch (e) {}
  }

  patchScreen();
  patchWindowMetrics();
  patchVisualViewport();
  patchElementGeometry();

  function refreshPatches() {
    captureLayoutLeak();
    patchElementGeometry();
    patchVisualViewport();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refreshPatches);
  }
  window.addEventListener('pageshow', refreshPatches);
})();