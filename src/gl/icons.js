// Emblems for each step of the journey, drawn in greys on a transparent canvas.
// The engraving shader turns the greys into line weight: dark = thick lines.

const SIZE = 900;
const g = (v) => `rgb(${v},${v},${v})`;

function canvas() {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const ctx = c.getContext('2d');
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  return { c, ctx };
}

function poly(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

// 2021 · Exército: a faceted five-pointed star inside a medal ring
function star() {
  const { c, ctx } = canvas();
  const cx = 450;
  const cy = 465;
  ctx.lineWidth = 16;
  ctx.strokeStyle = g(70);
  ctx.beginPath();
  ctx.arc(cx, cy, 405, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, 378, 0, Math.PI * 2);
  ctx.stroke();

  const R = 340;
  const r = 140;
  const light = -Math.PI * 0.75;
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k * Math.PI * 2) / 5;
    const tip = [cx + Math.cos(a) * R, cy + Math.sin(a) * R];
    for (const side of [-1, 1]) {
      const b = a + (side * Math.PI) / 5;
      const inner = [cx + Math.cos(b) * r, cy + Math.sin(b) * r];
      // each facet faces a little to one side of its point; shade it against a top-left light
      const facing = a + side * 0.9;
      const lum = 0.5 + 0.5 * Math.cos(facing - light);
      ctx.fillStyle = g(Math.round(60 + lum * 175));
      poly(ctx, [[cx, cy], tip, inner]);
      ctx.fill();
    }
  }
  ctx.strokeStyle = g(40);
  ctx.lineWidth = 6;
  const pts = [];
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 ? r : R;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  poly(ctx, pts);
  ctx.stroke();
  return c;
}

// 2022 · PUCRS: a graduation cap with its tassel
function cap() {
  const { c, ctx } = canvas();
  // skull cap under the board
  let grad = ctx.createLinearGradient(250, 0, 650, 0);
  grad.addColorStop(0, g(70));
  grad.addColorStop(0.45, g(140));
  grad.addColorStop(1, g(55));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(240, 380);
  ctx.lineTo(660, 380);
  ctx.lineTo(650, 590);
  ctx.quadraticCurveTo(450, 660, 250, 590);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = g(35);
  ctx.lineWidth = 6;
  ctx.stroke();

  // thickness of the board
  ctx.fillStyle = g(60);
  poly(ctx, [[90, 330], [450, 490], [810, 330], [810, 354], [450, 516], [90, 354]]);
  ctx.fill();
  // board
  grad = ctx.createLinearGradient(160, 180, 740, 480);
  grad.addColorStop(0, g(235));
  grad.addColorStop(1, g(150));
  ctx.fillStyle = grad;
  poly(ctx, [[450, 170], [810, 330], [450, 490], [90, 330]]);
  ctx.fill();
  ctx.stroke();

  // button, cord and tassel
  ctx.fillStyle = g(40);
  ctx.beginPath();
  ctx.arc(450, 330, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = g(45);
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(450, 330);
  ctx.quadraticCurveTo(640, 340, 720, 380);
  ctx.lineTo(722, 560);
  ctx.stroke();
  grad = ctx.createLinearGradient(695, 0, 750, 0);
  grad.addColorStop(0, g(50));
  grad.addColorStop(0.5, g(130));
  grad.addColorStop(1, g(45));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(708, 552);
  ctx.lineTo(736, 552);
  ctx.lineTo(752, 700);
  ctx.lineTo(692, 700);
  ctx.closePath();
  ctx.fill();
  return c;
}

// 2026 · SDR: a headset, for the calls
function headset() {
  const { c, ctx } = canvas();
  const cx = 450;
  const cy = 500;
  // headband
  ctx.lineWidth = 54;
  ctx.strokeStyle = g(85);
  ctx.beginPath();
  ctx.arc(cx, cy, 290, Math.PI * 1.04, Math.PI * 1.96);
  ctx.stroke();
  ctx.lineWidth = 16;
  ctx.strokeStyle = g(205);
  ctx.beginPath();
  ctx.arc(cx, cy, 300, Math.PI * 1.12, Math.PI * 1.5);
  ctx.stroke();

  const cup = (x, flip) => {
    const grad = ctx.createLinearGradient(x - 70, 0, x + 70, 0);
    grad.addColorStop(0, g(flip ? 40 : 170));
    grad.addColorStop(1, g(flip ? 170 : 40));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x - 72, 420, 144, 250, 60);
    ctx.fill();
    ctx.strokeStyle = g(35);
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.fillStyle = g(120);
    ctx.beginPath();
    ctx.roundRect(x + (flip ? -96 : 50), 450, 46, 190, 22);
    ctx.fill();
  };
  cup(165, false);
  cup(735, true);

  // microphone boom
  ctx.strokeStyle = g(55);
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.moveTo(190, 650);
  ctx.quadraticCurveTo(240, 790, 420, 778);
  ctx.stroke();
  const grad = ctx.createRadialGradient(440, 765, 4, 450, 778, 46);
  grad.addColorStop(0, g(200));
  grad.addColorStop(1, g(40));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(455, 778, 46, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

// today · assessor: a bank facade, like the vignette on a banknote
function bank() {
  const { c, ctx } = canvas();
  // pediment
  ctx.fillStyle = g(200);
  poly(ctx, [[100, 330], [450, 130], [800, 330]]);
  ctx.fill();
  ctx.fillStyle = g(120);
  poly(ctx, [[180, 312], [450, 160], [720, 312]]);
  ctx.fill();
  ctx.strokeStyle = g(40);
  ctx.lineWidth = 6;
  poly(ctx, [[100, 330], [450, 130], [800, 330]]);
  ctx.stroke();
  // entablature
  ctx.fillStyle = g(225);
  ctx.fillRect(90, 330, 720, 44);
  ctx.fillStyle = g(60);
  ctx.fillRect(90, 374, 720, 14);
  // wall behind the columns
  ctx.fillStyle = g(95);
  ctx.fillRect(130, 388, 640, 302);
  // columns, shaded like cylinders
  for (const x of [205, 365, 535, 695]) {
    const grad = ctx.createLinearGradient(x - 40, 0, x + 40, 0);
    grad.addColorStop(0, g(85));
    grad.addColorStop(0.35, g(240));
    grad.addColorStop(1, g(70));
    ctx.fillStyle = grad;
    ctx.fillRect(x - 38, 410, 76, 262);
    ctx.fillStyle = g(215);
    ctx.fillRect(x - 52, 390, 104, 22);
    ctx.fillRect(x - 52, 670, 104, 22);
  }
  // steps
  ctx.fillStyle = g(210);
  ctx.fillRect(80, 692, 740, 36);
  ctx.fillStyle = g(160);
  ctx.fillRect(50, 728, 800, 36);
  ctx.fillStyle = g(110);
  ctx.fillRect(20, 764, 860, 40);
  return c;
}

export const ICONS = [star, cap, headset, bank];
