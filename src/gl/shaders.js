export const COMMON = /* glsl */ `
float hash11(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }
float eOut(float x) { x = clamp(x, 0., 1.); return 1. - pow(1. - x, 4.); }
float eInOut(float x) { x = clamp(x, 0., 1.); return x < .5 ? 8. * x * x * x * x : 1. - pow(-2. * x + 2., 4.) * .5; }
// parallel lines along v (1 unit = 1 pitch); w: 0 = hairline, 1 = solid
float lines(float v, float w) {
  float d = abs(fract(v) - .5) * 2.;
  float fw = max(fwidth(v) * 2., 1e-4);
  float ww = w * (1. + 2. * fw);
  // below about a pixel the line fades instead of staying a hairline
  return (1. - smoothstep(ww - fw, ww + fw, d)) * clamp(w / fw * 1.5, 0., 1.);
}
`;

export const PLANE_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
}
`;

// photo → copper-plate engraving. the line field bends with the tone of the image,
// thickens in the shadows and cross-hatches the darkest areas.
export const ENGRAVE_FRAG = /* glsl */ `
uniform sampler2D uTex;
uniform vec2 uSize;
uniform vec2 uMouse;
uniform float uPitch, uIntro, uOut, uReveal, uLens, uLensR, uImgAspect, uCut, uFocusY, uTime, uOcc, uFadeB;
uniform vec3 uInk, uPaper;
varying vec2 vUv;
${COMMON}
vec2 coverUv(vec2 uv) {
  float ba = uSize.x / uSize.y;
  vec2 s = ba > uImgAspect ? vec2(1., uImgAspect / ba) : vec2(ba / uImgAspect, 1.);
  vec2 o = vec2(.5, mix(.5, uFocusY, 1. - s.y));
  return (uv - .5) * s + o;
}
void main() {
  vec2 p = vec2(vUv.x, 1. - vUv.y) * uSize;
  vec2 dm = p - uMouse;
  float f = exp(-dot(dm, dm) / (uLensR * uLensR)) * uLens;
  vec2 q = uMouse + dm * (1. - .3 * f);
  vec2 uv = coverUv(vec2(q.x / uSize.x, 1. - q.y / uSize.y));
  vec4 tx = texture(uTex, uv);
  vec3 tb = texture(uTex, uv, 4.5).rgb;
  float L = dot(tx.rgb, vec3(.299, .587, .114));
  float Lb = dot(tb, vec3(.299, .587, .114));
  // levels + a little local contrast so features read before flat areas
  float t = (1. - L) + (Lb - L) * 1.1;
  float dark = pow(clamp((t - .2) / .66, 0., 1.), 1.55);
  float ny = q.y / uSize.y;

  float v = (q.y + (Lb - .5) * uPitch * 3.2 + sin(q.x * .011 + ny * 3.1) * uPitch * .4) / uPitch;
  float row = floor(v);

  // intro: every line is cut from left to right, top rows first
  float rp = eOut(uIntro * 1.9 - ny * .9 - hash11(row) * .14);
  float hx = rp * 1.3 - .15;
  float drawn = 1. - smoothstep(hx - .08, hx, vUv.x);
  // exit: lines thin out from the top
  float ot = eInOut(uOut * 1.6 - (1. - ny) * .6);
  // reveal: lines swell until they become the photograph
  float rr = eInOut(uReveal * 1.7 - ny * .7);

  // optional fade at the foot: the lines thin out to nothing instead of ending at the edge
  float foot = uFadeB > 0. ? smoothstep(0., uFadeB, vUv.y) : 1.;
  drawn *= foot;
  float w = (dark * .86 + .14) * drawn * (1. - ot) + f * .1 * drawn;
  w = mix(w, 1., rr);
  float ink = lines(v, w);

  float v2 = dot(q, vec2(.574, .819)) / (uPitch * 1.2);
  float w2 = clamp((dark - .62) * 1.6, 0., 1.) * drawn * (1. - ot) * (1. - rr);
  ink = max(ink, lines(v2, w2));

  vec3 col = mix(uInk, tx.rgb, smoothstep(.3, 1., rr));
  float a = ink * mix(1., tx.a, uCut);
  // occlusion: inside the cutout the gaps between lines are paper, so type behind it is hidden
  float occ = uOcc * tx.a * drawn * (1. - ot);
  col = mix(uPaper, col, a / max(max(a, occ), 1e-4));
  a = max(a, occ);
  if (a < .002) discard;
  gl_FragColor = vec4(col, a);
}
`;

// type cut in horizontal slices; each slice slides on its own
export const SLICE_FRAG = /* glsl */ `
uniform sampler2D uTex;
uniform vec2 uSize;
uniform vec2 uMouse;
uniform float uPitch, uGap, uIntro, uOut, uSmear, uTime, uKnock;
uniform vec3 uInk, uPaper;
varying vec2 vUv;
${COMMON}
void main() {
  vec2 p = vec2(vUv.x, 1. - vUv.y) * uSize;
  float v = p.y / uPitch;
  float row = floor(v);
  float ny = row * uPitch / uSize.y;
  float dir = mod(row, 2.) < 1. ? -1. : 1.;
  float h = hash11(row);

  // intro: each slice is cut in by a sweeping edge, alternating sides, and settles
  float rp = eOut(uIntro * 1.7 - ny * .55 - h * .12);
  float xr = vUv.x;
  float edge = dir < 0. ? xr : 1. - xr;
  float sweep = 1. - smoothstep(rp * 1.12 - .06, rp * 1.12, edge);
  float off = (1. - rp) * dir * uSize.x * .07;
  off += dir * eInOut(uOut) * uSize.x * (.16 + .34 * h);
  float g = exp(-pow((p.y - uMouse.y) / (uSize.y * .17), 2.));
  off += g * uSmear * (.7 + .6 * h);

  float x = p.x - off;
  float a = texture(uTex, vec2(x / uSize.x, vUv.y)).a;
  a *= step(0., x) * step(x, uSize.x);

  float fy = fract(v);
  float fw = fwidth(v);
  float gap = uGap * .5;
  float cut = smoothstep(gap - fw, gap + fw, fy) * smoothstep(gap - fw, gap + fw, 1. - fy);
  a *= sweep;
  // knockout: the gaps between slices are filled with paper, so the type reads the same over the portrait
  vec3 col = mix(uPaper, uInk, mix(1., cut, uKnock));
  a *= mix(cut, 1., uKnock);
  if (a < .002) discard;
  gl_FragColor = vec4(col, a);
}
`;

// numerals in an atlas; on change every slice turns like a louver: the new numeral
// rises inside each slice and pushes the old one out through the top, row by row
export const DIGIT_FRAG = /* glsl */ `
uniform sampler2D uTex;
uniform vec2 uSize;
uniform float uPitch, uGap, uFrom, uTo, uP, uCells;
uniform vec3 uInk;
varying vec2 vUv;
${COMMON}
float cell(float i, vec2 p) {
  if (i < 0. || p.x < 0. || p.x > uSize.x) return 0.;
  return texture(uTex, vec2((i + p.x / uSize.x) / uCells, 1. - p.y / uSize.y)).a;
}
void main() {
  vec2 p = vec2(vUv.x, 1. - vUv.y) * uSize;
  float v = p.y / uPitch;
  float row = floor(v);
  float ny = row * uPitch / uSize.y;
  float fy = fract(v);
  float fw = fwidth(v);
  float gap = uGap * .5;
  // top rows turn first, in one clean cascade
  float pr = smoothstep(0., 1., uP * 1.6 - ny * .6);
  // the split runs a little past both edges so nothing of the other numeral lingers
  float split = mix(1. + gap + fw, -gap - fw, pr);
  float a = fy < split
    ? cell(uFrom, p + vec2(0., max(0., 1. - gap - split) * uPitch))
    : cell(uTo, p - vec2(0., max(0., split - gap) * uPitch));
  a *= smoothstep(gap - fw, gap + fw, fy) * smoothstep(gap - fw, gap + fw, 1. - fy);
  if (a < .002) discard;
  gl_FragColor = vec4(uInk, a);
}
`;

// diagonal hatching that grows out of the point where the cursor came in
export const HATCH_FRAG = /* glsl */ `
uniform vec2 uSize;
uniform vec2 uOrigin;
uniform float uFront, uPitch, uSoft;
uniform vec3 uInk;
varying vec2 vUv;
${COMMON}
void main() {
  vec2 p = vec2(vUv.x, 1. - vUv.y) * uSize;
  float d = length((p - uOrigin) * vec2(1., 1.6));
  float w = clamp((uFront - d) / uSoft, 0., 1.);
  float v = (p.x + p.y) / (uPitch * 1.41421);
  float a = lines(v, w);
  if (a < .002) discard;
  gl_FragColor = vec4(uInk, a);
}
`;

// full-screen pass: the navy section is laid down as engraved waves that thicken into solid ink
export const TIDE_FRAG = /* glsl */ `
uniform vec2 uRes;
uniform float uDpr, uTop, uBot, uRamp, uPitch, uTime;
uniform vec2 uMouse;
uniform vec3 uInk, uPaper;
${COMMON}
void main() {
  vec2 p = vec2(gl_FragCoord.x / uDpr, uRes.y - gl_FragCoord.y / uDpr);
  if (p.y < uTop - uRamp - 40. || p.y > uBot + uRamp + 40.) discard;
  float wav = sin(p.x * .0052 + uTime * .32) * 9. + sin(p.x * .0137 - uTime * .21 + 1.3) * 3.5;
  float y = p.y + wav;
  float t = y < uTop ? 1. - (uTop - y) / uRamp : (y > uBot ? 1. - (y - uBot) / uRamp : 1.);
  t = clamp(t, 0., 1.);
  float tt = t * t * (3. - 2. * t);
  float a = lines(y / uPitch, tt);

  // faint guilloche over the solid area
  float g = 0.;
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    float off = sin(p.x * (.0024 + fi * .0013) + uTime * (.08 + fi * .05) + fi * 2.1) * (60. + fi * 40.);
    float gv = (p.y + off) / (22. + fi * 6.);
    g += lines(gv, .04);
  }
  float inside = smoothstep(.55, 1., tt);
  vec3 col = mix(uInk, uPaper, clamp(g, 0., 1.) * .05 * inside);
  if (a < .002) discard;
  gl_FragColor = vec4(col, a);
}
`;

// guilloche rosette: many phase-shifted rings woven together, computed on the GPU
export const ROSETTE_VERT = /* glsl */ `
attribute float aT;
attribute float aC;
uniform float uN1, uN2, uA1, uA2, uBase, uPhase, uHover, uTime, uBands;
varying float vT;
varying float vC;
void main() {
  float th = aT * 6.2831853;
  float band = floor(aC * uBands);
  float c = fract(aC * uBands);
  float scale = 1. - band * .36;
  float ph = c * 6.2831853 + uPhase + uTime * (.035 + band * .02) * (mod(band, 2.) < 1. ? 1. : -1.);
  float a1 = uA1 * (1. + uHover * .35);
  float r = uBase + a1 * sin(uN1 * th + ph) + uA2 * sin(uN2 * th - ph * 2. + uHover * 1.2);
  r *= scale;
  vec2 pos = vec2(cos(th), sin(th)) * r;
  vT = aT;
  vC = c;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 0., 1.);
}
`;

export const ROSETTE_FRAG = /* glsl */ `
uniform float uDraw;
uniform vec3 uInk;
uniform float uAlpha;
varying float vT;
varying float vC;
void main() {
  float head = uDraw * 1.15 - vC * .15;
  if (vT > head) discard;
  gl_FragColor = vec4(uInk, uAlpha);
}
`;
