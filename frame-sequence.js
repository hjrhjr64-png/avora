'use strict';

function sequenceAsset(folder, index, extension = 'webp') {
  return folder + '/' + String(index).padStart(4, '0') + '.' + extension;
}

// Keep the wanted pose first, then warm the direction of travel. A decoded
// fallback can advance toward the target without overtaking it.
class FrameSequence {
  constructor(canvas, onReady, {
    draw = (ctx, image) => ctx.drawImage(image, 0, 0, canvas.width, canvas.height),
    sourceFrame = index => index,
    asset = sequenceAsset,
    companionAsset,
    source = path => path
  } = {}) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.onReady = onReady;
    this.draw = draw;
    this.sourceFrame = sourceFrame;
    this.asset = asset;
    this.companionAsset = companionAsset;
    this.source = source;
    this.prepared = null;
    this.cache = new Map();
    this.pending = 0;
    this.direction = 1;
    this.stride = 1;
    this.wanted = null;
    this.shown = null;
    this.used = false;
  }
  setRasterWidth(width) {
    if (this.rasterWidth === width) return;
    this.rasterWidth = width;
    if (this.shown) {
      const {frame, position} = this.shown;
      this.shown = null;
      this.paint(frame, position);
    }
  }
  key(folder, index) { return this.asset(folder, this.sourceFrame(index)); }
  get(folder, index) {
    const key = this.key(folder, index);
    if (this.prepared?.key === key) return this.prepared.frame;
    const entry = this.cache.get(key);
    return entry?.state === 'ready' ? entry : null;
  }
  paths(folder, total) {
    const paths = new Set();
    for (let position = 1; position <= total; position++) {
      const index = this.sourceFrame(position);
      paths.add(this.asset(folder, index));
      if (this.companionAsset) paths.add(this.companionAsset(folder, index));
    }
    return paths;
  }
  async decode(image, path) {
    const url = await this.source(path);
    image.src = url;
    try {
      await image.decode();
    } finally {
      if (url !== path) URL.revokeObjectURL(url);
    }
  }
  read(folder, index, key) {
    const image = new Image();
    const companion = this.companionAsset ? new Image() : null;
    const entry = {folder, index, image, companion, state:'loading'};
    const tasks = [this.decode(image, key)];
    if (companion) tasks.push(this.decode(companion, this.companionAsset(folder, index)));
    return {entry, decoded:Promise.all(tasks)};
  }
  async prepare(folder, position) {
    const index = this.sourceFrame(position);
    const key = this.asset(folder, index);
    const {entry, decoded} = this.read(folder, index, key);
    await decoded;
    entry.state = 'ready';
    this.prepared = {key, frame:entry};
  }
  set(folder, frame, total, paint = true) {
    this.used = true;
    const position = Math.max(1, Math.min(Math.round(frame), total));
    const previous = this.wanted;
    if (previous?.folder === folder) {
      const delta = position - previous.position;
      if (delta) {
        this.direction = Math.sign(delta);
        this.stride = Math.min(Math.abs(delta), 8);
      }
    } else this.stride = 1;
    this.wanted = {folder, position};
    this.queue = [0, 1, 2, 3, 4, 5, -1].map(offset => position + offset * this.direction * this.stride)
      .filter(index => index >= 1 && index <= total);
    this.prefetch();
    if (paint) this.present();
    return this.shown?.folder === folder;
  }
  prefetch() {
    if (!this.wanted || this.pending >= 3) return;
    const {folder} = this.wanted;
    const keys = this.queue.map(index => this.key(folder, index));
    for (const [offset, key] of keys.entries()) {
      if (this.pending >= 3) break;
      if (this.cache.has(key) || this.prepared?.key === key) continue;
      if (this.cache.size >= 7) {
        const evict = [...this.cache].find(([path, entry]) => entry.state !== 'loading' && !keys.includes(path));
        if (!evict) break;
        this.cache.delete(evict[0]);
      }
      const index = this.sourceFrame(this.queue[offset]);
      const {entry, decoded} = this.read(folder, index, key);
      this.cache.set(key, entry);
      this.pending++;
      decoded.then(() => this.finish(key, entry, 'ready'), () => this.finish(key, entry, 'failed'));
    }
  }
  finish(key, entry, state) {
    entry.state = state;
    this.pending--;
    const wanted = this.wanted;
    if (state === 'ready' && wanted && this.cache.get(key) === entry &&
        (key === this.key(wanted.folder, wanted.position) || this.canAdvance(entry))) {
      this.onReady();
    }
    this.prefetch();
  }
  canAdvance(entry) {
    if (entry.folder !== this.wanted.folder) return false;
    const to = this.wanted.position;
    if (this.shown?.folder !== entry.folder) {
      const lag = (to - entry.index) * this.direction;
      return lag >= 0 && lag <= 24;
    }
    const from = this.shown.position;
    return from < to ? from < entry.index && entry.index <= to : to <= entry.index && entry.index < from;
  }
  present() {
    const {folder, position} = this.wanted;
    const frame = this.get(folder, position);
    if (frame) {
      this.paint(frame, position);
      return;
    }
    const direction = this.shown?.folder === folder
      ? Math.sign(position - this.shown.position) : this.direction;
    const fallback = [...this.cache.values()].filter(entry => entry.state === 'ready' && this.canAdvance(entry))
      .sort((left, right) => direction * (right.index - left.index))[0];
    if (fallback) this.paint(fallback, fallback.index);
  }
  paint(frame, position) {
    if (!this.context) return;
    if (this.shown?.frame === frame) {
      this.shown.position = position;
      return;
    }
    if (this.rasterWidth) {
      const width = Math.min(this.rasterWidth, frame.image.naturalWidth);
      if (this.canvas.width !== width) {
        this.canvas.width = width;
        this.canvas.height = Math.round(width * frame.image.naturalHeight / frame.image.naturalWidth);
      }
    }
    const ctx = this.context;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.draw(ctx, frame.image, frame.companion);
    this.shown = {folder:frame.folder, frame, position};
  }
  endRender() {
    if (!this.used && this.wanted) {
      this.wanted = null;
      this.cache.clear();
      this.shown = null;
      this.context?.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    this.used = false;
  }
}
