import * as THREE from 'three';

THREE.ColorManagement.enabled = false;

const hex = (h) => new THREE.Vector3(((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255);
export const PAPER = hex(0xf1eee8);
export const INK = hex(0x0e1b2c);

export function createGL(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(new THREE.Color(PAPER.x, PAPER.y, PAPER.z), 1);

  const scene = new THREE.Scene();
  // perspective camera placed so that 1 unit = 1 css px on the z = 0 plane
  const FOV = 30;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 10000);

  const S = {
    THREE,
    renderer,
    scene,
    camera,
    w: 1,
    h: 1,
    dpr: 1,
    time: 0,
    dt: 0.016,
    touch: matchMedia('(hover: none)').matches,
    mobile: matchMedia('(max-width: 820px)').matches,
    // pointer in viewport css px (y down); s = smoothed; v = smoothed velocity (px/frame @60)
    mouse: { x: -1e4, y: -1e4, sx: -1e4, sy: -1e4, vx: 0, vy: 0, seen: false },
    scrollV: 0,
    // the camera turns a little with the pointer, so the page never feels like a flat screen
    tilt: { x: 0, y: 0 },
    // lowered at runtime if the device can't hold the frame rate
    maxDpr: 2,
  };

  S.resize = () => {
    S.w = window.innerWidth;
    S.h = window.innerHeight;
    S.mobile = matchMedia('(max-width: 820px)').matches;
    S.dpr = Math.min(window.devicePixelRatio || 1, S.maxDpr);
    renderer.setPixelRatio(S.dpr);
    renderer.setSize(S.w, S.h, false);
    camera.aspect = S.w / S.h;
    S.dist = S.h / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    S.orbit();
    camera.updateProjectionMatrix();
  };

  // the camera orbits the centre of the screen; the content itself never rotates
  S.orbit = () => {
    const { x, y } = S.tilt;
    camera.position.set(S.dist * Math.sin(y) * Math.cos(x), S.dist * Math.sin(x), S.dist * Math.cos(y) * Math.cos(x));
    camera.lookAt(0, 0, 0);
  };

  // place an object (centered geometry, unit size) over a DOM rect
  S.place = (obj, r, sx = r.width, sy = r.height) => {
    obj.position.x = r.left + r.width / 2 - S.w / 2;
    obj.position.y = S.h / 2 - (r.top + r.height / 2);
    obj.scale.set(sx, sy, 1);
  };

  S.visible = (r, margin = 0) => r.bottom > -margin && r.top < S.h + margin && r.right > -margin && r.left < S.w + margin;

  S.resize();
  return S;
}

export function loadTexture(url) {
  return new Promise((res, rej) => {
    new THREE.TextureLoader().load(
      url,
      (t) => {
        t.colorSpace = THREE.NoColorSpace;
        t.generateMipmaps = true;
        t.minFilter = THREE.LinearMipmapLinearFilter;
        t.magFilter = THREE.LinearFilter;
        t.anisotropy = 4;
        res(t);
      },
      undefined,
      rej,
    );
  });
}

// draws the text of a DOM element into a canvas, matching its computed type.
// returns { canvas, pad } where pad is the extra css px around the element box.
export function drawText(el, dpr, cells = null, padXk = 0.12) {
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  const fs = parseFloat(cs.fontSize);
  const lh = cs.lineHeight === 'normal' ? fs * 1.2 : parseFloat(cs.lineHeight);
  const padX = fs * padXk;
  const padY = fs * 0.32;
  const W = r.width + padX * 2;
  const H = r.height + padY * 2;
  const n = cells ? cells.length : 1;

  const c = document.createElement('canvas');
  c.width = Math.ceil(W * dpr) * n;
  c.height = Math.ceil(H * dpr);
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#fff';
  ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${fs}px ${cs.fontFamily}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
  ctx.textBaseline = 'alphabetic';
  const left = cs.textAlign === 'left' || cs.textAlign === 'start';
  ctx.textAlign = left ? 'left' : 'center';

  const ws = parseFloat(cs.wordSpacing) || 0;

  const m = ctx.measureText('Hg');
  const asc = m.fontBoundingBoxAscent ?? fs * 0.9;
  const desc = m.fontBoundingBoxDescent ?? fs * 0.25;

  const groups = cells || [el.innerText.split('\n').map((s) => s.trim()).filter(Boolean)];
  const cellW = Math.ceil(W * dpr) / dpr;
  groups.forEach((lines, gi) => {
    lines.forEach((line, i) => {
      const base = padY + i * lh + (lh - (asc + desc)) / 2 + asc;
      const x0 = gi * cellW + (left ? padX : W / 2);
      // canvas has no portable word-spacing, so wide gaps are laid out word by word
      if (ws && left) {
        let x = x0;
        line.split(' ').forEach((word) => {
          ctx.fillText(word, x, base);
          x += ctx.measureText(word + ' ').width + ws;
        });
      } else ctx.fillText(line, x0, base);
    });
  });
  return { canvas: c, padX, padY, fs };
}

export function canvasTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.NoColorSpace;
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  return t;
}

export function mipTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.NoColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  return t;
}
