'use strict';

const $ = selector => document.querySelector(selector);
const all = selector => Array.from(document.querySelectorAll(selector));
const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const range = (n, start, end) => clamp((n - start) / (end - start));
const ease = x => x * x * (3 - 2 * x);
const scrollEase = x => ease(x) + 2 * (x * (1 - x)) ** 2;
// CSS ease: cubic-bezier(.25,.1,.25,1). Solve x before evaluating y.
function surfaceEase(x) {
  if (x === 0 || x === 1) return x;
  let lower = 0, upper = 1;
  for (let i = 0; i < 14; i++) {
    const u = (lower + upper) / 2;
    const curveX = u * (.75 + u * (u - .75));
    if (curveX < x) lower = u;
    else upper = u;
  }
  const u = (lower + upper) / 2;
  return u * (.3 + u * (2.4 - 1.7 * u));
}
// Authored transitions between reading stops and the adjacent chapters.
const readingTravelDuration = 1200;
const referenceSlideDuration = 1000;
const referenceCoverDistance = .9;
const referenceFade = progress => 1 - range(progress, .3, 1);
const readingTravelEase = x => Math.min(1, 1.001 - 2 ** (-10 * x));
const linear = x => x;
const revealEase = scrollEase;
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const step = (n, a, b, curve = ease) => motion.matches ? Number(n >= (a + b) / 2) : curve(range(n, a, b));
const surface = (n, a, b) => step(n, a, b, surfaceEase);
const referenceTravel = (n, a, b) => step(n, a, b, linear);
const reveal = (n, a, b) => step(n, a, b, revealEase);
const design = 'assets/design/';
const models = 'assets/models/';
const touchViewport = matchMedia('(pointer:coarse)');
const compactMedia = matchMedia('(max-width:600px)').matches;
const adaptiveLayout = matchMedia('(max-width:1024px) and (orientation:portrait)');
const landscapePlans = matchMedia('(orientation:landscape) and (pointer:coarse) and (max-width:1023px) and (max-height:600px)');
const isPortraitTablet = () => adaptiveLayout.matches && width > 600;
const usesPlanRail = () => adaptiveLayout.matches || landscapePlans.matches;
const mediaProfile = compactMedia ? 'mobile' : 'desktop';
const highDensity = !compactMedia && Math.min(innerWidth*.938,innerHeight*5/3)*devicePixelRatio > 1900;
const detailProfile = highDensity ? 'retina' : mediaProfile;
const scrubPath = (name, profile = mediaProfile) => 'assets/scrub/' + name + '-' + profile;
let contactVideo = scrubPath('contact') + '.mp4';
const facadePoster = compactMedia ? 'assets/scrub/facade-mobile.webp' : 'assets/models/facade-poses/0001.webp';
const facadeFolder = models + 'facade-poses';
const wallFolder = models + 'wall-detail';
let loadingMedia = true;
let panoramaCover, panoramaWidth, visibleStageHeight;
const packagedMedia = window.avoraPackagedMedia;

async function cachedMedia(path) {
  return packagedMedia?.(path);
}

async function mediaSource(path) {
  const blob = await cachedMedia(path);
  return blob ? URL.createObjectURL(blob) : path;
}
let overlapSpan, interiorEntry, interiorEnd;
const facadesStop = 15.2;
const interiorArrival = 18.05;
const interiorFirstStop = 18.18;
const interiorStart = 17.91;
const interiorInterval = 1.17;
const interiorExitStart = 23.82;
const wallTitleStop = 25.12;
const wallTitleExitStart = 25.23;
const wallTitleExitEnd = 25.62;
const heroCopyFade = t => step(t, 0, .63);
const buildEntry = 31.08;
const buildStart = 31.96;
const buildInterval = 1.01;
const filmArrival = 36.12;
const filmSweep = 36.80;
const formArrival = 38.04;
const contactTravelDuration = 1850;
const filmFrameShare = 1343 / 1900;
const chapters = [
  ['home', 0], ['plans', 7.1], ['facades', facadesStop],
  ['interiors', interiorTime(0)], ['wall-system', wallTitleStop],
  ['how-we-build', buildStart], ['contact', 38.3]
];
const END = 38.75;
const story = $('#story');
const viewport = $('.viewport');
const menu = $('#menu');
const mast = $('#mast');
const mastBar = mast.querySelector('.bar');
const brand = $('.brand');
const intro = $('.hero-copy');
const pullback = $('#pullback');
const heroGround = $('.hero-ground img');
const villageCanvas = $('#village-frames');
const modelFrame = $('.model-frame');
const forestFilm = $('#forest-film');
const contactPoster = compactMedia ? 'assets/scrub/contact-mobile.webp' : 'assets/scrub/contact-desktop.jpg';
const interiorFrame = $('.interior-frame');
const interiorTrack = $('#interior-images');
const interiorCard = $('.interior-card');
const buildCard = $('.process-card');
const buildFrame = $('#build-images');
const buildSlider = $('#build-slider');
const buildCount = $('#build-count');
const buildCopy = $('#build-copy');
const contactForm = $('#enquiry-form');
const filmWindow = $('.contact-film-window');
let width, height, portrait, unit, barHeight, interiorPitch, compactLogo, heroCopyHeight;
let current = 0, raf = 0;
let openingRendered = false;
let interiorIndex = -1, buildIndex = -1;
let focusOnArrival = null;
const letterHeights = [108, 106, 108, 104, 108];
const letterWidths = [130, 124, 153, 118, 131];
const smallLeft = [0, .1641, .3658, .616, .8129];

function letters(container) {
  return letterWidths.map((_, index) => {
    const img = new Image();
    img.src = design + 'letter-' + (index + 1) + '.svg';
    img.alt = '';
    img.style.setProperty('--reveal-order', Math.abs(index - 2));
    container.append(img);
    return img;
  });
}
const logo = letters(brand);
const textRevealOverlay = $('#preloader');
const heroText = [
  [$('.opening-copy .eyebrow'), 0],
  [$('.opening-copy h1'), 80],
  [$('.opening-copy .subtitle'), 220]
];
const headerText = all('.bar > .micro');
const titleFades = new Map();
const wordFadeDuration = 600;
const wordFadeStagger = 80;
function fadeWord(word, delay, fill) {
  return word.animate([{opacity:0}, {opacity:1}], {
    duration:wordFadeDuration, delay, easing:'ease-out', fill
  });
}
const footerText = all('#footer :is(nav a, .socials a, .footer-info > *)');
const pendingText = new Map();

function splitRevealWords(node) {
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  const words = [];
  // Keep the original spaces and nested markup, including responsive text breaks.
  for (const textNode of textNodes) {
    const fragment = document.createDocumentFragment();
    for (const part of textNode.data.split(/(\s+)/)) {
      if (!part) continue;
      if (!/\S/.test(part)) {
        fragment.append(part);
        continue;
      }
      const word = document.createElement('span');
      word.className = 'reveal-word';
      word.textContent = part;
      fragment.append(word);
      words.push(word);
    }
    textNode.replaceWith(fragment);
  }
  return words;
}

function prepareTextReveal(node) {
  pendingText.set(node, splitRevealWords(node));
  node.classList.add('reveal-pending');
}

function playTextReveal(node, {delay = 0, immediate = false} = {}) {
  const words = pendingText.get(node);
  if (!words || textRevealOverlay.open) return;
  pendingText.delete(node);
  node.classList.remove('reveal-pending');
  if (immediate || motion.matches || node.matches(':focus-visible')) return;
  if (node.closest('.opening-copy')) {
    words.forEach((word, i) => fadeWord(word, delay + i * wordFadeStagger, 'backwards'));
    return;
  }
  const small = node.matches('.micro, #footer :is(nav a, .socials a)');
  const from = small
    ? {opacity:0, transform:'translateY(.6em)', filter:'blur(3px)'}
    : {opacity:0, transform:'translateY(24px)', filter:'blur(10px)'};
  const to = {opacity:1, transform:'translateY(0)', filter:'blur(0px)'};
  words.forEach((word, i) => word.animate([from, to], {
    duration:small ? 520 : 800,
    delay:delay + i * (small ? 35 : 45),
    easing:'cubic-bezier(.215,.61,.355,1)',
    fill:'backwards'
  }));
}

if (Element.prototype.animate) {
  [...heroText.map(([node]) => node), ...headerText].forEach(prepareTextReveal);
  for (const [name, selector] of Object.entries({
    'shape-title':'#shape-title h2', 'wall-title':'#wall-title h2',
    'build-title':'#build-title h2', facades:'.mask-title h2'
  })) {
    const animations = splitRevealWords($(selector)).map((word, i) => {
      const animation = fadeWord(word, i * wordFadeStagger, 'both');
      animation.pause();
      animation.currentTime = 0;
      return animation;
    });
    titleFades.set(name, {animations, duration:wordFadeDuration + (animations.length - 1) * wordFadeStagger, progress:0});
  }
  if (window.IntersectionObserver) footerText.forEach(prepareTextReveal);
}

function prepareLinkHover(control) {
  control.classList.add('rolling-link');
  const icon = control.querySelector('img');
  if (icon) {
    const label = document.createElement('span');
    label.className = 'menu-label';
    label.setAttribute('aria-hidden', 'true');
    const letter = document.createElement('span');
    letter.className = 'menu-letter';
    const copy = icon.cloneNode();
    copy.className = 'menu-icon-copy';
    icon.replaceWith(label);
    letter.append(icon, copy);
    label.append(letter);
    return;
  }

  const groups = [];
  const walker = document.createTreeWalker(control, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const text = walker.currentNode;
    const parts = text.data.match(/^(\s*)(\S(?:[\s\S]*\S)?)(\s*)$/);
    if (parts && !text.parentElement.closest('small')) {
      groups.push({text, parts, characters:Array.from(parts[2]), desktop:!!text.parentElement.closest('.desktop-word')});
    }
  }
  const length = groups.reduce((total, group) => total + group.characters.length, 0);
  const shortLength = groups.reduce((total, group) => total + (group.desktop ? 0 : group.characters.length), 0);
  let index = 0;
  for (const {text, parts, characters} of groups) {
    const label = document.createElement('span');
    label.className = 'menu-label';
    const source = document.createElement('span');
    source.className = 'menu-label-source';
    source.textContent = parts[2];
    if (control.closest('.numbered')) source.setAttribute('aria-hidden', 'true');
    const visual = document.createElement('span');
    visual.setAttribute('aria-hidden', 'true');
    for (const character of characters) {
      const letter = document.createElement('span');
      letter.className = 'menu-letter';
      letter.dataset.letter = character;
      letter.style.setProperty('--letter-delay', Math.abs(index - (length - 1) / 2) * 35 + 'ms');
      letter.style.setProperty('--short-letter-delay', Math.abs(index - (shortLength - 1) / 2) * 35 + 'ms');
      visual.append(letter);
      index++;
    }
    label.append(source, visual);
    text.replaceWith(parts[1], label, parts[3]);
  }
}
all([
  '.bar > .micro', '#menu :is(.numbered a, .menu-bottom a, .menu-top a, #close-menu)',
  '#footer :is(nav a, .socials a, .email, #privacy-button)'
].join(',')).forEach(prepareLinkHover);

function startTextReveals() {
  const skipOpening = mast.classList.contains('skip-intro');
  if (!skipOpening) {
    for (const [node, delay] of heroText) playTextReveal(node, {delay:1720 + delay});
  }
  for (const node of headerText) playTextReveal(node, {delay:1780, immediate:skipOpening});
  schedule();
  if (!footerText.some(node => pendingText.has(node))) return;
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const row = footerText.indexOf(entry.target);
      playTextReveal(entry.target, {delay:Math.min(row, 5) * 35});
      observer.unobserve(entry.target);
    }
  }, {rootMargin:'0px 0px -40px 0px'});
  footerText.forEach(node => observer.observe(node));
}

function makeCards(items, container, html, className) {
  return items.map((item, index) => {
    const el = document.createElement('article');
    el.className = className + (index % 2 ? ' right' : '');
    el.innerHTML = html(item, index);
    container.append(el);
    return el;
  });
}
const orderedPlans = [2, 3, 4, 6, 0, 1];
const planTrack = $('#plans-cards');
const planCards = makeCards(orderedPlans.map(i => catalog.plans[i]), planTrack, (p, i) =>
  '<div class="plan-intro" style="--description-width:' + p.descriptionWidth + '"><h3>' + p.name + '</h3><p>' + p.body + '</p></div>' +
  '<div class="plan-stats"><div><span class="micro">Interior area</span><b><small>m²</small>' + p.m2 + '</b></div><div><span class="micro">No. of rooms</span><b>' + p.rooms + '</b></div></div>' +
  '<div class="drawing" style="--drawing-width:' + p.drawingWidth + '"><img alt="Floor plan: ' + p.name + '" data-src="' + design + 'plan-' + (orderedPlans[i] + 1) + '.png"><span class="micro">' + p.caption + '</span></div>', 'plan-card');
let selectedPlan = -1, planStride = 0, planTrackWidth = 0, planFinalInset = 0, plansOpen = false;
const wallCards = makeCards(catalog.wall, $('#wall-cards'), item =>
  '<div class="wall-sample"><img alt="" data-src="' + design + 'wall-card-' + item.image + '.png"></div>' +
  '<div class="wall-copy"><h3>' + item.name + '</h3><p>' + item.body + '</p></div>', 'wall-card');
function makeSlides(group, parent, name) {
  return group.map((item, index) => {
    const img = new Image();
    img.alt = item.name;
    img.className = 'slide-image';
    img.dataset.src = design + (item.image ?? name + '-' + (index + 1)) + '.webp';
    if (name === 'interior' || index === 0) {
      const picture = document.createElement('picture');
      const portraitPhoto = design + 'portrait/' + item.image + '.webp';
      const sources = name === 'interior'
        ? [[600, portraitPhoto], [1024, index === 0 ? design + 'interior-tablet.webp' : portraitPhoto]]
        : [[600, 'assets/scrub/mobile/stage-1.webp'], [1024, design + 'build-tablet.webp']];
      for (const [limit, path] of sources) {
        const source = document.createElement('source');
        source.media = '(max-width:' + limit + 'px) and (orientation:portrait)';
        source.dataset.srcset = path;
        picture.append(source);
      }
      picture.append(img);
      parent.append(picture);
    } else parent.append(img);
    return img;
  });
}
const interiors = makeSlides(catalog.interiors, interiorTrack, 'interior');
interiors.forEach((image, index) => { image.style.left = 'calc(' + index + ' * var(--interior-pitch))'; });
const stages = makeSlides(catalog.stages, buildFrame, 'stage');
const buildLast = stages.length - 1;
const buildTime = index => buildStart + index * buildInterval;
function buildPosition(t) {
  const position = clamp((t - buildStart) / buildInterval, 0, buildLast);
  const nearest = Math.round(position);
  return motion.matches || Math.abs(position - nearest) * height < 1 ? nearest : position;
}
const buildAt = t => Math.round(buildPosition(t));
buildSlider.setAttribute('aria-valuemax', stages.length);
buildCount.querySelector('span').textContent = stages.length;
function loadImage(img) {
  if (img.hasAttribute('src') || !img.dataset.src) return;
  if (img.parentElement?.localName === 'picture') {
    for (const source of img.parentElement.querySelectorAll('source[data-srcset]'))
      source.srcset = source.dataset.srcset;
  }
  const useCompactAsset = compactMedia && !interiorTrack.contains(img);
  img.src = useCompactAsset ? img.dataset.src.replace(design,'assets/scrub/mobile/').replace(/\.png$/,'.webp') : img.dataset.src;
}
function loadCard(card) { card.querySelectorAll('[data-src]').forEach(loadImage); }

const sampleFrame = (frame, samples = 2) => 1 + (frame - 1) * samples;
const facadeSamples = 4;
function interleavedAsset(folder, index, samples = 2, extension = 'webp') {
  const base = 1 + Math.floor((index - 1) / samples);
  const offset = (index - 1) % samples;
  if (!offset) return sequenceAsset(folder, base, extension);
  const intermediate = folder + '-intermediate';
  if (offset * 2 === samples) return sequenceAsset(intermediate, base, extension);
  return intermediate + '/' + String(base).padStart(4, '0') + '-q' + offset + '.' + extension;
}
const panoramaPixels = Math.max(innerWidth, innerHeight * 16 / 9) * devicePixelRatio;
const landscapePanorama = !packagedMedia && !compactMedia && panoramaPixels <= 1920
  ? scrubPath('village', '1080') : scrubPath('village');
const villagePath = compactMedia && adaptiveLayout.matches ? 'assets/film/panorama-phone'
  : adaptiveLayout.matches ? 'assets/film/panorama' : landscapePanorama;
const villageFolder = adaptiveLayout.matches ? 'assets/film/panorama-frames' : 'assets/film/panorama-frames-1440';
// Narrow landscape already has its own lightweight track.
const onlineVillage = villagePath === scrubPath('village', 'mobile') ? villagePath : villagePath + '-web';
const village = new ScrubFilm(villageCanvas,{path:packagedMedia ? villagePath : onlineVillage,
  fallback:{asset:(folder,index) => sequenceAsset(folder,index,'jpg')}});
const orbitFolder = models + 'orbit';
const morphFolder = models + 'morph';
const masterPaths = {};
if (!compactMedia) {
  for (const [i, n] of [[150,1],[330,91],[510,181]])
    masterPaths[i] = sequenceAsset(morphFolder + '-hd-detail',n);
}
const tabletHouse = !packagedMedia && touchViewport.matches && !compactMedia &&
  Math.min(screen.width, screen.height) <= 1024;
const houseCanvas = $('#house-sequence');
const house = tabletHouse ? new FrameSequence(houseCanvas, schedule, {
  source:mediaSource,
  asset:(folder,index) => folder === orbitFolder ? sequenceAsset(orbitFolder,index)
    : masterPaths[index + 149] ?? interleavedAsset(morphFolder,index)
}) : new ScrubFilm(houseCanvas,{
  path:scrubPath('house',detailProfile), matte:'below',
  offset:folder => folder === morphFolder ? 150 : 0, stillPaths:masterPaths,
  fallback:{asset:(folder,index) => {
    if (folder === orbitFolder) return sequenceAsset(compactMedia ? folder : folder+'-detail',index);
    return masterPaths[index+149] ?? interleavedAsset(compactMedia ? folder : folder+'-detail',index);
  }}
});
const field = $('.facade-field');
const facadeCanvas = $('.facade-turn');
const facadePreview = new Image();
let facadeLayout, maskClipPosition;
const facadePose = new ScrubFilm(facadeCanvas,{path:scrubPath('facades',detailProfile),draw:drawFacade,
  fallback:{asset:(folder,index) => interleavedAsset(folder,index,facadeSamples),
    companionAsset:(_,index) => sequenceAsset(models+'facade-center',index)}});
const facadeTiles = Array.from({length:9}, (_, i) => {
  const tile = document.createElement('div');
  const col = i % 3, row = Math.floor(i / 3);
  // Complete 608×342 tiles in the original 1920×1080 nine-finish atlas.
  tile.style.backgroundPosition = (48 + col * 608) / (1920 - 608) * 100 + '% ' +
    (54 + row * 342) / (1080 - 342) * 100 + '%';
  field.append(tile);
  return tile;
});
facadeTiles[4].hidden = true;
// The authored holds under the four texts contain byte-identical frames.
const wallHolds = [[40, 54], [95, 108], [149, 162], [203, 216]];
// Each handoff starts once the incoming layer is visibly inside the viewport.
const wallCardStarts = [32, 73, 128, 184];
const wallSample = frame => sampleFrame(frame);
const hdWall = !compactMedia && parseFloat(getComputedStyle($('#wall-sequence')).width) * devicePixelRatio > 768;
const wallImages = {
  source:mediaSource,
  asset:(folder, index) => sequenceAsset(hdWall ? folder + '-hd' : folder, index),
  sourceFrame:index => {
    const hold = wallHolds.find(([first, last]) => index >= wallSample(first) && index <= wallSample(last));
    return hold ? wallSample(hold[0]) : index;
  }
};
const wall = new ScrubFilm($('#wall-sequence'),{
  path:scrubPath('wall',hdWall?'retina':mediaProfile),
  matte:compactMedia?'below':'side', fallback:wallImages
});
const frameSequences = [village, house, facadePose, wall];

// WebKit can ignore the source rectangle when drawImage crops a VideoFrame.
const facadeAtlas = document.createElement('canvas');
function drawFacade(ctx, image, center) {
  const {centerY, pitchX, pitchY, scale} = facadeLayout;
  if (image.displayWidth) {
    if (facadeAtlas.width !== image.displayWidth || facadeAtlas.height !== image.displayHeight) {
      facadeAtlas.width = image.displayWidth;
      facadeAtlas.height = image.displayHeight;
    }
    facadeAtlas.getContext('2d').drawImage(image, 0, 0);
    image = facadeAtlas;
  }
  const sourceScale = (image.videoWidth || image.naturalWidth || image.width) / 1920;
  ctx.clearRect(0,0,width,height);
  if (facadeLayout.centers) {
    facadeLayout.centers.forEach(([x, y], i) => {
      const col = i % 3, row = Math.floor(i / 3);
      // Trim the transparent side gutters to keep packed H.264 tiles from overlapping their neighbours.
      ctx.drawImage(image, (48 + col * 608 + 104) * sourceScale, (54 + row * 342) * sourceScale,
        400 * sourceScale, 342 * sourceScale, x - 200 * scale, y - 171 * scale, 400 * scale, 342 * scale);
    });
    return;
  }
  // At least one axis is packed edge to edge at rest. Draw contiguous
  // atlas strips together wherever the responsive layout has no gap.
  const columns = Math.abs(pitchX - 608 * scale) < .001 ? 3 : 1;
  const rows = Math.abs(pitchY - 342 * scale) < .001 ? 3 : 1;
  const tileWidth = columns * 608, tileHeight = rows * 342;
  for (let row = 0; row < 3; row += rows) {
    for (let col = 0; col < 3; col += columns) {
      ctx.drawImage(image, (48 + col * 608) * sourceScale, (54 + row * 342) * sourceScale,
        tileWidth * sourceScale, tileHeight * sourceScale,
        width / 2 + (col - 1) * pitchX - 304 * scale,
        centerY + (row - 1) * pitchY - 171 * scale, tileWidth * scale, tileHeight * scale);
    }
  }
  if (center) {
    const x=width/2-304*scale, y=centerY-171*scale;
    ctx.clearRect(x,y,608*scale,342*scale);
    ctx.drawImage(center,x,y,608*scale,342*scale);
  }
}

const scenes = Object.fromEntries(all('.scene').map(s => [s.id || s.classList[1], s]));
$('.hero-house').addEventListener('animationend', () => scenes.hero.classList.remove('first-visit'), {once:true});
function visible(name, show) {
  const node = scenes[name];
  const visibility = show ? 'visible' : 'hidden';
  if (node.style.visibility !== visibility) {
    node.classList.toggle('live', show);
    node.style.visibility = visibility;
    node.inert = !show;
    node.setAttribute('aria-hidden', String(!show));
  }
  return show;
}
let contactSource;
function prepareContactFilm() {
  // The offline edition resolves media from its local script bundle, even
  // when playback is first enabled after the preloader has closed.
  if (!contactSource) {
    contactSource = selectContactEncode().then(() => mediaSource(contactVideo)).catch(() => contactVideo).then(url => {
      forestFilm.preload = packagedMedia ? 'auto' : 'metadata';
      forestFilm.src = url;
      forestFilm.load();
      schedule();
      return url;
    });
  }
  return contactSource;
}
function loopVideo(video, play) {
  if (play && video.hasAttribute('src') && !motion.matches && !document.hidden) {
    if (video.paused && !video.dataset.starting) {
      video.dataset.starting = 'true';
      video.play().catch(() => {}).finally(() => delete video.dataset.starting);
    }
  } else if (!video.paused) video.pause();
}
const footer = $('#footer');
const themeColor = $('meta[name="theme-color"]');
const pageTheme = themeColor?.content;
const footerTheme = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
let footerThemeActive = false;
let mastScrollEdge = 0, mastPreviousY = 0, mastDirection = 0;
let mastScrollAnimations = [];
function measureMastMotion() {
  for (const animation of mastScrollAnimations) animation.cancel();
  mastScrollAnimations = [];
  if (!adaptiveLayout.matches || width > 600 || motion.matches ||
      !window.ScrollTimeline || !CSS.supports('animation-range', '0px 300px')) return;

  const timeline = new ScrollTimeline({source:document.scrollingElement});
  const options = {timeline, rangeStart:'0px', rangeEnd:clamp(height * .42, 220, 440) + 'px',
    fill:'both', easing:'cubic-bezier(.333333,0,.666667,1)'};
  const u = width / 390;
  const large = 22 * u;
  const widths = letterWidths.map(w => large * w / 108);
  const gap = (width - 20 * u - widths.reduce((a,b) => a + b, 0)) / 4;
  const pose = (x,y,scale) => 'translate3d(' + x + 'px,' + y + 'px,0) scale(' + scale + ')';
  let left = 10 * u;
  logo.forEach((img,i) => {
    const h = large * letterHeights[i] / 108;
    img.style.height = h + 'px';
    const from = pose(left, 18 * u + (large - h) / 2, 1);
    const to = pose(compactLogo.x + compactLogo.width * smallLeft[i], compactLogo.y, compactLogo.height / large);
    mastScrollAnimations.push(img.animate([{transform:from},{transform:to}], options));
    left += widths[i] + gap;
  });
  mastScrollAnimations.push(mastBar.animate([
    {transform:'translateY(' + 51.106 * u + 'px)'}, {transform:'translateY(0px)'}
  ], options));
}
function header(t, y) {
  const assemblyDistance = clamp(height * .42, 220, 440);
  const fraction = motion.matches ? Number(y > 0) : clamp(y / assemblyDistance);
  const progress = ease(fraction);
  if (y !== mastPreviousY) mastDirection = Math.sign(y - mastPreviousY);
  mastPreviousY = y;
  const enteringFooter = t >= END - .002;
  const atFooter = enteringFooter && y >= document.documentElement.scrollHeight - innerHeight - .5;
  const footerTop = enteringFooter ? footer.getBoundingClientRect().top : Infinity;
  const onDark = footerTop <= barHeight / 2;
  const footerInView = footerTop < innerHeight - 1;
  if (footerThemeActive !== footerInView) {
    footerThemeActive = footerInView;
    document.documentElement.classList.toggle('footer-theme', footerInView);
    if (themeColor) themeColor.content = footerInView ? footerTheme : pageTheme;
  }
  mast.classList.toggle('on-dark', onDark);
  mast.classList.toggle('at-footer', atFooter);
  const bar = barHeight;
  const adapted = adaptiveLayout.matches;
  const phone = width <= 600;
  const headerUnit = width / (phone ? 390 : 768);
  const edge = adapted ? (phone ? 10 : 17.5) * headerUnit : width <= 600 ? 10 : width * 20 / 1920;
  const large = adapted ? (phone ? 22 : 40.5) * headerUnit : portrait ? Math.min(width * .061, 72) : Math.min(width * .05625, height * .16);
  const top = adapted ? (phone ? 18 : 25.5) * headerUnit : portrait ? 18 : edge;
  const compact = compactLogo.height;
  const compactWidth = compactLogo.width;
  mast.classList.toggle('is-compact', progress === 1);
  const fullWidths = letterWidths.map(w => large * w / 108);
  const gap = (width - 2 * edge - fullWidths.reduce((a, b) => a + b, 0)) / 4;
  let left = edge;
  const openingBarTop = adapted ? (phone ? 51.106 : 80) * headerUnit : top + large + (portrait ? 12 : edge);
  mastBar.style.setProperty('--top-rule-opacity', 1 - ease(range(fraction, 0, .22)));
  if (!mastScrollAnimations.length) {
    mastBar.style.transform = 'translateY(' + openingBarTop * (1 - progress) + 'px)';
    const scale = 1 + (compact / large - 1) * progress;
    logo.forEach((img, i) => {
      const x = left + (compactLogo.x + compactWidth * smallLeft[i] - left) * progress;
      const openingHeight = large * letterHeights[i] / 108;
      const openingY = top + (large - openingHeight) / 2;
      const yy = openingY + (compactLogo.y - openingY) * progress;
      img.style.transform = 'translate3d(' + x + 'px,' + yy + 'px,0) scale(' + scale + ')';
      img.style.height = openingHeight + 'px';
      left += fullWidths[i] + gap;
    });
  }
  if (adapted && enteringFooter && !onDark) {
    mastScrollEdge = y;
    mast.classList.add('away');
  } else if (atFooter || (adapted && onDark) || mastDirection < 0) {
    mastScrollEdge = y;
    mast.classList.remove('away');
  } else if (enteringFooter || t < 2) {
    mastScrollEdge = y;
    const assemblyInView = motion.matches || y >= assemblyDistance + bar * 1.25;
    mast.classList.toggle('away', enteringFooter || (assemblyInView && heroCopyFade(t) >= .91));
  } else {
    mastScrollEdge = Math.min(mastScrollEdge, y);
    if (y - mastScrollEdge >= 36) {
      mast.classList.add('away');
      mastScrollEdge = y;
    }
  }
  return openingBarTop + bar;
}
function setTitleFadeProgress(fade, progress) {
  if (progress !== fade.progress) {
    for (const animation of fade.animations) animation.currentTime = progress * fade.duration;
    fade.progress = progress;
  }
}
function title(name, t, a, b, c, d) {
  if (!visible(name, t >= a && t < d)) return;
  const exitOpacity = 1 - step(t, c, d);
  const fade = titleFades.get(name);
  if (!fade || motion.matches) {
    scenes[name].style.opacity = step(t, a, b) * exitOpacity;
    return;
  }
  scenes[name].style.opacity = exitOpacity;
  setTitleFadeProgress(fade, range(t, a, b));
}
function portraitOpeningScale() {
  return (width <= 600 ? 755 / 390 : 1505 / 768) * width / 1920;
}
function portraitRoofOffset() {
  return width <= 600 ? 1.03 * height - 258.32 * width / 390 : height - 442 * width / 768;
}
function houseTransform(scale, y) {
  return 'translate3d(' + (width - 1920 * scale) / 2 + 'px,' + y + 'px,0) scale(' + scale + ')';
}
let openingHouseAnimation;
const phoneCopyCenter = () => height * .445 + 8.92 * width / 390;
const copyTravel = () => clamp(width * .036, 28, 78);
const copyTransform = center => 'translate3d(-50%,calc(' + center + 'px - 50%),0)';
let openingCopyAnimations = [];
function measureOpeningMotion() {
  for (const animation of openingCopyAnimations) animation.cancel();
  openingCopyAnimations = [];
  openingHouseAnimation?.cancel();
  openingHouseAnimation = null;
  if (!adaptiveLayout.matches || !touchViewport.matches || motion.matches ||
      !window.ScrollTimeline || !CSS.supports('animation-range', '0px 300px')) return;
  const timeline = new ScrollTimeline({source:document.scrollingElement});
  openingHouseAnimation = pullback.animate([
    {transform:houseTransform(portraitOpeningScale(), portraitRoofOffset())},
    {transform:houseTransform(panoramaWidth / 1920, (height - panoramaWidth * 9 / 16) / 2)}
  ], {timeline, rangeStart:'0px',
    rangeEnd:scrollAt(1.82) + 'px', fill:'both', easing:'cubic-bezier(.333333,.083333,.666667,.883333)'});
  if (width > 600) return;
  const center = phoneCopyCenter();
  const timing = {timeline, rangeStart:'0px', fill:'both', easing:'cubic-bezier(.333333,0,.666667,1)'};
  openingCopyAnimations = [
    intro.animate([{transform:copyTransform(center)}, {transform:copyTransform(center + copyTravel())}],
      {...timing, rangeEnd:scrollAt(.5) + 'px'}),
    intro.animate([{opacity:1}, {opacity:0}], {...timing, rangeEnd:scrollAt(.63) + 'px'})
  ];
}
function heroAndVillage(t, openingHeaderBottom) {
  const panoramaStart = 1.7, frontMatch = 1.82, exitStart = 3.82, exitEnd = exitStart + overlapSpan;
  if (t >= 2.1) scenes.hero.classList.remove('first-visit');
  if (t > .25 && t < panoramaStart) village.set(villageFolder, 1, 121, false);
  if (t >= exitEnd && t < 5.12) village.set(villageFolder,121,121,false);
  const mobile = width <= 600;
  const fullWidth = panoramaWidth;
  // The toolbar changes the visible height mid-swipe. Keep the opening
  // and the first panorama pose on the same stable vertical center.
  const openingHeight = adaptiveLayout.matches ? height : visibleStageHeight;
  if (visible('hero', t < 2.1)) {
    const progress = motion.matches ? Number(t > .9)
      : step(t, 0, frontMatch, x => x * (.25 + x * (2.15 - 1.4 * x)));
    const openingWidth = portrait ? width * (mobile ? 1.17 : 1.12) : width;
    // The reference shows 496px of the facade below the roof in a 1920×1080 frame.
    const roofY = portrait ? openingHeight * (mobile ? 1.01 : 1) - openingWidth * 496 / 1920
                           : Math.max(visibleStageHeight * 584 / 1080, visibleStageHeight - openingWidth * 496 / 1920);
    const openingScale = adaptiveLayout.matches ? portraitOpeningScale() : (openingWidth / 1920) * (1688 / 960);
    const fullScale = fullWidth / 1920;
    const scale = openingScale + (fullScale - openingScale) * progress;
    const roofOffset = adaptiveLayout.matches
      ? portraitRoofOffset()
      : roofY - 276 * openingScale;
    const fullTop = (openingHeight - fullWidth * 9 / 16) / 2;
    const y = roofOffset + (fullTop - roofOffset) * progress;
    if (!openingHouseAnimation) {
      const transform = houseTransform(scale, y);
      pullback.style.transform = transform;
      if (!adaptiveLayout.matches) heroGround.style.transform = transform;
    }
    const fade = heroCopyFade(t);
    if (fade < .25 && mast.classList.contains('skip-intro')) {
      for (const [node, delay] of heroText) playTextReveal(node, {delay});
    }
    if (!openingCopyAnimations.length) {
      const openingRoof = roofOffset + 274 * openingScale;
      const copyCenter = adaptiveLayout.matches
        ? mobile ? phoneCopyCenter() : openingHeight / 2 - 64 * width / 768
        : Math.min((openingHeaderBottom + roofY) / 2,
        openingRoof - (heroCopyHeight || intro.offsetHeight) / 2 - Math.max(18, width * .018));
      const descent = motion.matches ? 0 : step(t, 0, .5) * copyTravel();
      intro.style.transform = copyTransform(copyCenter + descent);
      intro.style.opacity = 1 - fade;
    }
  }
  if (visible('panorama', t >= panoramaStart && t < exitEnd)) {
    if (fullWidth < panoramaCover) {
      const scale = fullWidth / panoramaCover;
      const fill = surface(t, 2.32, 3.28);
      const zoom = scale + (1 - scale) * fill;
      const offset = (openingHeight - visibleStageHeight) * (1 - fill) / 2;
      villageCanvas.style.transform = 'translate3d(-50%,calc(-50% + ' + offset + 'px),0) scale(' + zoom + ')';
    }
    if (adaptiveLayout.matches) scenes.panorama.style.setProperty('--still',step(t,3.74,3.82));
    const leave = referenceTravel(t, exitStart, exitEnd);
    const veil = motion.matches ? 1 : referenceFade(leave);
    // Dissolve on the matched front view before the camera starts turning.
    const dissolve = motion.matches ? step(t, panoramaStart, 2.05) : step(t, frontMatch - .065, frontMatch);
    scenes.panorama.style.opacity = dissolve * veil;
    scenes.panorama.style.transform = 'translate3d(0,' + -visibleStageHeight * leave + 'px,0)';
    const flight = motion.matches ? step(t, 2.02, 3.74)
      : step(t, frontMatch, 3.74, x => x * (.4 + x * (2.2 - 1.6 * x)));
    village.set(villageFolder, 1 + 120 * flight, 121);
  }
  title('shape-title', t, exitStart + .55 * overlapSpan, exitEnd, 5.22, 5.86);
}
// A single monotone pose axis spans both clips. Pose 150 is also the
// first morph pose. Cards and the section exit follow the same clock.
function housePoseAt(t) {
  return 1 + 149 * referenceTravel(t,5.23,6.78)
    + 180 * (step(t,8.15,9.47) + step(t,10.39,11.79));
}
const firstPlan = 7.08;
// Keep the first and last authored card centers after removing one variation.
const cardPitch = 5.58 / (planCards.length - 1);
const planSpan = (planCards.length - 1) * cardPitch;
let planUnit, planHeight, widePlanSpacing, buildEntryStretch = 0;

// Extend only the distance between plan centers. Models, chapter links and
// controls still use the same authored poses, and cards move one pixel per pixel.
function scrollAt(time) {
  const buildDistance = clamp(time - buildEntry, 0, buildStart - buildEntry) * buildEntryStretch * unit;
  return time * unit + clamp(time - firstPlan, 0, planSpan) * (planUnit - unit) + buildDistance;
}
function timeAt(y) {
  const planDistance = clamp(y - firstPlan * unit, 0, planSpan * planUnit);
  const time = (y - planDistance) / unit + planDistance / planUnit;
  const buildProgress = clamp((time - buildEntry) / (1 + buildEntryStretch), 0, buildStart - buildEntry);
  return time - buildProgress * buildEntryStretch;
}
// Page scroll is the single timeline for the rail, the morph and the descent.
// A horizontal gesture seeks along that same timeline without scrolling into another chapter.
const planGallery = {last:planCards.length - 1, time:index => firstPlan + index * cardPitch};
const planPoses = orderedPlans.map(i => ({45:510,75:150,125:330})[catalog.plans[i].m2]);
function planPosition(t) {
  const raw = clamp((t - firstPlan) / cardPitch,0,planGallery.last);
  if (motion.matches) return Math.round(raw);
  const index = Math.floor(raw);
  return index + range(raw - index,.04,.96);
}
function seekPlan(position) {
  const bounded = clamp(position,0,planGallery.last);
  window.scrollTo({top:scrollAt(planGallery.time(bounded)),behavior:'instant'});
}
let planDrag = null;
planTrack.addEventListener('pointerdown', event => {
  if (!plansOpen || !event.isPrimary || event.button !== 0) return;
  planDrag = {id:event.pointerId,x:event.clientX,y:event.clientY,start:planPosition(current),horizontal:false};
});
planTrack.addEventListener('pointermove', event => {
  if (!planDrag || event.pointerId !== planDrag.id || !planStride) return;
  const dx = planDrag.x - event.clientX, dy = planDrag.y - event.clientY;
  if (!planDrag.horizontal) {
    if (Math.max(Math.abs(dx),Math.abs(dy)) < 6) return;
    if (Math.abs(dy) > Math.abs(dx)) { planDrag = null; return; }
    planDrag.horizontal = true;
    planTrack.setPointerCapture(event.pointerId);
    interruptScroll();
  }
  seekPlan(planDrag.start + dx / planStride);
});
planTrack.addEventListener('pointerup', event => {
  if (!planDrag || event.pointerId !== planDrag.id) return;
  if (planDrag.horizontal) {
    const dx = planDrag.x - event.clientX;
    const fraction = dx / planStride;
    const move = Math.abs(dx) >= 30 && Math.abs(fraction) < .5 ? Math.sign(dx) : fraction;
    selectGallery(planGallery,Math.round(planDrag.start + move));
  }
  planDrag = null;
});
planTrack.addEventListener('pointercancel', () => { planDrag = null; });
planTrack.addEventListener('wheel', event => {
  if (!plansOpen || event.ctrlKey || event.metaKey || !event.cancelable) return;
  const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
  if (!horizontal && !event.shiftKey) return;
  const delta = (horizontal ? event.deltaX : event.deltaY) * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? width : 1);
  event.preventDefault();
  interruptScroll();
  seekPlan((timeAt(scrollY) - firstPlan) / cardPitch + delta / planStride);
}, {passive:false});
planTrack.addEventListener('keydown', event => {
  if (!plansOpen) return;
  const index = selectedSlide?.gallery === planGallery ? selectedSlide.slide : selectedPlan;
  const next = {ArrowLeft:index - 1, ArrowRight:index + 1, Home:0, End:planGallery.last};
  if (!Object.hasOwn(next,event.key)) return;
  event.preventDefault();
  event.stopPropagation();
  selectGallery(planGallery,next[event.key]);
});
const portraitPlanUnit = () => width <= 600 ? Math.min(width / 390, height / 844) : Math.min(width / 768, height / 1194);
// Fit the longest roof once so the camera does not counter-animate the morph.
const portraitModelWidth = () => (width <= 600 ? 390 : 822) * portraitPlanUnit();
const portraitPlanCenter = () => height - (width <= 600 ? 662 : 934) * portraitPlanUnit();
function renderPlanRail(t) {
  const adapted = adaptiveLayout.matches;
  const start = adapted ? 5.55 : 6.65;
  const open = t >= start && t < (adapted ? 13.86 : 13.32);
  planTrack.hidden = !open;
  planTrack.tabIndex = open ? 0 : -1;
  if (open) {
    if (!plansOpen) planCards.forEach(loadCard);
    if (!plansOpen || planTrackWidth !== width) {
      if (adapted) {
        const first = planCards[0].getBoundingClientRect();
        planStride = planCards[1].getBoundingClientRect().left - first.left;
        planFinalInset = (width - first.width) / 2 - (first.left - planTrack.getBoundingClientRect().left + planTrack.scrollLeft);
      } else {
        planStride = planCards[1].offsetLeft - planCards[0].offsetLeft;
      }
      planTrackWidth = width;
    }
    const position = planPosition(t), index = Math.round(position);
    const centering = adapted ? planFinalInset * clamp(position - planGallery.last + 1) : 0;
    planTrack.scrollLeft = position * planStride - centering;
    if (!plansOpen || index !== selectedPlan) {
      selectedPlan = index;
      const plan = catalog.plans[orderedPlans[index]];
      planTrack.setAttribute('aria-valuenow',index + 1);
      planTrack.setAttribute('aria-valuetext',plan.name + ', ' + plan.m2 + ' m², ' + plan.rooms + ' rooms');
    }
    if (adapted) {
      const entry = (1 - surface(t,start,6.26)) * 102;
      const exit = surface(t,12.85,13.82);
      planTrack.style.transform = 'translateY(' + (entry + 106 * exit) + '%)';
      planTrack.style.opacity = 1 - exit;
      planTrack.inert = exit === 1;
    } else {
      const exposure = surface(t,start,firstPlan) * (1 - surface(t,12.84,13.32));
      planTrack.style.transform = 'translateY(' + ((1 - exposure) * 102) + '%)';
    }
  }
  plansOpen = open;
}
function houseAndPlans(t) {
  const active = visible('geometry', t >= 5.12 && t < interiorArrival);
  if (t > (tabletHouse ? 3.2 : 4.4) && t < 5.12) {
    // Only the entrance pose is needed while the panorama is still on screen.
    if (tabletHouse) house.set(orbitFolder, 1, 1, false);
    else house.set(orbitFolder, 1, 150);
  }
  if (!active) {
    plansOpen = false;
    return;
  }
  const arrival = reveal(t, 5.12, 6.03);
  modelFrame.style.translate = arrival < 1 ? '0 ' + (1 - arrival) * height * .7 + 'px' : '';
  if (usesPlanRail()) renderPlanRail(t);
  else planCards.forEach((card, i) => {
    const center = firstPlan + i * cardPitch;
    const offset = t - center;
    const distance = Math.abs(offset);
    // In motion the viewport itself clips entry and exit. The broad window
    // only culls cards that are already fully outside it at every supported size.
    const show = motion.matches ? i === Math.round((t - firstPlan) / cardPitch) : distance < 2;
    card.style.display = show ? '' : 'none';
    if (!show) return;
    loadCard(card);
    const travel = motion.matches ? 0 : scrollAt(t) - scrollAt(center);
    // Fade only the short portion that is actually crossing a screen edge.
    const top = height * .52 - travel - planHeight / 2;
    const visibleShare = clamp(Math.min(height - top, top + planHeight) / planHeight);
    card.style.opacity = motion.matches ? 1 : 1 - widePlanSpacing * (1 - ease(clamp(visibleShare / .28)));
    card.style.transform = portrait
      ? 'translate(-50%,' + (-travel) + 'px)'
      : 'translateY(calc(' + (height * .52 - travel) + 'px - 50%))';
  });
  if (t >= 13.86) {
    if (landscapePlans.matches) {
      modelFrame.style.width = '';
      modelFrame.style.left = '';
    }
    house.set(morphFolder, sampleFrame(181), sampleFrame(181));
    return;
  }
  modelFrame.style.visibility = '';
  house.canvas.style.transform = '';
  if (!adaptiveLayout.matches) modelFrame.style.top = '';
  let pose = Math.round(housePoseAt(t));
  if (usesPlanRail()) {
    const position = planPosition(t), index = Math.floor(position);
    const from = planPoses[index], to = planPoses[Math.min(index + 1,planGallery.last)];
    if (t >= 6.78) pose = Math.round(from + (to - from) * (position - index));
  }
  if (adaptiveLayout.matches) {
    const from = portraitPlanCenter();
    const settle = surface(t,12.85,13.52);
    modelFrame.style.top = (from + (height / 2 - from) * settle) + 'px';
    modelFrame.style.width = portraitModelWidth() + 'px';
  }
  if (landscapePlans.matches) {
    const leave = surface(t,13.04,13.82);
    modelFrame.style.left = (26 + 24 * leave) + '%';
    modelFrame.style.width = (50 + 50 * leave) + '%';
  }

  if (pose < 150) house.set(orbitFolder, pose, 150);
  else house.set(morphFolder, pose - 149, sampleFrame(181));
}
// Integrate a short acceleration into one constant rate through the mask.
function turnProgress(t, start, end) {
  if (motion.matches) return 0;
  const ramp = .26;
  const elapsed = clamp(t - start, 0, end - start);
  const distance = elapsed < ramp ? elapsed * elapsed / (2 * ramp) : elapsed - ramp / 2;
  return distance / (end - start - ramp / 2);
}
function modelDisplayWidth() {
  if (adaptiveLayout.matches) return portraitModelWidth() * 32 / 27;
  return portrait ? width * 1.1 : Math.min(width, height * 16 / 9) * 1.111;
}
// Join the two existing sizes through their authored middle pose. Both
// halves have the same nonzero speed at the join, with zero speed at rest.
function apertureProgress(t, start, middle, end, share) {
  const first = middle - start, last = end - middle;
  const speed = 1.5 * Math.min(share / first, (1 - share) / last);
  if (t < middle) {
    const x = range(t, start, middle);
    return share * ease(x) + speed * first * x * x * (x - 1);
  }
  const x = range(t, middle, end);
  return share + (1 - share) * ease(x) + speed * last * x * (1 - x) ** 2;
}
function facade(t) {
  const adapted = adaptiveLayout.matches;
  const maskEnd = 17.04;
  const maskStart = adapted ? Math.min(15.62, maskEnd - overlapSpan) : maskEnd - overlapSpan;
  const lastPose = sampleFrame(150, facadeSamples);
  const folder = facadeFolder;
  if (t > 12.6 && t < 13.86) facadePose.set(folder, 1, lastPose, false);
  if (t >= interiorArrival && t < interiorArrival+1) facadePose.set(folder,lastPose,lastPose,false);
  if (!visible('facades', t >= 13.86 && t < interiorArrival)) return;

  const turnStart = 15.10;
  const pull = reveal(t, 13.86, turnStart);
  const turn = turnProgress(t, turnStart, 17.04);
  const pose = Math.round(sampleFrame(1 + 149 * turn, facadeSamples));

  // Keep the outgoing 45 m² image throughout the pullback. The center turn
  // continues from the same morph scene at this final scale.
  const openingWidth = modelDisplayWidth();
  const morphScale = openingWidth * 9 / 16 / 1280;
  const startScale = morphScale * 1014 / 300;
  const phone = width <= 600;
  const u = Math.min(width / (phone ? 390 : 768), height / (phone ? 844 : 1194));
  const endScale = adapted ? (phone ? 96 : 182) / 301 * u : Math.min(width / 1920, height / 1080);
  const scale = startScale * Math.pow(endScale / startScale, pull);
  const openingY = adapted ? height / 2 : height * (portrait ? .36 : .5);
  const centerY = openingY + (height / 2 + (adapted ? 0 : 27 * endScale) - openingY) * pull;

  // At entry, every neighbour is outside the actual viewport. At rest the
  // three rows and columns use the available width and height independently.
  const startX = Math.max(608 * startScale, width / 2 + 304 * startScale);
  const startY = Math.max(342 * startScale, Math.max(openingY, height - openingY) + 171 * startScale);
  const pitchX = startX + (width * 608 / 1920 - startX) * pull;
  const pitchY = startY + (height * 342 / 1080 - startY) * pull;
  // Project the same nine atlas cells onto the authored portrait positions.
  // Offsets use the centre home as origin throughout the pullback and turn.
  const centers = adapted ? facadeTiles.map((_, i) => {
    const col = i % 3 - 1, row = Math.floor(i / 3) - 1;
    const x = phone ? col * (row ? 111 : 138) : col * 244;
    const y = phone ? row * (col ? 198 : 334) : row * 347;
    return [width / 2 + col * startX * (1 - pull) + x * u * pull,
      centerY + row * startY * (1 - pull) + y * u * pull];
  }) : null;
  facadeLayout = {centerY, pitchX, pitchY, scale, centers};
  // The CSS tiles may still be loading after a direct or reverse entry.
  // The movie's first frame contains that same grid at the pullback scale.
  const posterReady = packagedMedia || (facadePreview.complete && facadePreview.naturalWidth > 0);
  const useAtlas = pose > 1 || (adapted && (pull === 1 || !posterReady));
  if (pose === 1 && (!useAtlas || pull < 1)) facadePose.shown = null;
  const ready = facadePose.set(folder, pose, lastPose, useAtlas);
  const havePose = ready && (pose > 1 || facadePose.shown?.position === 1);
  const keepAtlas = adapted && !posterReady && !facadeCanvas.hidden;
  const rotating = useAtlas && (havePose || keepAtlas);
  const posterCenter = adapted && !rotating && posterReady &&
    !(house.shown?.folder === morphFolder && house.shown.position === sampleFrame(181));
  facadeTiles[4].hidden = !posterCenter;
  if (adapted) modelFrame.style.width = portraitModelWidth() + 'px';
  if (!rotating) {
    modelFrame.style.top = centerY + 'px';
    house.canvas.style.transform = 'scale(' + scale / startScale + ')';
    facadeTiles.forEach((tile, i) => {
      const x = (centers ? centers[i][0] : width / 2 + (i % 3 - 1) * pitchX) - 304 * scale;
      const y = (centers ? centers[i][1] : centerY + (Math.floor(i / 3) - 1) * pitchY) - 171 * scale;
      tile.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + scale + ')';
    });
  }
  if (field.hidden !== rotating) {
    field.hidden = rotating;
    facadeCanvas.hidden = !rotating;
  }
  modelFrame.style.visibility = rotating || posterCenter ? 'hidden' : '';
  const middle = adapted ? 16.08 : 16.60;
  const windowScale = adapted ? u : Math.min(width / 1920, height / 1080);
  const windowW = (adapted ? (phone ? 295 : 561) : 775) * windowScale;
  const windowH = (adapted ? (phone ? 180 : 342) : 472) * windowScale;
  const share = (windowW / width + windowH / height) / 2;
  const progress = apertureProgress(t, maskStart, middle, maskEnd, share);
  const first = motion.matches ? step(t, maskStart, adapted ? middle : maskEnd) : range(progress, 0, share);
  const last = motion.matches ? (adapted ? step(t, 16.20, maskEnd) : first) : range(progress, share, 1);
  const maskOpacity = ease(first);
  // Start once the title window has room for the words and finish as it fills the viewport.
  const textProgress = motion.matches ? first : range(progress, .85 * share, 1);
  const fade = titleFades.get('facades');
  if (fade && !motion.matches) setTitleFadeProgress(fade, textProgress);
  const copyOpacity = fade && !motion.matches ? 1 : textProgress;
  if (adapted) {
    const w = windowW * first + (width - windowW) * last;
    const h = windowH * first + (height - windowH) * last;
    const panel = $('.mask-title');
    const radius = 140 * u * (1-last);
    panel.style.clipPath = 'inset(' + (height-h)/2 + 'px ' + (width-w)/2 + 'px round ' + radius + 'px)';
    panel.style.opacity = maskOpacity;
    panel.style.setProperty('--title-lift',last);
    panel.firstElementChild.style.transform = 'none';
    panel.firstElementChild.style.opacity = copyOpacity;
    $('.mask-shade').style.opacity = .4 * maskOpacity;
    return;
  }
  // Desktop storyboard: the rounded title window reaches its authored pose
  // before expanding to fill the screen. Both phases follow scroll in reverse.
  $('.mask-shade').style.opacity = .4 * maskOpacity + .18 * ease(last);
  const maskTitle = $('.mask-title');
  const clipPosition = motion.matches ? first : progress;
  if (clipPosition !== maskClipPosition) {
    const left = (width - windowW * first) * (1 - last) / 2;
    const top = (height - windowH * first) * (1 - last) / 2;
    const radius = 140 * windowScale * (1 - last);
    maskTitle.style.clipPath = 'inset(' + top + 'px ' + left + 'px round ' + radius + 'px)';
    maskClipPosition = clipPosition;
  }
  maskTitle.style.opacity = maskOpacity;
  const heading = maskTitle.firstElementChild;
  heading.style.transform = 'none';
  heading.style.opacity = copyOpacity * (1 - .72 * step(t, interiorEntry, interiorArrival));
}
function slideImages(images, position, vertical) {
  images.forEach((img, i) => {
    const delta = i - position;
    if (Math.abs(delta) < 1.8) loadImage(img);
    const live = Math.abs(delta) < 1.01;
    img.style.visibility = live ? 'visible' : 'hidden';
    if (!live) return;
    img.style.transform = (vertical ? 'translateY(' : 'translateX(') + delta * 100 + '%)';
  });
}
const playingCardLines = new Map();

function measureCardLines(node) {
  const text = node.firstChild;
  if (!(text instanceof Text) || !text.data.trim()) return;
  const range = document.createRange();
  const starts = [0];
  let lineTop;
  for (const word of text.data.matchAll(/\S+/g)) {
    range.setStart(text, word.index);
    range.setEnd(text, word.index + word[0].length);
    const top = range.getBoundingClientRect().top;
    if (lineTop != null && Math.abs(top - lineTop) > 1) starts.push(word.index);
    lineTop = top;
  }
  return {node, text, lines:starts.map((start, i) => text.data.slice(start, starts[i + 1]))};
}

function revealCardLines(fields, startDelay = 0) {
  for (const node of fields) playingCardLines.get(node)?.();
  if (motion.matches || !Element.prototype.animate) return;
  // Read every natural line before inserting the masks. Restore the original
  // text at rest so later typography or viewport changes can wrap it normally.
  const measured = fields.map(measureCardLines).filter(Boolean);
  let delay = startDelay;
  for (const {node, text, lines} of measured) {
    const masks = lines.map(line => {
      const mask = document.createElement('span');
      const copy = document.createElement('span');
      mask.className = 'card-line-mask';
      copy.className = 'card-line';
      copy.textContent = line;
      mask.append(copy);
      return mask;
    });
    node.replaceChildren(...masks);
    const animations = masks.map(mask => {
      const animation = mask.firstChild.animate([{transform:'translateY(120%)'}, {transform:'translateY(0)'}],
        {duration:570, delay, easing:'cubic-bezier(.22,1,.36,1)', fill:'backwards'});
      delay += 72;
      return animation;
    });
    function finish() {
      if (playingCardLines.get(node) !== finish) return;
      playingCardLines.delete(node);
      if (node.firstChild === masks[0]) node.replaceChildren(text);
      for (const animation of animations) animation.cancel();
    }
    playingCardLines.set(node, finish);
    Promise.allSettled(animations.map(animation => animation.finished)).then(finish);
  }
}
function finishCardLines() {
  for (const finish of playingCardLines.values()) finish();
}
motion.addEventListener('change', finishCardLines);
const interiorCopy = $('.interior-copy');
const interiorTitle = $('#interior-title');
const interiorBody = $('#interior-description');
const interiorNumber = $('#interior-count strong');
const interiorSlider = $('#interior-slider');
const interiorLast = interiors.length - 1;
const interiorThumbFraction = () => adaptiveLayout.matches && width <= 600 ? 28.333 / 75 : isPortraitTablet() ? 58.333 / 145 : 7 / 18;
const interiorTextFields = [interiorTitle, interiorBody];
let interiorCopyShown = false;
let selectedSlide = null, interiorVisualPosition = null;
$('#interior-count span').textContent = ' — ' + interiors.length;
interiorSlider.setAttribute('aria-valuemax', interiors.length);

function interior(t) {
  if (t > 14.5 && t < interiorEntry) interiors.slice(0, 3).forEach(loadImage);
  if (t >= interiorEnd && t < interiorEnd + 2) interiors.slice(-3).forEach(loadImage);
  if (!visible('interiors', t >= interiorEntry && t < interiorEnd)) {
    interiorCopyShown = false;
    return;
  }
  const entrance = range(t, interiorEntry, interiorArrival);
  const enter = reveal(t, interiorEntry, interiorArrival);
  const exit = referenceTravel(t, interiorExitStart, interiorEnd);
  scenes.interiors.style.transform = 'translate3d(' + (1 - enter) * 100 + '%, ' + -exit * 101 + '%, 0)';
  scenes.interiors.style.opacity = motion.matches ? 1 : referenceFade(exit);
  const position = interiorPosition(t);
  if (position !== interiorVisualPosition) {
    interiorVisualPosition = position;
    interiorTrack.style.transform = 'translateX(' + (-position * interiorPitch) + 'px)';
  }
  const i = Math.round(position);
  const changed = i !== interiorIndex;
  if (changed) {
    for (const image of interiors.slice(Math.max(0, i - 2), i + 3)) loadImage(image);
    const {name, body} = catalog.interiors[i];
    interiorTitle.textContent = name;
    interiorBody.textContent = body;
    interiorNumber.textContent = i + 1;
    interiorSlider.setAttribute('aria-valuenow', i + 1);
    interiorSlider.setAttribute('aria-valuetext', (i + 1) + ' of ' + interiors.length + ', ' + name);
    interiors.forEach((image, index) => image.setAttribute('aria-hidden', String(index !== i)));
    interiorIndex = i;
  }
  const copyVisible = !textRevealOverlay.open && entrance >= (motion.matches ? .5 : .67);
  interiorCopy.style.visibility = copyVisible ? 'visible' : 'hidden';
  if (copyVisible && (changed || !interiorCopyShown)) revealCardLines(interiorTextFields);
  interiorCopyShown = copyVisible;
  interiorSlider.style.setProperty('--interior-progress', position / interiorLast);
  interiorCard.style.opacity = reveal(entrance, .47, .77);
  interiorCard.style.setProperty('--divider-reveal', reveal(entrance, .61, .89));
  interiorCard.style.setProperty('--controls-reveal', reveal(entrance, .72, 1));
  interiorCard.inert = t < interiorArrival || exit > .35;
}
const wallStart = 25.48;
const wallRate = 215 / 3.9;
const wallFirstFrame = wallHolds[0][0];
const wallReadFrame = wallFirstFrame + 6;
const wallReadSpan = .20;
const wallSlideDuration = 1120;
const wallStops = [];
let wallEntranceFrame, wallFirstArrival, wallReadPoint, wallLastPose, wallFadeStart, wallEnd;
function wallAuthoredFrameAt(t) {
  if (t < wallFirstArrival) {
    const progress = range(t, wallStart, wallFirstArrival);
    const ramp = .30;
    const edge = Math.min(progress, 1 - progress);
    const distance = edge < ramp ? edge * edge / (2 * ramp) : edge - ramp / 2;
    const fraction = distance / (1 - ramp);
    return wallEntranceFrame + (wallFirstFrame - wallEntranceFrame) * (progress <= .5 ? fraction : 1 - fraction);
  }
  if (t < wallReadPoint) {
    return wallFirstFrame + (wallReadFrame - wallFirstFrame) * ease(range(t, wallFirstArrival, wallReadPoint));
  }
  // Hold the first readable pose over a short scroll range without moving the page.
  const resume = wallReadPoint + wallReadSpan;
  const span = wallLastPose - resume;
  const elapsed = clamp(t - resume, 0, span);
  const remaining = span - elapsed;
  const ramp = .12;
  const start = 1 - range(elapsed, 0, ramp);
  const end = 1 - range(remaining, 0, ramp);
  const travel = elapsed - elapsed * start ** 2 + remaining * end ** 2;
  return Math.min(216, wallReadFrame + travel * wallRate);
}
function wallTimeAtFrame(frame) {
  let start = wallFirstArrival, end = wallLastPose;
  // Convert the still in the authored animation to a stop on the page.
  for (let i = 0; i < 18; i++) {
    const middle = (start + end) / 2;
    if (wallAuthoredFrameAt(middle) < frame) start = middle;
    else end = middle;
  }
  return (start + end) / 2;
}
function wallFrameAt(t) {
  const next = wallStops.findIndex(stop => stop > t);
  if (next <= 0) return wallAuthoredFrameAt(t);
  const start = wallStops[next - 1], end = wallStops[next];
  const [first, from] = wallHolds[next - 1];
  const to = wallHolds[next][0];
  if ((t - start) * unit < 1) return first;
  if ((end - t) * unit < 1) return to;
  // The source repeats each still. Spend the transition on the moving frames.
  return from + (to - from) * range(t, start, end);
}
const wallTextFields = wallCards.map(card => Array.from(card.querySelector('.wall-copy').children));
const wallCardFadeOut = 220;
scenes.wall.style.setProperty('--wall-card-fade-out', wallCardFadeOut + 'ms');
wallCards.forEach(card => card.setAttribute('aria-hidden', 'true'));
let activeWallCard = -1;
function showWallCard(index) {
  if (activeWallCard === index) return;
  const previous = wallCards[activeWallCard];
  if (previous) {
    previous.classList.remove('wall-card-visible');
    previous.setAttribute('aria-hidden', 'true');
  }
  activeWallCard = index;
  if (index < 0) return;
  const wait = previous && !motion.matches ? wallCardFadeOut : 0;
  const card = wallCards[index];
  card.style.setProperty('--wall-card-wait', wait + 'ms');
  card.classList.add('wall-card-visible');
  card.setAttribute('aria-hidden', 'false');
  revealCardLines(wallTextFields[index], wait);
}
function wallSystem(t) {
  const titleEntry = interiorExitStart + .9 * (interiorEnd - interiorExitStart);
  title('wall-title', t, titleEntry, wallTitleStop - .015, wallTitleExitStart, wallTitleExitEnd);
  const folder = wallFolder;
  if (t > 24.25 && t < wallStart) wall.set(folder, wallSample(wallEntranceFrame), wallSample(216), false);
  if (t >= wallEnd && t < wallEnd+.45) wall.set(folder,wallSample(216),wallSample(216),false);
  if (!visible('wall', t >= wallStart && t < wallEnd)) {
    showWallCard(-1);
    return;
  }
  const frame = wallFrameAt(t);
  const still = wallHolds.find(([first, last]) => frame >= first && frame <= last);
  const pose = still ? still[0] : motion.matches ? Math.round(frame) : frame;
  wall.set(folder, wallSample(pose), wallSample(216));
  const rise = surface(t, wallStart, wallFirstArrival);
  wall.canvas.style.opacity = rise * (motion.matches ? 1 - step(t, wallFadeStart, wallEnd)
    : referenceFade(range(t, wallFadeStart, wallEnd)));
  // Let the painted layer lead the caption even when decoding trails a gesture.
  const paintedFrame = ((wall.shown?.position ?? -1) + 1) / 2;
  const captionFrame = Math.min(frame, paintedFrame);
  const nextCard = t >= wallFadeStart || textRevealOverlay.open
    ? -1 : wallCardStarts.findLastIndex(start => captionFrame >= start);
  showWallCard(nextCard);
  wallCards.forEach((card, i) => {
    if (Math.abs(wallHolds[i][0] - frame) < 46) loadCard(card);
  });
}
const buildTextFields = Array.from(buildCopy.children);
let buildCopyShown = false;
function construction(t) {
  const photoEntry = buildEntry;
  const photoArrival = 31.62;
  const cardEntry = photoEntry + referenceCoverDistance * (photoArrival - photoEntry);
  title('build-title', t, wallEnd, Math.min(wallEnd + .41, 31.07), 31.16, 31.72);
  if (t > 29.9 && t < 36.3) stages.forEach(loadImage);
  const filmPosition = step(t, filmArrival, formArrival);
  const adapted = adaptiveLayout.matches;
  const entering = portrait ? t < filmSweep : filmPosition < filmFrameShare;
  if (visible('construction', t >= photoEntry && t < (adapted ? formArrival : 37.95))) {
    const entrance = reveal(t, photoEntry, photoArrival);
    const shift = (portrait ? 101 : 76) * (1 - entrance);
    const expose = reveal(t, cardEntry, buildStart - .025);
    buildFrame.hidden = !adapted && !entering;
    if (adapted) {
      scenes.construction.style.transform = 'translate3d(' + (-100 * filmPosition) + '%, ' + (-100 * (1 - entrance)) + '%, 0)';
      buildFrame.style.transform = '';
      buildCard.style.transform = 'translateY(calc(' + (expose - 1) + ' * (100% + var(--build-vgap))))';
    } else {
      scenes.construction.style.transform = '';
      buildFrame.style.transform = 'translateX(' + shift + 'vw)';
      buildCard.style.transform = 'translateX(calc(' + shift + 'vw + ' + (1 - expose) + ' * (' +
        (portrait ? '100vw' : '100% + var(--build-gap)') + ')))';
    }
    buildCard.style.visibility = expose > 0 && t < formArrival ? 'visible' : 'hidden';
    buildCard.style.opacity = expose;
    buildCard.inert = expose < .98 || t > filmArrival;
    const position = buildPosition(t);
    slideImages(stages, position, adapted);
    const i = Math.round(position);
    const changed = i !== buildIndex;
    if (changed) {
      const {name, kicker, body} = catalog.stages[i];
      buildCopy.children[0].textContent = kicker;
      buildCopy.children[1].textContent = name;
      buildCopy.children[2].textContent = body;
      buildCount.querySelector('strong').textContent = i + 1;
      buildSlider.setAttribute('aria-valuenow', i + 1);
      buildSlider.setAttribute('aria-valuetext', (i + 1) + ' of ' + stages.length + ', ' + name);
      stages.forEach((image, index) => image.setAttribute('aria-hidden', String(index !== i)));
      buildIndex = i;
    }
    const copyVisible = !textRevealOverlay.open && expose >= .35 && t < formArrival;
    buildCopy.style.visibility = copyVisible ? 'visible' : 'hidden';
    if (copyVisible && (changed || !buildCopyShown)) revealCardLines(buildTextFields);
    buildCopyShown = copyVisible;
    buildSlider.style.setProperty('--build-progress', position / buildLast);
  } else buildCopyShown = false;
  if (t > 29.9 && !forestFilm.poster) forestFilm.poster = contactPoster;
  if (t > 34 && !motion.matches) prepareContactFilm();
  const enquiry = visible('enquiry', t >= filmArrival);
  const footerDeparture = range(t, END, END + height / unit);
  loopVideo(forestFilm, enquiry && footerDeparture < 1);
  if (!enquiry) return;
  // In portrait the incoming video and form travel together, one viewport behind Engineering.
  scenes.enquiry.style.transform = adapted ? 'translateX(' + (100 * (1 - filmPosition)) + '%)' : '';
  // Other layouts clip the incoming video to the Engineering photo.
  filmWindow.style.clipPath = !adapted && entering
    ? (!portrait && buildFrame.style.clipPath) || 'inset(0 round var(--radius))' : '';
  const entry = portrait ? step(t, filmArrival, filmSweep) : clamp(filmPosition / filmFrameShare);
  const sweep = portrait ? step(t, filmSweep, formArrival) : range(filmPosition, filmFrameShare, 1);
  filmWindow.style.setProperty('--film-enter', 1 - entry);
  filmWindow.style.setProperty('--film-sweep', sweep);
  contactForm.style.visibility = adapted || !entering ? 'visible' : 'hidden';
  contactForm.inert = t < formArrival;
}
function render() {
  raf = 0;
  if (loadingMedia) return;
  const y = window.scrollY;
  if (!openingRendered) {
    openingRendered = true;
    if (y > 0) {
      mast.classList.add('skip-intro');
      scenes.hero.classList.remove('first-visit');
    }
  }
  current = timeAt(y);
  if (!packagedMedia) prepareOnlineMedia(current);
  const openingHeaderBottom = header(current, y);
  heroAndVillage(current, openingHeaderBottom);
  houseAndPlans(current);
  facade(current);
  interior(current);
  wallSystem(current);
  construction(current);
  frameSequences.forEach(sequence => sequence.endRender());
  if (focusOnArrival && Math.abs(focusOnArrival.getBoundingClientRect().top) <= 2) {
    const target = focusOnArrival;
    focusOnArrival = null;
    if (target.id === 'contact') contactForm.elements.name.focus({preventScroll:true});
    else if (target.id === 'plans' && plansOpen) planTrack.focus({preventScroll:true});
    else target.focus({preventScroll:true});
  }
}
function schedule() { if (!raf) raf = requestAnimationFrame(render); }
function measurePanorama() {
  visibleStageHeight = viewport.clientHeight;
  panoramaCover = Math.max(width, visibleStageHeight * 16 / 9);
  panoramaWidth = portrait ? width * (width <= 600 ? 1.64 : 1.38) : Math.min(panoramaCover, width * 1.4);
  const fitted = panoramaWidth < panoramaCover;
  villageCanvas.style.left = villageCanvas.style.top = fitted ? '50%' : '';
  villageCanvas.style.width = fitted ? panoramaCover + 'px' : '';
  villageCanvas.style.height = fitted ? panoramaCover * 9 / 16 + 'px' : '';
  if (!fitted) villageCanvas.style.transform = '';
}
function measure() {
  if (touchViewport.matches && width !== viewport.clientWidth) {
    document.documentElement.style.removeProperty('--view');
    document.documentElement.style.setProperty('--stage-view', stageHeight() + 'px');
  }
  viewport.style.minHeight = '';
  const timelineHeight = parseFloat(getComputedStyle(viewport).minHeight);
  if (touchViewport.matches) {
    document.documentElement.style.setProperty('--view', timelineHeight + 'px');
    viewport.style.minHeight = '0';
  }
  const resized = unit && (width !== viewport.clientWidth || height !== timelineHeight);
  if (resized) finishCardLines();
  const previousTime = resized ? timeAt(window.scrollY) : null;
  width = viewport.clientWidth;
  height = timelineHeight;
  portrait = adaptiveLayout.matches || matchMedia('(max-aspect-ratio:4/5)').matches;
  planTrack.hidden = false;
  planTrackWidth = 0;
  planDrag = null;
  plansOpen = false;
  planTrack.style.transform = '';
  planTrack.style.opacity = '';
  planTrack.inert = false;
  modelFrame.style.width = '';
  modelFrame.style.left = '';
  if (usesPlanRail()) {
    for (const card of planCards) {
      card.style.removeProperty('display');
      card.style.removeProperty('opacity');
      card.style.removeProperty('transform');
    }
    planTrack.setAttribute('role','slider');
    planTrack.setAttribute('aria-label','Floor plans');
    planTrack.setAttribute('aria-valuemin','1');
    planTrack.setAttribute('aria-valuemax',planCards.length);
  } else {
    for (const name of ['role','aria-label','aria-valuemin','aria-valuemax']) planTrack.removeAttribute(name);
    planTrack.removeAttribute('aria-valuenow');
    planTrack.removeAttribute('aria-valuetext');
    planTrack.removeAttribute('tabindex');
    planTrack.scrollLeft = 0;
  }
  // The scenes can be display:none here. Use the house's fitted 3:2 width
  // and the wall's resolved viewport-based CSS width, including overscan.
  const houseWidth = modelDisplayWidth() * 27 / 32;
  measurePanorama();
  village.setRasterWidth(Math.min(3840, Math.round(panoramaCover * devicePixelRatio)));
  const wallWidth = parseFloat(getComputedStyle(wall.canvas).width);
  house.setRasterWidth(Math.min(3840, Math.round(houseWidth * devicePixelRatio)));
  wall.setRasterWidth(Math.min(1536, Math.round(wallWidth * devicePixelRatio)));
  const density = Math.min(devicePixelRatio, Math.sqrt(3840 * 2160 / (width * height)));
  facadeCanvas.width = Math.round(width * density);
  facadeCanvas.height = Math.round(height * density);
  facadeCanvas.getContext('2d')?.setTransform(facadeCanvas.width / width, 0, 0, facadeCanvas.height / height, 0, 0);
  facadePose.shown = null;
  maskClipPosition = null;
  const interiorGap = adaptiveLayout.matches ? (width <= 600 ? 10 : 10 * width / 768) : Math.max(6, width * 10 / 1920);
  interiorFrame.style.setProperty('--interior-gap', interiorGap + 'px');
  interiorSlider.style.setProperty('--thumb-height', interiorThumbFraction() * 100 + '%');
  interiorPitch = width - interiorGap;
  interiorTrack.style.setProperty('--interior-pitch', interiorPitch + 'px');
  interiorVisualPosition = null;
  const bar = $('.bar').getBoundingClientRect();
  const compact = $('.compact-wordmark img').getBoundingClientRect();
  barHeight = bar.height;
  compactLogo = {x:compact.left - bar.left, y:compact.top - bar.top, width:compact.width, height:compact.height};
  measureMastMotion();
  if (current < 2.1) heroCopyHeight = intro.offsetHeight || heroCopyHeight;
  unit = height * (portrait ? .82 : .75);
  overlapSpan = referenceCoverDistance * height / unit;
  interiorEntry = interiorArrival - overlapSpan;
  interiorEnd = interiorExitStart + overlapSpan;
  const wallDisplay = scenes.wall.style.display;
  scenes.wall.style.display = 'block';
  const wallBounds = wall.canvas.getBoundingClientRect();
  const wallTop = wallBounds.top - viewport.getBoundingClientRect().top;
  scenes.wall.style.display = wallDisplay;
  const wallBottom = (height - wallTop) * 2560 / wallBounds.height;
  // The first layer starts off-screen and rises 36 source pixels per authored
  // frame. Begin at the visible edge; desktop and portrait crop it differently.
  wallEntranceFrame = clamp(1.25 + (2555 - wallBottom) / 36, 1, wallFirstFrame - 1);
  const firstHold = wallTitleExitEnd + overlapSpan;
  wallFirstArrival = wallStart + (firstHold - wallStart) * .82;
  // Spend the saved entrance time on the authored still so the later layers keep their cues.
  wallReadPoint = firstHold + (wallReadFrame - wallFirstFrame) / wallRate;
  wallLastPose = firstHold + (216 - wallFirstFrame) / wallRate + wallReadSpan;
  wallHolds.forEach(([first, last], index) => {
    wallStops[index] = wallTimeAtFrame((first + last) / 2);
  });
  wallFadeStart = wallLastPose + .25;
  wallEnd = wallFadeStart + .35;
  // The scene may be display:none on a direct link. Measure its actual card
  // template once per viewport size, outside the animation loop.
  const sample = planCards[0].cloneNode(true);
  sample.style.cssText = 'visibility:hidden';
  viewport.append(sample);
  planHeight = sample.getBoundingClientRect().height;
  sample.remove();
  widePlanSpacing = range(width / height, 1.15, 1.5);
  // At the closest handoff the smaller of two visible fragments is 10%.
  const widePitch = height + .8 * planHeight;
  planUnit = usesPlanRail() ? unit * .82 : unit + widePlanSpacing * (widePitch / cardPitch - unit);
  buildEntryStretch = .75;
  story.style.height = 'calc(' + scrollAt(END) + 'px + var(--stage-view,var(--view)))';
  measureOpeningMotion();
  for (const [id, time] of chapters) document.getElementById(id).style.top = Math.round(scrollAt(time)) + 'px';
  if (previousTime !== null && previousTime <= END) {
    window.scrollTo({top:scrollAt(previousTime), behavior:'instant'});
  }
  schedule();
}
function interruptScroll() {
  if (selectedSlide) cancelAnimationFrame(selectedSlide.frame);
  selectedSlide = null;
  focusOnArrival = null;
}
let chapterTransition = null;
function endChapterTransition() {
  chapterTransition?.skipTransition();
  chapterTransition = null;
}
function landOnChapter(target) {
  window.scrollTo({top:window.scrollY + target.getBoundingClientRect().top, behavior:'instant'});
  focusOnArrival = target;
  render();
}
function visitChapter(target) {
  endChapterTransition();
  resetGestures();
  if (menu.open) {
    menuDestination = target;
    closeMenu();
    return;
  }
  const arrive = () => {
    const hash = '#' + target.id;
    if (location.hash !== hash) history.pushState(null, '', hash);
    landOnChapter(target);
  };
  if (motion.matches || !document.startViewTransition) return arrive();

  // Snapshot the outgoing viewport before closing its menu or changing scrollY.
  const transition = document.startViewTransition(() => {
    if (chapterTransition === transition) arrive();
  });
  chapterTransition = transition;
  transition.ready.catch(() => {}); // A newer link or history traversal can skip this reveal.
  transition.finished.then(() => {
    if (chapterTransition === transition) chapterTransition = null;
  });
}
window.addEventListener('popstate', () => {
  endChapterTransition();
  menuDestination = null;
  const target = document.getElementById(location.hash.slice(1));
  // Native history restoration runs after popstate and varies between engines.
  if (target?.classList.contains('anchor')) requestAnimationFrame(() => landOnChapter(target));
});
const menuButton = $('#menu-button');
const menuOffscreen = 'translateY(-100%) scaleY(0)';
let menuMotion, menuDestination = null, menuClosing = false;
menuButton.addEventListener('click', () => {
  if (menu.open) return;
  resetGestures();
  menu.showModal();
  menuButton.setAttribute('aria-expanded','true');
  if (!motion.matches && menu.animate) {
    menuMotion = menu.animate([{transform:menuOffscreen}, {transform:'translateY(0) scaleY(1)'}],
      {duration:1000, easing:'cubic-bezier(.333333,1,.666667,1)'});
  }
});
function closeMenu() {
  if (!menu.open || menuClosing) return;
  menuClosing = true;
  if (motion.matches || !menu.animate) return menu.close();
  menu.classList.add('menu-closing');
  const from = getComputedStyle(menu).transform;
  menuMotion?.cancel();
  menuMotion = menu.animate([{transform:from === 'none' ? 'translateY(0) scaleY(1)' : from},
    {transform:menuOffscreen}], {duration:500, easing:'cubic-bezier(.333333,0,.666667,0)', fill:'forwards'});
  menuMotion.finished.then(() => menu.close(), () => {});
}
$('#close-menu').addEventListener('click', closeMenu);
menu.addEventListener('cancel', event => {
  event.preventDefault();
  closeMenu();
});
menu.addEventListener('close', () => {
  if (menu.open) return;
  const restoreFocus = menuClosing;
  const destination = menuDestination;
  menuClosing = false;
  menuDestination = null;
  menuMotion?.cancel();
  menu.classList.remove('menu-closing');
  menuButton.setAttribute('aria-expanded','false');
  if (destination) visitChapter(destination);
  else if (restoreFocus) menuButton.focus({preventScroll:true});
});
menu.addEventListener('click', event => {
  if (event.target === menu && event.clientY > menu.getBoundingClientRect().bottom) closeMenu();
});
motion.addEventListener('change', () => {
  if (!motion.matches) return;
  if (menuClosing) menu.close();
  else menuMotion?.cancel();
});
document.addEventListener('click', e => {
  const anchor = e.target.closest('a[href^="#"]');
  if (!anchor || e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
  const target = document.getElementById(anchor.hash.slice(1));
  if (!target) return;
  e.preventDefault();
  visitChapter(target);
});
function interiorTime(index) { return index === 0 ? interiorFirstStop : interiorStart + index * interiorInterval + .06; }
function interiorPosition(t) {
  // The first room has a shorter interval because it enters from the facade.
  const position = t < interiorTime(1) ? range(t, interiorTime(0), interiorTime(1))
    : clamp(1 + (t - interiorTime(1)) / interiorInterval, 1, interiorLast);
  const nearest = Math.round(position);
  return motion.matches || Math.abs(position - nearest) * interiorPitch < 1 ? nearest : position;
}
const interiorGallery = {time:interiorTime, at:t => Math.round(interiorPosition(t)), last:interiorLast};
const wallGallery = {time:index => wallStops[index]};
const buildGallery = {time:buildTime, at:buildAt, last:buildLast};
const interiorStops = Array.from({length:interiorLast + 1}, (_, index) => interiorTime(index));

function animateToTime(time, duration, gallery = null, slide = null, curve = scrollEase) {
  interruptScroll();
  const from = window.scrollY;
  const to = Math.round(scrollAt(time));
  if (from === to || !duration || motion.matches) {
    window.scrollTo({top:to,behavior:'instant'});
    return;
  }
  const start = performance.now();
  let lastY = from;
  function advance(now) {
    if (Math.abs(window.scrollY - lastY) > 1) {
      return interruptScroll();
    }
    const progress = range(now, start, start + duration);
    window.scrollTo({top:from + (to - from) * curve(progress),behavior:'instant'});
    lastY = window.scrollY;
    if (progress < 1) {
      selectedSlide.frame = requestAnimationFrame(advance);
    } else {
      const {exitDelta} = selectedSlide;
      selectedSlide = null;
      if (exitDelta) {
        const stop = nextReadingStop(lastY, exitDelta);
        window.scrollTo({top:stop ? scrollAt(stop.time) : lastY + exitDelta, behavior:'instant'});
      }
    }
  }
  selectedSlide = {gallery,slide,direction:Math.sign(to - from),frame:requestAnimationFrame(advance)};
}
function selectGallery(gallery, index) {
  resetGestures();
  const slide = clamp(index, 0, gallery.last);
  animateToTime(gallery.time(slide), referenceSlideDuration, gallery, slide, surfaceEase);
}

const readingGroups = [
  interiorStops, [wallTitleStop], wallStops,
  [...Array.from({length:buildLast + 1}, (_, index) => buildTime(index)), formArrival + .02]
];

function usesInstantReadingEntry(stop) {
  return stop?.entry && (interiorStops.includes(stop.time) || wallStops.includes(stop.time));
}

// Outside a gallery, native input owns the page up to its actual boundary.
// Within it, choose the next authored reading pose in the gesture direction.
function nextReadingStop(y, delta, groups = readingGroups) {
  for (const times of delta > 0 ? groups : groups.toReversed()) {
    const first = Math.round(scrollAt(times[0])), last = Math.round(scrollAt(times.at(-1)));
    if (y < first - 1) {
      if (y + delta >= first) return {time:times[0], entry:true};
    } else if (y > last + 1) {
      if (y + delta <= last) return {time:times.at(-1), entry:true};
    } else {
      const target = delta > 0 ? times.find(t => Math.round(scrollAt(t)) > y + 1)
        : times.findLast(t => Math.round(scrollAt(t)) < y - 1);
      if (target != null) return {time:target, entry:false};
    }
  }
}
function moveToReadingStop(time, touch = false) {
  const distance = Math.abs(timeAt(window.scrollY) - time);
  const entersBuild = time === buildStart && current < buildStart;
  const entersContact = time > buildTime(buildLast);
  const entersWallTitle = time === wallTitleStop;
  const authoredDuration = entersContact ? contactTravelDuration : entersBuild || entersWallTitle
    ? readingTravelDuration : clamp(distance * referenceSlideDuration, 120, referenceSlideDuration);
  const duration = touch ? Math.min(authoredDuration, entersContact ? 900 : 520) : authoredDuration;
  const curve = entersContact || entersWallTitle ? scrollEase : entersBuild ? readingTravelEase : surfaceEase;
  const interiorSlide = interiorStops.indexOf(time);
  const wallSlide = wallStops.indexOf(time);
  if (interiorSlide >= 0) {
    animateToTime(time, duration, interiorGallery, interiorSlide, curve);
  } else if (wallSlide >= 0) {
    const wallDuration = clamp(distance * wallSlideDuration, 180, wallSlideDuration);
    animateToTime(time, touch ? Math.min(wallDuration, 650) : wallDuration, wallGallery, wallSlide, ease);
  } else if (time >= buildStart && time <= buildTime(buildLast)) {
    animateToTime(time, duration, buildGallery, Math.round((time - buildStart) / buildInterval), curve);
  } else animateToTime(time, duration, null, null, curve);
  if (selectedSlide) selectedSlide.readingTime = time;
}
function acceptsPageGesture(event) {
  return !event.defaultPrevented && !document.querySelector('dialog[open]') &&
    !event.target.closest?.('input,textarea,select,[contenteditable="true"]');
}
let wheelGesture = null, finger = null;
const wheelStepThreshold = 16;
const wheelQuietTime = 180;
const fineWheelPause = 350;
function resetGestures() {
  wheelGesture = finger = null;
  interruptScroll();
}
window.addEventListener('pointerdown', event => {
  if (event.pointerType !== 'touch') resetGestures();
}, {passive:true});
window.addEventListener('popstate', resetGestures);
motion.addEventListener('change', resetGestures);

function readingOrigin(y, direction) {
  if (selectedSlide?.direction !== direction) return y;
  const {gallery, slide, readingTime} = selectedSlide;
  const time = readingTime ?? (gallery === interiorGallery || gallery === buildGallery ? gallery.time(slide) : null);
  return time == null ? y : Math.round(scrollAt(time));
}

function finishReadingInput(stop, origin, delta, touch = false) {
  if (stop?.entry && usesInstantReadingEntry(stop)) animateToTime(stop.time, 0);
  else if (stop) moveToReadingStop(stop.time, touch);
  else if (selectedSlide && origin !== window.scrollY) selectedSlide.exitDelta ??= delta;
}

function startsAnotherWheelStep(gesture, gap, magnitude, now) {
  if (gap > wheelQuietTime) return true;
  if (!gesture.handled) return false;
  // A new stroke can overtake the decaying tail. A small rebound or the
  // continuing slowdown of one stroke must never advance another frame.
  const rebounds = magnitude >= Math.max(18, gesture.last * 2, Math.min(36, gesture.peak * .25));
  if (gesture.last <= gesture.peak * .45 && rebounds && gap >= 24) return true;
  // A stream of strong, steady detents may traverse a gallery. Advance at
  // reading stops, even while the wheel is being spun continuously.
  return now - gesture.start >= 420 && gesture.steady >= 4 &&
    magnitude >= 48 && magnitude >= gesture.last * .96;
}

window.addEventListener('wheel', event => {
  if (touchViewport.matches) { resetGestures(); return; }
  if (!acceptsPageGesture(event) || !event.cancelable || event.ctrlKey || event.metaKey ||
      event.shiftKey || !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
  finger = null;
  const mode = event.deltaMode;
  const delta = event.deltaY * (mode === 1 ? 16 : mode === 2 ? height : 1);
  const direction = Math.sign(delta), magnitude = Math.abs(delta), now = event.timeStamp;
  const previous = wheelGesture;
  const gap = now - (previous?.time ?? -Infinity);
  const sameDirection = previous?.direction === direction;
  if (!sameDirection || startsAnotherWheelStep(previous, gap, magnitude, now)) {
    const keepFineInput = sameDirection && !previous.handled && gap <= fineWheelPause;
    wheelGesture = {direction, start:now, time:now, distance:keepFineInput ? previous.distance : 0,
      last:magnitude, peak:magnitude, steady:0, handled:false};
  }
  const gesture = wheelGesture;
  gesture.steady = magnitude >= 48 && magnitude >= gesture.last * .96 ? gesture.steady + 1 : 0;
  gesture.last = magnitude;
  gesture.peak = Math.max(gesture.peak, magnitude);
  gesture.time = now;
  if (gesture.handled) {
    event.preventDefault();
    return;
  }
  const y = window.scrollY;
  const origin = readingOrigin(y, direction);
  const stop = nextReadingStop(origin, delta);
  if (!stop && origin === y) {
    gesture.distance = 0;
    interruptScroll();
    return;
  }

  event.preventDefault();
  gesture.distance += magnitude;
  const threshold = selectedSlide?.direction === -direction ? 12 : wheelStepThreshold;
  if (!stop?.entry && gesture.distance < threshold &&
      (!stop || Math.abs(scrollAt(stop.time) - y) > gesture.distance)) return;
  gesture.handled = true;
  finishReadingInput(stop, origin, direction * gesture.distance);
}, {passive:false});

const touchStepThreshold = 12;
function handleReadingTouch(event) {
  if (!finger || event.touches.length > 1) return;
  const releasing = event.type === 'touchend';
  const touch = releasing ? event.changedTouches[0] : event.touches[0];
  if (!touch) return;
  const dx = finger.x - touch.clientX, dy = finger.y - touch.clientY;
  if (!finger.axis && Math.max(Math.abs(dx), Math.abs(dy)) >= 5) {
    finger.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
  }
  if (!finger.axis) return;
  if (finger.axis === 'x') {
    if (!finger.dragged && Math.abs(dx) < touchStepThreshold) return;
    if (!finger.dragged) {
      interruptScroll();
      finger.dragged = true;
    }
    if (releasing) {
      const direction = Math.abs(dx) >= touchStepThreshold ? Math.sign(dx) : 0;
      const target = direction > 0 ? Math.floor(finger.position) + 1
        : direction < 0 ? Math.ceil(finger.position) - 1 : Math.round(finger.position);
      moveToReadingStop(interiorTime(clamp(target, 0, interiorLast)), true);
    } else {
      const position = clamp(finger.position + clamp(dx / interiorPitch, -1, 1), 0, interiorLast);
      const index = Math.floor(position), mix = position - index;
      const t = interiorTime(index) + mix * (interiorTime(Math.min(index + 1, interiorLast)) - interiorTime(index));
      window.scrollTo({top:scrollAt(t), behavior:'instant'});
    }
    return;
  }
}
// Vertical drags and momentum always belong to the browser. Only a sideways
// drag over the interior gallery moves its rail along the shared timeline.
window.addEventListener('touchstart', event => {
  resetGestures();
  if (event.touches.length !== 1 || !acceptsPageGesture(event)) return;
  const t = timeAt(window.scrollY);
  if (t < interiorEntry || t > interiorEnd) return;
  const touch = event.touches[0];
  finger = {x:touch.clientX, y:touch.clientY, position:interiorPosition(t)};
}, {passive:true});
window.addEventListener('touchmove', handleReadingTouch, {passive:true});
window.addEventListener('touchend', event => {
  if (finger) handleReadingTouch(event);
  finger = null;
}, {passive:true});
window.addEventListener('touchcancel', () => { finger = null; }, {passive:true});
window.addEventListener('keydown', event => {
  if (!acceptsPageGesture(event) || event.altKey || event.ctrlKey || event.metaKey ||
      event.target.closest?.('button,a,[role="slider"]')) return;
  const direction = {ArrowDown:1,PageDown:1,ArrowUp:-1,PageUp:-1,' ':event.shiftKey ? -1 : 1}[event.key];
  wheelGesture = finger = null;
  if (!direction) { interruptScroll(); return; }
  const stride = event.key.startsWith('Arrow') ? 40 : height * .9;
  const y = window.scrollY;
  const stop = nextReadingStop(readingOrigin(y, direction), direction * stride);
  if (stop == null) { interruptScroll(); return; }
  event.preventDefault();
  if (event.repeat) return;
  if (usesInstantReadingEntry(stop)) animateToTime(stop.time, 0);
  else moveToReadingStop(stop.time);
});

interiorSlider.addEventListener('click', event => {
  const {top, height: trackHeight} = interiorSlider.getBoundingClientRect();
  const fraction = (event.clientY - top) / trackHeight;
  const thumb = interiorThumbFraction();
  const progress = clamp((fraction - thumb / 2) / (1 - thumb));
  interiorSlider.focus({preventScroll:true});
  selectGallery(interiorGallery, Math.round(progress * interiorLast));
});
buildSlider.addEventListener('click', event => {
  const {left, width} = buildSlider.getBoundingClientRect();
  buildSlider.focus({preventScroll:true});
  selectGallery(buildGallery, Math.floor(clamp((event.clientX - left) / width) * stages.length));
});
for (const [slider, gallery] of [[interiorSlider, interiorGallery], [buildSlider, buildGallery]]) {
  slider.addEventListener('keydown', event => {
    const index = selectedSlide?.gallery === gallery ? selectedSlide.slide : gallery.at(timeAt(window.scrollY));
    const choices = {ArrowDown:index + 1, ArrowRight:index + 1, ArrowUp:index - 1,
      ArrowLeft:index - 1, Home:0, End:gallery.last};
    if (!Object.hasOwn(choices, event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    selectGallery(gallery, choices[event.key]);
  });
}
const privacy = $('#privacy');
$('#privacy-button').onclick = () => privacy.showModal();
privacy.querySelector('button').onclick = () => privacy.close();
const formStatus = $('#form-status');
const enquiryDraft = $('#enquiry-draft');
const enquiryIntro = $('#enquiry-intro');
const enquiryInputs = contactForm.querySelector('.fields');
const enquiryConfirmation = contactForm.querySelector('.enquiry-confirmation');
const enquirySubmit = contactForm.querySelector('button[type="submit"]');
const enquiryName = contactForm.elements.name;
const enquiryPhone = contactForm.elements.phone;
const enquiryFields = [enquiryName, enquiryPhone, contactForm.elements.message];
const enquiryPhoneMask = '+7 (999) 999-99-99';
const enquiryPhoneLength = 10;
const enquiryErrorTimers = new WeakMap();
function updateEnquiryPlaceholder(field) {
  const label = field.parentElement;
  if (field === enquiryPhone) field.placeholder = field === document.activeElement ? enquiryPhoneMask : 'Phone';
  else if (label.dataset.error === 'placeholder') field.placeholder = label.querySelector('.field-note').textContent;
  else field.placeholder = label.querySelector('.field-label').textContent;
}
function nameCharacters(value) {
  return value.replace(/[^\p{L}\p{M}\p{Zs}]/gu, '');
}
function normalizeEnquiryName() {
  const value = enquiryName.value;
  const name = nameCharacters(value);
  if (value === name) return;
  const caret = nameCharacters(value.slice(0, enquiryName.selectionStart)).length;
  enquiryName.value = name;
  enquiryName.setSelectionRange(caret, caret);
}
function readEnquiryPhone(value) {
  const text = value.trim();
  if (!/^(?:\+7)?[0-9().\s-]*$/.test(text)) return null;
  const digits = text.replace(/\D/g, '');
  const number = text.startsWith('+7') || /^[78][0-9]{10}$/.test(digits) ? digits.slice(1) : digits;
  return number.length <= enquiryPhoneLength ? number : null;
}
function writeEnquiryPhone(digits, position) {
  let value = '';
  let slot = 0;
  let caret = digits.length ? enquiryPhoneMask.indexOf('9') : 0;
  for (const token of enquiryPhoneMask) {
    if (slot === digits.length) break;
    value += token === '9' ? digits[slot++] : token;
    if (token === '9' && slot === position) caret = value.length;
  }
  if (enquiryPhone.value !== value) enquiryPhone.value = value;
  if (document.activeElement === enquiryPhone) enquiryPhone.setSelectionRange(caret, caret);
}
function normalizeEnquiryPhone() {
  const value = enquiryPhone.value;
  const digits = readEnquiryPhone(value) ?? '';
  const prefix = value.replace(/\D/g, '').length - digits.length;
  const caret = Math.max(0, value.slice(0, enquiryPhone.selectionStart).replace(/\D/g, '').length - prefix);
  writeEnquiryPhone(digits, caret);
}
function editEnquiryPhone(inserted, deletion = '') {
  const value = enquiryPhone.value;
  const digits = readEnquiryPhone(value) ?? '';
  // The first digit belongs to the fixed country code. Map the selection to the editable digits.
  let start = value.slice(2, enquiryPhone.selectionStart).replace(/\D/g, '').length;
  let end = value.slice(2, enquiryPhone.selectionEnd).replace(/\D/g, '').length;
  if (start === end && deletion === 'deleteContentBackward') start = Math.max(0, start - 1);
  if (start === end && deletion === 'deleteContentForward') end = Math.min(digits.length, end + 1);
  const number = digits.slice(0, start) + inserted + digits.slice(end);
  if (number.length > enquiryPhoneLength) return;
  writeEnquiryPhone(number, start + inserted.length);
  if (enquiryPhone.hasAttribute('aria-invalid')) validateEnquiryField(enquiryPhone);
}
function validateEnquiryField(field, highlight = false) {
  const label = field.parentElement;
  const note = label.querySelector('.field-note');
  const value = field.value.trim();
  let error = '';
  if (field === enquiryName && !/\p{L}/u.test(value)) error = 'Enter your name.';
  if (field === enquiryPhone) {
    if (!value) error = 'Enter a phone number.';
    else if (readEnquiryPhone(value)?.length !== enquiryPhoneLength) error = 'Enter 10 digits after +7.';
  }
  if (field.validity.tooLong || field.value.length > field.maxLength) error = 'Use ' + field.maxLength + ' characters or fewer.';
  if (error) {
    label.dataset.error = field.value ? 'note' : 'placeholder';
    if (highlight || error !== note.textContent) {
      clearTimeout(enquiryErrorTimers.get(field));
      label.classList.add('error-accent');
      enquiryErrorTimers.set(field, setTimeout(() => label.classList.remove('error-accent'), 1250));
    }
  } else {
    delete label.dataset.error;
    clearTimeout(enquiryErrorTimers.get(field));
    label.classList.remove('error-accent');
  }
  label.toggleAttribute('data-valid', !error && Boolean(value));
  field.setAttribute('aria-invalid', String(Boolean(error)));
  note.textContent = error;
  updateEnquiryPlaceholder(field);
  return !error;
}
enquiryPhone.addEventListener('focus', () => updateEnquiryPlaceholder(enquiryPhone));
enquiryPhone.addEventListener('beforeinput', event => {
  if (event.isComposing || !event.cancelable) return;
  if (event.inputType === 'insertText' && event.data != null) {
    event.preventDefault();
    if (/^[0-9]+$/.test(event.data)) editEnquiryPhone(event.data);
  } else if (['deleteContentBackward', 'deleteContentForward', 'deleteByCut'].includes(event.inputType)) {
    event.preventDefault();
    editEnquiryPhone('', event.inputType);
  }
});
enquiryPhone.addEventListener('paste', event => {
  const text = event.clipboardData?.getData('text');
  if (text == null) return;
  event.preventDefault();
  const digits = readEnquiryPhone(text);
  if (digits) editEnquiryPhone(digits);
});
for (const field of enquiryFields) {
  field.addEventListener('blur', () => {
    if (field.value || field.hasAttribute('aria-invalid')) validateEnquiryField(field);
    else updateEnquiryPlaceholder(field);
  });
  field.addEventListener('input', event => {
    if (event.isComposing) return;
    if (field === enquiryName) normalizeEnquiryName();
    if (field === enquiryPhone) normalizeEnquiryPhone();
    if (field.hasAttribute('aria-invalid')) validateEnquiryField(field);
  });
}
contactForm.addEventListener('submit', event => {
  event.preventDefault();
  if (enquiryInputs.inert) return;
  normalizeEnquiryName();
  normalizeEnquiryPhone();
  const invalid = enquiryFields.filter(field => !validateEnquiryField(field, true));
  if (invalid.length) {
    invalid[0].focus();
    return;
  }
  const [name, phone, message] = enquiryFields.map(field => field.value.trim());
  const body = 'Name: ' + name + '\nPhone: ' + phone + '\n\n' + message;
  enquiryDraft.href = 'mailto:artem@unfa-design.ru?subject=AVORA%20project%20enquiry&body=' + encodeURIComponent(body);
  enquiryInputs.inert = true;
  enquiryConfirmation.hidden = false;
  enquiryIntro.hidden = true;
  enquirySubmit.hidden = true;
  formStatus.textContent = 'Send the draft from your email app — we’ll get in touch once we receive it.';
  formStatus.focus({preventScroll:true});
  enquiryDraft.click();
});
let stageResizeTimer;
function stageHeight() {
  return window.visualViewport?.scale === 1 ? Math.round(visualViewport.height) : innerHeight;
}
function settleStageHeight() {
  clearTimeout(stageResizeTimer);
  stageResizeTimer = setTimeout(() => {
    stageResizeTimer = null;
    if (window.visualViewport && visualViewport.scale !== 1) return;
    document.documentElement.style.setProperty('--stage-view', stageHeight() + 'px');
    measurePanorama();
    schedule();
  }, 180);
}
window.addEventListener('scroll', () => {
  schedule();
  if (stageResizeTimer) settleStageHeight();
}, {passive:true});
window.visualViewport?.addEventListener('resize', () => {
  if (touchViewport.matches && width === viewport.clientWidth) settleStageHeight();
}, {passive:true});
window.addEventListener('resize', () => {
  if (touchViewport.matches && width === viewport.clientWidth) {
    settleStageHeight();
    return;
  }
  if (width !== viewport.clientWidth || height !== parseFloat(getComputedStyle(viewport).minHeight)) {
    resetGestures();
    measure();
  } else if (visibleStageHeight !== viewport.clientHeight) {
    measurePanorama();
    schedule();
  }
});
adaptiveLayout.addEventListener('change', measure);
landscapePlans.addEventListener('change', measure);
document.addEventListener('visibilitychange', schedule);
motion.addEventListener('change', () => { measureMastMotion(); measureOpeningMotion(); schedule(); });
observeSmoothCorners(all([
  '.plan-card', '.plan-stats > div', '.drawing', '#interior-images .slide-image', '.interior-card',
  '.wall-card', '.process-frame', '.process-card', '.contact-film', '#enquiry-form',
  '#privacy'
].join(',')));
observeSmoothCorners(all('#enquiry-form input, #enquiry-form textarea, #enquiry-form button[type=submit]'),
  adaptiveLayout);
measure();
document.fonts.ready.then(measure);
if (location.hash && document.getElementById(location.hash.slice(1))) document.getElementById(location.hash.slice(1)).scrollIntoView({behavior:'instant'});
render();

function prepareOnlineMedia(t) {
  if (t < 6.2 && !village.loading) village.loadOnline();
  if (t > .18 && t < 6.2 && !scenes.panorama.style.getPropertyValue('--panorama-poster')) {
    loadImage($('.village-still img'));
    scenes.panorama.style.setProperty('--panorama-poster', `url("${sequenceAsset(villageFolder, 1, 'jpg')}")`);
  }
  if (!tabletHouse && !house.loading && t > 3.2 && t < 18.15) house.loadOnline();
  if (!tabletHouse && !house.loadingStills && t > 5.1 && t < 16.85) house.warmStills();
  if (t > 10.8 && t < 19.05) {
    if (adaptiveLayout.matches && !facadePreview.src) {
      facadePreview.onload = schedule;
      facadePreview.src = facadePoster;
    }
    if (!field.style.getPropertyValue('--facade-atlas')) {
      field.style.setProperty('--facade-atlas', `url("${facadePoster}")`);
      facadePose.loadOnline();
    }
  }
  if (!wall.loading && t > 20.2 && t < 31.5) wall.loadOnline();
}

function pageMedia() {
  return new Set([
    ...village.paths(),
    ...house.paths(),
    ...facadePose.paths(),
    ...wall.paths(wallFolder, wallSample(216)),
    facadePoster, sequenceAsset(villageFolder,1,'jpg'),
    ...(!motion.matches ? [contactVideo] : [])
  ]);
}

let contactEncode;
function selectContactEncode() {
  if (!contactEncode && !motion.matches && navigator.mediaCapabilities) {
    // Only use the more efficient contact encode when this device can play it smoothly.
    contactEncode = navigator.mediaCapabilities.decodingInfo({type:'file',video:{
      contentType:`video/mp4; codecs="${compactMedia?'av01.0.04M.08':'av01.0.12M.08'}"`,width:compactMedia?1088:3840,
      height:compactMedia?612:2160,bitrate:compactMedia?3600000:23200000,framerate:24
    }}).then(playback => {
      if (playback?.supported && playback.smooth && playback.powerEfficient)
        contactVideo = scrubPath('contact-av1')+'.mp4';
    }).catch(() => {});
  }
  return Promise.resolve(contactEncode);
}

const openingFonts = () => [
  document.fonts.load('500 16px Archivo'),
  document.fonts.load('500 12px "Geist Mono"'),
  document.fonts.load('600 12px "Geist Mono"')
];

async function warmOpening(onProgress, signal) {
  const t = timeAt(scrollY);
  const images = t >= interiorEntry && t < interiorEnd ? [interiors[interiorGallery.at(t)]]
    : t >= buildEntry && t < filmArrival ? [stages[buildAt(t)]] : [pullback];
  images.forEach(loadImage);
  if (t >= filmArrival) forestFilm.poster = contactPoster;
  const work = Promise.allSettled([...images.map(image => image.decode()), ...openingFonts()]);
  const film = t < 4.25 ? village : t < 13.86 ? (tabletHouse ? null : house) : t < 16.85 ? facadePose
    : t >= wallStart && t < wallEnd ? wall : null;
  // The opening film must already be local when the first scroll arrives.
  // Farther scenes fetch on approach and do not compete for startup bandwidth.
  let imageProgress = 0, filmProgress = film ? 0 : 1;
  const update = () => onProgress(.15 * imageProgress + .85 * filmProgress);
  await Promise.all([
    work.then(() => { imageProgress = 1; update(); }),
    film?.loadOnline({blocking:true, signal, progress:fraction => { filmProgress = fraction; update(); }})
      .finally(() => { filmProgress = 1; update(); })
  ]);
  if (film === village && !signal.aborted && village.bytes && village.config) village.decodeGroup(0);
}

async function warmMedia(onProgress, signal) {
  await selectContactEncode();
  const paths = [...pageMedia()];
  const images = all('img');
  images.forEach(loadImage);
  const fonts = openingFonts();
  const poster = new Image();
  forestFilm.poster = poster.src = contactPoster;
  const tasks = [
    ...paths.map(path => () => packagedMedia(path)),
    ...images.map(image => () => image.decode()),
    ...fonts.map(font => () => font),
    () => poster.decode()
  ];
  let cursor = 0, finished = 0;
  async function worker() {
    while (!signal.aborted && cursor < tasks.length) {
      const task = tasks[cursor++];
      try { await task(); } catch { /* Keep the ordinary URL available for retry. */ }
      onProgress(++finished / tasks.length);
    }
  }
  await Promise.all(Array.from({length:8}, worker));
  if (signal.aborted) return;

  const [atlasUrl, panoramaUrl, filmUrl] = await Promise.all([
    mediaSource(facadePoster),
    mediaSource(sequenceAsset(villageFolder, 1, 'jpg')),
    motion.matches ? null : prepareContactFilm()
  ]);
  field.style.setProperty('--facade-atlas', 'url("' + atlasUrl + '")');
  scenes.panorama.style.setProperty('--panorama-poster', 'url("' + panoramaUrl + '")');
  // Keep one decoded entry pose for each sequence. The rest stay compressed.
  await Promise.allSettled([
    village.prepare(),
    house.prepare(),
    facadePose.prepare(),
    wall.prepare(),
    firstVideoFrame(filmUrl)
  ]);
}

function firstVideoFrame(url) {
  if (!url || forestFilm.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return;
  return new Promise(resolve => {
    const listeners = new AbortController();
    const timer = setTimeout(done, 4000);
    function done() {
      clearTimeout(timer);
      listeners.abort();
      resolve();
    }
    for (const event of ['loadeddata', 'error']) forestFilm.addEventListener(event, done, {signal:listeners.signal});
  });
}

function startPreloader() {
  const overlay = textRevealOverlay;
  if (!overlay.open) {
    loadingMedia = false;
    render();
    startTextReveals();
    return;
  }
  overlay.addEventListener('close', startTextReveals, {once:true});
  const mark = overlay.querySelector('.loader-mark');
  const count = overlay.querySelector('.loader-count');
  overlay.setAttribute('data-tracking', '');
  let displayed = 0, ready = 0, lastValue = 0, previous = performance.now();
  const controller = new AbortController();
  let deadline;
  let resetDeadline;
  const timeout = new Promise(resolve => {
    resetDeadline = () => {
      clearTimeout(deadline);
      deadline = setTimeout(() => { controller.abort(); resolve(); }, 90000);
    };
    resetDeadline();
  });
  Promise.race([
    (packagedMedia ? warmMedia : warmOpening)(progress => { resetDeadline(); ready = progress * 99; }, controller.signal),
    timeout
  ]).catch(() => {}).finally(() => {
    clearTimeout(deadline);
    loadingMedia = false;
    render();
    // A direct link may start at any pose. Let that canvas paint under the loader.
    const until = performance.now() + 1200;
    function revealWhenPainted() {
      if (frameSequences.some(sequence => sequence.wanted && !sequence.shown) && performance.now() < until) {
        requestAnimationFrame(revealWhenPainted);
      } else ready = 100;
    }
    revealWhenPainted();
  });

  function update(now) {
    if (!overlay.open) return;
    displayed = Math.min(ready, displayed + (motion.matches ? 100 : (now - previous) / 8));
    previous = now;
    const value = Math.floor(displayed);
    if (value !== lastValue) {
      count.textContent = String(value).padStart(3,'0') + '%';
      count.setAttribute('aria-valuenow', value);
      lastValue = value;
    }
    if (value < 100) requestAnimationFrame(update);
    else setTimeout(depart, motion.matches ? 0 : 160);
  }
  function depart() {
    if (!overlay.open) return;
    if (motion.matches) { overlay.close(); return; }
    overlay.classList.add('departing');
    // Leave room for all four viewport corners inside the O's rounded aperture.
    const bounds = mark.getBoundingClientRect();
    const zoom = 2 * Math.max(innerWidth / bounds.width, innerHeight / bounds.height);
    const frames = [0, .25, .5, .75, 1].map(offset => ({
      offset, transform:'scale(' + Math.pow(zoom, offset) + ')'
    }));
    const easing = getComputedStyle(mark).getPropertyValue('--surface-ease').trim();
    const exit = mark.animate(frames, {duration:920,easing,fill:'forwards'});
    exit.finished.then(() => overlay.close(), () => overlay.close());
  }
  requestAnimationFrame(update);
}
startPreloader();
