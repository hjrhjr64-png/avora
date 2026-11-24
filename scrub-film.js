'use strict';

// The second half of the H.264 picture carries the original matte. RGB was
// composited on the page grey before encoding to keep the soft shadow clean.
class MatteCanvas {
  constructor(canvas, sideBySide) {
    this.canvas = canvas;
    this.sideBySide = sideBySide;
    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
      antialias: false,
      depth: false,
      stencil: false
    });
    if (!gl) {
      this.ctx = canvas.getContext('2d');
      this.scratch = document.createElement('canvas');
      return;
    }
    this.gl = gl;
    const program = gl.createProgram();
    const shaders = [
      [
        gl.VERTEX_SHADER,
        'attribute vec2 p; varying vec2 uv; void main(){uv=vec2((p.x+1.)*.5,(1.-p.y)*.5);gl_Position=vec4(p,0.,1.);}'
      ],
      [
        gl.FRAGMENT_SHADER,
        `precision highp float;
        varying vec2 uv;
        uniform sampler2D picture;
        uniform vec2 split;
        uniform bool still;
        void main(){
          if(still){vec4 c=texture2D(picture,uv);gl_FragColor=vec4(c.rgb*c.a,c.a);return;}
          vec2 coord=uv*split;
          vec3 rgb=texture2D(picture,coord).rgb;
          float alpha=texture2D(picture,coord+1.-split).r;
          gl_FragColor=vec4(clamp(rgb-vec3((1.-alpha)*225./255.),0.,alpha),alpha);
        }`
      ]
    ];
    for (const [kind, src] of shaders) {
      const shader = gl.createShader(kind);
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(gl.getUniformLocation(program, 'split'), sideBySide ? 0.5 : 1, sideBySide ? 1 : 0.5);
    this.still = gl.getUniformLocation(program, 'still');
    this.staticTextures = new WeakMap();
    this.videoTexture = this.texture();
  }
  texture() {
    const gl = this.gl,
      texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    for (const key of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T])
      gl.texParameteri(gl.TEXTURE_2D, key, gl.CLAMP_TO_EDGE);
    for (const key of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER])
      gl.texParameteri(gl.TEXTURE_2D, key, gl.LINEAR);
    return texture;
  }
  async warmStill(source, width) {
    const w = Math.min(width, source.naturalWidth);
    const h = Math.round(w * source.naturalHeight / source.naturalWidth);
    let plane;
    if (window.createImageBitmap) {
      try {
        plane = await createImageBitmap(source, {
          resizeWidth:w, resizeHeight:h, resizeQuality:'high', premultiplyAlpha:'none'
        });
        if (plane.width !== w || plane.height !== h) {
          plane.close();
          plane = null;
        }
      } catch { /* Some engines do not support resizing an ImageBitmap. */ }
    }
    if (!plane) {
      plane = document.createElement('canvas');
      plane.width = w;
      plane.height = h;
      plane.getContext('2d').drawImage(source, 0, 0, w, h);
    }
    if (this.gl) {
      const gl = this.gl,
        texture = this.texture();
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, plane);
      this.staticTextures.set(plane, texture);
      gl.bindTexture(gl.TEXTURE_2D, this.videoTexture);
    }
    return plane;
  }
  draw(source, still, crop) {
    const {gl, canvas} = this;
    let x = 0,
      y = 0,
      w = canvas.width,
      h = canvas.height;
    if (crop && !still) {
      const [left, top, width, height, fullWidth, fullHeight] = crop;
      x = Math.round((left * canvas.width) / fullWidth);
      y = Math.round((top * canvas.height) / fullHeight);
      w = Math.round(((left + width) * canvas.width) / fullWidth) - x;
      h = Math.round(((top + height) * canvas.height) / fullHeight) - y;
    }
    if (gl) {
      gl.viewport(x, canvas.height - y - h, w, h);
      gl.uniform1i(this.still, still ? 1 : 0);
      const texture = still && this.staticTextures.get(source);
      gl.bindTexture(gl.TEXTURE_2D, texture || this.videoTexture);
      if (!texture) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      return;
    }
    const ctx = this.ctx;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (still) {
      ctx.drawImage(source, 0, 0, w, h);
      return;
    }
    const scratch = this.scratch,
      sw = this.sideBySide ? w * 2 : w,
      sh = this.sideBySide ? h : h * 2;
    if (scratch.width !== sw || scratch.height !== sh) {
      scratch.width = sw;
      scratch.height = sh;
    }
    const read = scratch.getContext('2d', {willReadFrequently: true});
    read.drawImage(source, 0, 0, sw, sh);
    const color = read.getImageData(0, 0, w, h);
    const mask = read.getImageData(this.sideBySide ? w : 0, this.sideBySide ? 0 : h, w, h).data;
    for (let i = 0; i < mask.length; i += 4) {
      const alpha = mask[i] / 255;
      for (let c = 0; c < 3; c++)
        color.data[i + c] = alpha ? (color.data[i + c] - 225 * (1 - alpha)) / alpha : 0;
      color.data[i + 3] = mask[i];
    }
    ctx.putImageData(color, x, y);
  }
}

// Short, independently decodable groups allow a change of direction without
// rewinding a playing movie. On the web, fetch those groups as they are needed.
class ScrubFilm {
  constructor(
    canvas,
    {path, matte, draw, offset = () => 0, stillPaths = {}, fallback}
  ) {
    Object.assign(this, {canvas, path, draw, offset, stillPaths, fallback, matteLayout: matte});
    if (!matte) this.context = canvas.getContext('2d');
    this.frames = new Map();
    this.stills = new Map();
    this.masters = new Map();
    this.direction = 1;
  }
  paths() {
    return [this.path + '.mp4', this.path + '.json', ...Object.values(this.stillPaths)];
  }
  setRasterWidth(width) {
    if (this.rasterWidth === width) return;
    this.rasterWidth = width;
    this.shown = null;
    for (const [index, image] of this.masters) this.prepareStill(index, image).catch(() => {});
  }
  async prepareStill(index, image) {
    const width = this.rasterWidth;
    this.masters.set(index, image);
    this.matte ??= new MatteCanvas(this.canvas, this.matteLayout === 'side');
    const plane = await this.matte.warmStill(image, width);
    const discard = this.rasterWidth === width ? this.stills.get(index) : plane;
    if (discard) {
      if (this.matte.gl) this.matte.gl.deleteTexture(this.matte.staticTextures.get(discard));
      discard.close?.();
    }
    if (this.rasterWidth === width) {
      this.stills.set(index, plane);
      if (this.shown?.index === index) this.shown = null;
      schedule();
    }
  }
  warmStills() {
    return this.loadingStills ??= Promise.allSettled(
      Object.entries(this.stillPaths).map(async ([index, path]) => {
        const image = new Image();
        const url = await mediaSource(path);
        try {
          image.src = url;
          await image.decode();
          await this.prepareStill(+index, image);
        } finally {
          if (url !== path) URL.revokeObjectURL(url);
        }
      })
    );
  }
  loadOnline(preload = {}) {
    return this.loading ??= this.prepare(true, preload).then(schedule, () => {
      this.failed = true;
      schedule();
    });
  }
  async preloadMovie({signal, progress = () => {}}) {
    const response = await fetch(this.remoteVideo, {signal});
    if (!response.ok) throw new Error('Unavailable film ' + this.remoteVideo);
    const size = Number(response.headers.get('Content-Length'));
    if (!response.body || !size || response.headers.has('Content-Encoding')) {
      this.bytes = new Uint8Array(await response.arrayBuffer());
      return;
    }
    const download = {bytes:new Uint8Array(size), received:0};
    const reader = response.body.getReader();
    this.download = download;
    try {
      for (;;) {
        const {done, value} = await reader.read();
        if (done) break;
        download.bytes.set(value, download.received);
        download.received += value.length;
        progress(download.received / size);
      }
      if (download.received !== size || size < this.starts.at(-1)) throw new Error('Incomplete film');
      this.bytes = download.bytes;
      this.groups.clear();
    } finally {
      this.download = null;
    }
  }
  async prepare(online = false, preload) {
    const manifestPath = this.path + '.json';
    const [blob, manifest] = await Promise.all([
      online ? null : cachedMedia(this.path + '.mp4'),
      online ? fetch(manifestPath).then(response => {
        if (!response.ok) throw new Error('Missing film index ' + manifestPath);
        return response;
      }) : cachedMedia(manifestPath)
    ]);
    if ((!online && !blob) || !manifest) throw new Error('Missing film ' + this.path);
    this.blob = blob;
    const m = JSON.parse(await manifest.text());
    const [num, den] = m.fps.split('/').map(Number);
    this.fps = num / den;
    this.starts = [m.offset];
    for (const size of m.sizes) this.starts.push(this.starts.at(-1) + size);
    if (online) {
      this.remoteVideo = this.path + '.mp4';
      this.groups = new Map();
      if (preload?.blocking) {
        try { await this.preloadMovie(preload); }
        catch { /* Keep range and still-image playback available after an interrupted download. */ }
      }
    }
    if (!online || (preload?.blocking && !preload.deferStills)) await this.warmStills();
    try {
      const description = Uint8Array.from(m.avcc.match(/../g), (v) => parseInt(v, 16));
      const config = {
        codec: 'avc1.' + m.avcc.slice(2, 8),
        description,
        codedWidth: m.width,
        codedHeight: m.height,
        optimizeForLatency: true
      };
      if (!window.VideoDecoder || !(await VideoDecoder.isConfigSupported(config)).supported)
        throw new Error('native seek');
      if (this.blob) {
        this.bytes = new Uint8Array(await this.blob.arrayBuffer());
        if (online) this.blob = null;
      }
      this.config = config;
      if (online && preload && !preload.blocking) this.preloadMovie(preload).then(schedule, schedule);
    } catch {
      try {
        await this.nativeVideo();
      } catch {
        this.failed = true;
      }
    }
    this.meta = m;
  }
  async nativeVideo() {
    if (this.video) return;
    const v = (this.video = document.createElement('video'));
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    await new Promise((resolve, reject) => {
      v.onloadeddata = resolve;
      v.onerror = reject;
      const local = this.blob ?? (this.bytes && new Blob([this.bytes], {type:'video/mp4'}));
      v.src = local ? URL.createObjectURL(local) : this.remoteVideo;
      if (local && this.remoteVideo) {
        // The object URL owns the compressed movie during native seeking.
        this.bytes = null;
        this.blob = null;
      }
    });
    this.nativeIndex = 0;
    v.onseeked = () => {
      this.nativeIndex = this.seekingIndex;
      this.seekingIndex = null;
      schedule();
    };
  }
  release() {
    this.groupRequest?.controller.abort();
    this.groupRequest = null;
    if (this.decoder && this.decoder.state !== 'closed') this.decoder.close();
    this.decoder = null;
    this.decoding = null;
    for (const frame of this.frames.values()) frame.close();
    this.frames.clear();
  }
  async readGroup(begin, end, signal) {
    const start = this.starts[begin], limit = this.starts[end];
    const response = await fetch(this.remoteVideo, {signal, headers:{Range:`bytes=${start}-${limit - 1}`}});
    if (!response.ok) throw new Error('Unavailable film group ' + this.remoteVideo);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (response.status === 200 && bytes.length >= limit) {
      this.bytes = bytes; // A static host can elect to serve the entire file.
      this.groups.clear();
      return {bytes, base:0};
    }
    if (response.status !== 206 || bytes.length !== limit - start ||
        !response.headers.get('Content-Range')?.startsWith(`bytes ${start}-${limit - 1}/`))
      throw new Error('Unexpected film byte range ' + this.remoteVideo);
    const data = {bytes, base:start};
    this.groups.set(begin, data);
    if (this.groups.size > 8) this.groups.delete(this.groups.keys().next().value);
    return data;
  }
  decodeGroup(index, speculative = false) {
    const m = this.meta;
    const group = m.keys.findLastIndex((k) => k <= index);
    const begin = m.keys[group],
      end = m.keys[group + 1] ?? m.sizes.length;
    const streamed = this.download?.received >= this.starts[end] ? {bytes:this.download.bytes, base:0} : null;
    const saved = this.groups?.get(begin) ?? streamed;
    if (this.decoding != null) {
      const pending = this.groupRequest;
      if (speculative || this.decoding === begin || !pending || (!this.bytes && !saved && !pending.speculative)) return;
      // A requested pose takes precedence over a neighbour being warmed. A
      // return to an already buffered group can also interrupt a network wait.
      pending.controller.abort();
      this.groupRequest = null;
    }
    // Keep both neighbours available for an immediate change of direction.
    for (const [i, frame] of this.frames) {
      if (i < begin - (end - begin) || i >= end + (end - begin)) {
        frame.close();
        this.frames.delete(i);
      }
    }
    if (!this.decoder) {
      const decoder = (this.decoder = new VideoDecoder({
        output: (f) => {
          if (this.decoder !== decoder) {
            f.close();
            return;
          }
          const i = Math.round((f.timestamp * this.fps) / 1e6);
          this.frames.get(i)?.close();
          this.frames.set(i, f);
          schedule();
        },
        error: () => this.useNative(decoder)
      }));
      decoder.configure(this.config);
    }
    const decoder = this.decoder;
    this.decoding = begin;
    const feed = ({bytes, base}) => {
      if (this.decoder !== decoder) return;
      for (let i = begin; i < end; i++) {
        decoder.decode(new EncodedVideoChunk({
          type: i === begin ? 'key' : 'delta',
          timestamp: Math.round((i * 1e6) / this.fps),
          data: bytes.subarray(this.starts[i] - base, this.starts[i + 1] - base)
        }));
      }
      return decoder.flush().then(() => {
        if (this.decoder !== decoder) return;
        this.decoding = null;
        schedule();
      });
    };
    if (this.bytes || saved) {
      try {
        feed(saved ?? {bytes:this.bytes, base:0})?.catch(() => this.useNative(decoder));
      } catch {
        this.useNative(decoder);
      }
    } else {
      const pending = {controller:new AbortController(), speculative};
      this.groupRequest = pending;
      this.readGroup(begin, end, pending.controller.signal).then(data => {
        if (this.groupRequest !== pending) return;
        this.groupRequest = null;
        return feed(data);
      }).catch(() => {
        if (!pending.controller.signal.aborted) this.useNative(decoder);
      });
    }
  }
  useNative(decoder) {
    if (this.decoder !== decoder) return;
    this.release();
    this.config = null;
    this.nativeVideo()
      .then(schedule)
      .catch(() => {
        this.failed = true;
        schedule();
      });
  }
  paint(source, folder, index, still = false) {
    if (this.matteLayout) this.matte ??= new MatteCanvas(this.canvas, this.matteLayout === 'side');
    if (this.rasterWidth) {
      const fullWidth = still
        ? source.width
        : (this.meta.crop?.[4] ?? this.meta.width / (this.matte?.sideBySide ? 2 : 1));
      const fullHeight = still
        ? source.height
        : (this.meta.crop?.[5] ?? this.meta.height / (this.matte && !this.matte.sideBySide ? 2 : 1));
      const w = Math.min(this.rasterWidth, fullWidth),
        ratio = fullHeight / fullWidth;
      if (this.canvas.width !== w || this.canvas.height !== Math.round(w * ratio)) {
        this.canvas.width = w;
        this.canvas.height = Math.round(w * ratio);
      }
    }
    if (this.matte) this.matte.draw(source, still, this.meta?.crop);
    else if (this.draw) this.draw(this.context, source);
    else this.context.drawImage(source, 0, 0, this.canvas.width, this.canvas.height);
    this.shown = {folder, position: index + 1 - this.offset(folder), index};
  }
  set(folder, pose, total, paint = true) {
    this.used = true;
    const position = Math.max(1, Math.min(total, Math.round(pose)));
    if (!this.meta || this.failed) return this.setImage(folder, position, total, paint);
    // Seek directly to the scroll pose, retaining the last picture during decode.
    const index = position - 1 + this.offset(folder);
    if (this.wanted && index !== this.wanted.index) this.direction = Math.sign(index - this.wanted.index);
    this.wanted = {folder, position, index};
    const still = this.stills.get(index);
    if (still) {
      if (paint && (this.shown?.index !== index || this.shown.frame)) this.paint(still, folder, index, true);
      if (this.config && this.decoding == null) {
        for (const next of [index - 1, index + 1]) {
          if (next >= 0 && next < this.meta.sizes.length && !this.frames.has(next)) {
            this.decodeGroup(next, true);
            break;
          }
        }
      }
    } else if (this.config) {
      const frame = this.frames.get(index);
      if (!frame) this.decodeGroup(index);
      if (!frame && !this.bytes && this.remoteVideo && (!this.shown || this.shown.frame) && !this.download?.received)
        this.setImage(folder, position, total, paint);
      if (paint && (this.shown?.index !== index || this.shown.frame)) {
        if (frame) this.paint(frame, folder, index);
        else if (this.shown?.folder === folder) {
          const from = this.shown.index;
          const candidates = [...this.frames.keys()].filter(
            (i) => (from < i && i <= index) || (index <= i && i < from)
          );
          if (candidates.length) {
            const next = index > from ? Math.max(...candidates) : Math.min(...candidates);
            this.paint(this.frames.get(next), folder, next);
          }
        }
      }
      if (frame && this.decoding == null) {
        const keys = this.meta.keys;
        const group = keys.findLastIndex((key) => key <= index);
        const ahead = this.direction > 0 ? keys[group + 1] : keys[group] - 1;
        if (ahead >= 0 && !this.frames.has(ahead)) this.decodeGroup(ahead, true);
      }
    } else if (this.video?.readyState >= 2) {
      const v = this.video;
      if (
        this.seekingIndex == null &&
        this.nativeIndex != null &&
        paint &&
        (this.shown?.index !== this.nativeIndex || this.shown.frame)
      ) {
        const actual = this.nativeIndex;
        if (actual === index || (this.shown && (actual - this.shown.index) * (index - actual) >= 0))
          this.paint(v, folder, actual);
      }
      if (this.seekingIndex == null && this.nativeIndex !== index) {
        this.seekingIndex = index;
        v.currentTime = (index + 0.15) / this.fps;
      }
    }
    return !!this.shown;
  }
  setImage(folder, position, total, paint) {
    // A missing film/index can still display the authored WebP/JPEG sequence.
    if (!this.images)
      this.images = new FrameSequence(document.createElement('canvas'), schedule, {
        ...this.fallback,
        source: mediaSource,
        draw: () => {}
      });
    this.wanted = {folder, position, index:position - 1 + this.offset(folder)};
    this.images.set(folder, position, total, paint);
    const shown = this.images.shown;
    if (paint && shown && this.shown?.frame !== shown.frame) {
      const {image, companion} = shown.frame;
      if (this.draw) this.draw(this.context, image, companion);
      else this.paint(image, shown.folder, shown.position - 1 + this.offset(shown.folder), true);
      this.shown = {...shown, index:shown.position - 1 + this.offset(shown.folder)};
    }
    return this.shown?.folder === folder;
  }
  endRender() {
    this.images?.endRender();
    if (!this.used && this.wanted) {
      this.wanted = null;
      this.shown = null;
      this.release();
    }
    this.used = false;
  }
}
