/** Small deterministic 2D solver. All distances are SVG viewBox units. */
export type Body = { x: number; y: number; vx: number; vy: number; r: number };
export type Peg = { x: number; y: number; r: number; boost?: number };
export type Rail = { ax: number; ay: number; bx: number; by: number };
export type Sample = { x: number; y: number; hit: number; flipper?: number };
export const STEP = 1 / 120;
export const funnel: Rail[] = [
  { ax: 40, ay: 360, bx: 230, by: 460 },
  { ax: 460, ay: 360, bx: 270, by: 460 },
];

export function reflect(body: Body, nx: number, ny: number, restitution: number, boost = 0) {
  const speed = body.vx * nx + body.vy * ny;
  if (speed >= 0) return;
  body.vx -= ((1 + restitution) * speed - boost) * nx;
  body.vy -= ((1 + restitution) * speed - boost) * ny;
}

export function collidePeg(body: Body, peg: Peg) {
  const dx = body.x - peg.x, dy = body.y - peg.y;
  const distance = Math.hypot(dx, dy), radius = body.r + peg.r;
  if (distance >= radius) return false;
  const nx = distance > 0.0001 ? dx / distance : 1;
  const ny = distance > 0.0001 ? dy / distance : 0;
  body.x = peg.x + nx * radius;
  body.y = peg.y + ny * radius;
  reflect(body, nx, ny, 0.64, peg.boost ?? 0);
  return true;
}

export function collideRail(body: Body, rail: Rail) {
  const dx = rail.bx - rail.ax, dy = rail.by - rail.ay;
  const t = Math.max(0, Math.min(1, ((body.x - rail.ax) * dx + (body.y - rail.ay) * dy) / (dx * dx + dy * dy)));
  return collidePeg(body, { x: rail.ax + t * dx, y: rail.ay + t * dy, r: 2 });
}

export function advance(body: Body, gravity: number, dt = STEP) {
  body.vy += gravity * dt;
  body.x += body.vx * dt;
  body.y += body.vy * dt;
}

/** Replay only a trajectory that reaches the visible collector, without end-position snapping. */
export function dropTrajectory(pegs: Peg[], pinball: boolean, random = Math.random): Sample[] {
  for (let attempt = 0; attempt < 80; attempt++) {
    const body: Body = { x: pinball ? 448 : 120 + random() * 260, y: pinball ? 458 : 45, vx: pinball ? 0 : (random() - 0.5) * 100, vy: pinball ? -850 : 0, r: 10 };
    const samples: Sample[] = [{ x: body.x, y: body.y, hit: -1 }];
    let launching = pinball;
    let returns = 0, hits = 0;
    for (let i = 0; i < 3600; i++) {
      advance(body, 520);
      if (launching && body.y < 65) { launching = false; body.vx = -210 - random() * 90; body.vy = -40; }
      if (body.x < 42) { body.x = 42; reflect(body, 1, 0, .72); }
      if (body.x > 458) { body.x = 458; reflect(body, -1, 0, .72); }
      if (body.y < 44) { body.y = 44; reflect(body, 0, 1, .7); }
      let hit = -1;
      let flipper: number | undefined;
      if (!launching) {
        pegs.forEach((peg, index) => { if (collidePeg(body, peg)) { hit = index; hits++; } });
        funnel.forEach(rail => collideRail(body, rail));
        if (pinball) {
          collideRail(body, { ax: 432, ay: 120, bx: 432, by: 460 });
          // Powered paddles strike only on contact with their visible upper surface.
          const side = body.x < 250 ? 0 : 1;
          const paddle = side === 0 ? { ax: 90, ay: 400, bx: 247, by: 430 } : { ax: 410, ay: 400, bx: 253, by: 430 };
          if (returns < 4 && body.vy > 0 && body.y > 380 && collideRail(body, paddle)) {
            flipper = side;
            body.vy = -620 - random() * 110;
            body.vx = (250 - body.x) * 1.4 + (random() - .5) * 160;
            returns++;
          }
        }
      }
      body.vx *= .999;
      samples.push({ x: body.x, y: body.y, hit, ...(flipper === undefined ? {} : { flipper }) });
      if (body.y >= 470 && Math.abs(body.x - 250) < 22) {
        if (!pinball || (returns >= 3 && hits >= 5)) return samples;
        break;
      }
      if (body.y > 510) break;
    }
  }
  throw new Error('No physical trajectory reached the collector');
}
