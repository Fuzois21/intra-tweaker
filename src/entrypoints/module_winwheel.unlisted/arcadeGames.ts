/** Canvas arcade games: marble Grand Prix, pachinko cabinet, pinball table and lotto drum. */
import type { FxHelpers } from "./extraGames";
import { frameLoop } from "./timing";
import { advance, collidePeg, reflect, dropTrajectory, STEP, type Body, type Peg } from "./physics";
import { impactAwards } from "./scoring";
import {
  burst, drawPopups, drawSparks, ellipse, fade, glassMarble, paintLayer, roundRect,
  setupCanvas, softShadow, steelBall, tint, TAU, type Ctx, type Popup, type Spark,
} from "./canvasKit";

export type ArcadeGameId = "marbles" | "pachinko" | "pinball" | "lotto";

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const CONFETTI = ["#f2c66d", "#ff4d6d", "#2fb8ff", "#2fd38a", "#ffffff", "#b77bff"];

const revealResult = (stage: HTMLElement, selector: string, score: number) => {
  const result = stage.querySelector<HTMLElement>(selector);
  if (!result) throw new Error("Missing game result: " + selector);
  result.textContent = `${score}%`;
  result.dataset.result = String(score);
  stage.dataset.phase = "result";
  return result;
};

const screenMarkup = (width: number, height: number, extra: string, overlay = "") =>
  `<div class="ag-screen ${extra}" style="--ag-ar:${width}/${height}"><canvas aria-hidden="true"></canvas>${overlay}</div>`;

const mountCanvas = (stage: HTMLElement, width: number, height: number) =>
  setupCanvas(stage.querySelector<HTMLCanvasElement>(".ag-screen canvas")!, width, height);

const setStatus = (stage: HTMLElement, text: string) => {
  const status = stage.querySelector(".ag-status");
  if (status) status.textContent = text;
};

/** Keeps the canvas alive after the reveal so confetti can settle. */
const afterglow = (duration: number, signal: AbortSignal, paint: (dt: number) => void) => {
  let last = 0;
  return frameLoop(duration, signal, p => {
    const now = p * duration / 1000;
    paint(Math.min(.05, now - last));
    last = now;
  });
};

/* ==========================================================================
   1. GRAND PRIX DES BILLES — four glass marbles race down a zigzag wooden run
   ========================================================================== */

const MARBLES = [
  { name: "Comète", color: "#2fb8ff" },
  { name: "Rubis", color: "#ff4d6d" },
  { name: "Jade", color: "#2fd38a" },
  { name: "Soleil", color: "#ffc23d" },
];
const MW = 720, MH = 540, MR = 8.5;
const LANE = { x: 15, y: -11 };
const RAMP_DROP = 28;

type Ramp = { ax: number; ay: number; bx: number; by: number; len: number; dir: number; ux: number; uy: number; sin: number; cos: number };
const marbleRamps: Ramp[] = Array.from({ length: 5 }, (_, i) => {
  const dir = i % 2 ? -1 : 1;
  const ax = dir > 0 ? 92 : 600, bx = dir > 0 ? 600 : 92;
  const ay = 92 + i * 86, by = ay + 58;
  const len = Math.hypot(bx - ax, by - ay);
  return { ax, ay, bx, by, len, dir, ux: (bx - ax) / len, uy: (by - ay) / len, sin: (by - ay) / len, cos: Math.abs(bx - ax) / len };
});
const FINISH_S = marbleRamps[4].len - 74;

const lanePoint = (ramp: Ramp, s: number, lane: number) => ({
  x: ramp.ax + ramp.ux * s + LANE.x * lane,
  y: ramp.ay + ramp.uy * s + LANE.y * lane,
});

type RaceFrame = Float32Array; // x, y, spin per marble
type Race = { frames: RaceFrame[]; finish: number[]; order: number[]; progress: Float32Array[] };

const simulateRace = (): Race => {
  const g = 3200, drag = .0009;
  const friction = MARBLES.map(() => marbleRamps.map(() => rand(.004, .03)));
  const bounce = MARBLES.map(() => marbleRamps.map(() => rand(.55, .7)));
  const marbles = MARBLES.map((_, lane) => ({ lane, ramp: 0, s: 0, v: 0, fall: -1, spin: rand(0, TAU), done: -1, delay: rand(0, .14) }));
  const frames: RaceFrame[] = [], progress: Float32Array[] = [];
  let t = 0, winner = -1;
  while (t < 20) {
    const frame = new Float32Array(MARBLES.length * 3), rank = new Float32Array(MARBLES.length);
    for (const m of marbles) {
      const ramp = marbleRamps[m.ramp];
      if (t >= m.delay) {
        if (m.fall >= 0) {
          m.fall += STEP;
          if (.5 * g * m.fall * m.fall >= RAMP_DROP) {
            m.v *= bounce[m.lane][m.ramp];
            m.ramp++; m.s = 0; m.fall = -1;
          }
        } else {
          const finished = m.ramp === 4 && m.s >= FINISH_S;
          const a = finished ? -9 * m.v : g * (ramp.sin * 5 / 7 - friction[m.lane][m.ramp] * ramp.cos) - drag * m.v * m.v;
          m.v = Math.max(0, m.v + a * STEP);
          m.s += m.v * STEP;
          m.spin += m.v * STEP / MR * ramp.dir;
          if (m.ramp === 4) {
            if (m.done < 0 && m.s >= FINISH_S) { m.done = t; if (winner < 0) winner = m.lane; }
            m.s = Math.min(m.s, ramp.len - 10);
          } else if (m.s >= ramp.len) { m.s = ramp.len; m.fall = 0; }
        }
      }
      const current = marbleRamps[m.ramp];
      const point = lanePoint(current, m.s, m.lane);
      const drop = m.fall >= 0 ? Math.min(RAMP_DROP, .5 * g * m.fall * m.fall) : 0;
      frame[m.lane * 3] = point.x;
      frame[m.lane * 3 + 1] = point.y - MR * .8 + drop;
      frame[m.lane * 3 + 2] = m.spin;
      rank[m.lane] = m.done >= 0 ? 1e6 - m.done : m.ramp * 1000 + m.s;
    }
    frames.push(frame); progress.push(rank);
    t += STEP;
    const done = marbles.filter(m => m.done >= 0);
    if (done.length === marbles.length && t > Math.max(...done.map(m => m.done)) + .5) break;
    if (winner >= 0 && t > marbles[winner].done + 1.7) break;
  }
  if (winner < 0) throw new Error("Marble race did not finish");
  const finish = marbles.map(m => m.done < 0 ? Infinity : m.done);
  const order = marbles.map(m => m.lane).sort((a, b) => finish[a] - finish[b]);
  return { frames, finish, order, progress };
};

/** Every marble carries a percentage before the start; the winner always carries the real score. */
const marbleValues = (score: number, winner: number) => {
  const decoys: number[] = [];
  while (decoys.length < MARBLES.length - 1) {
    const value = Math.round(rand(0, 100));
    if ([score, ...decoys].every(other => Math.abs(other - value) >= 6)) decoys.push(value);
  }
  decoys.splice(winner, 0, score);
  return decoys;
};

/** Percentage tags floating above the marbles, nudged apart so they never overlap. */
const drawMarbleTags = (ctx: Ctx, frame: RaceFrame, values: number[], pick: number) => {
  ctx.font = "900 11px ui-rounded, system-ui, sans-serif";
  ctx.textAlign = "center";
  const tags = MARBLES.map((_, lane) => {
    const text = `${values[lane]}%`, w = ctx.measureText(text).width + 14;
    return { lane, text, w, mx: frame[lane * 3], my: frame[lane * 3 + 1], x: frame[lane * 3], y: frame[lane * 3 + 1] - 26 };
  });
  for (let pass = 0; pass < 6; pass++) {
    tags.sort((a, b) => a.y - b.y);
    for (let i = 0; i < tags.length; i++) for (let j = i + 1; j < tags.length; j++) {
      const a = tags[i], b = tags[j];
      if (Math.abs(a.x - b.x) < (a.w + b.w) / 2 + 2 && b.y - a.y < 18) a.y = b.y - 18;
    }
  }
  // Tags pushed above the canvas edge drop back down, the stack then sorts itself out next frame.
  for (const tag of tags) tag.y = Math.max(11, tag.y);
  for (const tag of tags) {
    const color = MARBLES[tag.lane].color, picked = tag.lane === pick;
    ctx.strokeStyle = fade(color, .7); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(tag.mx, tag.my - MR - 1); ctx.lineTo(tag.x, tag.y + 8); ctx.stroke();
    ctx.fillStyle = picked ? "#ffe7a3" : "rgba(12,10,8,.86)";
    roundRect(ctx, tag.x - tag.w / 2, tag.y - 8, tag.w, 16, 8); ctx.fill();
    ctx.strokeStyle = picked ? "#c8902f" : color; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = picked ? "#2b1a00" : "#fff";
    ctx.fillText(tag.text, tag.x, tag.y + 4);
    if (picked) {
      ctx.strokeStyle = "#ffe7a3"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(tag.mx, tag.my, MR + 3.5, 0, TAU); ctx.stroke();
    }
  }
};

const paintMarbleScenery = (ctx: Ctx) => {
  const wall = ctx.createLinearGradient(0, 0, 0, MH);
  wall.addColorStop(0, "#1d2a24");
  wall.addColorStop(1, "#0b1310");
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, MW, MH);
  const spot = ctx.createRadialGradient(MW * .45, 40, 20, MW * .45, 160, 520);
  spot.addColorStop(0, "rgba(255,236,190,.16)");
  spot.addColorStop(1, "rgba(255,236,190,0)");
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, MW, MH);
  ctx.strokeStyle = "rgba(255,255,255,.035)";
  ctx.lineWidth = 1;
  for (let x = -MH; x < MW; x += 26) { ctx.beginPath(); ctx.moveTo(x, MH); ctx.lineTo(x + MH, 0); ctx.stroke(); }
  // Floor
  const floor = ctx.createLinearGradient(0, MH - 32, 0, MH);
  floor.addColorStop(0, "#3b2a1c");
  floor.addColorStop(1, "#1d140d");
  ctx.fillStyle = floor;
  ctx.fillRect(0, MH - 30, MW, 30);
  // Support posts behind the ramps
  for (const x of [118, 574]) {
    const post = ctx.createLinearGradient(x, 0, x + 16, 0);
    post.addColorStop(0, "#5b3b22"); post.addColorStop(.5, "#8a5c35"); post.addColorStop(1, "#4a2f1b");
    ctx.fillStyle = post;
    ctx.fillRect(x + LANE.x * 2, 70, 16, MH - 96);
    softShadow(ctx, x + LANE.x * 2 + 8, MH - 28, 28, 6, .5);
  }
  marbleRamps.forEach((ramp, index) => {
    const back = lanePoint(ramp, 0, 3.6), backEnd = lanePoint(ramp, ramp.len, 3.6);
    const front = lanePoint(ramp, 0, -.6), frontEnd = lanePoint(ramp, ramp.len, -.6);
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.beginPath();
    ctx.moveTo(front.x + 6, front.y + 22); ctx.lineTo(frontEnd.x + 6, frontEnd.y + 22);
    ctx.lineTo(backEnd.x + 6, backEnd.y + 22); ctx.lineTo(back.x + 6, back.y + 22);
    ctx.fill();
    const board = ctx.createLinearGradient(back.x, back.y, front.x, front.y);
    board.addColorStop(0, "#a8774a"); board.addColorStop(1, "#d9a46b");
    ctx.fillStyle = board;
    ctx.beginPath();
    ctx.moveTo(front.x, front.y); ctx.lineTo(frontEnd.x, frontEnd.y);
    ctx.lineTo(backEnd.x, backEnd.y); ctx.lineTo(back.x, back.y);
    ctx.closePath(); ctx.fill();
    // Wood grain
    ctx.save(); ctx.clip();
    ctx.strokeStyle = "rgba(90,50,20,.18)";
    for (let k = 0; k < 14; k++) {
      const a = lanePoint(ramp, 0, -.6 + k * .3), b = lanePoint(ramp, ramp.len, -.6 + k * .3 + rand(-.1, .1));
      ctx.lineWidth = rand(.5, 1.6);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + rand(-3, 3), b.x, b.y); ctx.stroke();
    }
    ctx.restore();
    // Grooves
    for (let lane = 0; lane < 4; lane++) {
      const a = lanePoint(ramp, 4, lane), b = lanePoint(ramp, ramp.len - 4, lane);
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(60,32,14,.55)"; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.strokeStyle = "rgba(255,220,170,.35)"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y + 4); ctx.lineTo(b.x, b.y + 4); ctx.stroke();
    }
    // Front face (thickness)
    const face = ctx.createLinearGradient(0, front.y, 0, front.y + 12);
    face.addColorStop(0, "#8c5a31"); face.addColorStop(1, "#5a3519");
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.moveTo(front.x, front.y); ctx.lineTo(frontEnd.x, frontEnd.y);
    ctx.lineTo(frontEnd.x, frontEnd.y + 12); ctx.lineTo(front.x, front.y + 12);
    ctx.closePath(); ctx.fill();
    // Back wall and end stop
    ctx.fillStyle = "#6e4426";
    ctx.beginPath();
    ctx.moveTo(back.x, back.y); ctx.lineTo(backEnd.x, backEnd.y);
    ctx.lineTo(backEnd.x, backEnd.y - 9); ctx.lineTo(back.x, back.y - 9);
    ctx.closePath(); ctx.fill();
    if (index === 4) {
      // Checkered finish line across every lane
      for (let k = 0; k < 8; k++) for (let row = 0; row < 2; row++) {
        const s = FINISH_S + row * 6, lane = -.6 + k * .525;
        const p1 = lanePoint(ramp, s, lane), p2 = lanePoint(ramp, s + 6, lane), p3 = lanePoint(ramp, s + 6, lane + .525), p4 = lanePoint(ramp, s, lane + .525);
        ctx.fillStyle = (k + row) % 2 ? "#111" : "#f3f3f3";
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y); ctx.fill();
      }
      const top = lanePoint(ramp, FINISH_S + 6, 3.8);
      ctx.fillStyle = "#c9c9c9";
      ctx.fillRect(top.x - 2, top.y - 62, 4, 62);
      ctx.fillStyle = "#e33";
      roundRect(ctx, top.x - 34, top.y - 78, 68, 18, 4); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "900 11px ui-rounded, system-ui, sans-serif"; ctx.textAlign = "center";
      ctx.fillText("ARRIVÉE", top.x, top.y - 65);
    }
    if (index < 4) {
      // Drop hole at the low end
      const hole = lanePoint(ramp, ramp.len - 4, 1.5);
      ctx.fillStyle = "rgba(0,0,0,.45)";
      ellipse(ctx, hole.x, hole.y + 3, 10, 40, -.95); ctx.fill();
    }
  });
};

const paintMarbleLips = (ctx: Ctx) => {
  marbleRamps.forEach(ramp => {
    const a = lanePoint(ramp, 0, -.6), b = lanePoint(ramp, ramp.len, -.6);
    const lip = ctx.createLinearGradient(0, a.y - 5, 0, a.y + 2);
    lip.addColorStop(0, "#e9b77d"); lip.addColorStop(1, "#9a6638");
    ctx.strokeStyle = lip; ctx.lineWidth = 4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(a.x, a.y - 2); ctx.lineTo(b.x, b.y - 2); ctx.stroke();
  });
};

const makeMarblesMarkup = () => {
  const rows = MARBLES.map((m, i) => `<li class="mr-row" data-lane="${i}" role="button" tabindex="0" style="--c:${m.color};transform:translateY(${i * 100}%)"><i style="--c:${m.color}"></i><b>${m.name}</b><em data-mr-value>—</em><span>—</span></li>`).join("");
  return `<div class="arcade-game ag-marbles">`
    + `<header class="ag-hud"><div><span>GRAND PRIX DES BILLES</span><strong>5 rampes · 4 couloirs</strong></div><div class="mr-progress"><i></i></div></header>`
    + `<div class="mr-layout">`
    + screenMarkup(MW, MH, "mr-screen", `<div class="mr-plate"><small>Vainqueur</small><b data-mr-winner>—</b><strong data-mr-score>—</strong></div>`)
    + `<ol class="mr-board">${rows}</ol></div>`
    + `<p class="ag-status">Placement des billes sur la grille…</p></div>`;
};

const runMarbles = async (stage: HTMLElement, score: number, signal: AbortSignal, fx: FxHelpers) => {
  const ctx = mountCanvas(stage, MW, MH);
  const scenery = paintLayer(MW, MH, paintMarbleScenery);
  const lips = paintLayer(MW, MH, paintMarbleLips);
  const race = simulateRace();
  const values = marbleValues(score, race.order[0]);
  const rows = [...stage.querySelectorAll<HTMLElement>(".mr-row")];
  let pick = -1;
  rows.forEach((row, lane) => {
    row.querySelector("[data-mr-value]")!.textContent = `${values[lane]}%`;
    const choose = () => {
      pick = lane;
      rows.forEach((other, i) => other.classList.toggle("is-picked", i === lane));
    };
    row.addEventListener("click", choose);
    row.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") choose(); });
  });
  const bar = stage.querySelector<HTMLElement>(".mr-progress i")!;
  const sparks: Spark[] = [];
  const trail = MARBLES.map(() => [] as { x: number; y: number }[]);
  let flash = 0, gate = 0, lights = 0;

  const draw = (frame: RaceFrame, dt: number) => {
    ctx.drawImage(scenery, 0, 0, MW, MH);
    // Start gate lifts once the lights go green
    const ramp = marbleRamps[0];
    const g1 = lanePoint(ramp, 14, -.6), g2 = lanePoint(ramp, 14, 3.6);
    ctx.strokeStyle = "#d8342c"; ctx.lineWidth = 5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(g1.x, g1.y - 6 - gate * 40); ctx.lineTo(g2.x, g2.y - 6 - gate * 40); ctx.stroke();
    for (let lane = 3; lane >= 0; lane--) {
      const x = frame[lane * 3], y = frame[lane * 3 + 1];
      const history = trail[lane];
      history.forEach((p, i) => {
        ctx.globalAlpha = (i + 1) / history.length * .18;
        ctx.fillStyle = MARBLES[lane].color;
        ctx.beginPath(); ctx.arc(p.x, p.y, MR * .9, 0, TAU); ctx.fill();
      });
      ctx.globalAlpha = 1;
      softShadow(ctx, x + 3, y + MR * .85, MR * 1.3, MR * .45, .55);
      glassMarble(ctx, x, y, MR, MARBLES[lane].color, frame[lane * 3 + 2]);
      history.push({ x, y });
      if (history.length > 5) history.shift();
    }
    ctx.drawImage(lips, 0, 0, MW, MH);
    drawMarbleTags(ctx, frame, values, pick);
    // Starting lights
    ctx.fillStyle = "rgba(10,12,14,.85)";
    roundRect(ctx, 286, 14, 148, 34, 17); ctx.fill();
    for (let i = 0; i < 3; i++) {
      const on = lights > i, green = lights >= 4;
      ctx.fillStyle = green ? "#3df07a" : on ? "#ff3b30" : "#3a1715";
      ctx.shadowColor = green ? "#3df07a" : "#ff3b30";
      ctx.shadowBlur = on || green ? 14 : 0;
      ctx.beginPath(); ctx.arc(318 + i * 42, 31, 10, 0, TAU); ctx.fill();
    }
    ctx.shadowBlur = 0;
    drawSparks(ctx, sparks, dt);
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flash})`;
      ctx.fillRect(0, 0, MW, MH);
      flash = Math.max(0, flash - dt * 2.4);
    }
  };

  const rank = (index: number) => {
    const progress = race.progress[index];
    const order = MARBLES.map((_, i) => i).sort((a, b) => progress[b] - progress[a]);
    order.forEach((lane, place) => {
      rows[lane].style.transform = `translateY(${place * 100}%)`;
      rows[lane].classList.toggle("is-leading", place === 0);
      const done = race.finish[lane] <= index * STEP;
      rows[lane].querySelector("span")!.textContent = done
        ? place === 0 ? "1er" : `+${(race.finish[lane] - race.finish[order[0]]).toFixed(2)} s`
        : `P${place + 1}`;
    });
  };

  // Pick a marble, then three red lights, green and the gate lifts.
  const countdown = fx.reduced() ? 200 : 4200;
  let lastT = 0;
  if (!(await frameLoop(countdown, signal, p => {
    const t = p * countdown / 1000;
    const lightP = clamp((p - .45) / .55, 0, 1);
    lights = Math.min(4, Math.floor(lightP * 4.4));
    gate = clamp((lightP - .86) / .14, 0, 1);
    bar.style.width = `${(p * 4).toFixed(2)}%`;
    setStatus(stage, p < .45 ? "Chaque bille porte un % : choisissez la vôtre !"
      : lights >= 4 ? "Partez !" : `Départ dans ${3 - Math.min(2, lights)}…`);
    draw(race.frames[0], t - lastT); lastT = t;
  }))) return false;

  const simTime = race.frames.length * STEP;
  const duration = fx.reduced() ? 900 : clamp(simTime * 1000, 5500, 9500);
  const winner = race.order[0];
  let celebrated = false;
  lastT = 0;
  setStatus(stage, "Les billes dévalent la piste…");
  if (!(await frameLoop(duration, signal, p => {
    const index = Math.min(race.frames.length - 1, Math.floor(p * (race.frames.length - 1)));
    const t = p * duration / 1000;
    if (!celebrated && race.finish[winner] <= index * STEP) {
      celebrated = true; flash = .7;
      const x = race.frames[index][winner * 3], y = race.frames[index][winner * 3 + 1];
      if (!fx.reduced()) burst(sparks, x, y, 70, CONFETTI, 260, true);
      setStatus(stage, `Photo-finish : ${MARBLES[winner].name} (${values[winner]}%) en tête !`);
    }
    bar.style.width = `${(4 + p * 96).toFixed(2)}%`;
    rank(index);
    draw(race.frames[index], Math.min(.05, t - lastT)); lastT = t;
  }))) return false;

  const plate = stage.querySelector<HTMLElement>(".mr-plate")!;
  plate.style.setProperty("--c", MARBLES[winner].color);
  plate.querySelector("[data-mr-winner]")!.textContent = MARBLES[winner].name;
  revealResult(stage, "[data-mr-score]", score);
  plate.classList.add("is-shown");
  rows.forEach((row, lane) => row.classList.toggle("is-out", lane !== winner));
  setStatus(stage, pick < 0 ? `${MARBLES[winner].name} remporte le Grand Prix`
    : pick === winner ? `Bien joué : votre bille ${MARBLES[winner].name} gagne !`
    : `${MARBLES[winner].name} gagne · votre bille ${MARBLES[pick].name} (${values[pick]}%) est battue`);
  const last = race.frames[race.frames.length - 1];
  return afterglow(fx.reduced() ? 60 : 700, signal, dt => draw(last, dt));
};

/* ==========================================================================
   2. PACHINKO — brass nails, windmills, start chucker and LCD reels
   ========================================================================== */

const PW = 420, PH = 600, PR = 5;
const PC = { x: 210, y: 235 }, PRAD = 180;
const LCD = { x: 140, y: 160, w: 140, h: 140 };
const CHUCKER = { x: 210, y: 478 };
const TULIPS = [{ x: 98, y: 440 }, { x: 322, y: 440 }];
const WINDMILLS = [{ x: 92, y: 312, r: 13, spin: 1 }, { x: 328, y: 312, r: 13, spin: -1 }];

const pachinkoNails: Peg[] = (() => {
  const nails: Peg[] = [];
  const add = (x: number, y: number) => nails.push({ x, y, r: 2.2 });
  for (let row = 0; row < 20; row++) {
    const y = 96 + row * 22;
    for (let x = 44 + (row % 2) * 13; x < 380; x += 26) {
      if (y < PC.y && Math.hypot(x - PC.x, y - PC.y) > PRAD - 16) continue;
      if (x > LCD.x - 14 && x < LCD.x + LCD.w + 14 && y > LCD.y - 14 && y < LCD.y + LCD.h + 14) continue;
      if (WINDMILLS.some(w => Math.hypot(x - w.x, y - w.y) < 26)) continue;
      if ([CHUCKER, ...TULIPS].some(p => Math.hypot(x - p.x, y - p.y) < 30)) continue;
      if (y > 520) continue;
      add(x, y);
    }
  }
  for (const p of [CHUCKER, ...TULIPS]) { add(p.x - 11, p.y - 7); add(p.x + 11, p.y - 7); }
  add(CHUCKER.x - 19, CHUCKER.y - 25); add(CHUCKER.x + 19, CHUCKER.y - 25);
  return nails;
})();

type PachinkoBall = { samples: Float32Array; end: "chucker" | "tulip" | "drain"; tulip: number; strength: number };

const railPoint = (angle: number, radius = PRAD + 9) => ({ x: PC.x + Math.cos(angle) * radius, y: PC.y + Math.sin(angle) * radius });

const simulatePachinkoBall = (strength: number): PachinkoBall => {
  const out: number[] = [];
  // Launch: straight up the left channel, then around the outer rail.
  const startY = 548, straight = startY - PC.y, exit = Math.PI * (1.6 + strength * .28);
  const arc = (exit - Math.PI) * (PRAD + 9), railSpeed = 760 + strength * 260;
  for (let d = 0; d < straight + arc; d += railSpeed * STEP) {
    if (d < straight) out.push(PC.x - PRAD - 9, startY - d);
    else { const p = railPoint(Math.PI + (d - straight) / (PRAD + 9)); out.push(p.x, p.y); }
  }
  const start = railPoint(exit, PRAD - 7);
  const speed = 250 + strength * 120;
  // The rail tip deflects the ball inward, off the outer wall and into the nails.
  const tx = -Math.sin(exit) * .4 - Math.cos(exit) * .6, ty = Math.cos(exit) * .4 - Math.sin(exit) * .6, tl = Math.hypot(tx, ty);
  const body: Body = { x: start.x, y: start.y, vx: tx / tl * speed, vy: ty / tl * speed, r: PR };
  let end: PachinkoBall["end"] = "drain", tulip = -1;
  for (let i = 0; i < 1400; i++) {
    const prevY = body.y;
    advance(body, 700);
    if (body.y < PC.y) {
      const dx = body.x - PC.x, dy = body.y - PC.y, d = Math.hypot(dx, dy);
      if (d > PRAD - PR) {
        body.x = PC.x + dx / d * (PRAD - PR); body.y = PC.y + dy / d * (PRAD - PR);
        reflect(body, -dx / d, -dy / d, .45);
      }
    }
    if (body.x < PC.x - PRAD + PR) { body.x = PC.x - PRAD + PR; reflect(body, 1, 0, .45); }
    if (body.x > PC.x + PRAD - PR) { body.x = PC.x + PRAD - PR; reflect(body, -1, 0, .45); }
    for (const nail of pachinkoNails) collidePeg(body, nail);
    for (const mill of WINDMILLS) {
      if (collidePeg(body, { x: mill.x, y: mill.y, r: mill.r })) {
        const dx = body.x - mill.x, dy = body.y - mill.y, d = Math.hypot(dx, dy) || 1;
        body.vx += -dy / d * 140 * mill.spin; body.vy += dx / d * 140 * mill.spin;
      }
    }
    const cx = clamp(body.x, LCD.x, LCD.x + LCD.w), cy = clamp(body.y, LCD.y, LCD.y + LCD.h);
    collidePeg(body, { x: cx, y: cy, r: .5 });
    body.vx *= .998;
    out.push(body.x, body.y);
    if (prevY < CHUCKER.y && body.y >= CHUCKER.y && Math.abs(body.x - CHUCKER.x) < 8) { end = "chucker"; break; }
    const caught = TULIPS.findIndex(p => prevY < p.y && body.y >= p.y && Math.abs(body.x - p.x) < 8);
    if (caught >= 0) { end = "tulip"; tulip = caught; break; }
    if (body.y > 552) break;
  }
  return { samples: new Float32Array(out), end, tulip, strength };
};

const pachinkoRound = () => {
  const losers: PachinkoBall[] = [];
  for (let attempt = 0; attempt < 600; attempt++) {
    const ball = simulatePachinkoBall(Math.random());
    if (ball.end === "chucker") return [...losers.slice(0, 6), ball];
    losers.push(ball);
  }
  throw new Error("No pachinko ball reached the start chucker");
};

const paintBrassNail = (ctx: Ctx, x: number, y: number, r: number) => {
  ctx.fillStyle = "rgba(0,0,0,.45)";
  ctx.beginPath(); ctx.arc(x + 1.3, y + 1.6, r, 0, TAU); ctx.fill();
  const head = ctx.createRadialGradient(x - r * .4, y - r * .4, .2, x, y, r);
  head.addColorStop(0, "#fff6d5"); head.addColorStop(.45, "#d9b25a"); head.addColorStop(1, "#7a5a1c");
  ctx.fillStyle = head;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
};

const paintPachinkoBoard = (ctx: Ctx) => {
  // Chrome cabinet
  const chrome = ctx.createLinearGradient(0, 0, PW, 0);
  chrome.addColorStop(0, "#5c6470"); chrome.addColorStop(.2, "#e3e8ee"); chrome.addColorStop(.5, "#8d96a2");
  chrome.addColorStop(.8, "#eef2f6"); chrome.addColorStop(1, "#4d545e");
  ctx.fillStyle = chrome;
  roundRect(ctx, 0, 0, PW, PH, 26); ctx.fill();
  ctx.fillStyle = "#16101f";
  roundRect(ctx, 12, 12, PW - 24, PH - 24, 18); ctx.fill();
  // Printed playfield artwork
  ctx.save();
  ctx.beginPath();
  ctx.arc(PC.x, PC.y, PRAD, Math.PI, 0);
  ctx.lineTo(PC.x + PRAD, 560); ctx.lineTo(PC.x - PRAD, 560); ctx.closePath();
  ctx.clip();
  const art = ctx.createRadialGradient(PC.x, 230, 20, PC.x, 300, 380);
  art.addColorStop(0, "#ff5fa2"); art.addColorStop(.35, "#7b2cbf"); art.addColorStop(.75, "#240b5a"); art.addColorStop(1, "#0d0626");
  ctx.fillStyle = art;
  ctx.fillRect(0, 0, PW, PH);
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * TAU;
    ctx.fillStyle = i % 2 ? "rgba(255,255,255,.05)" : "rgba(255,220,120,.06)";
    ctx.beginPath(); ctx.moveTo(PC.x, 230);
    ctx.arc(PC.x, 230, 420, a, a + TAU / 36); ctx.fill();
  }
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(255,255,255,${rand(.15, .6)})`;
    ctx.beginPath(); ctx.arc(rand(40, 380), rand(70, 540), rand(.4, 1.4), 0, TAU); ctx.fill();
  }
  ctx.restore();
  // Inner and outer guide rails
  ctx.lineCap = "round";
  for (const [radius, width, color] of [[PRAD + 2, 4, "#f0d48a"], [PRAD + 16, 5, "#c9ced6"]] as const) {
    ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(PC.x - radius, 556); ctx.lineTo(PC.x - radius, PC.y);
    ctx.arc(PC.x, PC.y, radius, Math.PI, radius > PRAD + 10 ? TAU : Math.PI * 1.97);
    if (radius > PRAD + 10) ctx.lineTo(PC.x + radius, 556);
    ctx.stroke();
  }
  ctx.strokeStyle = "#f0d48a"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(PC.x + PRAD, PC.y); ctx.lineTo(PC.x + PRAD, 556); ctx.stroke();
  // LCD bezel
  const bezel = ctx.createLinearGradient(LCD.x, LCD.y, LCD.x + LCD.w, LCD.y + LCD.h);
  bezel.addColorStop(0, "#ffe08a"); bezel.addColorStop(.5, "#b8862b"); bezel.addColorStop(1, "#ffe7a6");
  ctx.fillStyle = bezel;
  roundRect(ctx, LCD.x - 8, LCD.y - 8, LCD.w + 16, LCD.h + 16, 16); ctx.fill();
  ctx.fillStyle = "#05030c";
  roundRect(ctx, LCD.x, LCD.y, LCD.w, LCD.h, 10); ctx.fill();
  // Tulips and start chucker
  for (const tulip of TULIPS) {
    ctx.fillStyle = "#ff3d7f";
    ctx.beginPath(); ctx.moveTo(tulip.x - 9, tulip.y - 6); ctx.quadraticCurveTo(tulip.x, tulip.y + 12, tulip.x + 9, tulip.y - 6);
    ctx.lineTo(tulip.x + 5, tulip.y + 8); ctx.lineTo(tulip.x - 5, tulip.y + 8); ctx.fill();
  }
  const cup = ctx.createLinearGradient(CHUCKER.x - 14, 0, CHUCKER.x + 14, 0);
  cup.addColorStop(0, "#8a6a1e"); cup.addColorStop(.5, "#ffe9a8"); cup.addColorStop(1, "#8a6a1e");
  ctx.fillStyle = cup;
  roundRect(ctx, CHUCKER.x - 14, CHUCKER.y - 4, 28, 20, 6); ctx.fill();
  ctx.fillStyle = "#1b0d2e";
  roundRect(ctx, CHUCKER.x - 8, CHUCKER.y - 2, 16, 8, 3); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = "900 8px ui-rounded, system-ui, sans-serif"; ctx.textAlign = "center";
  ctx.fillText("START", CHUCKER.x, CHUCKER.y + 14);
  for (const nail of pachinkoNails) paintBrassNail(ctx, nail.x, nail.y, nail.r);
  // Ball tray
  const tray = ctx.createLinearGradient(0, 560, 0, PH);
  tray.addColorStop(0, "#c7ccd4"); tray.addColorStop(1, "#5f6670");
  ctx.fillStyle = tray;
  roundRect(ctx, 26, 562, PW - 52, 26, 12); ctx.fill();
  ctx.fillStyle = "#2a2f36";
  roundRect(ctx, 34, 568, PW - 120, 14, 7); ctx.fill();
  for (let i = 0; i < 26; i++) steelBall(ctx, 42 + i * 9.6, 575, 4.4);
};

const paintPachinkoGlass = (ctx: Ctx) => {
  const glare = ctx.createLinearGradient(40, 40, 300, 420);
  glare.addColorStop(0, "rgba(255,255,255,.16)"); glare.addColorStop(.35, "rgba(255,255,255,.02)");
  glare.addColorStop(.36, "rgba(255,255,255,.07)"); glare.addColorStop(.5, "rgba(255,255,255,0)");
  ctx.fillStyle = glare;
  ctx.beginPath();
  ctx.arc(PC.x, PC.y, PRAD + 4, Math.PI, 0);
  ctx.lineTo(PC.x + PRAD + 4, 560); ctx.lineTo(PC.x - PRAD - 4, 560); ctx.closePath();
  ctx.fill();
};

const paintWindmill = (ctx: Ctx, mill: typeof WINDMILLS[number], angle: number) => {
  ctx.save();
  ctx.translate(mill.x, mill.y);
  ctx.rotate(angle * mill.spin);
  for (let i = 0; i < 6; i++) {
    ctx.rotate(TAU / 6);
    ctx.fillStyle = i % 2 ? "#ffe066" : "#4cc9f0";
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(mill.r + 2, -4); ctx.lineTo(mill.r + 2, 4); ctx.fill();
  }
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, TAU); ctx.fill();
  ctx.restore();
};

const makePachinkoMarkup = () => {
  const reels = [0, 1, 2].map(() => `<span class="pk-reel"><span class="pk-strip">${Array.from({ length: 20 }, (_, i) => `<b>${i % 10}</b>`).join("")}</span></span>`).join("");
  const overlay = `<div class="pk-lcd"><div class="pk-attract">PACHINKO<small>FEVER</small></div><div class="pk-reels">${reels}</div><strong class="pk-score" data-pk-score></strong></div>`
    + `<div class="pk-handle"><i></i></div>`;
  return `<div class="arcade-game ag-pachinko">`
    + `<header class="ag-hud"><div><span>PACHINKO FEVER</span><strong>Visez le START</strong></div><div class="pk-counter"><small>BILLES</small><b data-pk-balls>0</b></div></header>`
    + screenMarkup(PW, PH, "pk-screen", overlay)
    + `<p class="ag-status">Tournez la poignée…</p></div>`;
};

const runPachinko = async (stage: HTMLElement, score: number, signal: AbortSignal, fx: FxHelpers) => {
  const ctx = mountCanvas(stage, PW, PH);
  const board = paintLayer(PW, PH, paintPachinkoBoard);
  const glass = paintLayer(PW, PH, paintPachinkoGlass);
  const balls = pachinkoRound();
  const gap = fx.reduced() ? .05 : .34;
  const starts = balls.map((_, i) => i * gap);
  const simTotal = Math.max(...balls.map((b, i) => starts[i] + b.samples.length / 2 * STEP));
  const duration = fx.reduced() ? 700 : clamp(simTotal * 1000, 2500, 8000);
  const timeScale = simTotal / (duration / 1000);
  const handle = stage.querySelector<HTMLElement>(".pk-handle")!;
  const counter = stage.querySelector<HTMLElement>("[data-pk-balls]")!;
  const lcd = stage.querySelector<HTMLElement>(".pk-lcd")!;
  const sparks: Spark[] = [];
  const tulipFlash = [0, 0];
  let chuckerFlash = 0, launched = 0, lastT = 0;

  const draw = (simT: number, dt: number) => {
    ctx.drawImage(board, 0, 0, PW, PH);
    WINDMILLS.forEach(mill => paintWindmill(ctx, mill, simT * 5));
    TULIPS.forEach((tulip, i) => {
      if (tulipFlash[i] <= 0) return;
      ctx.fillStyle = `rgba(255,120,180,${tulipFlash[i]})`;
      ctx.beginPath(); ctx.arc(tulip.x, tulip.y, 16, 0, TAU); ctx.fill();
      tulipFlash[i] -= dt * 2;
    });
    if (chuckerFlash > 0) {
      const glow = ctx.createRadialGradient(CHUCKER.x, CHUCKER.y, 2, CHUCKER.x, CHUCKER.y, 46);
      glow.addColorStop(0, `rgba(255,240,150,${chuckerFlash})`); glow.addColorStop(1, "rgba(255,240,150,0)");
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(CHUCKER.x, CHUCKER.y, 46, 0, TAU); ctx.fill();
      chuckerFlash = Math.max(0, chuckerFlash - dt * .8);
    }
    balls.forEach((ball, i) => {
      const local = (simT - starts[i]) / STEP, count = ball.samples.length / 2;
      if (local < 0 || local >= count - 1) return;
      const k = Math.floor(local), mix = local - k;
      const x = ball.samples[k * 2] + (ball.samples[k * 2 + 2] - ball.samples[k * 2]) * mix;
      const y = ball.samples[k * 2 + 1] + (ball.samples[k * 2 + 3] - ball.samples[k * 2 + 1]) * mix;
      ctx.fillStyle = "rgba(0,0,0,.4)";
      ctx.beginPath(); ctx.arc(x + 2, y + 3, PR, 0, TAU); ctx.fill();
      steelBall(ctx, x, y, PR);
    });
    ctx.drawImage(glass, 0, 0, PW, PH);
    drawSparks(ctx, sparks, dt);
  };

  const ended = balls.map(() => false);
  setStatus(stage, "Billes lancées sur le rail…");
  if (!(await frameLoop(duration, signal, p => {
    const t = p * duration / 1000, simT = t * timeScale, dt = Math.min(.05, t - lastT);
    lastT = t;
    while (launched < balls.length && starts[launched] <= simT) {
      handle.style.setProperty("--pull", String(.35 + balls[launched].strength * .65));
      counter.textContent = String(++launched);
    }
    handle.style.setProperty("--wobble", `${(Math.sin(t * 31) * 2).toFixed(2)}deg`);
    balls.forEach((ball, i) => {
      if (ended[i] || simT < starts[i] + ball.samples.length / 2 * STEP) return;
      ended[i] = true;
      if (ball.end === "tulip") { tulipFlash[ball.tulip] = 1; setStatus(stage, "Tulipe ! Mais pas de fever…"); }
      if (ball.end === "chucker") {
        chuckerFlash = 1;
        if (!fx.reduced()) burst(sparks, CHUCKER.x, CHUCKER.y, 30, ["#fff3a8", "#ffd23f", "#ffffff"], 180);
      }
    });
    draw(simT, dt);
  }))) return false;

  // Start chucker hit: the LCD spins three reels that stop one by one.
  setStatus(stage, "START ! Les rouleaux tournent…");
  lcd.classList.add("is-spinning");
  const digits = String(score).padStart(3, "0").split("").map(Number);
  const strips = [...stage.querySelectorAll<HTMLElement>(".pk-strip")];
  const stops = fx.reduced() ? [.15, .2, .25] : [1.1, 1.65, 2.3];
  const travel = stops.map((stop, i) => Math.ceil((stop * 22 - digits[i]) / 10) * 10 + digits[i]);
  const reelTime = stops[2] * 1000 + (fx.reduced() ? 0 : 250);
  const simEnd = simTotal;
  lastT = 0;
  if (!(await frameLoop(reelTime, signal, p => {
    const t = p * reelTime / 1000, dt = Math.min(.05, t - lastT);
    lastT = t;
    strips.forEach((strip, i) => {
      const u = clamp(t / stops[i], 0, 1), pos = travel[i] * easeOut(u);
      strip.style.transform = `translateY(${(-(pos % 10) * 1.2).toFixed(3)}em)`;
      strip.parentElement!.classList.toggle("is-stopped", u >= 1);
    });
    if (lastT > stops[1] && digits[0] === digits[1] && !lcd.classList.contains("is-reach")) {
      lcd.classList.add("is-reach");
      setStatus(stage, "REACH !");
    }
    draw(simEnd + t, dt);
  }))) return false;

  lcd.classList.add("is-fever");
  revealResult(stage, "[data-pk-score]", score);
  setStatus(stage, "FEVER ! Score débloqué");
  if (!fx.reduced()) {
    burst(sparks, LCD.x + LCD.w / 2, LCD.y + LCD.h / 2, 90, CONFETTI, 300, true);
  }
  return afterglow(fx.reduced() ? 60 : 800, signal, dt => draw(simEnd + reelTime / 1000, dt));
};

/* ==========================================================================
   3. PINBALL — tilted table, pop bumpers, powered flippers and a DMD
   ========================================================================== */

const BW = 500, BH = 540;
const BUMPERS: Peg[] = [
  { x: 170, y: 180, r: 30, boost: 110 },
  { x: 330, y: 180, r: 30, boost: 110 },
  { x: 250, y: 270, r: 34, boost: 110 },
];
const BUMPER_COLORS = ["#ff4d6d", "#2fb8ff", "#ffc23d"];
const FLIPPERS = [
  { px: 90, py: 400, tx: 240, ty: 428, up: -1 },
  { px: 410, py: 400, tx: 260, ty: 428, up: 1 },
];
const LETTERS = "EPITA".split("");

const paintPinballTable = (ctx: Ctx) => {
  // Wooden cabinet sides
  const wood = ctx.createLinearGradient(0, 0, BW, 0);
  wood.addColorStop(0, "#2b1709"); wood.addColorStop(.06, "#6b3f1e"); wood.addColorStop(.94, "#6b3f1e"); wood.addColorStop(1, "#2b1709");
  ctx.fillStyle = wood;
  ctx.fillRect(0, 0, BW, BH);
  // Playfield
  ctx.save();
  roundRect(ctx, 30, 30, BW - 60, BH - 30, 60);
  ctx.clip();
  const field = ctx.createLinearGradient(0, 30, 0, BH);
  field.addColorStop(0, "#1b0f3b"); field.addColorStop(.55, "#2d1263"); field.addColorStop(1, "#120826");
  ctx.fillStyle = field;
  ctx.fillRect(0, 0, BW, BH);
  // Art: sunburst and big EPITA lettering
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * TAU;
    ctx.fillStyle = i % 2 ? "rgba(255,255,255,.035)" : "rgba(255,90,200,.05)";
    ctx.beginPath(); ctx.moveTo(250, 230); ctx.arc(250, 230, 600, a, a + TAU / 48); ctx.fill();
  }
  ctx.font = "italic 900 74px ui-rounded, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,.06)";
  ctx.fillText("EPITA", 240, 370);
  ctx.strokeStyle = "rgba(255,120,220,.15)"; ctx.lineWidth = 2;
  ctx.strokeText("EPITA", 240, 370);
  // Lamp inserts (unlit state)
  LETTERS.forEach((_, i) => {
    ctx.fillStyle = "rgba(255,255,255,.08)";
    ctx.beginPath(); ctx.arc(130 + i * 50, 92, 13, 0, TAU); ctx.fill();
  });
  for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
    ctx.fillStyle = "rgba(255,200,80,.1)";
    const x = 250 + side * (70 + i * 26), y = 330 + i * 16;
    ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.lineTo(x + 8 * side, y + 6); ctx.lineTo(x - 8 * side, y + 6); ctx.fill();
  }
  ctx.restore();
  // Chrome rails: funnel guides, launch divider, top arch
  const rail = (ax: number, ay: number, bx: number, by: number, width = 6) => {
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.lineWidth = width + 3;
    ctx.beginPath(); ctx.moveTo(ax + 2, ay + 3); ctx.lineTo(bx + 2, by + 3); ctx.stroke();
    const metal = ctx.createLinearGradient(ax, ay - 4, ax, ay + 4);
    metal.addColorStop(0, "#ffffff"); metal.addColorStop(.5, "#9aa5b1"); metal.addColorStop(1, "#4b5560");
    ctx.strokeStyle = metal; ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  };
  rail(40, 360, 230, 460);
  rail(460, 360, 270, 460);
  rail(432, 120, 432, 460, 5);
  ctx.strokeStyle = "#c9d1da"; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(466, 470); ctx.lineTo(466, 90); ctx.arcTo(466, 36, 400, 36, 56); ctx.lineTo(250, 36); ctx.stroke();
  // Jackpot collector
  const hole = ctx.createRadialGradient(250, 482, 2, 250, 482, 26);
  hole.addColorStop(0, "#000"); hole.addColorStop(.7, "#1a0b2e"); hole.addColorStop(1, "#f2c66d");
  ctx.fillStyle = hole;
  ctx.beginPath(); ctx.arc(250, 482, 24, 0, TAU); ctx.fill();
  ctx.fillStyle = "#f2c66d"; ctx.font = "900 10px ui-rounded, system-ui, sans-serif";
  ctx.fillText("JACKPOT", 250, 520);
  // Plunger housing
  ctx.fillStyle = "#14161a";
  roundRect(ctx, 438, 470, 22, 66, 6); ctx.fill();
};

const paintPinballGlass = (ctx: Ctx) => {
  const glare = ctx.createLinearGradient(0, 0, BW, BH);
  glare.addColorStop(0, "rgba(255,255,255,.12)"); glare.addColorStop(.3, "rgba(255,255,255,0)");
  glare.addColorStop(.62, "rgba(255,255,255,0)"); glare.addColorStop(.66, "rgba(255,255,255,.06)"); glare.addColorStop(.72, "rgba(255,255,255,0)");
  ctx.fillStyle = glare;
  ctx.fillRect(0, 0, BW, BH);
};

const paintBumper = (ctx: Ctx, peg: Peg, color: string, glow: number) => {
  softShadow(ctx, peg.x + 6, peg.y + 10, peg.r * 1.25, peg.r * .8, .55);
  // Skirt
  ctx.fillStyle = tint(color, -.45);
  ellipse(ctx, peg.x, peg.y + 6, peg.r, peg.r * .82); ctx.fill();
  ctx.fillStyle = "#d8dde3";
  ellipse(ctx, peg.x, peg.y + 2, peg.r * .92, peg.r * .74); ctx.fill();
  // Cap
  const cap = ctx.createRadialGradient(peg.x - peg.r * .3, peg.y - peg.r * .45, 2, peg.x, peg.y - 4, peg.r * .8);
  cap.addColorStop(0, tint(color, .75)); cap.addColorStop(.6, color); cap.addColorStop(1, tint(color, -.35));
  ctx.fillStyle = cap;
  ellipse(ctx, peg.x, peg.y - 5, peg.r * .74, peg.r * .58); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.font = `900 ${Math.round(peg.r * .55)}px ui-rounded, system-ui, sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("★", peg.x, peg.y - 5);
  ctx.textBaseline = "alphabetic";
  if (glow > 0) {
    const halo = ctx.createRadialGradient(peg.x, peg.y, peg.r * .4, peg.x, peg.y, peg.r * 1.9);
    halo.addColorStop(0, fade("#ffffff", .7 * glow)); halo.addColorStop(.4, fade(color.startsWith("#") ? color : "#ffffff", .5 * glow));
    halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(peg.x, peg.y, peg.r * 1.9, 0, TAU); ctx.fill();
  }
};

const paintFlipper = (ctx: Ctx, flipper: typeof FLIPPERS[number], lift: number) => {
  const length = Math.hypot(flipper.tx - flipper.px, flipper.ty - flipper.py);
  const rest = Math.atan2(flipper.ty - flipper.py, flipper.tx - flipper.px);
  ctx.save();
  ctx.translate(flipper.px, flipper.py);
  ctx.rotate(rest + flipper.up * lift * .6);
  ctx.fillStyle = "rgba(0,0,0,.45)";
  ctx.beginPath(); ctx.moveTo(3, -9); ctx.lineTo(length + 3, -2); ctx.arc(length + 3, 4, 6, -Math.PI / 2, Math.PI / 2); ctx.lineTo(3, 17); ctx.arc(3, 4, 13, Math.PI / 2, -Math.PI / 2); ctx.fill();
  const body = ctx.createLinearGradient(0, -12, 0, 12);
  body.addColorStop(0, "#ffffff"); body.addColorStop(.5, "#e7e7ee"); body.addColorStop(1, "#9aa0ab");
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(length, -5); ctx.arc(length, 0, 5, -Math.PI / 2, Math.PI / 2); ctx.lineTo(0, 12); ctx.arc(0, 0, 12, Math.PI / 2, -Math.PI / 2); ctx.fill();
  ctx.strokeStyle = "#ff2e7e"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(4, 8); ctx.lineTo(length, 3); ctx.stroke();
  ctx.fillStyle = "#c2c7cf";
  ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill();
  ctx.restore();
};

const makePinballMarkup = () => `<div class="arcade-game ag-pinball">`
  + `<header class="pb-dmd"><small data-impact-caption>BALL 1 · INSERT COIN</small><strong data-live-score>0%</strong><span>EPITA FRENZY</span></header>`
  + `<div class="pb-tilt">${screenMarkup(BW, BH, "pb-screen")}</div>`
  + `<p class="ag-status">Le plongeur se tend…</p></div>`;

const runPinball = async (stage: HTMLElement, score: number, signal: AbortSignal, fx: FxHelpers) => {
  const ctx = mountCanvas(stage, BW, BH);
  const table = paintLayer(BW, BH, paintPinballTable);
  const glass = paintLayer(BW, BH, paintPinballGlass);
  let samples = dropTrajectory(BUMPERS, true);
  let impacts = samples.flatMap((s, frame) => s.hit >= 0 ? [{ frame, target: s.hit, x: s.x, y: s.y }] : []);
  // A positive result is earned by an actual contact, never by a missed table.
  for (let retry = 0; !impacts.length && score > 0 && retry < 30; retry++) {
    samples = dropTrajectory(BUMPERS, true);
    impacts = samples.flatMap((s, frame) => s.hit >= 0 ? [{ frame, target: s.hit, x: s.x, y: s.y }] : []);
  }
  const awards = impactAwards(impacts, score);
  const live = stage.querySelector<HTMLElement>("[data-live-score]")!;
  const caption = stage.querySelector<HTMLElement>("[data-impact-caption]")!;
  const dmd = stage.querySelector<HTMLElement>(".pb-dmd")!;
  const tilt = stage.querySelector<HTMLElement>(".pb-tilt")!;
  const sparks: Spark[] = [], popups: Popup[] = [];
  const bumperGlow = BUMPERS.map(() => 0);
  const flipperAge = [9, 9];
  const trail: { x: number; y: number }[] = [];
  let shake = 0, plunger = 0, awarded = 0, total = 0, lastT = 0, ballR = 10;

  const draw = (x: number, y: number, t: number, dt: number) => {
    ctx.drawImage(table, 0, 0, BW, BH);
    // Lit EPITA letters follow the earned share of the score.
    const lit = score ? Math.round(total / score * LETTERS.length) : Math.min(LETTERS.length, awarded);
    LETTERS.forEach((letter, i) => {
      const on = i < lit || (Math.floor(t * 6) % LETTERS.length === i);
      ctx.fillStyle = on ? "#ffcf4a" : "rgba(255,255,255,.12)";
      ctx.shadowColor = "#ffcf4a"; ctx.shadowBlur = on ? 16 : 0;
      ctx.beginPath(); ctx.arc(130 + i * 50, 92, 13, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = on ? "#3b1c00" : "rgba(255,255,255,.4)";
      ctx.font = "900 13px ui-rounded, system-ui, sans-serif"; ctx.textAlign = "center";
      ctx.fillText(letter, 130 + i * 50, 97);
    });
    for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
      const on = (Math.floor(t * 8) + i) % 3 === 0;
      if (!on) continue;
      const lx = 250 + side * (70 + i * 26), ly = 330 + i * 16;
      ctx.fillStyle = "#ffb43b"; ctx.shadowColor = "#ffb43b"; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.moveTo(lx, ly - 9); ctx.lineTo(lx + 8 * side, ly + 6); ctx.lineTo(lx - 8 * side, ly + 6); ctx.fill();
      ctx.shadowBlur = 0;
    }
    BUMPERS.forEach((peg, i) => {
      paintBumper(ctx, peg, BUMPER_COLORS[i], bumperGlow[i]);
      bumperGlow[i] = Math.max(0, bumperGlow[i] - dt * 5);
    });
    FLIPPERS.forEach((flipper, i) => {
      const age = flipperAge[i];
      paintFlipper(ctx, flipper, age < .18 ? Math.sin(age / .18 * Math.PI) : 0);
      flipperAge[i] += dt;
    });
    // Plunger rod
    ctx.fillStyle = "#c9ced6";
    ctx.fillRect(444, 470 + plunger * 26, 10, 60);
    ctx.fillStyle = "#ff2e7e";
    roundRect(ctx, 440, 466 + plunger * 26, 18, 8, 3); ctx.fill();
    // Ball with motion trail
    trail.forEach((p, i) => {
      ctx.globalAlpha = (i + 1) / trail.length * .22;
      ctx.fillStyle = "#cfe3ff";
      ctx.beginPath(); ctx.arc(p.x, p.y, ballR * .85, 0, TAU); ctx.fill();
    });
    ctx.globalAlpha = 1;
    if (ballR > .5) {
      softShadow(ctx, x + 5, y + 8, ballR * 1.3, ballR * .7, .6);
      steelBall(ctx, x, y, ballR);
    }
    trail.push({ x, y });
    if (trail.length > 6) trail.shift();
    drawSparks(ctx, sparks, dt);
    drawPopups(ctx, popups, dt);
    ctx.drawImage(glass, 0, 0, BW, BH);
  };

  const nudge = () => {
    tilt.style.setProperty("--shake-x", `${(Math.sin(shake * 60) * shake * 4).toFixed(2)}px`);
    tilt.style.setProperty("--shake-y", `${(Math.cos(shake * 47) * shake * 3).toFixed(2)}px`);
  };

  // Plunger pull and release.
  const pull = fx.reduced() ? 120 : 650;
  if (!(await frameLoop(pull, signal, p => {
    const t = p * pull / 1000;
    plunger = p < .8 ? easeOut(p / .8) : 1 - (p - .8) / .2;
    dmd.style.setProperty("--glow", (.5 + .5 * Math.sin(t * 12)).toFixed(2));
    draw(samples[0].x, samples[0].y + plunger * 20, t, Math.min(.05, t - lastT)); lastT = t;
  }))) return false;
  plunger = 0;
  caption.textContent = "BALL 1 · EN JEU";
  setStatus(stage, "Bille lancée !");

  const duration = fx.reduced() ? 450 : clamp(samples.length * STEP * 1000, 3200, 11000);
  let previous = 0;
  lastT = 0;
  if (!(await frameLoop(duration, signal, p => {
    const t = p * duration / 1000, dt = Math.min(.05, t - lastT);
    lastT = t;
    const frame = p * (samples.length - 1), index = Math.floor(frame), mix = frame - index;
    const a = samples[index], b = samples[index + 1] ?? a;
    for (let i = previous; i <= index; i++) {
      const sample = samples[i];
      if (sample.hit >= 0) { bumperGlow[sample.hit] = 1; shake = .35; if (!fx.reduced()) burst(sparks, sample.x, sample.y, 10, ["#ffffff", BUMPER_COLORS[sample.hit]], 160); }
      if (sample.flipper !== undefined) flipperAge[sample.flipper] = 0;
    }
    previous = index + 1;
    while (awarded < awards.length && awards[awarded].frame <= index) {
      const award = awards[awarded++];
      total += award.points;
      live.textContent = `${total}%`;
      live.dataset.total = String(total);
      caption.textContent = award.points ? `BUMPER +${award.points}% · ${awarded} TOUCHES` : `BUMPER · ${awarded} TOUCHES`;
      if (!fx.reduced()) popups.push({ x: award.x, y: award.y - 24, text: award.points ? `+${award.points}%` : "BUMP", life: 0, color: BUMPER_COLORS[award.target] });
    }
    shake = Math.max(0, shake - dt * 1.8);
    nudge();
    dmd.style.setProperty("--glow", (.6 + shake).toFixed(2));
    draw(a.x + (b.x - a.x) * mix, a.y + (b.y - a.y) * mix, t, dt);
  }))) return false;

  const end = samples[samples.length - 1];
  lastT = 0;
  if (!(await frameLoop(fx.reduced() ? 60 : 260, signal, p => {
    ballR = 10 * (1 - p);
    draw(end.x + (250 - end.x) * p, end.y + (482 - end.y) * p, p, .016);
  }))) return false;
  if (total !== score) throw new Error("Impact total differs from recorded score");
  ballR = 0;
  dmd.classList.add("is-jackpot");
  caption.textContent = "JACKPOT · SCORE FINAL";
  revealResult(stage, "[data-live-score]", score);
  setStatus(stage, "Partie terminée · points conservés");
  if (!fx.reduced()) burst(sparks, 250, 470, 80, CONFETTI, 320, true);
  return afterglow(fx.reduced() ? 60 : 700, signal, dt => draw(250, 482, 0, dt));
};

/* ==========================================================================
   4. LUCKY LOTTO — glass drum with air-blown balls and a delivery tube
   ========================================================================== */

const LW = 520, LH = 580;
const LC = { x: 250, y: 240 }, LR = 160, LBR = 17, FOCAL = 650;
const LOTTO_COLORS = ["#ff4d6d", "#2fb8ff", "#2fd38a", "#ffc23d", "#b77bff", "#ff8a3d"];
const CRADLE = { x: 440, y: 498 };

type LottoBall = { x: number; y: number; z: number; vx: number; vy: number; vz: number; label: number; color: string; a1: number; a2: number };

// Delivery tube from the drum's top outlet to the cradle, in screen coordinates.
const TUBE = (() => {
  const pts: { x: number; y: number }[] = [];
  const add = (x: number, y: number) => pts.push({ x, y });
  add(LC.x, LC.y - LR + 4);
  add(LC.x, 48);
  for (let i = 1; i <= 10; i++) { const a = Math.PI + i / 10 * Math.PI / 2; add(LC.x + 40 + Math.cos(a) * 40, 48 + 40 + Math.sin(a) * 40 - 40); }
  add(CRADLE.x + 20, 48);
  for (let i = 1; i <= 8; i++) { const a = -Math.PI / 2 + i / 8 * Math.PI / 2; add(CRADLE.x + 20 + Math.cos(a) * 30 - 0, 78 + Math.sin(a) * 30); }
  add(CRADLE.x + 50, 430);
  for (let i = 1; i <= 8; i++) { const a = i / 8 * Math.PI / 2; add(CRADLE.x + 20 + Math.cos(a) * 30, 430 + Math.sin(a) * 30); }
  add(CRADLE.x, CRADLE.y - 8);
  const lengths = [0];
  for (let i = 1; i < pts.length; i++) lengths.push(lengths[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return { pts, lengths, total: lengths[lengths.length - 1] };
})();

const tubeAt = (distance: number) => {
  const d = clamp(distance, 0, TUBE.total);
  let i = 1;
  while (i < TUBE.lengths.length - 1 && TUBE.lengths[i] < d) i++;
  const span = TUBE.lengths[i] - TUBE.lengths[i - 1] || 1, mix = (d - TUBE.lengths[i - 1]) / span;
  const a = TUBE.pts[i - 1], b = TUBE.pts[i];
  return { x: a.x + (b.x - a.x) * mix, y: a.y + (b.y - a.y) * mix };
};

const strokeTube = (ctx: Ctx, width: number, style: string) => {
  ctx.strokeStyle = style; ctx.lineWidth = width; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath();
  TUBE.pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
  ctx.stroke();
};

const paintLottoBack = (ctx: Ctx) => {
  const curtain = ctx.createLinearGradient(0, 0, 0, LH);
  curtain.addColorStop(0, "#3a0a14"); curtain.addColorStop(1, "#14040a");
  ctx.fillStyle = curtain;
  ctx.fillRect(0, 0, LW, LH);
  for (let x = 0; x < LW; x += 34) {
    const fold = ctx.createLinearGradient(x, 0, x + 34, 0);
    fold.addColorStop(0, "rgba(0,0,0,.28)"); fold.addColorStop(.5, "rgba(255,120,140,.06)"); fold.addColorStop(1, "rgba(0,0,0,.28)");
    ctx.fillStyle = fold;
    ctx.fillRect(x, 0, 34, LH);
  }
  const spot = ctx.createRadialGradient(LC.x, LC.y, 40, LC.x, LC.y, 330);
  spot.addColorStop(0, "rgba(255,230,180,.22)"); spot.addColorStop(1, "rgba(255,230,180,0)");
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, LW, LH);
  // Stage floor
  const floor = ctx.createLinearGradient(0, 500, 0, LH);
  floor.addColorStop(0, "#2a1a12"); floor.addColorStop(1, "#0d0705");
  ctx.fillStyle = floor;
  ctx.fillRect(0, 505, LW, LH - 505);
  softShadow(ctx, LC.x, 520, 150, 22, .6);
  // Pedestal
  const chrome = ctx.createLinearGradient(LC.x - 90, 0, LC.x + 90, 0);
  chrome.addColorStop(0, "#5a616b"); chrome.addColorStop(.3, "#f2f5f8"); chrome.addColorStop(.55, "#9aa3ad"); chrome.addColorStop(.8, "#e6eaee"); chrome.addColorStop(1, "#4b525b");
  ctx.fillStyle = chrome;
  ctx.beginPath();
  ctx.moveTo(LC.x - 46, LC.y + LR - 6); ctx.lineTo(LC.x + 46, LC.y + LR - 6);
  ctx.lineTo(LC.x + 100, 500); ctx.lineTo(LC.x - 100, 500); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#1f1c24";
  roundRect(ctx, LC.x - 112, 494, 224, 24, 8); ctx.fill();
  ctx.fillStyle = "#f2c66d"; ctx.font = "900 13px ui-rounded, system-ui, sans-serif"; ctx.textAlign = "center";
  ctx.fillText("LUCKY LOTTO", LC.x, 470);
  // Inside of the drum
  const inside = ctx.createRadialGradient(LC.x + 30, LC.y + 40, 20, LC.x, LC.y, LR);
  inside.addColorStop(0, "rgba(120,180,255,.10)"); inside.addColorStop(.8, "rgba(20,30,60,.35)"); inside.addColorStop(1, "rgba(200,230,255,.25)");
  ctx.fillStyle = inside;
  ctx.beginPath(); ctx.arc(LC.x, LC.y, LR, 0, TAU); ctx.fill();
  // Air nozzle
  ctx.fillStyle = "#7d8691";
  ellipse(ctx, LC.x, LC.y + LR - 10, 26, 8); ctx.fill();
  strokeTube(ctx, 26, "rgba(255,255,255,.08)");
  // Cradle
  ctx.fillStyle = "#2a2730";
  roundRect(ctx, CRADLE.x - 30, CRADLE.y + 8, 60, 14, 6); ctx.fill();
};

const paintLottoFront = (ctx: Ctx) => {
  const rim = ctx.createLinearGradient(LC.x - LR, LC.y - LR, LC.x + LR, LC.y + LR);
  rim.addColorStop(0, "rgba(255,255,255,.75)"); rim.addColorStop(.5, "rgba(255,255,255,.15)"); rim.addColorStop(1, "rgba(255,255,255,.55)");
  ctx.strokeStyle = rim; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(LC.x, LC.y, LR, 0, TAU); ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,.18)";
  ellipse(ctx, LC.x - 70, LC.y - 84, 52, 24, -.7); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.08)";
  ellipse(ctx, LC.x + 92, LC.y + 70, 22, 60, -.5); ctx.fill();
  // Equator ring
  ctx.strokeStyle = "rgba(242,198,109,.65)"; ctx.lineWidth = 4;
  ellipse(ctx, LC.x, LC.y, LR, 16); ctx.stroke();
  // Outlet collar
  ctx.fillStyle = "#c9ced6";
  roundRect(ctx, LC.x - 22, LC.y - LR - 10, 44, 16, 5); ctx.fill();
  strokeTube(ctx, 26, "rgba(220,240,255,.16)");
  strokeTube(ctx, 2, "rgba(255,255,255,.4)");
  // Cradle lip
  const cup = ctx.createLinearGradient(CRADLE.x - 26, 0, CRADLE.x + 26, 0);
  cup.addColorStop(0, "#6b727c"); cup.addColorStop(.5, "#f1f4f7"); cup.addColorStop(1, "#6b727c");
  ctx.fillStyle = cup;
  ctx.beginPath(); ctx.moveTo(CRADLE.x - 26, CRADLE.y + 2); ctx.quadraticCurveTo(CRADLE.x, CRADLE.y + 24, CRADLE.x + 26, CRADLE.y + 2);
  ctx.lineTo(CRADLE.x + 22, CRADLE.y + 12); ctx.lineTo(CRADLE.x - 22, CRADLE.y + 12); ctx.fill();
};

const paintLottoBall = (ctx: Ctx, x: number, y: number, r: number, ball: LottoBall, light = 1) => {
  const body = ctx.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r);
  body.addColorStop(0, tint(ball.color, .65 * light)); body.addColorStop(.55, light < 1 ? tint(ball.color, -(1 - light) * .6) : ball.color); body.addColorStop(1, tint(ball.color, -.55));
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  const facing = Math.cos(ball.a1) * Math.cos(ball.a2);
  if (facing > .1) {
    const ox = Math.sin(ball.a1) * r * .42, oy = Math.sin(ball.a2) * r * .42;
    ctx.fillStyle = `rgba(255,255,255,${.95 * light})`;
    ellipse(ctx, x + ox, y + oy, r * .52 * Math.abs(Math.cos(ball.a1)), r * .52 * Math.abs(Math.cos(ball.a2))); ctx.fill();
    if (facing > .45) {
      ctx.fillStyle = "#1a1a1a";
      ctx.font = `900 ${Math.round(r * .62)}px ui-rounded, system-ui, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(String(ball.label), x + ox, y + oy + 1);
      ctx.textBaseline = "alphabetic";
    }
  }
  ctx.fillStyle = "rgba(255,255,255,.8)";
  ellipse(ctx, x - r * .38, y - r * .45, r * .22, r * .13, -.6); ctx.fill();
};

const makeLottoMarkup = () => `<div class="arcade-game ag-lotto">`
  + `<header class="ag-hud"><div><span>LUCKY LOTTO</span><strong>Tirage en direct</strong></div><div class="lt-gauge" aria-hidden="true"><i></i><small>AIR</small></div></header>`
  + screenMarkup(LW, LH, "lt-screen", `<div class="lt-winner"><strong data-lt-score></strong></div>`)
  + `<p class="ag-status">Les boules attendent le souffle…</p></div>`;

const runLotto = async (stage: HTMLElement, score: number, signal: AbortSignal, fx: FxHelpers) => {
  const ctx = mountCanvas(stage, LW, LH);
  const back = paintLayer(LW, LH, paintLottoBack);
  const front = paintLayer(LW, LH, paintLottoFront);
  const needle = stage.querySelector<HTMLElement>(".lt-gauge i")!;
  const labels = new Set<number>([score]);
  while (labels.size < 24) labels.add(Math.floor(Math.random() * 101));
  const balls: LottoBall[] = [...labels].map((label, i) => {
    const a = rand(0, TAU), d = rand(0, LR * .5);
    return {
      x: Math.cos(a) * d, y: LR - LBR - rand(0, 60), z: Math.sin(a) * d,
      vx: 0, vy: 0, vz: 0, label, color: LOTTO_COLORS[i % LOTTO_COLORS.length], a1: rand(-1, 1), a2: rand(-1, 1),
    };
  });
  const chosen = balls[0];
  const sparks: Spark[] = [];
  let jet = 0, extracting = false, inTube = -1, settled = false;

  const physics = (dt: number) => {
    for (const b of balls) {
      if (b === chosen && (extracting || inTube >= 0)) continue;
      b.vy += 1100 * dt;
      if (jet > 0 && b.y > LR * .25 && Math.hypot(b.x, b.z) < LR * .6) {
        b.vy -= jet * rand(.6, 1.4) * dt;
        b.vx += rand(-1, 1) * 1100 * jet / 3000 * dt;
        b.vz += rand(-1, 1) * 1100 * jet / 3000 * dt;
      }
      const damp = 1 - .5 * dt;
      b.vx *= damp; b.vy *= damp; b.vz *= damp;
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      const d = Math.hypot(b.x, b.y, b.z);
      if (d > LR - LBR) {
        const nx = b.x / d, ny = b.y / d, nz = b.z / d, k = (LR - LBR) / d;
        b.x *= k; b.y *= k; b.z *= k;
        const vn = b.vx * nx + b.vy * ny + b.vz * nz;
        if (vn > 0) { b.vx -= 1.75 * vn * nx; b.vy -= 1.75 * vn * ny; b.vz -= 1.75 * vn * nz; }
      }
      const speed = Math.hypot(b.vx, b.vy, b.vz);
      b.a1 += b.vx / LBR * dt * .7; b.a2 += b.vy / LBR * dt * .7;
      if (speed < 4) { b.a1 *= .99; b.a2 *= .99; }
    }
    for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i], b = balls[j];
      if ((a === chosen || b === chosen) && inTube >= 0) continue;
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.hypot(dx, dy, dz);
      if (d >= LBR * 2 || d < .001) continue;
      const nx = dx / d, ny = dy / d, nz = dz / d, push = (LBR * 2 - d) / 2;
      const pinned = a === chosen && extracting ? 0 : 1, pinnedB = b === chosen && extracting ? 0 : 1;
      a.x -= nx * push * pinned; a.y -= ny * push * pinned; a.z -= nz * push * pinned;
      b.x += nx * push * pinnedB; b.y += ny * push * pinnedB; b.z += nz * push * pinnedB;
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny + (b.vz - a.vz) * nz;
      if (rel < 0) {
        const impulse = -.92 * rel;
        a.vx -= impulse * nx * pinned; a.vy -= impulse * ny * pinned; a.vz -= impulse * nz * pinned;
        b.vx += impulse * nx * pinnedB; b.vy += impulse * ny * pinnedB; b.vz += impulse * nz * pinnedB;
      }
    }
  };

  const draw = (t: number, dt: number) => {
    ctx.drawImage(back, 0, 0, LW, LH);
    // Chrome bulbs chase around the pedestal
    for (let i = 0; i < 9; i++) {
      const on = (Math.floor(t * 9) + i) % 3 === 0 || settled;
      const x = LC.x - 96 + i * 24, y = 506;
      ctx.fillStyle = on ? "#ffe9a3" : "#5b4a2a";
      ctx.shadowColor = "#ffd36b"; ctx.shadowBlur = on ? 12 : 0;
      ctx.beginPath(); ctx.arc(x, y, 4.5, 0, TAU); ctx.fill();
    }
    ctx.shadowBlur = 0;
    const inside = balls.filter(b => !(b === chosen && inTube >= 0));
    inside.sort((a, b) => b.z - a.z);
    for (const b of inside) {
      const s = FOCAL / (FOCAL + b.z);
      paintLottoBall(ctx, LC.x + b.x * s, LC.y + b.y * s, LBR * s, b, clamp(.6 + (1 - b.z / LR) * .25, .45, 1));
    }
    if (inTube >= 0) {
      const p = tubeAt(inTube);
      paintLottoBall(ctx, p.x, p.y, LBR * .82, chosen);
    }
    ctx.drawImage(front, 0, 0, LW, LH);
    drawSparks(ctx, sparks, dt);
  };

  const gauge = (pressure: number, t: number) => {
    needle.style.transform = `rotate(${(-120 + pressure * 240 + Math.sin(t * 40) * pressure * 6).toFixed(2)}deg)`;
  };

  const loop = (duration: number, onStep: (t: number, dt: number) => void) => {
    let last = 0, acc = 0;
    return frameLoop(duration, signal, p => {
      const t = p * duration / 1000, dt = Math.min(.05, t - last);
      last = t; acc += dt;
      while (acc >= STEP) { physics(STEP); acc -= STEP; }
      onStep(t, dt);
      draw(t, dt);
    });
  };

  // 1. Mixing: the blower ramps up and the balls churn.
  const mix = fx.reduced() ? 400 : 4200;
  setStatus(stage, "Soufflerie en marche · mélange des boules");
  if (!(await loop(mix, t => {
    const pressure = clamp(t / (mix / 1000) * 3, 0, 1);
    jet = 3100 * pressure;
    gauge(pressure, t);
  }))) return false;

  // 2. Extraction: the outlet suction pulls the chosen ball to the top.
  extracting = true;
  setStatus(stage, "Aspiration d'une boule…");
  const target = { x: 0, y: -LR + LBR + 2, z: 0 };
  const suck = fx.reduced() ? 300 : 1300;
  if (!(await loop(suck, (t, dt) => {
    const k = clamp(t / (suck / 1000), 0, 1), pull = 3 + k * 14;
    chosen.x += (target.x - chosen.x) * Math.min(1, pull * dt);
    chosen.y += (target.y - chosen.y) * Math.min(1, pull * dt);
    chosen.z += (target.z - chosen.z) * Math.min(1, pull * dt);
    if (k >= 1) { chosen.x = target.x; chosen.y = target.y; chosen.z = target.z; }
    chosen.a1 += dt * 9; chosen.a2 += dt * 6;
    jet = 3100 * (1 - k * .5);
    gauge(1 - k * .5, t);
  }))) return false;

  // 3. Tube delivery under gravity, then the ball settles in the cradle.
  inTube = 0;
  chosen.a1 = 0; chosen.a2 = 0;
  setStatus(stage, "La boule descend le tube…");
  const ride = fx.reduced() ? 300 : 1500;
  if (!(await loop(ride, (t, dt) => {
    const k = clamp(t / (ride / 1000), 0, 1);
    inTube = TUBE.total * (k < .35 ? k * k / .35 * .45 : .1575 + (k - .35) / .65 * .8425);
    chosen.a1 = Math.sin(t * 6) * .5;
    jet = Math.max(0, jet - 4000 * dt);
    gauge(jet / 3100, t);
  }))) return false;

  settled = true;
  const winner = stage.querySelector<HTMLElement>(".lt-winner")!;
  winner.style.setProperty("--c", chosen.color);
  revealResult(stage, "[data-lt-score]", score);
  winner.classList.add("is-shown");
  setStatus(stage, "Boule gagnante tirée !");
  if (!fx.reduced()) burst(sparks, CRADLE.x, CRADLE.y - 30, 80, CONFETTI, 300, true);
  return afterglow(fx.reduced() ? 60 : 800, signal, dt => draw(10, dt));
};

/* ==========================================================================
   REGISTRY
   ========================================================================== */

export const isArcadeGame = (game: string): game is ArcadeGameId =>
  game === "marbles" || game === "pachinko" || game === "pinball" || game === "lotto";

export const getArcadeGameMarkup = (game: ArcadeGameId) => {
  switch (game) {
    case "marbles": return makeMarblesMarkup();
    case "pachinko": return makePachinkoMarkup();
    case "pinball": return makePinballMarkup();
    case "lotto": return makeLottoMarkup();
  }
};

export const runArcadeGame = (game: ArcadeGameId, stage: HTMLElement, score: number, signal: AbortSignal, fx: FxHelpers) => {
  switch (game) {
    case "marbles": return runMarbles(stage, score, signal, fx);
    case "pachinko": return runPachinko(stage, score, signal, fx);
    case "pinball": return runPinball(stage, score, signal, fx);
    case "lotto": return runLotto(stage, score, signal, fx);
  }
};

export const arcadeGameStyles = `
  .game-panel[data-game="marbles"] { --accent: #2fb8ff; --active-line: rgb(47 184 255 / 45%); }
  .game-panel[data-game="pachinko"] { --accent: #ff5fa2; --active-line: rgb(255 95 162 / 45%); }
  .game-panel[data-game="pinball"] { --accent: #ffb43b; --active-line: rgb(255 180 59 / 45%); }
  .game-panel[data-game="lotto"] { --accent: #f2c66d; --active-line: rgb(242 198 109 / 45%); }
  .game-panel:has(.arcade-game) .game-stage { padding: 56px 14px 20px; }

  .arcade-game { position: relative; z-index: 1; display: grid; justify-items: center; gap: 10px; width: min(94vw, 900px); }
  .ag-hud { display: flex; justify-content: space-between; align-items: center; gap: 14px; width: min(100%, 720px); padding: 9px 16px; border-radius: 16px; background: linear-gradient(180deg, rgb(255 255 255 / 7%), rgb(255 255 255 / 2%)); border: 1px solid rgb(255 255 255 / 12%); box-shadow: 0 8px 24px rgb(0 0 0 / 35%); }
  .ag-hud > div:first-child { display: grid; gap: 1px; }
  .ag-hud span { color: var(--accent); font-size: 11px; font-weight: 900; letter-spacing: .18em; }
  .ag-hud strong { color: var(--paper, #f3eedf); font-size: 15px; font-weight: 850; }
  .ag-screen { position: relative; width: min(100%, calc(var(--ag-ar) * min(64dvh, 620px))); aspect-ratio: var(--ag-ar); border-radius: 18px; overflow: hidden; background: #050505; box-shadow: 0 0 0 1px rgb(255 255 255 / 10%), 0 22px 60px rgb(0 0 0 / 60%), 0 0 60px color-mix(in srgb, var(--accent) 18%, transparent); }
  .ag-screen canvas { display: block; width: 100%; height: 100%; }
  .ag-status { margin: 0; min-height: 1.3em; color: var(--muted, #b9b29f); font-size: 13px; font-weight: 800; letter-spacing: .06em; text-align: center; text-transform: uppercase; }

  /* Marbles */
  .mr-layout { display: flex; align-items: flex-start; justify-content: center; gap: 12px; width: 100%; }
  .mr-screen { flex: 1 1 auto; width: min(100%, calc(var(--ag-ar) * min(60dvh, 560px))); }
  .mr-progress { position: relative; width: 180px; height: 8px; border-radius: 99px; background: rgb(255 255 255 / 10%); overflow: hidden; }
  .mr-progress i { position: absolute; inset: 0 auto 0 0; width: 0; border-radius: inherit; background: linear-gradient(90deg, var(--accent), #fff); }
  .mr-board { position: relative; flex: 0 0 214px; height: 152px; margin: 0; padding: 0; list-style: none; }
  .mr-row { position: absolute; inset: 0 0 auto; display: flex; align-items: center; gap: 8px; height: 34px; margin-bottom: 4px; padding: 0 10px; border-radius: 10px; background: rgb(255 255 255 / 6%); border: 1px solid rgb(255 255 255 / 8%); color: var(--paper, #f3eedf); font-size: 12px; transition: transform 260ms cubic-bezier(.2,.8,.2,1), background 200ms; }
  .mr-row i { width: 14px; height: 14px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fff 0 12%, var(--c) 40%, color-mix(in srgb, var(--c) 45%, #000) 100%); box-shadow: 0 0 8px var(--c); }
  .mr-row b { flex: 1; font-weight: 850; }
  .mr-row { cursor: pointer; }
  .mr-row em { min-width: 40px; padding: 2px 6px; border-radius: 99px; background: rgb(0 0 0 / 35%); box-shadow: inset 0 0 0 1px var(--c, rgb(255 255 255 / 20%)); font-style: normal; font-weight: 950; text-align: center; font-variant-numeric: tabular-nums; }
  .mr-row.is-picked { box-shadow: 0 0 0 2px #ffe7a3; }
  .mr-row.is-picked b::after { content: " ★"; color: #ffe7a3; }
  .mr-row.is-out { opacity: .45; }
  .mr-row span { white-space: nowrap; color: var(--muted, #b9b29f); font-variant-numeric: tabular-nums; font-weight: 800; }
  .mr-row.is-leading { background: color-mix(in srgb, var(--accent) 22%, transparent); border-color: color-mix(in srgb, var(--accent) 55%, transparent); }
  .mr-plate { position: absolute; right: 4%; bottom: 6%; display: grid; justify-items: center; gap: 2px; padding: 10px 18px 12px; border-radius: 14px; background: linear-gradient(180deg, #ffe7a3, #c8902f); color: #2b1a00; box-shadow: 0 12px 30px rgb(0 0 0 / 55%), 0 0 0 3px #7a5212, 0 0 40px var(--c, #f2c66d); opacity: 0; transform: translateY(20px) scale(.8); transition: opacity 300ms, transform 420ms cubic-bezier(.2,1.4,.4,1); }
  .mr-plate small { font-size: 10px; font-weight: 900; letter-spacing: .2em; text-transform: uppercase; }
  .mr-plate b { font-size: 14px; }
  .mr-plate strong { font-size: clamp(28px, 6vw, 44px); font-weight: 950; line-height: 1; }
  .mr-plate.is-shown { opacity: 1; transform: none; }

  /* Pachinko */
  .ag-pachinko .ag-hud { width: min(100%, 460px); }
  .pk-screen { width: min(100%, calc(var(--ag-ar) * min(66dvh, 640px))); }
  .pk-counter { display: grid; justify-items: end; }
  .pk-counter small { color: var(--muted, #b9b29f); font-size: 10px; font-weight: 900; letter-spacing: .16em; }
  .pk-counter b { color: var(--paper, #f3eedf); font-size: 18px; font-variant-numeric: tabular-nums; }
  .pk-lcd { position: absolute; left: calc(140 / 420 * 100%); top: calc(160 / 600 * 100%); width: calc(140 / 420 * 100%); height: calc(140 / 600 * 100%); display: grid; place-items: center; border-radius: 6%; overflow: hidden; background: radial-gradient(circle at 50% 40%, #2a1060, #07031a 75%); font-size: clamp(14px, 3.4vw, 30px); }
  .pk-attract { display: grid; justify-items: center; color: #ffd7f0; font-size: .55em; font-weight: 950; letter-spacing: .08em; text-shadow: 0 0 10px #ff5fa2; animation: pk-attract 1.2s ease-in-out infinite alternate; }
  .pk-attract small { color: #ffe066; font-size: .8em; letter-spacing: .3em; }
  @keyframes pk-attract { from { transform: scale(.94); opacity: .7; } to { transform: scale(1.04); opacity: 1; } }
  .pk-reels { position: absolute; inset: 22% 8%; display: none; grid-template-columns: repeat(3, 1fr); gap: 6%; }
  .pk-reel { position: relative; height: 1.2em; align-self: center; overflow: hidden; border-radius: 8px; background: linear-gradient(#fff, #e6e0ff 50%, #fff); box-shadow: inset 0 4px 6px rgb(0 0 0 / 35%), inset 0 -4px 6px rgb(0 0 0 / 35%); }
  .pk-strip { position: absolute; inset: 0 0 auto; display: grid; }
  .pk-strip b { display: grid; place-items: center; height: 1.2em; color: #c1121f; font-weight: 950; line-height: 1; }
  .pk-reel.is-stopped { box-shadow: inset 0 4px 6px rgb(0 0 0 / 35%), 0 0 12px #ffe066; }
  .pk-lcd.is-spinning .pk-attract { display: none; }
  .pk-lcd.is-spinning .pk-reels { display: grid; }
  .pk-lcd.is-reach { animation: pk-reach 300ms steps(2) infinite; }
  @keyframes pk-reach { 50% { box-shadow: inset 0 0 0 4px #ff2e7e; } }
  .pk-score { position: absolute; inset: auto 0 6%; color: #fff; font-size: .9em; font-weight: 950; text-align: center; text-shadow: 0 0 12px #ff5fa2, 0 2px 0 #7b2cbf; opacity: 0; transform: scale(.5); transition: opacity 250ms, transform 420ms cubic-bezier(.2,1.5,.4,1); }
  .pk-lcd.is-fever { animation: none; box-shadow: inset 0 0 0 3px #ffe066, 0 0 30px #ff5fa2; }
  .pk-lcd.is-fever .pk-score { opacity: 1; transform: none; }
  .pk-lcd.is-fever .pk-reels { inset: 10% 8% 40%; }
  .pk-handle { position: absolute; right: 3%; bottom: 1.5%; width: 13%; aspect-ratio: 1; border-radius: 50%; background: radial-gradient(circle at 40% 35%, #f6f7f9, #8a929c 60%, #3c424a); box-shadow: 0 6px 14px rgb(0 0 0 / 55%); transform: rotate(calc(-30deg - var(--pull, 0) * 70deg + var(--wobble, 0deg))); transition: transform 120ms; }
  .pk-handle i { position: absolute; left: 44%; top: -18%; width: 12%; height: 60%; border-radius: 99px; background: linear-gradient(90deg, #c1121f, #ff5f6d); }

  /* Pinball */
  .pb-dmd { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; width: min(100%, 520px); padding: 10px 16px; border-radius: 12px; background-color: #170a02; background-image: radial-gradient(rgb(255 140 30 / 14%) 1px, transparent 1.4px); background-size: 4px 4px; border: 3px solid #2e2e33; box-shadow: inset 0 0 18px rgb(0 0 0 / 80%), 0 0 calc(var(--glow, .6) * 26px) rgb(255 140 30 / 45%); color: #ff9a2e; font-family: ui-monospace, "SF Mono", Menlo, monospace; text-shadow: 0 0 6px rgb(255 140 30 / 80%); }
  .pb-dmd small, .pb-dmd span { font-size: 10px; font-weight: 800; letter-spacing: .1em; }
  .pb-dmd span { text-align: right; }
  .pb-dmd strong { font-size: clamp(26px, 5vw, 38px); font-weight: 900; letter-spacing: .06em; font-variant-numeric: tabular-nums; }
  .pb-dmd.is-jackpot { animation: pb-flash 240ms steps(2) 5; color: #ffd36b; }
  @keyframes pb-flash { 50% { color: #fff; text-shadow: 0 0 16px #fff; } }
  .pb-tilt { display: grid; justify-items: center; width: 100%; perspective: 1100px; transform: translate(var(--shake-x, 0), var(--shake-y, 0)); }
  .pb-screen { width: min(100%, calc(var(--ag-ar) * min(60dvh, 600px))); transform: rotateX(14deg); transform-origin: 50% 100%; border-radius: 26px 26px 14px 14px; }

  /* Lotto */
  .lt-screen { width: min(100%, calc(var(--ag-ar) * min(64dvh, 620px))); }
  .lt-gauge { position: relative; width: 46px; height: 46px; border-radius: 50%; background: radial-gradient(circle, #20242a 55%, #8d96a2 57%, #e7ebf0 70%, #555c66 100%); }
  .lt-gauge::before { content: ""; position: absolute; inset: 7px; border-radius: 50%; background: conic-gradient(from 240deg, #2fd38a 0 30%, #ffc23d 0 55%, #ff4d6d 0 66.6%, transparent 0); mask: radial-gradient(circle, transparent 62%, #000 64%); }
  .lt-gauge i { position: absolute; left: calc(50% - 1.5px); top: 8px; width: 3px; height: 15px; border-radius: 3px; background: #ff4d6d; transform-origin: 50% 100%; transform: rotate(-120deg); }
  .lt-gauge small { position: absolute; inset: auto 0 6px; color: #cfd5dc; font-size: 7px; font-weight: 900; text-align: center; }
  .lt-winner { position: absolute; left: calc(440 / 520 * 100%); top: calc(380 / 580 * 100%); display: grid; place-items: center; width: 26%; aspect-ratio: 1; border-radius: 50%; background: radial-gradient(circle at 35% 28%, #fff 0 8%, color-mix(in srgb, var(--c, #f2c66d) 70%, #fff) 20%, var(--c, #f2c66d) 55%, color-mix(in srgb, var(--c, #f2c66d) 45%, #000) 100%); box-shadow: 0 16px 34px rgb(0 0 0 / 55%), 0 0 50px var(--c, #f2c66d); transform: translate(-50%, -50%) scale(.2); opacity: 0; transition: transform 520ms cubic-bezier(.2,1.5,.4,1), opacity 200ms; }
  .lt-winner strong { display: grid; place-items: center; width: 68%; aspect-ratio: 1; border-radius: 50%; background: #fff; color: #161616; font-size: clamp(18px, 4.6vw, 34px); font-weight: 950; box-shadow: inset 0 -4px 8px rgb(0 0 0 / 20%); }
  .lt-winner.is-shown { opacity: 1; transform: translate(-50%, -50%) scale(1); }

  @media (max-width: 640px) {
    .mr-layout { flex-direction: column; align-items: center; }
    .mr-board { flex-basis: auto; width: min(100%, 320px); }
    .mr-progress { width: 110px; }
    .ag-status { font-size: 11px; letter-spacing: .02em; }
  }
  @media (prefers-reduced-motion: reduce) {
    .mr-row, .mr-plate, .pk-score, .lt-winner, .pk-handle { transition: none; }
    .pk-attract, .pk-lcd.is-reach, .pb-dmd.is-jackpot { animation: none; }
  }
`;
