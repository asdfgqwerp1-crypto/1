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

  var iframeAllow = 'camera; microphone; autoplay; fullscreen; display-capture';

  function applyIframeAllow(el) {
    if (!el || !el.tagName || String(el.tagName).toLowerCase() !== 'iframe') return;
    try {
      el.setAttribute('allow', iframeAllow);
      if (el.allow !== undefined) el.allow = iframeAllow;
    } catch (e) {}
  }

  function patchExistingIframes(root) {
    try {
      var nodes = (root || document).querySelectorAll('iframe');
      for (var i = 0; i < nodes.length; i++) applyIframeAllow(nodes[i]);
    } catch (e) {}
  }

  function patchIframeAllow() {
    if (document.__spoofIframeAllowPatched) return;

    var origCreate = document.createElement.bind(document);
    document.createElement = function (tagName, options) {
      var el = origCreate(tagName, options);
      applyIframeAllow(el);
      return el;
    };
    document.createElement.toString = function () {
      return 'function createElement() { [native code] }';
    };

    var iframeProto = window.HTMLIFrameElement && HTMLIFrameElement.prototype;
    if (iframeProto && !iframeProto.__spoofAllowPatched) {
      var origSetAttr = iframeProto.setAttribute;
      iframeProto.setAttribute = function (name, value) {
        var result = origSetAttr.apply(this, arguments);
        if (name === 'allow' || name === 'src' || name === 'sandbox') applyIframeAllow(this);
        return result;
      };
      iframeProto.setAttribute.toString = function () {
        return 'function setAttribute() { [native code] }';
      };
      iframeProto.__spoofAllowPatched = true;
    }

    if (typeof MutationObserver === 'function' && !document.__spoofIframeObserver) {
      var observer = new MutationObserver(function (records) {
        records.forEach(function (record) {
          record.addedNodes.forEach(function (node) {
            if (!node || node.nodeType !== 1) return;
            applyIframeAllow(node);
            if (node.querySelectorAll) patchExistingIframes(node);
          });
        });
      });
      var target = document.documentElement || document.body;
      if (target) {
        observer.observe(target, { childList: true, subtree: true });
        document.__spoofIframeObserver = observer;
      }
    }

    patchExistingIframes(document);
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