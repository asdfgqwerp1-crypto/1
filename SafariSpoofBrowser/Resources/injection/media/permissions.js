(function () {
  'use strict';
  var config = window.__SAFARI_SPOOF_CONFIG__;
  if (!config) return;

  function nativeFn(name, impl) {
    impl.toString = function () {
      return 'function ' + name + '() { [native code] }';
    };
    return impl;
  }

  function permissionName(desc) {
    if (!desc) return '';
    if (typeof desc === 'string') return desc;
    return desc.name || '';
  }

  function grantedPermission(name) {
    return {
      state: 'granted',
      status: 'granted',
      onchange: null
    };
  }

  function patchPermissions() {
    var perms = navigator.permissions;
    if (!perms || perms.__spoofPermissionsPatched) return;

    var origQuery = typeof perms.query === 'function' ? perms.query.bind(perms) : null;
    perms.query = nativeFn('query', function (desc) {
      var name = permissionName(desc);
      if (name === 'camera' || name === 'microphone' || name === 'video_capture' || name === 'audio_capture') {
        return Promise.resolve(grantedPermission(name));
      }
      if (origQuery) {
        try { return origQuery(desc); } catch (e) {}
      }
      return Promise.resolve({ state: 'prompt', onchange: null });
    });
    perms.__spoofPermissionsPatched = true;
  }

  function patchMediaDevicesExtras(md) {
    if (!md || md.__spoofExtrasPatched) return;
    if (typeof md.getSupportedConstraints !== 'function') {
      md.getSupportedConstraints = nativeFn('getSupportedConstraints', function () {
        return {
          width: true,
          height: true,
          frameRate: true,
          facingMode: true,
          deviceId: true,
          aspectRatio: true,
          resizeMode: true
        };
      });
    }
    if (typeof md.addEventListener === 'function' && !md.__spoofDeviceChangeHooked) {
      var origAdd = md.addEventListener.bind(md);
      md.addEventListener = function (type, listener, options) {
        if (type === 'devicechange') return;
        return origAdd(type, listener, options);
      };
      md.__spoofDeviceChangeHooked = true;
    }
    md.__spoofExtrasPatched = true;
  }

  function patchIframeAllow() {
    if (document.__spoofIframeAllowPatched) return;
    var orig = document.createElement.bind(document);
    document.createElement = function (tagName, options) {
      var el = orig(tagName, options);
      try {
        if (tagName && String(tagName).toLowerCase() === 'iframe') {
          var allow = 'camera; microphone; autoplay; fullscreen; display-capture';
          el.setAttribute('allow', allow);
          if (el.allow !== undefined) el.allow = allow;
        }
      } catch (e) {}
      return el;
    };
    document.createElement.toString = function () {
      return 'function createElement() { [native code] }';
    };
    document.__spoofIframeAllowPatched = true;
  }

  function install() {
    patchPermissions();
    patchIframeAllow();
    if (navigator.mediaDevices) {
      patchMediaDevicesExtras(navigator.mediaDevices);
    }
  }

  install();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  }
  window.addEventListener('pageshow', install);
})();