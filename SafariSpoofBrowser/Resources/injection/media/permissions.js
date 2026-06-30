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
        if (window.__spoofTrace) {
          window.__spoofTrace('info', 'permissions.query ' + name + ' -> granted @ ' + (location.href || ''), 'perm');
        }
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
    if (!el || !el.tagName || String(el.tagName).toLowerCase() !== 'iframe') return false;
    var changed = false;
    try {
      var prev = el.getAttribute('allow') || '';
      if (prev.indexOf('camera') < 0) {
        el.setAttribute('allow', iframeAllow);
        if (el.allow !== undefined) el.allow = iframeAllow;
        changed = true;
      }
      var sandbox = el.getAttribute('sandbox');
      if (sandbox && sandbox.indexOf('allow-scripts') < 0) {
        el.setAttribute('sandbox', sandbox + ' allow-scripts allow-same-origin');
        changed = true;
      }
    } catch (e) {}
    return changed;
  }

  function patchAllIframes() {
    var patched = 0;
    var total = 0;
    try {
      var nodes = document.querySelectorAll('iframe');
      total = nodes.length;
      for (var i = 0; i < nodes.length; i++) {
        if (applyIframeAllow(nodes[i])) patched += 1;
      }
    } catch (e) {}
    return { patched: patched, total: total };
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
        if (name === 'src' || name === 'sandbox') applyIframeAllow(this);
        var result = origSetAttr.apply(this, arguments);
        if (name === 'allow' || name === 'src' || name === 'sandbox') applyIframeAllow(this);
        return result;
      };
      iframeProto.setAttribute.toString = function () {
        return 'function setAttribute() { [native code] }';
      };

      try {
        var srcDesc = Object.getOwnPropertyDescriptor(iframeProto, 'src');
        if (srcDesc && srcDesc.set) {
          Object.defineProperty(iframeProto, 'src', {
            configurable: true,
            enumerable: srcDesc.enumerable !== false,
            get: srcDesc.get,
            set: function (value) {
              applyIframeAllow(this);
              srcDesc.set.call(this, value);
            }
          });
        }
      } catch (e) {}

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

  window.__spoofPatchAllIframes = patchAllIframes;

  function install() {
    patchPermissions();
    patchIframeAllow();
    if (navigator.mediaDevices) {
      patchMediaDevicesExtras(navigator.mediaDevices);
    }
    var stats = patchAllIframes();
    if (stats.total > 0 && window.__spoofTrace) {
      window.__spoofTrace(
        'info',
        'iframe allow patch total=' + stats.total + ' changed=' + stats.patched + ' @ ' + (location.href || ''),
        'perm'
      );
    }
  }

  install();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  }
  window.addEventListener('pageshow', install);
  window.addEventListener('load', install);

  if (!window.__spoofIframePatchInterval) {
    var passes = 0;
    window.__spoofIframePatchInterval = setInterval(function () {
      passes += 1;
      install();
      if (passes >= 20) clearInterval(window.__spoofIframePatchInterval);
    }, 500);
  }
})();