/* Corner geometry adapted from figma-squircle (github.com/phamfoo/figma-squircle).
MIT License

Copyright (c) 2021 Tien Pham

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
'use strict';

// Two tangent Béziers join each straight edge to the remaining circular arc.
// Figma limits the transition length when adjacent corners share a short side.
function smoothCornerClip(width, height, radius, left = 0, top = 0) {
  const budget = Math.min(width, height) / 2;
  const r = Math.min(radius, budget);
  if (r <= 0) return 'inset(' + top + 'px ' + left + 'px)';
  const smoothing = Math.min(.6, budget / r - 1);
  const extent = (1 + smoothing) * r;
  const angle = Math.PI / 4 * smoothing;
  const arc = Math.SQRT2 * r * Math.sin(Math.PI / 4 - angle);
  const tangent = r * Math.tan(angle / 2);
  const c = tangent * Math.cos(angle), d = tangent * Math.sin(angle);
  const b = (extent - arc - c - d) / 3;
  const a = 2 * b;
  const right = left + width, bottom = top + height;
  const shoulder = a + b + c;

  return `path("M ${right - extent} ${top}
    c ${a} 0 ${a + b} 0 ${shoulder} ${d}
    a ${r} ${r} 0 0 1 ${arc} ${arc}
    c ${d} ${c} ${d} ${b + c} ${d} ${shoulder}
    V ${bottom - extent}
    c 0 ${a} 0 ${a + b} ${-d} ${shoulder}
    a ${r} ${r} 0 0 1 ${-arc} ${arc}
    c ${-c} ${d} ${-b - c} ${d} ${-shoulder} ${d}
    H ${left + extent}
    c ${-a} 0 ${-a - b} 0 ${-shoulder} ${-d}
    a ${r} ${r} 0 0 1 ${-arc} ${-arc}
    c ${-d} ${-c} ${-d} ${-b - c} ${-d} ${-shoulder}
    V ${top + extent}
    c 0 ${-a} 0 ${-a - b} ${d} ${-shoulder}
    a ${r} ${r} 0 0 1 ${arc} ${-arc}
    c ${c} ${-d} ${b + c} ${-d} ${shoulder} ${-d} Z")`.replace(/\s+/g, ' ');
}

function observeSmoothCorners(elements, media) {
  const observer = new ResizeObserver(entries => {
    for (const entry of entries) {
      const {inlineSize, blockSize} = entry.borderBoxSize[0];
      if (!inlineSize || !blockSize) continue;
      const el = entry.target;
      const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius);
      el.style.clipPath = smoothCornerClip(inlineSize, blockSize, radius);
    }
  });
  function observe() {
    observer.disconnect();
    for (const el of elements) {
      if (!media || media.matches) observer.observe(el, {box:'border-box'});
      else el.style.removeProperty('clip-path');
    }
  }
  observe();
  media?.addEventListener('change', observe);
}
