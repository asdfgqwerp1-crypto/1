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
      mediaDefaults: profile.mediaDefaults,
      frameTiming: profile.frameTiming,
      frameNoise: profile.frameNoise,
      videoTrackSpoof: profile.videoTrackSpoof,
      audioTrackSpoof: profile.audioTrackSpoof
    };
  }

  function sampleCanvasCenter() {
    var canvas = window.__spoofCanvas;
    if (!canvas) return null;
    var ctx = canvas.getContext('2d');
    var x = (canvas.width / 2) | 0;
    var y = (canvas.height / 4) | 0;
    var px = ctx.getImageData(x, y, 1, 1).data;
    return { r: px[0], g: px[1], b: px[2] };
  }

  function isPlaceholderGreen(px) {
    if (!px) return true;
    return px.r < 60 && px.g > 40 && px.g < 90 && px.b < 70;
  }

  function coverCropRect(srcW, srcH, dstW, dstH) {
    if (!srcW || !srcH || !dstW || !dstH) {
      return { sx: 0, sy: 0, sw: srcW || dstW, sh: srcH || dstH };
    }
    var srcAspect = srcW / srcH;
    var dstAspect = dstW / dstH;
    var sw, sh, sx, sy;
    if (srcAspect > dstAspect) {
      sh = srcH;
      sw = srcH * dstAspect;
      sx = (srcW - sw) * 0.5;
      sy = 0;
    } else {
      sw = srcW;
      sh = srcW / dstAspect;
      sx = 0;
      sy = (srcH - sh) * 0.5;
    }
    return { sx: sx, sy: sy, sw: sw, sh: sh };
  }

  function testCoverCropMath() {
    var wide = coverCropRect(1920, 1080, 480, 640);
    assert('cover crop 16:9→3:4 crops width', Math.abs(wide.sw - 810) < 0.1,
      'sw=' + wide.sw);
    assert('cover crop 16:9→3:4 centered', Math.abs(wide.sx - 555) < 0.1,
      'sx=' + wide.sx);

    var same = coverCropRect(1280, 720, 1280, 720);
    assert('cover crop same size full frame', same.sw === 1280 && same.sh === 720);
  }

  function countStreamFrames(video, ms) {
    return new Promise(function (resolve) {
      var count = 0;
      var start = performance.now();
      function onFrame() {
        count += 1;
        if (performance.now() - start < ms) {
          video.requestVideoFrameCallback(onFrame);
        } else {
          resolve(count);
        }
      }
      if (typeof video.requestVideoFrameCallback === 'function') {
        video.requestVideoFrameCallback(onFrame);
      } else {
        setTimeout(function () { resolve(0); }, ms);
      }
    });
  }

  async function run() {
    logEl.textContent = '';
    testCoverCropMath();
    try {
      var profileRes = await fetch('/profiles/iphone11_ios265.json');
      var profile = await profileRes.json();
      window.__SAFARI_SPOOF_CONFIG__ = buildConfig(profile);
      var params = new URLSearchParams(window.location.search);
      var mode = params.get('mode') || 'nv12';
      window.__SAFARI_SPOOF_CONFIG__.frameDelivery = mode === 'jpeg' ? 'jpeg' : 'nv12';
      window.__SAFARI_SPOOF_FRAME_URL__ = mode === 'jpeg' ? '/frame/jpeg-live' : '/frame/latest';
      if (mode === 'nv12') {
        window.__spoofPartURL__ = function (_seq, index) {
          return '/frame/part?p=' + index + '&t=' + Date.now();
        };
      }
      window.webkit = {
        messageHandlers: {
          spoofFrameBridge: { postMessage: function () {} }
        }
      };

      await loadScript('/injection/media/frameReceiver.js');
      await loadScript('/injection/media/mediaStreamMock.js');

      window.__spoofResetCanvas();
      window.__spoofStartFramePoll();
      await new Promise(function (r) { setTimeout(r, 1200); });

      assert('frame count after poll', (window.__spoofFrameCount || 0) >= 4,
        'count=' + (window.__spoofFrameCount || 0));

      var px = sampleCanvasCenter();
      assert('canvas not placeholder green', !isPlaceholderGreen(px),
        px ? ('rgb=' + px.r + ',' + px.g + ',' + px.b) : 'no pixel');

      var canvas = window.__spoofCanvas;
      var untainted = true;
      try {
        canvas.getContext('2d').getImageData(0, 0, 1, 1);
      } catch (e) {
        untainted = false;
      }
      assert('canvas not tainted', untainted);

      var stream;
      try {
        stream = canvas.captureStream(16);
      } catch (e) {
        assert('captureStream', false, e.message || String(e));
        stream = null;
      }
      if (!stream) {
        window.__FRAME_PIPELINE_RESULTS__ = results;
        return;
      }
      var video = document.getElementById('preview');
      video.srcObject = stream;
      await video.play();

      var before = sampleCanvasCenter();
      await new Promise(function (r) { setTimeout(r, 400); });
      window.__spoofStartFramePoll();
      await new Promise(function (r) { setTimeout(r, 400); });
      var afterRestart = sampleCanvasCenter();

      assert('poll restart keeps frame', !isPlaceholderGreen(afterRestart),
        afterRestart ? ('rgb=' + afterRestart.r + ',' + afterRestart.g + ',' + afterRestart.b) : 'no pixel');

      var streamFrames = await countStreamFrames(video, 1200);
      assert('captureStream updates', streamFrames >= 4,
        'rVFC=' + streamFrames + ' transport=' + (window.__spoofFrameTransport || 'unknown'));

      if (mode === 'nv12') {
        assert('nv12 chunked transport', window.__spoofFrameTransport === 'chunked-nv12');
      }

      window.__spoofStopFramePoll();
    } catch (err) {
      assert('runner', false, err.message || String(err));
    }

    window.__FRAME_PIPELINE_RESULTS__ = results;
    log('\nDone: ' + results.passed + ' passed, ' + results.failed + ' failed');
  }

  run();
})();