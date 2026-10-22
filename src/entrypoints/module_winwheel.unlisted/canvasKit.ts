/** Canvas helpers shared by the arcade games: crisp HiDPI surfaces, shaded spheres and particles. */
export type Ctx = CanvasRenderingContext2D;
export const TAU = Math.PI * 2;

export const setupCanvas = (canvas: HTMLCanvasElement, width: number, height: number) => {
  const ratio = Math.min(2, Math.max(1, globalThis.devicePixelRatio || 1));
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D indisponible");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return ctx;
};

/** Static scenery is painted once, then blitted every frame. */
export const paintLayer = (width: number, height: number, paint: (ctx: Ctx) => void) => {
  const canvas = document.createElement("canvas");
  paint(setupCanvas(canvas, width, height));
  return canvas;
};

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** amount > 0 mixes toward white, amount < 0 toward black. */
export const tint = (hex: string, amount: number) => {
  const target = amount < 0 ? 0 : 255, mix = Math.min(1, Math.abs(amount));
  const [r, g, b] = rgb(hex).map(c => Math.round(c + (target - c) * mix));
  return `rgb(${r},${g},${b})`;
};

export const fade = (hex: string, opacity: number) => {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${opacity})`;
};

export const ellipse = (ctx: Ctx, x: number, y: number, rx: number, ry: number, rotation = 0) => {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), rotation, 0, TAU);
};

export const roundRect = (ctx: Ctx, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

export const softShadow = (ctx: Ctx, x: number, y: number, rx: number, ry: number, strength = .4) => {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, rx);
  gradient.addColorStop(0, `rgba(0,0,0,${strength})`);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  ctx.translate(-x, -y);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, rx, 0, TAU);
  ctx.fill();
  ctx.restore();
};

/** Glass marble with a cat's-eye vane that turns with the rolling angle. */
export const glassMarble = (ctx: Ctx, x: number, y: number, r: number, color: string, spin: number) => {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.clip();
  const body = ctx.createRadialGradient(x - r * .3, y - r * .35, r * .1, x, y, r * 1.05);
  body.addColorStop(0, tint(color, .6));
  body.addColorStop(.5, color);
  body.addColorStop(1, tint(color, -.6));
  ctx.fillStyle = body;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.fillStyle = "rgba(255,255,255,.62)";
  ctx.beginPath();
  ctx.moveTo(-r, -r * .1);
  ctx.bezierCurveTo(-r * .35, -r * .7, r * .35, r * .7, r, r * .1);
  ctx.bezierCurveTo(r * .3, r * .3, -r * .3, -r * .3, -r, -r * .1);
  ctx.fill();
  ctx.fillStyle = fade("#000000", .28);
  ctx.beginPath();
  ctx.moveTo(-r * .1, -r);
  ctx.bezierCurveTo(r * .55, -r * .3, -r * .55, r * .3, r * .1, r);
  ctx.bezierCurveTo(-r * .2, r * .3, r * .2, -r * .3, -r * .1, -r);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "rgba(255,255,255,.92)";
  ellipse(ctx, x - r * .36, y - r * .42, r * .3, r * .18, -.6);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.3)";
  ctx.lineWidth = Math.max(.8, r * .1);
  ctx.beginPath();
  ctx.arc(x, y, r * .8, .15 * Math.PI, .7 * Math.PI);
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,.4)";
  ctx.lineWidth = Math.max(.6, r * .07);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
};

/** Polished steel ball reflecting a bright ceiling and a dark horizon. */
export const steelBall = (ctx: Ctx, x: number, y: number, r: number) => {
  const body = ctx.createRadialGradient(x - r * .35, y - r * .4, r * .05, x, y, r * 1.02);
  body.addColorStop(0, "#ffffff");
  body.addColorStop(.22, "#eef3f8");
  body.addColorStop(.55, "#8d99a6");
  body.addColorStop(.82, "#39424d");
  body.addColorStop(1, "#b9c4cf");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.clip();
  ctx.fillStyle = "rgba(16,22,30,.35)";
  ellipse(ctx, x, y + r * .18, r * 1.1, r * .2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "rgba(255,255,255,.95)";
  ellipse(ctx, x - r * .34, y - r * .38, r * .22, r * .14, -.6);
  ctx.fill();
};

export type Spark = {
  x: number; y: number; vx: number; vy: number;
  life: number; ttl: number; size: number; color: string;
  gravity: number; spin: number; angle: number; confetti: boolean;
};

export const burst = (list: Spark[], x: number, y: number, count: number, colors: string[], speed: number, confetti = false) => {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * TAU, velocity = speed * (.35 + Math.random() * .65);
    list.push({
      x, y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity - (confetti ? speed * .55 : 0),
      life: 0,
      ttl: confetti ? 1.2 + Math.random() * .8 : .35 + Math.random() * .45,
      size: confetti ? 3 + Math.random() * 4 : 1.2 + Math.random() * 2.2,
      color: colors[i % colors.length],
      gravity: confetti ? 520 : 260,
      spin: (Math.random() - .5) * 18,
      angle: Math.random() * TAU,
      confetti,
    });
  }
};

export const drawSparks = (ctx: Ctx, list: Spark[], dt: number) => {
  for (let i = list.length - 1; i >= 0; i--) {
    const s = list[i];
    s.life += dt;
    if (s.life >= s.ttl) { list.splice(i, 1); continue; }
    s.vy += s.gravity * dt;
    s.vx *= s.confetti ? .985 : .96;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.angle += s.spin * dt;
    ctx.globalAlpha = Math.min(1, 1.4 * (1 - s.life / s.ttl));
    ctx.fillStyle = s.color;
    if (s.confetti) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      ctx.fillRect(-s.size / 2, -s.size * .3, s.size, s.size * .6 * Math.abs(Math.cos(s.angle * 1.7)) + .5);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, TAU);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
};

export type Popup = { x: number; y: number; text: string; life: number; color: string };

export const drawPopups = (ctx: Ctx, list: Popup[], dt: number) => {
  ctx.textAlign = "center";
  ctx.font = "900 17px ui-rounded, system-ui, sans-serif";
  ctx.lineJoin = "round";
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.life += dt;
    if (p.life > .9) { list.splice(i, 1); continue; }
    const y = p.y - p.life * 42;
    ctx.globalAlpha = Math.min(1, 2.2 * (1 - p.life / .9));
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(10,6,20,.85)";
    ctx.strokeText(p.text, p.x, y);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, y);
  }
  ctx.globalAlpha = 1;
};
