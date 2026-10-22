import './style.css';
import Lenis from 'lenis';
import { createGL, loadTexture, mipTexture } from './gl/core.js';
import { Engraving, SlicedText, Digits, HatchRow, Tide } from './gl/sections.js';
import { ICONS } from './gl/icons.js';

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;

/* ───────────── scroll ───────────── */
const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, autoRaf: false });
window.__lenis = lenis;
lenis.stop();
window.scrollTo(0, 0);
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

$$('[data-nav]').forEach((a) =>
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (!id?.startsWith('#')) return;
    e.preventDefault();
    root.classList.remove('menu-open');
    $('[data-menu-btn]').setAttribute('aria-expanded', 'false');
    lenis.start();
    lenis.scrollTo(id === '#topo' ? 0 : id, { duration: 1.8, easing: (t) => 1 - Math.pow(1 - t, 4) });
  }),
);

/* ───────────── menu ───────────── */
$('[data-menu-btn]').addEventListener('click', (e) => {
  const open = !root.classList.contains('menu-open');
  root.classList.toggle('menu-open', open);
  e.currentTarget.setAttribute('aria-expanded', String(open));
  $('[data-menu]').setAttribute('aria-hidden', String(!open));
  open ? lenis.stop() : lenis.start();
});

/* ───────────── reveals ───────────── */
const io = new IntersectionObserver(
  (entries) => {
    let i = 0;
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      const base = parseFloat(el.dataset.revealDelay || 0);
      el.style.setProperty('--d', `${base + i++ * 0.09}s`);
      el.classList.add('in');
      io.unobserve(el);
      setTimeout(() => el.classList.add('done'), (base + i * 0.09 + 1.8) * 1000);
    });
  },
  { rootMargin: '0px 0px -10% 0px', threshold: 0.1 },
);

/* ───────────── magnetic buttons ───────────── */
const magnets = $$('[data-magnetic]').map((el) => ({ el, span: $('span', el), x: 0, y: 0, tx: 0, ty: 0 }));

/* ───────────── pointer ───────────── */
let S = null;
const mouse = { x: -1e4, y: -1e4 };
window.addEventListener('pointermove', (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

/* ───────────── boot ───────────── */
async function boot() {
  const canvas = $('#gl');
  let ok = true;
  try {
    S = createGL(canvas);
  } catch (err) {
    ok = false;
  }
  root.classList.add(ok ? 'gl' : 'no-gl');

  await Promise.all([
    document.fonts.load('400 100px "Instrument Serif"'),
    document.fonts.load('500 16px "Inter Tight Variable"'),
    document.fonts.ready,
  ]);

  const parts = [];
  let hero = null;
  let name = null;
  let digits = null;

  if (ok) {
    const [cut, photo] = await Promise.all([loadTexture('/davi-cut.png'), loadTexture('/davi-src.png')]);

    hero = new Engraving(S, $('[data-gl-portrait]'), cut, {
      cut: true,
      order: 2,
      pitch: (r) => Math.max(3.6, r.height / 150),
    });
    name = new SlicedText(S, $('[data-gl-name]'), { slices: 14, gap: 0.12 });
    const about = new Engraving(S, $('[data-gl-photo]'), photo, {
      order: 1,
      focusY: 0.45,
      pitch: (r) => Math.max(3.4, r.height / 140),
    });
    const contact = new SlicedText(S, $('[data-gl-contact]'), { slices: 12, gap: 0.14, smear: true, padX: 1.6 });
    const tide = new Tide(S, $('[data-gl-tide]'));
    // one engraved emblem per step of the journey
    const emblems = $$('[data-gl-rosette]').map(
      (el) => new Engraving(S, el, mipTexture(ICONS[+el.dataset.glRosette]()), { cut: true, order: 1, pitch: (r) => Math.max(3.4, r.height / 105) }),
    );
    S.emblems = emblems;
    const rows = $$('[data-gl-row]').map((el) => new HatchRow(S, el));
    digits = new Digits(S, $('[data-gl-digits]'), ['01', '02', '03', '04']);

    about.scrub = true;
    contact.scrub = true;
    parts.push(tide, hero, name, about, contact, digits, ...emblems, ...rows);
    S.parts = parts;
    S.about = about;
    S.contact = contact;

    let rt;
    window.addEventListener('resize', () => {
      S.resize();
      clearTimeout(rt);
      rt = setTimeout(() => {
        name.build();
        contact.build();
        digits.build();
      }, 150);
    });
  }

  $$('[data-reveal]').forEach((el) => {
    if (el.closest('[data-hero]')) el.dataset.revealDelay = reduced ? 0 : 1.9;
    io.observe(el);
  });

  /* intro */
  const hdr = $('[data-hdr]');
  hdr.classList.add('is-hidden');
  const t0 = performance.now();
  window.__t0 = t0;
  const INTRO = reduced ? 0.01 : 3.2;
  setTimeout(() => {
    hdr.classList.remove('is-hidden');
    lenis.start();
  }, reduced ? 0 : 1600);

  /* section helpers */
  const journey = $('[data-journey]');
  const track = $('[data-journey-track]');
  const jbar = $('[data-journey-bar]');
  const how = $('[data-how]');
  const hbar = $('[data-how-bar]');
  const steps = $$('[data-step]');
  const frame = $('[data-gl-tide]');
  const heroEl = $('[data-hero]');

  let last = performance.now();
  let lastScroll = 0;

  function frameLoop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    lenis.raf(now);

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const mobile = vw <= 820;

    /* journey: vertical scroll drives the horizontal track */
    if (!mobile) {
      const r = journey.getBoundingClientRect();
      const p = clamp(-r.top / (r.height - vh));
      const dist = track.scrollWidth - vw;
      track.style.transform = `translate3d(${-p * dist}px,0,0)`;
      jbar.style.transform = `scaleX(${p})`;
    }

    /* how: current step + progress */
    {
      const r = how.getBoundingClientRect();
      hbar.style.transform = `scaleX(${clamp((vh * 0.5 - r.top) / r.height)})`;
      let cur = 0;
      steps.forEach((s, i) => {
        if (s.getBoundingClientRect().top < vh * 0.55) cur = i;
      });
      if (digits && r.top < vh * 0.8) digits.set(cur);
    }

    /* header over the navy section */
    {
      const r = frame.getBoundingClientRect();
      hdr.classList.toggle('is-dark', r.top < 40 && r.bottom > 40);
      // step aside while reading downwards, come back on the way up
      const y = lenis.scroll;
      if (Math.abs(y - lastScroll) > 6) {
        const away = y > lastScroll && y > vh * 0.5 && !root.classList.contains('menu-open');
        if (now - t0 > 1700) hdr.classList.toggle('is-hidden', away);
        lastScroll = y;
      }
    }

    /* magnets */
    magnets.forEach((m) => {
      const r = m.el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = mouse.x - cx;
      const dy = mouse.y - cy;
      const near = Math.abs(dx) < r.width / 2 + 40 && Math.abs(dy) < r.height / 2 + 40;
      m.tx = near ? dx * 0.28 : 0;
      m.ty = near ? dy * 0.38 : 0;
      m.x = damp(m.x, m.tx, 10, dt);
      m.y = damp(m.y, m.ty, 10, dt);
      m.el.style.transform = `translate3d(${m.x}px,${m.y}px,0)`;
      if (m.span) m.span.style.transform = `translate3d(${m.x * 0.35}px,${m.y * 0.35}px,0)`;
    });

    if (S) {
      S.dt = dt;
      S.time = now / 1000;
      const M = S.mouse;
      if (M.sx < -9e3) {
        M.sx = mouse.x;
        M.sy = mouse.y;
      }
      const px = M.sx;
      M.sx = damp(M.sx, mouse.x, 9, dt);
      M.sy = damp(M.sy, mouse.y, 9, dt);
      M.vx = damp(M.vx, ((M.sx - px) / Math.max(dt, 1e-3)) / 60, 10, dt);

      // the whole scene turns a few degrees towards the pointer
      const nx = S.touch || M.sx < 0 ? 0 : (M.sx / vw) * 2 - 1;
      const ny = S.touch || M.sy < 0 ? 0 : (M.sy / vh) * 2 - 1;
      S.tilt.y = damp(S.tilt.y, nx * 0.06, 2.5, dt);
      S.tilt.x = damp(S.tilt.x, -ny * 0.045, 2.5, dt);
      S.orbit();

      // emblems are cut in, line by line, as each step comes into view
      for (const e of S.emblems) {
        const r = e.el.getBoundingClientRect();
        const k = mobile ? (vh * 1.0 - (r.top + r.height / 2)) / (vh * 0.55) : (vw * 1.02 - (r.left + r.width / 2)) / (vw * 0.55);
        e.u.uIntro.value = Math.min(1, Math.max(0, k));
      }

      const intro = clamp((now - t0) / 1000 / INTRO);
      const hr = heroEl.getBoundingClientRect();
      const out = clamp(-hr.top / (hr.height * 0.85));
      hero.u.uIntro.value = clamp(intro * 1.05 - 0.05);
      hero.u.uOut.value = out;
      name.u.uIntro.value = clamp(intro * 1.5);
      name.u.uOut.value = out;

      /* about photo: lines get cut as it enters, then swell into the photograph */
      {
        const r = S.about.el.getBoundingClientRect();
        const enter = clamp((vh - r.top) / (vh * 0.7));
        const rev = clamp((vh * 0.62 - r.top) / (vh * 0.55));
        S.about.u.uIntro.value = enter;
        S.about.u.uReveal.value = rev;
      }
      /* contact type assembles as it scrolls in */
      {
        const r = S.contact.el.getBoundingClientRect();
        S.contact.u.uIntro.value = clamp((vh * 1.05 - r.top) / (vh * 0.75));
      }

      for (const p of S.parts) p.update();
      S.renderer.render(S.scene, S.camera);
    }
    requestAnimationFrame(frameLoop);
  }
  requestAnimationFrame(frameLoop);
}

boot();
