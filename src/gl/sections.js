import * as THREE from 'three';
import { PAPER, INK, drawText, canvasTexture } from './core.js';
import {
  PLANE_VERT,
  ENGRAVE_FRAG,
  SLICE_FRAG,
  DIGIT_FRAG,
  HATCH_FRAG,
  TIDE_FRAG,
  ROSETTE_VERT,
  ROSETTE_FRAG,
} from './shaders.js';

const PLANE = new THREE.PlaneGeometry(1, 1);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

function planeMat(frag, uniforms) {
  return new THREE.ShaderMaterial({
    vertexShader: PLANE_VERT,
    fragmentShader: frag,
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
}

/* ───────────── engraved portrait (hero) and engraved photo (about) ───────────── */
export class Engraving {
  constructor(S, el, tex, opts = {}) {
    this.S = S;
    this.el = el;
    this.o = opts;
    this.u = {
      uTex: { value: tex },
      uSize: { value: new THREE.Vector2(1, 1) },
      uMouse: { value: new THREE.Vector2(-1e4, -1e4) },
      uPitch: { value: 5 },
      uIntro: { value: 0 },
      uOut: { value: 0 },
      uReveal: { value: 0 },
      uLens: { value: 0 },
      uLensR: { value: 150 },
      uImgAspect: { value: tex.image.width / tex.image.height },
      uCut: { value: opts.cut ? 1 : 0 },
      uFocusY: { value: opts.focusY ?? 0.5 },
      uTime: { value: 0 },
      uOcc: { value: 0 },
      uFadeB: { value: 0 },
      uInk: { value: INK },
      uPaper: { value: PAPER },
    };
    this.mesh = new THREE.Mesh(PLANE, planeMat(ENGRAVE_FRAG, this.u));
    this.mesh.renderOrder = opts.order ?? 2;
    S.scene.add(this.mesh);
    this.lens = 0;
  }
  update() {
    const { S, u, o } = this;
    const r = this.el.getBoundingClientRect();
    this.rect = r;
    this.mesh.visible = S.visible(r, 50);
    if (!this.mesh.visible) return;
    S.place(this.mesh, r);
    u.uSize.value.set(r.width, r.height);
    u.uPitch.value = o.pitch(r);
    u.uTime.value = S.time;
    const mx = S.mouse.sx - r.left;
    const my = S.mouse.sy - r.top;
    u.uMouse.value.set(mx, my);
    const inside = o.lens && !S.touch && mx > -40 && my > -40 && mx < r.width + 40 && my < r.height + 40;
    this.lens = damp(this.lens, inside ? 1 : 0, 4, S.dt);
    u.uLens.value = this.lens;
    u.uLensR.value = r.width * 0.2;
  }
}

/* ───────────── sliced display type (hero name, contact) ───────────── */
export class SlicedText {
  constructor(S, el, opts = {}) {
    this.S = S;
    this.el = el;
    this.o = opts;
    this.u = {
      uTex: { value: null },
      uSize: { value: new THREE.Vector2(1, 1) },
      uMouse: { value: new THREE.Vector2(-1e4, -1e4) },
      uPitch: { value: 10 },
      uGap: { value: opts.gap ?? 0.14 },
      uIntro: { value: 0 },
      uOut: { value: 0 },
      uSmear: { value: 0 },
      uTime: { value: 0 },
      uKnock: { value: 0 },
      uInk: { value: opts.ink ?? INK },
      uPaper: { value: PAPER },
    };
    this.mesh = new THREE.Mesh(PLANE, planeMat(SLICE_FRAG, this.u));
    this.mesh.renderOrder = opts.order ?? 1;
    S.scene.add(this.mesh);
    this.smear = 0;
    this.build();
  }
  build() {
    const { canvas, padX, padY, fs } = drawText(this.el, this.S.dpr, null, this.o.padX ?? 0.12);
    this.pad = [padX, padY];
    this.fs = fs;
    this.u.uTex.value?.dispose();
    this.u.uTex.value = canvasTexture(canvas);
  }
  update() {
    const { S, u, o } = this;
    const b = this.el.getBoundingClientRect();
    const [px, py] = this.pad;
    const r = { left: b.left - px, top: b.top - py, width: b.width + px * 2, height: b.height + py * 2 };
    r.right = r.left + r.width;
    r.bottom = r.top + r.height;
    this.mesh.visible = S.visible(r, 50);
    if (!this.mesh.visible) return;
    S.place(this.mesh, r);
    u.uSize.value.set(r.width, r.height);
    u.uPitch.value = this.fs / (o.slices ?? 16);
    u.uTime.value = S.time;
    u.uMouse.value.set(S.mouse.sx - r.left, S.mouse.sy - r.top);
    if (o.smear) {
      const near = S.mouse.sy > r.top - 60 && S.mouse.sy < r.bottom + 60 ? 1 : 0;
      // never drag a slice further than the box has room for
      const lim = this.pad[0] * 0.9;
      const target = clamp(S.mouse.vx * 7 * near, -Math.min(260, lim), Math.min(260, lim));
      this.smear = damp(this.smear, target, target === 0 ? 3.2 : 9, S.dt);
      u.uSmear.value = this.smear;
    }
  }
}

/* ───────────── step numerals ───────────── */
export class Digits {
  constructor(S, el, labels) {
    this.S = S;
    this.el = el;
    this.labels = labels;
    this.u = {
      uTex: { value: null },
      uSize: { value: new THREE.Vector2(1, 1) },
      uPitch: { value: 10 },
      uGap: { value: 0.16 },
      uFrom: { value: -1 },
      uTo: { value: 0 },
      uP: { value: 0 },
      uCells: { value: labels.length },
      uInk: { value: INK },
    };
    this.mesh = new THREE.Mesh(PLANE, planeMat(DIGIT_FRAG, this.u));
    this.mesh.renderOrder = 1;
    S.scene.add(this.mesh);
    this.cur = -1;
    this.p = 1;
    this.build();
  }
  build() {
    const { canvas, padX, padY, fs } = drawText(this.el, this.S.dpr, this.labels.map((l) => [l]));
    this.pad = [padX, padY];
    this.fs = fs;
    this.u.uTex.value?.dispose();
    this.u.uTex.value = canvasTexture(canvas);
  }
  set(i) {
    if (i === this.cur) return;
    this.u.uFrom.value = this.cur;
    this.u.uTo.value = i;
    this.cur = i;
    this.p = 0;
  }
  update() {
    const { S, u } = this;
    const b = this.el.getBoundingClientRect();
    const [px, py] = this.pad;
    const r = { left: b.left - px, top: b.top - py, width: b.width + px * 2, height: b.height + py * 2 };
    r.right = r.left + r.width;
    r.bottom = r.top + r.height;
    this.mesh.visible = b.width > 0 && S.visible(r, 50);
    if (!this.mesh.visible) return;
    S.place(this.mesh, r);
    u.uSize.value.set(r.width, r.height);
    u.uPitch.value = this.fs / 15;
    this.p = Math.min(1, this.p + S.dt / 1.3);
    u.uP.value = this.p;
  }
}

/* ───────────── hatched hover rows ───────────── */
export class HatchRow {
  constructor(S, el) {
    this.S = S;
    this.el = el;
    this.u = {
      uSize: { value: new THREE.Vector2(1, 1) },
      uOrigin: { value: new THREE.Vector2(0, 0) },
      uFront: { value: 0 },
      uPitch: { value: 7 },
      uSoft: { value: 160 },
      uInk: { value: INK },
    };
    this.mesh = new THREE.Mesh(PLANE, planeMat(HATCH_FRAG, this.u));
    this.mesh.renderOrder = 1;
    S.scene.add(this.mesh);
    this.front = 0;
    this.target = 0;
    this.on = false;

    if (!S.touch) {
      // only a real mouse move lights a row: rows scrolling under a still cursor stay quiet
      el.addEventListener('mousemove', (e) => { if (!this.on && (e.movementX || e.movementY)) this.enter(e.clientX, e.clientY); });
      el.addEventListener('mouseleave', (e) => this.leave(e.clientX, e.clientY));
    }
  }
  max() {
    const r = this.el.getBoundingClientRect();
    return Math.hypot(r.width, r.height * 1.6) + this.u.uSoft.value;
  }
  enter(x, y) {
    const r = this.el.getBoundingClientRect();
    this.u.uOrigin.value.set(x - r.left, y - r.top);
    if (!this.on) this.front = Math.min(this.front, 0);
    this.target = this.max();
    this.on = true;
    this.el.classList.add('is-on');
  }
  leave(x, y) {
    const r = this.el.getBoundingClientRect();
    const full = this.max();
    // retreat towards the exit point
    this.u.uOrigin.value.set(x - r.left, y - r.top);
    this.front = full * clamp(this.front / full);
    this.target = 0;
    this.on = false;
    this.el.classList.remove('is-on');
  }
  update() {
    const { S, u } = this;
    const r = this.el.getBoundingClientRect();
    if (S.touch) {
      // on touch the row fills while it crosses the middle of the screen
      const c = (r.top + r.height / 2) / S.h;
      const on = c > 0.36 && c < 0.64;
      if (on !== this.on) {
        if (on) this.enter(r.left + 10, r.top + r.height / 2);
        else this.leave(r.right - 10, r.top + r.height / 2);
      }
    }
    this.front = damp(this.front, this.target, this.on ? 2.6 : 3.4, S.dt);
    this.mesh.visible = this.front > 1 && S.visible(r);
    if (!this.mesh.visible) return;
    S.place(this.mesh, r);
    u.uSize.value.set(r.width, r.height);
    u.uFront.value = this.front;
  }
}

/* ───────────── navy section laid in engraved waves ───────────── */
export class Tide {
  constructor(S, el) {
    this.S = S;
    this.el = el;
    this.u = {
      uRes: { value: new THREE.Vector2(1, 1) },
      uDpr: { value: 1 },
      uTop: { value: 0 },
      uBot: { value: 0 },
      uRamp: { value: 300 },
      uPitch: { value: 8 },
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(-1e4, -1e4) },
      uInk: { value: INK },
      uPaper: { value: PAPER },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: 'void main(){ gl_Position = vec4(position.xy * 2., 0., 1.); }',
      fragmentShader: TIDE_FRAG,
      uniforms: this.u,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(PLANE, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 0;
    S.scene.add(this.mesh);
  }
  update() {
    const { S, u } = this;
    const r = this.el.getBoundingClientRect();
    const ramp = Math.min(S.h * 0.42, 420);
    this.mesh.visible = r.bottom + ramp > 0 && r.top - ramp < S.h;
    if (!this.mesh.visible) return;
    u.uRes.value.set(S.w, S.h);
    u.uDpr.value = S.dpr;
    u.uTop.value = r.top;
    u.uBot.value = r.bottom;
    u.uRamp.value = ramp;
    u.uPitch.value = S.mobile ? 6 : 8;
    u.uTime.value = S.time;
    u.uMouse.value.set(S.mouse.sx, S.mouse.sy);
  }
}

/* ───────────── guilloche rosettes ───────────── */
const ROSETTES = [
  { n1: 9, n2: 27, a1: 0.11, a2: 0.035, base: 0.8, bands: 2, phase: 0.0 },
  { n1: 12, n2: 5, a1: 0.09, a2: 0.05, base: 0.8, bands: 2, phase: 1.1 },
  { n1: 7, n2: 21, a1: 0.13, a2: 0.03, base: 0.79, bands: 3, phase: 2.3 },
  { n1: 16, n2: 8, a1: 0.075, a2: 0.045, base: 0.81, bands: 2, phase: 0.6 },
];

export class Rosette {
  constructor(S, el, i, curves = 44, seg = 720) {
    this.S = S;
    this.el = el;
    const P = ROSETTES[i % ROSETTES.length];
    const n = curves * seg * 2;
    const aT = new Float32Array(n);
    const aC = new Float32Array(n);
    let k = 0;
    for (let c = 0; c < curves; c++) {
      for (let s = 0; s < seg; s++) {
        aT[k] = s / seg;
        aC[k++] = c / curves;
        aT[k] = (s + 1) / seg;
        aC[k++] = c / curves;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aT', new THREE.BufferAttribute(aT, 1));
    g.setAttribute('aC', new THREE.BufferAttribute(aC, 1));
    this.u = {
      uN1: { value: P.n1 },
      uN2: { value: P.n2 },
      uA1: { value: P.a1 },
      uA2: { value: P.a2 },
      uBase: { value: P.base },
      uBands: { value: P.bands },
      uPhase: { value: P.phase },
      uHover: { value: 0 },
      uTime: { value: 0 },
      uDraw: { value: 0 },
      uAlpha: { value: 0.62 },
      uInk: { value: INK },
    };
    const m = new THREE.ShaderMaterial({
      vertexShader: ROSETTE_VERT,
      fragmentShader: ROSETTE_FRAG,
      uniforms: this.u,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new THREE.LineSegments(g, m);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    S.scene.add(this.mesh);
    this.hover = 0;
    this.draw = 0;
  }
  update() {
    const { S, u } = this;
    const r = this.el.getBoundingClientRect();
    this.mesh.visible = S.visible(r, 20);
    if (!this.mesh.visible) return;
    S.place(this.mesh, r, r.width / 2, r.height / 2);
    // draw while the milestone travels into view
    const target = S.mobile
      ? clamp((S.h * 1.0 - (r.top + r.height / 2)) / (S.h * 0.55))
      : clamp((S.w * 1.02 - (r.left + r.width / 2)) / (S.w * 0.55));
    this.draw = damp(this.draw, target, 3, S.dt);
    u.uDraw.value = this.draw;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const d = Math.hypot(S.mouse.sx - cx, S.mouse.sy - cy) / (r.width * 0.6);
    this.hover = damp(this.hover, S.touch ? 0 : clamp(1.2 - d), 3, S.dt);
    u.uHover.value = this.hover;
    u.uTime.value = S.time;
  }
}
