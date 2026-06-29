(function () {
  'use strict';

  var logEl = document.getElementById('log');
  var results = { passed: 0, failed: 0, tests: [], ts: new Date().toISOString() };

  function log(line) {
    logEl.textContent += line + '\n';
  }

  function assert(name, condition, detail) {
    var ok = !!condition;
    results.tests.push({ name: name, ok: ok, detail: detail || '' });
    if (ok) results.passed++; else results.failed++;
    log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : ''));
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('Failed to load ' + src)); };
      document.head.appendChild(s);
    });
  }

  function buildConfig(profile) {
      return {
      profileId: profile.id,
      emulateSafariObject: profile.emulateSafariObject,
      frameDelivery: profile.frameDelivery || 'nv12',
      navigator: profile.navigator,
      screen: profile.screen,
      webgl: profile.webgl,
      audio: profile.audio,
      cameras: profile.cameras,
      microphones: profile.microphones,
      mediaCapabilities: profile.mediaCapabilities,
      mediaPresets: profile.mediaPresets,
      frameTiming: profile.frameTiming,
      frameNoise: profile.frameNoise,
      videoTrackSpoof: profile.videoTrackSpoof,
      audioTrackSpoof: profile.audioTrackSpoof
    };
  }

  async function run() {
    logEl.textContent = '';
    try {
      var profileRes = await fetch('/profiles/iphone11_ios265.json');
      var profile = await profileRes.json();
      window.__SAFARI_SPOOF_CONFIG__ = buildConfig(profile);
      window.__SAFARI_SPOOF_FRAME_URL__ = '/injection-lab/test-frame.svg';
      window.webkit = {
        messageHandlers: {
          spoofFrameBridge: {
            postMessage: function (msg) {
              window.__MOCK_BRIDGE_EVENTS__ = window.__MOCK_BRIDGE_EVENTS__ || [];
              window.__MOCK_BRIDGE_EVENTS__.push(msg);
            }
          }
        }
      };

      var modules = [
        '/injection/fingerprint/navigator.js',
        '/injection/fingerprint/screen.js',
        '/injection/fingerprint/webgl.js',
        '/injection/fingerprint/canvas.js',
        '/injection/fingerprint/audio.js',
        '/injection/media/frameReceiver.js',
        '/injection/media/mediaStreamMock.js',
        '/injection/media/getUserMedia.js',
        '/injection/webrtc/enumerateDevices.js'
      ];

      for (var i = 0; i < modules.length; i++) {
        await loadScript(modules[i]);
      }

      assert('config loaded', !!window.__SAFARI_SPOOF_CONFIG__);
      assert('navigator.platform', navigator.platform === 'iPhone');
      assert('navigator.webdriver false', navigator.webdriver === false);
      assert('emulateSafariObject profile', window.__SAFARI_SPOOF_CONFIG__.emulateSafariObject === profile.emulateSafariObject);
      assert('screen.width', screen.width === 414, 'got ' + screen.width);
      assert('screen.height', screen.height === 896, 'got ' + screen.height);
      assert('screen.colorDepth', screen.colorDepth === 24, 'got ' + screen.colorDepth);
      assert('innerHeight', window.innerHeight === 750, 'got ' + window.innerHeight);
      assert('outerHeight', window.outerHeight === 896, 'got ' + window.outerHeight);

      var probe = document.createElement('div');
      probe.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none';
      document.body.appendChild(probe);
      assert('div.clientWidth', probe.clientWidth === 414, 'got ' + probe.clientWidth);
      assert('div.clientHeight', probe.clientHeight === 750, 'got ' + probe.clientHeight);
      probe.remove();

      assert('canvas ready', !!window.__spoofCanvas);

      if (window.__spoofStartFramePoll) {
        window.__spoofStartFramePoll();
        await new Promise(function (r) { setTimeout(r, 300); });
        assert('frame poll draws', window.__spoofCanvas.width > 0);
        window.__spoofStopFramePoll();
      }

      var devicesBefore = await navigator.mediaDevices.enumerateDevices();
      assert('enumerate pre-permission count', devicesBefore.length === 2, 'count=' + devicesBefore.length);
      assert('enumerate pre-permission empty ids', devicesBefore.every(function (d) { return !d.deviceId; }));

      if (typeof window.__spoofSelectMediaPreset === 'function') {
        var hdPreset = window.__spoofSelectMediaPreset({ video: { width: 1280, height: 720 } });
        assert('preset 720p', hdPreset && hdPreset.width === 1280 && hdPreset.height === 720,
          hdPreset ? (hdPreset.width + 'x' + hdPreset.height) : 'none');
      }

      var stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      assert('getUserMedia stream', !!stream && stream.getVideoTracks().length === 1);
      var track = stream.getVideoTracks()[0];
      var settings = track.getSettings();
      assert('track width', settings.width === profile.mediaCapabilities.width, JSON.stringify(settings));
      assert('track deviceId', settings.deviceId === profile.cameras[0].deviceId, JSON.stringify(settings));
      assert('bridge startStream', (window.__MOCK_BRIDGE_EVENTS__ || []).some(function (e) { return e.event === 'startStream'; }));

      var devices = await navigator.mediaDevices.enumerateDevices();
      var cams = devices.filter(function (d) { return d.kind === 'videoinput'; });
      assert('enumerateDevices cameras', cams.length === 2, 'count=' + cams.length);
      assert('front camera label', cams.some(function (c) { return c.label === 'Front Camera'; }));
      assert('front camera deviceId', cams.some(function (c) { return c.deviceId === profile.cameras[0].deviceId; }));

      stream.getTracks().forEach(function (t) { t.stop(); });
    } catch (err) {
      assert('runner', false, err.message || String(err));
    }

    window.__INJECTION_TEST_RESULTS__ = results;
    log('\nDone: ' + results.passed + ' passed, ' + results.failed + ' failed');
  }

  run();
})();