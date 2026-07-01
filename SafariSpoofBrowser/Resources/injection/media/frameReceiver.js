(function () {
  'use strict';
  var config = window.__SAFARI_SPOOF_CONFIG__;
  if (!config) return;

  var caps = config.mediaCapabilities;
  var preferNV12 = config.frameDelivery === 'nv12';
  var canvas = null;
  var ctx = null;
  var pollTimer = null;
  var pollActive = false;
  var pollFrameIndex = 0;
  var isDrawing = false;
  var rgbaBuffer = null;
  var nv12ScratchCanvas = null;
  var noiseScratchCanvas = null;
  var nv12GlRenderer = null;
  var uvUnpackBuffer = null;
  var lastFrameSeq = 0;
  var lastPtsUs = 0;
  var streamStartPtsUs = 0;
  var streamStartPerf = 0;

  function mountCanvas(node) {
    node.style.cssText = 'position:fixed;width:2px;height:2px;opacity:0.01;pointer-events:none;left:0;bottom:0;z-index:-1';
    if (document.documentElement) {
      document.documentElement.appendChild(node);
    }
  }

  function activeCaps() {
    if (typeof window.__spoofGetActiveCaps === 'function') {
      return window.__spoofGetActiveCaps();
    }
    return caps;
  }

  function makeCanvas() {
    var active = activeCaps();
    var node = document.createElement('canvas');
    node.width = active.width;
    node.height = active.height;
    mountCanvas(node);
    return node;
  }

  function drawPlaceholder() {
    if (!ctx || !canvas) return;
    ctx.fillStyle = '#1b4332';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px -apple-system, sans-serif';
    ctx.fillText('Camera loading…', 16, 32);
  }

  // WKWebView often hides X-Frame-* headers even with Access-Control-Expose-Headers.
  var fetchOptions = { cache: 'no-store', credentials: 'omit' };
  var MIN_REAL_FRAME_BYTES = 512;
  var POLL_FETCH_TIMEOUT_MS = 3000;
  var DELIVERY_REBIND_MS = 2000;
  var pollFailCount = 0;
  var lastPollFailLog = 0;
  var lastDeliveryRebind = 0;

  function traceFrame(message, level) {
    if (typeof window.__spoofTrace === 'function') {
      window.__spoofTrace(level || 'info', message, 'frame');
    }
  }

  function fetchWithTimeout(url, options, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        reject(new Error('poll timeout'));
      }, timeoutMs);
      fetch(url, options).then(function (response) {
        clearTimeout(timer);
        resolve(response);
      }).catch(function (err) {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  function logPollFail(reason) {
    pollFailCount += 1;
    var now = Date.now();
    if (now - lastPollFailLog < 2000) return;
    lastPollFailLog = now;
    traceFrame('poll fail #' + pollFailCount + ': ' + reason, 'warn');
  }

  function schemeAuthKey() {
    return (config && config.schemeAuthKey) || '';
  }

  function withSchemeAuth(url) {
    var key = schemeAuthKey();
    var out = url;
    if (key) {
      out += (out.indexOf('?') >= 0 ? '&' : '?') + 'k=' + encodeURIComponent(key);
    }
    return out;
  }

  function frameURL() {
    var base = window.__SAFARI_SPOOF_FRAME_URL__ || 'spoofframe://frame/latest';
    return withSchemeAuth(base + (base.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now());
  }

  function partURL(index) {
    if (typeof window.__spoofPartURL__ === 'function') {
      return window.__spoofPartURL__(0, index);
    }
    return withSchemeAuth('spoofframe://frame/part?p=' + index + '&t=' + Date.now());
  }

  function jpegMirrorURL() {
    return withSchemeAuth('spoofframe://frame/jpeg?t=' + Date.now());
  }

  function fetchJpegMirror(meta, onDone) {
    window.__spoofFrameTransport = 'jpeg-mirror-fallback';
    fetch(jpegMirrorURL(), fetchOptions)
      .then(function (response) {
        if (!response.ok) throw new Error('bad jpeg mirror');
        return response.blob();
      })
      .then(function (blob) {
        drawBlobAsImage(blob, meta, function () {
          if (onDone) onDone(true);
        });
      })
      .catch(function () {
        if (onDone) onDone(false);
      });
  }

  function blobToArrayBuffer(blob) {
    if (typeof blob.arrayBuffer === 'function') {
      return blob.arrayBuffer();
    }
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    });
  }

  function noteRealFrame(meta, payloadBytes, pixelW, pixelH) {
    var bytes = payloadBytes || 0;
    var w = pixelW || 0;
    var h = pixelH || 0;
    // WKWebView: fetch(spoofframe://) fails; Image path has no byte length — use decoded size.
    if (w >= 64 && h >= 64) {
      window.__spoofGotRealFrame = true;
      window.__spoofLastFrameBytes = Math.max(bytes || w * h, window.__spoofLastFrameBytes || 0);
      return;
    }
    if (bytes > MIN_REAL_FRAME_BYTES) {
      window.__spoofGotRealFrame = true;
      window.__spoofLastFrameBytes = Math.max(bytes, window.__spoofLastFrameBytes || 0);
    }
  }

  function markFrameDrawn(meta, payloadBytes, pixelW, pixelH) {
    window.__spoofFrameCount = (window.__spoofFrameCount || 0) + 1;
    pollFrameIndex += 1;
    if (meta) {
      window.__spoofLastFrameSeq = meta.seq;
      window.__spoofLastPtsUs = meta.ptsUs;
    }
    noteRealFrame(meta, payloadBytes, pixelW, pixelH);
  }

  function seededRng(seed) {
    var state = seed >>> 0;
    return function () {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  function gaussian(rng) {
    var u = 0;
    var v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function noiseDownscaleFor(width, height) {
    var pixels = width * height;
    if (pixels >= 1244160) return 3;
    if (pixels >= 307200) return 2;
    return 1;
  }

  function applySensorNoise(ctx, width, height, frameSeed) {
    var noise = config.frameNoise;
    if (!noise || noise.enabled === false || !ctx || !canvas) return;

    var downscale = noiseDownscaleFor(width, height);
    var nw = Math.max(1, Math.round(width / downscale));
    var nh = Math.max(1, Math.round(height / downscale));
    var scratch = ensureNoiseScratchCanvas(nw, nh);
    var scratchCtx = scratch.getContext('2d');
    scratchCtx.drawImage(canvas, 0, 0, width, height, 0, 0, nw, nh);

    var rng = seededRng(((noise.seed || 0) ^ (frameSeed || 0)) >>> 0);
    var readSigma = noise.readSigma != null ? noise.readSigma : 1.0;
    var shotScale = noise.shotScale != null ? noise.shotScale : 2.5;
    var chromaR = noise.chromaR != null ? noise.chromaR : 1.0;
    var chromaG = noise.chromaG != null ? noise.chromaG : 0.85;
    var chromaB = noise.chromaB != null ? noise.chromaB : 1.3;
    var image = scratchCtx.getImageData(0, 0, nw, nh);
    var d = image.data;
    var inv255 = 1 / 255;

    for (var i = 0; i < d.length; i += 4) {
      var r = d[i];
      var g = d[i + 1];
      var b = d[i + 2];
      var luma = (0.299 * r + 0.587 * g + 0.114 * b) * inv255;
      var sigma = readSigma + shotScale * Math.sqrt(Math.max(luma, 0));
      var n = sigma * gaussian(rng);
      d[i] = clampByte(r + n * chromaR);
      d[i + 1] = clampByte(g + n * chromaG);
      d[i + 2] = clampByte(b + n * chromaB);
    }

    scratchCtx.putImageData(image, 0, 0);
    ctx.drawImage(scratch, 0, 0, nw, nh, 0, 0, width, height);
  }

  function ensureNoiseScratchCanvas(width, height) {
    if (!noiseScratchCanvas) {
      noiseScratchCanvas = document.createElement('canvas');
    }
    if (noiseScratchCanvas.width !== width || noiseScratchCanvas.height !== height) {
      noiseScratchCanvas.width = width;
      noiseScratchCanvas.height = height;
    }
    return noiseScratchCanvas;
  }

  function finishFrame(meta, onDone, payloadBytes, pixelW, pixelH) {
    if (ctx && canvas) {
      applySensorNoise(ctx, canvas.width, canvas.height, meta ? meta.seq : pollFrameIndex);
    }
    markFrameDrawn(meta, payloadBytes, pixelW, pixelH);
    if (onDone) onDone();
  }

  function nextPollDelayMs() {
    var timing = config.frameTiming || {};
    var fps = timing.targetFrameRate || 30;
    var ms = 1000 / fps;
    var jitter = Math.random() * ((timing.jitterMsMax || 14) - (timing.jitterMsMin || -8)) + (timing.jitterMsMin || -8);
    ms += jitter;
    var hitchEvery = timing.exposureHitchInterval || 60;
    var onHitch = hitchEvery > 0 && pollFrameIndex > 0 && pollFrameIndex % hitchEvery === 0;
    if (onHitch) {
      ms += Math.random() * ((timing.exposureHitchMsMax || 18) - (timing.exposureHitchMsMin || 6)) + (timing.exposureHitchMsMin || 6);
    }
    if (Math.random() < (timing.slowdownProbability || 0)) {
      ms *= Math.random() * ((timing.slowdownFactorMax || 1.32) - (timing.slowdownFactorMin || 1.1)) + (timing.slowdownFactorMin || 1.1);
    }
    if (!onHitch && timing.minDeliverFps) {
      ms = Math.min(ms, 1000 / timing.minDeliverFps);
    }
    return Math.max(28, ms);
  }

  function clampByte(v) {
    return v < 0 ? 0 : (v > 255 ? 255 : v);
  }

  function ensureRgbaBuffer(width, height) {
    if (!rgbaBuffer || rgbaBuffer.width !== width || rgbaBuffer.height !== height) {
      rgbaBuffer = new ImageData(width, height);
    }
    return rgbaBuffer;
  }

  function nv12ToRGBA(nv12, width, height, out) {
    var ySize = width * height;
    var y = new Uint8Array(nv12, 0, ySize);
    var uv = new Uint8Array(nv12, ySize);
    var rgba = out.data;
    var uvWidth = width;

    for (var row = 0; row < height; row++) {
      var yRow = row * width;
      var uvRow = (row >> 1) * uvWidth;
      for (var col = 0; col < width; col++) {
        var yVal = y[yRow + col];
        var uvIndex = uvRow + (col & ~1);
        var u = uv[uvIndex] - 128;
        var v = uv[uvIndex + 1] - 128;
        var c = yVal - 16;
        if (c < 0) c = 0;
        var r = (298 * c + 409 * v + 128) >> 8;
        var g = (298 * c - 100 * u - 208 * v + 128) >> 8;
        var b = (298 * c + 516 * u + 128) >> 8;
        var i = (yRow + col) * 4;
        rgba[i] = clampByte(r);
        rgba[i + 1] = clampByte(g);
        rgba[i + 2] = clampByte(b);
        rgba[i + 3] = 255;
      }
    }
  }

  function headerValue(response, name) {
    try {
      return response.headers.get(name) || response.headers.get(name.toLowerCase()) || '';
    } catch (e) {
      return '';
    }
  }

  function parseFrameHeaders(response) {
    var contentType = headerValue(response, 'Content-Type');
    var formatHeader = headerValue(response, 'X-Frame-Format');
    return {
      contentType: contentType,
      formatHeader: formatHeader,
      width: parseInt(headerValue(response, 'X-Frame-Width') || String(caps.width), 10),
      height: parseInt(headerValue(response, 'X-Frame-Height') || String(caps.height), 10),
      seq: parseInt(headerValue(response, 'X-Frame-Seq') || '0', 10),
      ptsUs: parseInt(headerValue(response, 'X-Frame-PTS-Us') || '0', 10),
      chunkCount: parseInt(headerValue(response, 'X-Frame-Chunks') || '0', 10)
    };
  }

  function fetchChunkedNV12(meta, onDone) {
    var parts = meta.chunkCount;
    if (!parts || parts < 2) {
      if (onDone) onDone(false);
      return;
    }
    window.__spoofFrameTransport = 'chunked-nv12';
    var buffers = new Array(parts);
    var failed = false;

    function fetchPart(index) {
      if (failed) return;
      if (index >= parts) {
        var total = 0;
        var i;
        for (i = 0; i < buffers.length; i++) {
          if (!buffers[i]) {
            fetchJpegMirror(meta, onDone);
            return;
          }
          total += buffers[i].byteLength;
        }
        var out = new Uint8Array(total);
        var offset = 0;
        for (i = 0; i < buffers.length; i++) {
          out.set(new Uint8Array(buffers[i]), offset);
          offset += buffers[i].byteLength;
        }
        if (drawNV12(out.buffer, meta)) {
          if (onDone) onDone(true);
        } else {
          fetchJpegMirror(meta, onDone);
        }
        return;
      }
      fetch(partURL(index), fetchOptions)
        .then(function (response) {
          if (!response.ok) throw new Error('bad chunk');
          return response.blob().then(function (blob) {
            return blobToArrayBuffer(blob);
          });
        })
        .then(function (buf) {
          buffers[index] = buf;
          fetchPart(index + 1);
        })
        .catch(function () {
          failed = true;
          fetchJpegMirror(meta, onDone);
        });
    }

    fetchPart(0);
  }

  function expectedNV12Bytes(width, height) {
    return ((width * height * 3) / 2) | 0;
  }

  function isJpegBuffer(buffer) {
    if (!buffer || buffer.byteLength < 2) return false;
    var bytes = new Uint8Array(buffer, 0, 2);
    return bytes[0] === 0xFF && bytes[1] === 0xD8;
  }

  function detectFrameFormat(buffer, meta) {
    if (meta.formatHeader === 'nv12') return 'nv12';
    if (meta.formatHeader === 'jpeg') return 'jpeg';
    if (meta.contentType.indexOf('nv12') >= 0) return 'nv12';
    if (meta.contentType.indexOf('jpeg') >= 0) return 'jpeg';

    var width = meta.width || caps.width;
    var height = meta.height || caps.height;
    if (isJpegBuffer(buffer)) return 'jpeg';
    if (buffer.byteLength >= expectedNV12Bytes(width, height)) return 'nv12';
    if (preferNV12) return 'nv12';
    return 'jpeg';
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

  function drawImageCover(ctx, source, dstW, dstH) {
    var srcW = source.width;
    var srcH = source.height;
    if (!srcW || !srcH) return;
    if (typeof ctx.imageSmoothingEnabled !== 'undefined') {
      ctx.imageSmoothingEnabled = true;
      if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
    }
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, dstW, dstH);
    if (srcW === dstW && srcH === dstH) {
      ctx.drawImage(source, 0, 0, dstW, dstH);
      return;
    }
    var crop = coverCropRect(srcW, srcH, dstW, dstH);
    ctx.drawImage(source, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, dstW, dstH);
  }

  function ensureScratchCanvas(width, height) {
    if (!nv12ScratchCanvas) {
      nv12ScratchCanvas = document.createElement('canvas');
    }
    if (nv12ScratchCanvas.width !== width || nv12ScratchCanvas.height !== height) {
      nv12ScratchCanvas.width = width;
      nv12ScratchCanvas.height = height;
    }
    return nv12ScratchCanvas;
  }

  function createShader(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return null;
    return shader;
  }

  function createNV12GlRenderer(width, height) {
    var node = document.createElement('canvas');
    node.width = width;
    node.height = height;
    var gl = node.getContext('webgl', { premultipliedAlpha: false, antialias: false });
    if (!gl) return null;

    var vs = createShader(gl, gl.VERTEX_SHADER, [
      'attribute vec2 a_pos;',
      'varying vec2 v_uv;',
      'void main(){',
      '  v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);',
      '  gl_Position = vec4(a_pos, 0.0, 1.0);',
      '}'
    ].join('\n'));
    var fs = createShader(gl, gl.FRAGMENT_SHADER, [
      'precision mediump float;',
      'varying vec2 v_uv;',
      'uniform sampler2D y_tex;',
      'uniform sampler2D uv_tex;',
      'void main(){',
      '  float y = texture2D(y_tex, v_uv).r;',
      '  vec2 uv = texture2D(uv_tex, v_uv).ra;',
      '  float c = max(y - 0.06274509803921569, 0.0);',
      '  float d = uv.r - 0.5;',
      '  float e = uv.g - 0.5;',
      '  float r = c + 1.5748 * e;',
      '  float g = c - 0.187324 * d - 0.468124 * e;',
      '  float b = c + 1.8556 * d;',
      '  gl_FragColor = vec4(clamp(r, 0.0, 1.0), clamp(g, 0.0, 1.0), clamp(b, 0.0, 1.0), 1.0);',
      '}'
    ].join('\n'));
    if (!vs || !fs) return null;

    var program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
    gl.useProgram(program);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    var yTex = gl.createTexture();
    var uvTex = gl.createTexture();

    function setupTex(tex, unit) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }
    setupTex(yTex, 0);
    setupTex(uvTex, 1);
    gl.uniform1i(gl.getUniformLocation(program, 'y_tex'), 0);
    gl.uniform1i(gl.getUniformLocation(program, 'uv_tex'), 1);

    return {
      canvas: node,
      gl: gl,
      width: width,
      height: height,
      yTex: yTex,
      uvTex: uvTex,
      unpackUV: function (nv12) {
        var ySize = width * height;
        var uvSrc = new Uint8Array(nv12, ySize);
        var uvW = width >> 1;
        var uvH = height >> 1;
        var need = uvW * uvH * 2;
        if (!uvUnpackBuffer || uvUnpackBuffer.length !== need) {
          uvUnpackBuffer = new Uint8Array(need);
        }
        var dst = uvUnpackBuffer;
        for (var row = 0; row < uvH; row++) {
          var srcRow = row * width;
          var dstRow = row * uvW * 2;
          for (var pair = 0; pair < uvW; pair++) {
            var src = srcRow + (pair << 1);
            var dstIdx = dstRow + (pair << 1);
            dst[dstIdx] = uvSrc[src];
            dst[dstIdx + 1] = uvSrc[src + 1];
          }
        }
        return dst;
      },
      draw: function (nv12) {
        var ySize = width * height;
        gl.viewport(0, 0, width, height);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, yTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, width, height, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array(nv12, 0, ySize));
        var uvData = this.unpackUV(nv12);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, uvTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE_ALPHA, width >> 1, height >> 1, 0, gl.LUMINANCE_ALPHA, gl.UNSIGNED_BYTE, uvData);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    };
  }

  function ensureNV12GlRenderer(width, height) {
    if (nv12GlRenderer && nv12GlRenderer.width === width && nv12GlRenderer.height === height) {
      return nv12GlRenderer;
    }
    nv12GlRenderer = createNV12GlRenderer(width, height);
    return nv12GlRenderer;
  }

  function blitNV12ToCanvas(buffer, width, height) {
    var renderer = ensureNV12GlRenderer(width, height);
    if (renderer) {
      renderer.draw(buffer);
      drawImageCover(ctx, renderer.canvas, canvas.width, canvas.height);
      return true;
    }
    var image = ensureRgbaBuffer(width, height);
    nv12ToRGBA(buffer, width, height, image);
    var scratch = ensureScratchCanvas(width, height);
    scratch.getContext('2d').putImageData(image, 0, 0);
    drawImageCover(ctx, scratch, canvas.width, canvas.height);
    return true;
  }

  function drawNV12(buffer, meta) {
    if (!ctx || !canvas) return false;
    var width = meta.width || canvas.width;
    var height = meta.height || canvas.height;
    if (buffer.byteLength < expectedNV12Bytes(width, height)) return false;
    blitNV12ToCanvas(buffer, width, height);
    if (meta.seq > lastFrameSeq) lastFrameSeq = meta.seq;
    if (meta.ptsUs >= lastPtsUs) lastPtsUs = meta.ptsUs;
    finishFrame(meta, null, buffer.byteLength, width, height);
    return true;
  }

  function shouldUseNV12(meta, byteLength) {
    if (!preferNV12) return false;
    if (meta.formatHeader === 'jpeg') return false;
    if (meta.contentType.indexOf('jpeg') >= 0) return false;
    if (meta.formatHeader === 'nv12') return true;
    if (meta.contentType.indexOf('nv12') >= 0) return true;
    var width = meta.width || caps.width;
    var height = meta.height || caps.height;
    return byteLength >= expectedNV12Bytes(width, height);
  }

  function drawBitmap(bitmap, meta, onDone, payloadBytes) {
    if (!ctx || !canvas) {
      if (bitmap && bitmap.close) bitmap.close();
      if (onDone) onDone();
      return;
    }
    drawImageCover(ctx, bitmap, canvas.width, canvas.height);
    if (bitmap.close) bitmap.close();
    finishFrame(meta, onDone, payloadBytes || 0, bitmap.width, bitmap.height);
  }

  function drawImageSource(src, revoke, meta, onDone, payloadBytes) {
    if (!ctx || !canvas) {
      if (onDone) onDone();
      return;
    }
    var img = new Image();
    // crossOrigin on blob:/custom schemes taints canvas and breaks captureStream().
    if (String(src).indexOf('blob:') !== 0 && String(src).indexOf('spoofframe:') !== 0) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = function () {
      drawImageCover(ctx, img, canvas.width, canvas.height);
      if (revoke) URL.revokeObjectURL(src);
      finishFrame(meta, onDone, payloadBytes || 0, img.naturalWidth, img.naturalHeight);
    };
    img.onerror = function () {
      if (revoke) URL.revokeObjectURL(src);
      if (onDone) onDone();
    };
    img.src = src;
  }

  function drawBlobAsImage(blob, meta, onDone) {
    var blobSize = blob && blob.size ? blob.size : 0;
    if (typeof createImageBitmap === 'function') {
      createImageBitmap(blob).then(function (bitmap) {
        drawBitmap(bitmap, meta, onDone, blobSize);
      }).catch(function () {
        drawImageSource(URL.createObjectURL(blob), true, meta, onDone, blobSize);
      });
      return;
    }
    drawImageSource(URL.createObjectURL(blob), true, meta, onDone, blobSize);
  }

  function handleBuffer(buffer, meta, release) {
    if (isJpegBuffer(buffer)) {
      drawBlobAsImage(new Blob([buffer], { type: 'image/jpeg' }), meta, release);
      return;
    }
    if (shouldUseNV12(meta, buffer.byteLength)) {
      if (drawNV12(buffer, meta)) {
        release();
        return;
      }
    }
    drawBlobAsImage(new Blob([buffer], { type: 'image/jpeg' }), meta, release);
  }

  window.__spoofOnJPEGPush = function (payload) {
    if (!payload || !payload.b64 || !ctx || !canvas) return;
    try {
      var meta = {
        seq: payload.seq || 0,
        ptsUs: payload.pts || 0,
        width: payload.w || 0,
        height: payload.h || 0
      };
      var binary = atob(payload.b64);
      var len = binary.length;
      var bytes = new Uint8Array(len);
      for (var i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
      window.__spoofFrameTransport = 'native-push';
      window.__spoofLastNativePush = Date.now();
      if (!window.__spoofLoggedPush) {
        window.__spoofLoggedPush = true;
        traceFrame('native push bytes=' + len, 'info');
      }
      handleBuffer(bytes.buffer, meta, function () {});
    } catch (e) {
      traceFrame('native push decode fail: ' + (e && e.message), 'error');
    }
  };

  function drawFrameViaXHR(onDone) {
    var xhr = new XMLHttpRequest();
    var released = false;
    function release() {
      if (released) return;
      released = true;
      isDrawing = false;
      if (onDone) onDone();
    }
    xhr.open('GET', frameURL(), true);
    xhr.responseType = 'blob';
    xhr.onload = function () {
      if (xhr.status !== 200 || !xhr.response) {
        logPollFail('xhr status ' + xhr.status);
        release();
        return;
      }
      window.__spoofFrameTransport = 'scheme-xhr';
      drawBlobAsImage(xhr.response, null, release);
    };
    xhr.onerror = function () {
      logPollFail('xhr failed');
      release();
    };
    xhr.send();
  }

  function maybeRebindDeliveryFrame() {
    if (!pollActive || typeof window.__spoofSendControl !== 'function') return;
    if (!window.__spoofIsDeliveryOwner) return;
    var now = Date.now();
    if (now - lastDeliveryRebind < DELIVERY_REBIND_MS) return;
    var lastPush = window.__spoofLastNativePush || 0;
    if (!lastPush) {
      if (now - streamStartPerf < DELIVERY_REBIND_MS) return;
    } else if (now - lastPush < DELIVERY_REBIND_MS) {
      return;
    }
    var active = activeCaps();
    lastDeliveryRebind = now;
    window.__spoofLoggedPush = false;
    traceFrame('delivery rebind stale=' + (now - lastPush) + 'ms owner=' + (location.host || 'main'), 'info');
    window.__spoofSendControl('stream/start', {
      width: active.width,
      height: active.height,
      frameRate: active.frameRate || 30,
      ownerHost: location.hostname || '',
      href: location.href || '',
      rebind: true
    });
  }

  function stopPollIfBackground() {
    if (document.visibilityState !== 'visible' && pollActive && window.__spoofStopFramePoll) {
      window.__spoofStopFramePoll();
    }
  }

  function drawFrame() {
    if (!ctx || !canvas) return;
    maybeRebindDeliveryFrame();
    if (isDrawing) {
      if (Date.now() - (window.__spoofDrawStartedAt || 0) > POLL_FETCH_TIMEOUT_MS + 500) {
        isDrawing = false;
      } else {
        return;
      }
    }
    if (Date.now() - (window.__spoofLastNativePush || 0) < 30) return;
    isDrawing = true;
    window.__spoofDrawStartedAt = Date.now();
    var released = false;
    function release() {
      if (released) return;
      released = true;
      isDrawing = false;
    }

    // JPEG: native push is primary; XHR blob fallback (never Image — taints canvas).
    if (!preferNV12) {
      if (Date.now() - (window.__spoofLastNativePush || 0) < 80) {
        release();
        return;
      }
      drawFrameViaXHR(release);
      return;
    }

    if (typeof fetch !== 'function') {
      drawFrameViaXHR(release);
      return;
    }

    fetchWithTimeout(frameURL(), fetchOptions, POLL_FETCH_TIMEOUT_MS)
      .then(function (response) {
        if (!response.ok) throw new Error('bad status ' + response.status);
        var meta = parseFrameHeaders(response);
        if (meta.chunkCount > 1 && (meta.formatHeader === 'nv12' || preferNV12)) {
          fetchChunkedNV12(meta, function () {
            release();
          });
          return;
        }
        return response.blob().then(function (blob) {
          if (shouldUseNV12(meta, blob.size)) {
            return blobToArrayBuffer(blob).then(function (buf) {
              handleBuffer(buf, meta, release);
            });
          }
          window.__spoofFrameTransport = 'jpeg-blob';
          drawBlobAsImage(blob, meta, release);
        });
      })
      .catch(function (err) {
        logPollFail(err && err.message ? err.message : 'fetch failed');
        drawFrameViaXHR(release);
      });
  }

  function schedulePoll() {
    if (!pollActive) return;
    var delay = nextPollDelayMs();
    pollTimer = setTimeout(function () {
      drawFrame();
      schedulePoll();
    }, delay);
  }

  window.__spoofResetCanvas = function () {
    pollActive = false;
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
    isDrawing = false;
    lastFrameSeq = 0;
    lastPtsUs = 0;
    pollFrameIndex = 0;
    streamStartPtsUs = 0;
    streamStartPerf = 0;
    if (canvas && canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
    }
    canvas = makeCanvas();
    ctx = canvas.getContext('2d');
    window.__spoofCanvas = canvas;
    window.__spoofCanvasCtx = ctx;
    window.__spoofFrameCount = 0;
    window.__spoofGotRealFrame = false;
    window.__spoofLastFrameBytes = 0;
    window.__spoofCanvasTainted = false;
    window.__spoofLoggedPush = false;
    drawPlaceholder();
  };

  window.__spoofStartFramePoll = function () {
    if (!canvas) window.__spoofResetCanvas();
    if (pollActive) {
      if (!pollTimer && !isDrawing) {
        schedulePoll();
      }
      return;
    }
    traceFrame('poll start ' + (canvas ? canvas.width + 'x' + canvas.height : 'no-canvas'), 'info');
    streamStartPerf = performance.now();
    streamStartPtsUs = 0;
    if ((window.__spoofFrameCount || 0) === 0) {
      drawPlaceholder();
    }
    drawFrame();
    pollActive = true;
    schedulePoll();
  };

  window.__spoofStopFramePoll = function () {
    pollActive = false;
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
    window.__spoofFrameCount = 0;
    window.__spoofGotRealFrame = false;
    window.__spoofLastFrameBytes = 0;
    window.__spoofLastNativePush = 0;
    window.__spoofIsDeliveryOwner = false;
  };

  window.__spoofReceiveFrame = function () {};

  window.__spoofResetCanvas();
  document.addEventListener('visibilitychange', stopPollIfBackground);
  window.addEventListener('pagehide', function () {
    if (window.__spoofStopFramePoll) window.__spoofStopFramePoll();
  });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (canvas && !canvas.parentNode) mountCanvas(canvas);
    });
  }

  ['__spoofCanvas', '__spoofCanvasCtx', '__spoofFrameCount', '__spoofStartFramePoll',
    '__spoofStopFramePoll', '__spoofResetCanvas', '__spoofReceiveFrame'].forEach(function (key) {
    try {
      var val = window[key];
      Object.defineProperty(window, key, {
        value: val,
        enumerable: false,
        configurable: true,
        writable: true
      });
    } catch (e) {}
  });
})();