import { impactAwards, scoreReadout, showImpact } from "./scoring";
import { frameLoop } from "./timing";
import { advance, reflect, dropTrajectory, STEP, type Body, type Peg } from "./physics";

export type FxHelpers = {
  animate: (element: Element, frames: Keyframe[], options: KeyframeAnimationOptions, signal: AbortSignal) => Promise<boolean>;
  wait: (milliseconds: number, signal: AbortSignal) => Promise<boolean>;
  reduced: () => boolean;
};

export type ExtraGameId =
  | "marbles"
  | "pachinko"
  | "derby"
  | "crash"
  | "pinball"
  | "lotto"
  | "cups";

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));


const reveal = (stage: HTMLElement, selector: string, score: number) => {
  const result = stage.querySelector(selector);
  if (!result) throw new Error("Missing game result: " + selector);
  result.textContent = score + "%";
  result.setAttribute("data-result", String(score));
  stage.dataset.phase = "result";
  const svg = result.closest("svg");
  if (svg && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const box = result.getBoundingClientRect(), matrix = svg.getScreenCTM();
    if (matrix) {
      const origin = new DOMPoint(box.x + box.width / 2, box.y + box.height / 2).matrixTransform(matrix.inverse());
      const burst = document.createElementNS("http://www.w3.org/2000/svg", "g");
      burst.setAttribute("aria-hidden", "true");
      burst.setAttribute("transform", `translate(${origin.x} ${origin.y})`);
      for (let i = 0; i < 14; i++) {
        const spark = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        const angle = i * Math.PI * 2 / 14;
        spark.setAttribute("r", String(rand(1.5, 3)));
        spark.setAttribute("class", "result-spark");
        spark.style.setProperty("--dx", `${Math.cos(angle) * rand(35, 65)}px`);
        spark.style.setProperty("--dy", `${Math.sin(angle) * rand(35, 65)}px`);
        burst.append(spark);
      }
      svg.append(burst);
    }
  }
};


/* ==========================================================================
   1. MARBLE RUN (Circuit de billes 3D physique avec aiguillages & entonnoir)
   ========================================================================== */

const marbleDefs = [
  { name: "Neon Cyan", c: "#00f0ff", fill: "url(#grad-cyan)" },
  { name: "Gold Fire", c: "#ffd700", fill: "url(#grad-gold)" },
  { name: "Ruby Red", c: "#ff3366", fill: "url(#grad-ruby)" },
  { name: "Purple Star", c: "#b366ff", fill: "url(#grad-purple)" },
];

const makeMarblesMarkup = (score: number) => {
  return '<div class="marble-run-game">'
    + '<div class="mr-hud">'
    + '  <div class="mr-hud-title"><span>MARBLE CUP</span><strong>CHAMPIONSHIP</strong></div>'
    + '  <div class="mr-leaderboard">'
    + '    <div class="mr-rank is-1" data-rank="1"><span class="mr-dot" style="background:#ffd700"></span><span class="mr-name">Gold</span></div>'
    + '    <div class="mr-rank is-2" data-rank="2"><span class="mr-dot" style="background:#00f0ff"></span><span class="mr-name">Cyan</span></div>'
    + '    <div class="mr-rank is-3" data-rank="3"><span class="mr-dot" style="background:#ff3366"></span><span class="mr-name">Ruby</span></div>'
    + '    <div class="mr-rank is-4" data-rank="4"><span class="mr-dot" style="background:#b366ff"></span><span class="mr-name">Purple</span></div>'
    + '  </div>'
    + '</div>'
    + '<svg class="mr-stage-svg" viewBox="0 0 700 520">'
    + '  <defs>'
    + '    <radialGradient id="grad-cyan" cx="35%" cy="30%"><stop offset="0%" stop-color="#ffffff"/><stop offset="30%" stop-color="#70f3ff"/><stop offset="100%" stop-color="#008ba3"/></radialGradient>'
    + '    <radialGradient id="grad-gold" cx="35%" cy="30%"><stop offset="0%" stop-color="#ffffff"/><stop offset="30%" stop-color="#ffe259"/><stop offset="100%" stop-color="#d48806"/></radialGradient>'
    + '    <radialGradient id="grad-ruby" cx="35%" cy="30%"><stop offset="0%" stop-color="#ffffff"/><stop offset="30%" stop-color="#ff6b8b"/><stop offset="100%" stop-color="#b8002b"/></radialGradient>'
    + '    <radialGradient id="grad-purple" cx="35%" cy="30%"><stop offset="0%" stop-color="#ffffff"/><stop offset="30%" stop-color="#d896ff"/><stop offset="100%" stop-color="#6610f2"/></radialGradient>'
    + '    <linearGradient id="rail-track" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#1e3227"/><stop offset="50%" stop-color="#345844"/><stop offset="100%" stop-color="#14241b"/></linearGradient>'
    + '    <filter id="mr-glow"><feGaussianBlur stdDeviation="6" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
    + '  </defs>'
    + '  <rect x="15" y="15" width="670" height="490" rx="28" class="mr-frame-bg"/>'
    + '  <!-- Track Rails (outer shadow & pipe) -->'
    + '  <path class="mr-pipe-shadow" d="M 80,60 C 350,60 580,70 600,120 C 620,180 120,150 100,210 C 80,270 580,240 600,300 C 620,360 220,340 180,390 C 140,440 280,450 350,455"/>'
    + '  <path class="mr-pipe-body" d="M 80,60 C 350,60 580,70 600,120 C 620,180 120,150 100,210 C 80,270 580,240 600,300 C 620,360 220,340 180,390 C 140,440 280,450 350,455"/>'
    + '  <path class="mr-pipe-core" id="mr-main-path" d="M 80,60 C 350,60 580,70 600,120 C 620,180 120,150 100,210 C 80,270 580,240 600,300 C 620,360 220,340 180,390 C 140,440 280,450 350,455"/>'
    + '  <!-- Finish Pod / Cup -->'
    + '  <g class="mr-finish-pod" transform="translate(350 455)" filter="url(#mr-glow)">'
    + '    <circle r="42" class="mr-pod-base"/>'
    + '    <circle r="34" class="mr-pod-inner"/>'
    + '    <text y="7" text-anchor="middle" class="mr-pod-score" data-mr-score>' + '—</text>'
    + '  </g>'
    + '  <!-- 4 Marble Elements directly in SVG -->'
    + '  <g class="mr-marble" data-marble="0" transform="translate(80 39)"><circle r="6" fill="url(#grad-cyan)" stroke="#ffffff" stroke-width="2"/><circle cx="-2" cy="-2" r="1.5" fill="#ffffff" opacity="0.8"/></g>'
    + '  <g class="mr-marble" data-marble="1" transform="translate(80 53)"><circle r="6" fill="url(#grad-gold)" stroke="#ffffff" stroke-width="2"/><circle cx="-2" cy="-2" r="1.5" fill="#ffffff" opacity="0.8"/></g>'
    + '  <g class="mr-marble" data-marble="2" transform="translate(80 67)"><circle r="6" fill="url(#grad-ruby)" stroke="#ffffff" stroke-width="2"/><circle cx="-2" cy="-2" r="1.5" fill="#ffffff" opacity="0.8"/></g>'
    + '  <g class="mr-marble" data-marble="3" transform="translate(80 81)"><circle r="6" fill="url(#grad-purple)" stroke="#ffffff" stroke-width="2"/><circle cx="-2" cy="-2" r="1.5" fill="#ffffff" opacity="0.8"/></g>'
    + '</svg>'
    + '<p class="mr-status-banner">Course en cours…</p>'
    + '</div>';
};

const runMarbles = async (stage: HTMLElement, score: number, signal: AbortSignal, fx: FxHelpers) => {
  const path = stage.querySelector<SVGPathElement>("#mr-main-path")!;
  const marbles = [...stage.querySelectorAll<SVGGElement>(".mr-marble")];
  const pod = stage.querySelector<SVGGElement>(".mr-finish-pod")!;
  const banner = stage.querySelector<HTMLElement>(".mr-status-banner")!;
  const ranks = [...stage.querySelectorAll<HTMLElement>(".mr-rank")];
  const length = path.getTotalLength();
  // Gravity projected on the track tangent, rolling resistance and initial gate velocity.
  const racers = marbles.map((_, i) => ({ distance: 0, speed: rand(115, 155), drag: rand(.065, .11), lane: (i - 1.5) * 14 }));
  const snapshots: number[][] = [racers.map(r => r.distance)];
  let winner = -1;
  for (let tick = 0; tick < 3600 && winner < 0; tick++) {
    racers.forEach((r, i) => {
      const a = path.getPointAtLength(r.distance), b = path.getPointAtLength(Math.min(length, r.distance + 2));
      const slope = (b.y - a.y) / Math.max(.01, Math.hypot(b.x - a.x, b.y - a.y));
      r.speed = Math.max(35, r.speed + (280 * slope - r.drag * r.speed) * STEP);
      r.distance = Math.min(length, r.distance + r.speed * STEP);
      if (r.distance >= length && winner < 0) winner = i;
    });
    snapshots.push(racers.map(r => r.distance));
  }
  if (winner < 0) throw new Error("Marble track did not finish");
  const raced = await frameLoop(fx.reduced() ? 450 : clamp(snapshots.length * STEP * 1000 * 0.75, 3600, 4800), signal, progress => {
    const frame = progress * (snapshots.length - 1), index = Math.floor(frame), mix = frame - index;
    const distances = snapshots[index].map((d, i) => d + ((snapshots[index + 1]?.[i] ?? d) - d) * mix);
    distances.forEach((distance, i) => {
      const p = path.getPointAtLength(distance), before = path.getPointAtLength(Math.max(0, distance - 2)), after = path.getPointAtLength(Math.min(length, distance + 2));
      const dx = after.x - before.x, dy = after.y - before.y, norm = Math.hypot(dx, dy) || 1;
      const lane = racers[i].lane * Math.min(1, (length - distance) / 100);
      marbles[i].setAttribute("transform", `translate(${p.x - dy / norm * lane} ${p.y + dx / norm * lane}) rotate(${distance * 9})`);
    });
    distances.map((distance, i) => ({ distance, i })).sort((a, b) => b.distance - a.distance).forEach((r, n) => {
      ranks[n].querySelector(".mr-name")!.textContent = marbleDefs[r.i].name;
      ranks[n].querySelector<HTMLElement>(".mr-dot")!.style.background = marbleDefs[r.i].c;
    });
  });
  if (!raced) return false;
  // The same winning marble enters the cup before its percentage is revealed.
  if (!(await frameLoop(fx.reduced() ? 80 : 220, signal, p => {
    marbles[winner].setAttribute("transform", `translate(350 455) scale(${1 - p})`);
  }))) return false;
  pod.classList.add("is-won");
  reveal(stage, "[data-mr-score]", score);
  banner.textContent = marbleDefs[winner].name + " · arrivée confirmée";
  return true;
};

/* ==========================================================================
   2. PACHINKO FEVER (Arcade néon avec clous dorés, bumpers et poche centrale)
   ========================================================================== */

const makePachinkoMarkup = (score: number) => {
  const pins = [];
  const rows = 9;
  for (let r = 0; r < rows; r++) {
    const isOdd = r % 2 === 1;
    const cols = isOdd ? 9 : 8;
    const startX = isOdd ? 45 : 68;
    const y = 80 + r * 30;
    for (let c = 0; c < cols; c++) {
      const x = startX + c * 46;
      if ([{x:160,y:180,r:22},{x:340,y:180,r:22},{x:250,y:270,r:26}].some(b => Math.hypot(x-b.x,y-b.y)<b.r+18)) continue;
      pins.push('<circle cx="' + x + '" cy="' + y + '" r="3.8" class="pk-pin"/>');
    }
  }

  return '<div class="pachinko-game impact-game">' + scoreReadout()
    + '<svg class="pk-stage-svg" viewBox="0 0 500 540">'
    + '  <defs>'
    + '    <radialGradient id="pk-ball-metal" cx="35%" cy="30%"><stop offset="0%" stop-color="#ffffff"/><stop offset="35%" stop-color="#d6e0ea"/><stop offset="100%" stop-color="#607285"/></radialGradient>'
    + '    <linearGradient id="pk-neon-rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ff007f"/><stop offset="50%" stop-color="#7000ff"/><stop offset="100%" stop-color="#00f0ff"/></linearGradient>'
    + '    <filter id="pk-glow"><feGaussianBlur stdDeviation="8" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
    + '  </defs>'
    + '  <rect x="15" y="15" width="470" height="510" rx="30" class="pk-board-bg"/>'
    + '  <rect x="25" y="25" width="450" height="490" rx="22" class="pk-board-rim"/>'
    + '  <!-- Bumpers -->'
    + '  <circle cx="160" cy="180" r="22" class="pk-bumper" id="pk-bump-1"/>'
    + '  <circle cx="340" cy="180" r="22" class="pk-bumper" id="pk-bump-2"/>'
    + '  <circle cx="250" cy="270" r="26" class="pk-bumper" id="pk-bump-3"/>'
    + '  <!-- Clous métalliques -->'
    + pins.join("")
    + '  <path d="M40 360 L230 460 M460 360 L270 460" class="physics-rail"/>'
    + '  <rect x="208" y="452" width="84" height="60" rx="16" class="pk-jackpot-pocket"/>'
    + '  <text x="250" y="491" text-anchor="middle" class="pk-jackpot-score" data-pk-score>—</text>'
    + '  <!-- Billes lancées -->'
    + '  <g id="pk-balls-group"></g>'
    + '</svg>'
    + '<p class="pk-status-banner">La bille rebondit…</p>'
    + '</div>';
};

const runPachinko = async (stage: HTMLElement, score: number, signal: AbortSignal, fx: FxHelpers) => {
  const group = stage.querySelector("#pk-balls-group")!;
  const ball = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  ball.setAttribute("r", "10");
  ball.setAttribute("fill", "url(#pk-ball-metal)");
  ball.setAttribute("class", "physics-ball");
  group.append(ball);
  const obstacles = [...stage.querySelectorAll<SVGCircleElement>(".pk-pin,.pk-bumper")];
  const pegs = obstacles.map(p => ({ x: p.cx.baseVal.value, y: p.cy.baseVal.value, r: p.r.baseVal.value, boost: p.classList.contains("pk-bumper") ? 70 : 0 }));
  return runBoard(stage, score, signal, fx, ball, pegs, obstacles, false);
};

const runBoard = async (stage: HTMLElement, score: number, signal: AbortSignal, fx: FxHelpers, ball: SVGCircleElement, pegs: Peg[], obstacles: Element[], pinball: boolean) => {
  let samples = dropTrajectory(pegs, pinball);
  let impacts = samples.flatMap((s, frame) => s.hit >= 0 ? [{frame, target:s.hit, x:s.x, y:s.y}] : []);
  // A positive result is earned by an actual contact, never by a missed board.
  for (let retry = 0; !impacts.length && score > 0 && retry < 30; retry++) {
    samples = dropTrajectory(pegs, pinball);
    impacts = samples.flatMap((s, frame) => s.hit >= 0 ? [{frame, target:s.hit, x:s.x, y:s.y}] : []);
  }
  const awards = impactAwards(impacts, score);
  const svg = ball.ownerSVGElement!;
  const live = stage.querySelector<HTMLElement>("[data-live-score]")!;
  const caption = stage.querySelector<HTMLElement>("[data-impact-caption]")!;
  let awarded = 0, total = 0;
  const labels = pegs.map(peg => {
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", String(peg.x)); label.setAttribute("y", String(peg.y - peg.r - 8));
    label.setAttribute("class", "target-award"); label.setAttribute("text-anchor", "middle");
    svg.append(label); return label;
  });
  const updateTargets = () => obstacles.forEach((el, index) => {
    const next = awards.slice(awarded).find(a => a.target === index);
    const points = next?.points ?? (5 + (index % 3) * 5);
    el.classList.toggle("is-scoring", points > 0);
    labels[index].textContent = (pinball || pegs[index].r > 10) && points ? `+${points}` : "";
  });
  updateTargets();
  const paddleHit = [-1, -1];
  const place = (x: number, y: number) => { ball.setAttribute("cx", String(x)); ball.setAttribute("cy", String(y)); };
  place(samples[0].x, samples[0].y);
  let previous = 0;
  const flashed = new Map<number, number>();
  // Replay the simulation at its own clock (STEP seconds per sample) so motion and flipper kicks look physical.
  const duration = fx.reduced() ? 450 : clamp(samples.length * STEP * 1000, 3200, pinball ? 11000 : 7000);
  const completed = await frameLoop(duration, signal, p => {
    const frame = p * (samples.length - 1), index = Math.floor(frame), mix = frame - index;
    const a = samples[index], b = samples[index + 1] ?? a;
    place(a.x + (b.x-a.x)*mix, a.y + (b.y-a.y)*mix);
    for (let i = previous; i <= index; i++) {
      if (samples[i].hit >= 0) flashed.set(samples[i].hit, p);
      const paddle = samples[i].flipper;
      if (paddle !== undefined) paddleHit[paddle] = p;
    }
    while (awarded < awards.length && awards[awarded].frame <= index) {
      const award = awards[awarded++]; total += award.points;
      live.textContent = `${total}%`;
      live.dataset.total = String(total);
      caption.textContent = award.points ? `Impact +${award.points}% · ${awarded} touches` : "Impact neutre · aucun point";
      if (!fx.reduced()) showImpact(svg, award);
      updateTargets();
    }
    stage.querySelectorAll<SVGPathElement>("[data-flipper]").forEach((el,i) => {
      const age = paddleHit[i] < 0 ? -1 : (p - paddleHit[i]) * duration;
      const amount = age >= 0 && age < 180 ? Math.sin(age / 180 * Math.PI) : 0;
      el.style.transform = `rotate(${(i === 0 ? -35 : 35) * amount}deg)`;
    });
    previous = index + 1;
    obstacles.forEach((el, i) => el.classList.toggle("is-hit", (p - (flashed.get(i) ?? -1)) * duration < 160));
  });
  if (!completed) return false;
  if (!(await frameLoop(fx.reduced() ? 60 : 180, signal, p => ball.setAttribute("r", String(10 * (1-p)))))) return false;
  if (total !== score) throw new Error("Impact total differs from recorded score");
  const prefix = pinball ? "pb" : "pk";
  stage.querySelector(pinball ? ".pb-jackpot-saucer" : ".pk-jackpot-pocket")!.classList.add("is-won");
  reveal(stage, pinball ? ".pb-saucer-score" : "[data-pk-score]", score);
  stage.querySelector(`.${prefix}-status-banner`)!.textContent = "Partie terminée · points conservés";
  return true;
};

/* ==========================================================================
   3. DERBY RACE (Course d'hippodrome réaliste avec sprint et photo-finish)
   ========================================================================== */

const derbySilks = ["#ffd700", "#00c8ff", "#ff3366", "#45d39b", "#b366ff"];
const derbyCoats = ["#6b3b1c", "#2b1a10", "#9a5a2a", "#4a2f1f", "#c08850"];

const makeHorse = (idx: number) => '<svg class="dr-horse" viewBox="0 0 80 56" aria-hidden="true">'
  + '<ellipse class="dr-horse-shadow" cx="40" cy="53" rx="26" ry="3"/>'
  + '<g class="dr-legs-back"><path class="dr-leg dr-leg-a" d="M24 30 L20 41 L22 51"/><path class="dr-leg dr-leg-b" d="M28 30 L30 41 L27 51"/></g>'
  + '<path fill="' + derbyCoats[idx] + '" d="M14 24 Q8 27 5 36 Q11 31 16 29 Z"/>'
  + '<path fill="' + derbyCoats[idx] + '" d="M18 22 Q22 15 38 16 Q50 15 54 17 L62 6 Q66 4 72 9 L74 13 Q72 15 67 14 L60 25 Q56 33 46 33 L24 33 Q16 32 18 22 Z"/>'
  + '<path class="dr-mane" d="M55 15 L62 6 L60 14 Z"/>'
  + '<g class="dr-legs-front"><path class="dr-leg dr-leg-a" d="M50 30 L54 41 L52 51"/><path class="dr-leg dr-leg-b" d="M46 30 L44 41 L47 51"/></g>'
  + '<path fill="' + derbySilks[idx] + '" d="M34 16 Q33 7 40 5 Q45 6 44 12 L41 17 Z"/>'
  + '<circle cx="41" cy="3" r="3.2" fill="' + derbySilks[idx] + '" stroke="#111" stroke-width=".8"/>'
  + '<text x="38" y="27" class="dr-saddle-num">' + (idx + 1) + '</text>'
  + '</svg>';

const makeDerbyMarkup = (score: number) => {
  const scores = new Set<number>([score]);
  while (scores.size < 5) scores.add(Math.floor(Math.random() * 101));
  const oddsList = [...scores];
  for (let i=oddsList.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [oddsList[i],oddsList[j]]=[oddsList[j],oddsList[i]]; }

  const lanes = oddsList.map((val, idx) => {
    return '<div class="dr-lane" data-lane="' + idx + '" data-value="' + val + '">'
      + '  <div class="dr-lane-info">'
      + '    <span class="dr-lane-num" style="background:' + derbySilks[idx] + '">' + (idx + 1) + '</span>'
      + '    <span class="dr-lane-score">?</span>'
      + '  </div>'
      + '  <div class="dr-track-run">'
      + '    <div class="dr-runner" id="dr-horse-' + idx + '">' + makeHorse(idx) + '</div>'
      + '  </div>'
      + '</div>';
  }).join("");

  return '<div class="derby-game">'
    + '<div class="dr-header">'
    + '  <div class="dr-title">GRAND PRIX · TAG FINISH</div>'
    + '  <div class="dr-track-meta"><span>1200 M</span><span class="dr-leader">Départ</span></div>'
    + '</div>'
    + '<div class="dr-stadium"><div class="dr-turf-field">' + lanes + '</div></div>'
    + '<p class="dr-status-banner">Les chevaux entrent dans les stalles…</p>'
    + '</div>';
};

const runDerby = async (stage: HTMLElement, score: number, signal: AbortSignal, fx: FxHelpers) => {
  const lanes = [...stage.querySelectorAll<HTMLElement>(".dr-lane")];
  const runners = [...stage.querySelectorAll<HTMLElement>(".dr-runner")];
  const banner = stage.querySelector<HTMLElement>(".dr-status-banner");
  const leader = stage.querySelector<HTMLElement>(".dr-leader");
  const game = stage.querySelector<HTMLElement>(".derby-game");
  const winnerIndex = lanes.findIndex((l) => Number(l.dataset.value) === score);
  if (lanes.length !== 5 || winnerIndex < 0 || !banner || !leader || !game) return false;

  const trackWidth = () => Math.max(0, lanes[0].querySelector<HTMLElement>(".dr-track-run")!.clientWidth - runners[0].offsetWidth);
  const raceDuration = fx.reduced() ? 900 : 6200;

  if (!(await fx.wait(500, signal))) return false;
  banner.textContent = "Départ !";
  game.classList.add("is-galloping");

  // Each horse follows its own pace curve (fixed ends, random surges) so the lead changes before the line.
  const plans = lanes.map((_, idx) => {
    const isWinner = idx === winnerIndex;
    return {
      a1: isWinner ? rand(-0.06, 0.01) : rand(-0.05, 0.06),
      a2: rand(-0.025, 0.025),
      a3: rand(-0.015, 0.015),
      finish: isWinner ? 1 : rand(0.955, 0.993),
      stride: rand(240, 300),
    };
  });
  plans.forEach((plan, idx) => runners[idx].style.setProperty("--stride", plan.stride.toFixed(0) + "ms"));
  const positions = plans.map(() => 0);
  const base = (t: number) => (t < 0.1 ? 5 * t * t : t - 0.05) / 0.95;
  let lastLeader = -1;

  const raced = await frameLoop(raceDuration, signal, (progress) => {
    const width = trackWidth();
    plans.forEach((p, idx) => {
      const curve = base(progress) + p.a1 * Math.sin(Math.PI * progress) + p.a2 * Math.sin(2 * Math.PI * progress) + p.a3 * Math.sin(3 * Math.PI * progress);
      positions[idx] = Math.max(positions[idx], clamp(curve * p.finish, 0, p.finish));
      runners[idx].style.transform = 'translateX(' + (positions[idx] * width).toFixed(1) + 'px)';
    });
    const ahead = positions.indexOf(Math.max(...positions));
    if (ahead !== lastLeader && progress > 0.05) {
      lastLeader = ahead;
      leader.textContent = "En tête : n°" + (ahead + 1);
    }
    if (progress > 0.7) banner.textContent = "Dernière ligne droite…";
    else if (progress > 0.3) banner.textContent = "Ils abordent le virage…";
  });
  game.classList.remove("is-galloping");
  if (!raced) return false;

  lanes.forEach((lane, idx) => {
    if (idx === winnerIndex) return;
    lane.classList.add("is-lost");
    lane.querySelector(".dr-lane-score")!.textContent = lane.dataset.value + "%";
  });
  lanes[winnerIndex].classList.add("is-won");
  leader.textContent = "Vainqueur : n°" + (winnerIndex + 1);
  reveal(stage, `.dr-lane[data-lane="${winnerIndex}"] .dr-lane-score`, score);
  banner.textContent = `Photo-finish · n°${winnerIndex + 1} l’emporte`;
  return true;
};

/* ==========================================================================
   4. ROCKET CRASH (Multiplicateur spatial exponentiel avec arrêt net)
   ========================================================================== */

const makeCrashMarkup = () => {
  const grid = [0, 25, 50, 75, 100].map((val) => {
    const y = 320 - val * 2.7;
    return '<line x1="50" y1="' + y + '" x2="650" y2="' + y + '" class="rc-grid-line"/><text x="42" y="' + (y + 4) + '" text-anchor="end" class="rc-axis-text">' + val + '%</text>';
  }).join("");
  const stars = Array.from({ length: 34 }, () => '<circle class="rc-star" cx="' + rand(30, 670).toFixed(0) + '" cy="' + rand(30, 330).toFixed(0) + '" r="' + rand(0.6, 1.8).toFixed(1) + '"/>').join("");

  return '<div class="rocket-crash-game">'
    + '<svg class="rc-stage-svg" viewBox="0 0 700 380">'
    + '  <defs>'
    + '    <linearGradient id="rc-trail-glow" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#ff9900"/><stop offset="100%" stop-color="#ff0055"/></linearGradient>'
    + '    <linearGradient id="rc-area-glow" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(255,0,85,0.35)"/><stop offset="100%" stop-color="rgba(255,0,85,0)"/></linearGradient>'
    + '    <linearGradient id="rc-hull" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#c9d2dc"/><stop offset="1" stop-color="#6c7886"/></linearGradient>'
    + '    <radialGradient id="rc-boom" cx="50%" cy="50%"><stop offset="0" stop-color="#fff6c2"/><stop offset=".4" stop-color="#ffb000"/><stop offset="1" stop-color="#ff2a00" stop-opacity="0"/></radialGradient>'
    + '  </defs>'
    + '  <rect x="15" y="15" width="670" height="350" rx="24" class="rc-board-bg"/>'
    + stars + grid
    + '  <path class="rc-area-fill" d=""/>'
    + '  <path class="rc-trail-curve" d=""/>'
    + '  <g class="rc-cashout" opacity="0"><line class="rc-cashout-line" x1="0" y1="-14" x2="0" y2="14"/><circle r="6" class="rc-cashout-dot"/><text y="-20" text-anchor="middle" class="rc-cashout-text">CASH OUT</text></g>'
    + '  <g class="rc-rocket-unit" transform="translate(50 320)">'
    + '    <g class="rc-rocket-body">'
    + '      <path class="rc-flame" d="M-22 0 Q-34 -6 -46 0 Q-34 6 -22 0 Z"/>'
    + '      <path fill="#ff3366" d="M-18 -6 L-26 -14 L-12 -7 Z M-18 6 L-26 14 L-12 7 Z"/>'
    + '      <path fill="url(#rc-hull)" stroke="#2b3440" stroke-width="1" d="M-22 -7 L10 -7 Q24 -6 30 0 Q24 6 10 7 L-22 7 Z"/>'
    + '      <circle cx="6" cy="0" r="3.6" fill="#33c8ff" stroke="#1d2a36" stroke-width="1.2"/>'
    + '    </g>'
    + '  </g>'
    + '  <g class="rc-explosion" opacity="0"><circle r="40" fill="url(#rc-boom)"/></g>'
    + '</svg>'
    + '<div class="rc-hud-readout">'
    + '  <strong data-rc-val>0%</strong>'
    + '  <span data-rc-label>COMPTE À REBOURS…</span>'
    + '</div>'
    + '</div>';
};

const runCrash = async (stage: HTMLElement, score: number, signal: AbortSignal, fx: FxHelpers) => {
  const curvePath = stage.querySelector<SVGPathElement>(".rc-trail-curve");
  const areaFill = stage.querySelector<SVGPathElement>(".rc-area-fill");
  const rocket = stage.querySelector<SVGGElement>(".rc-rocket-unit");
  const cashout = stage.querySelector<SVGGElement>(".rc-cashout");
  const explosion = stage.querySelector<SVGGElement>(".rc-explosion");
  const game = stage.querySelector<HTMLElement>(".rocket-crash-game");
  const valText = stage.querySelector<HTMLElement>("[data-rc-val]");
  const labelText = stage.querySelector<HTMLElement>("[data-rc-label]");
  if (!curvePath || !areaFill || !rocket || !cashout || !explosion || !game || !valText || !labelText) return false;

  // Crash game rules: the rocket's value climbs exponentially, the auto cash-out locks your score, then it explodes.
  const crashAt = score >= 100 ? 100 : score === 0 ? 0 : Math.min(100, score + rand(4, 28));
  const k = 2.4;
  const valueAt = (u: number) => crashAt * (Math.exp(k * u) - 1) / (Math.exp(k) - 1);
  const cashU = crashAt === 0 ? 0 : Math.log(1 + (score / crashAt) * (Math.exp(k) - 1)) / k;
  const toX = (u: number) => 50 + u * 580;
  const toY = (value: number) => 320 - value * 2.7;

  for (const count of ["3", "2", "1"]) {
    labelText.textContent = "DÉCOLLAGE DANS " + count;
    if (!(await fx.wait(320, signal))) return false;
  }
  game.classList.add("is-flying");
  labelText.textContent = "LA FUSÉE GRIMPE…";

  const points: string[] = [];
  let cashed = score === 0;
  let lastX = 50, lastY = 320;
  const flightTime = crashAt === 0 ? 400 : 2400 + crashAt * 24;
  const flown = await frameLoop(fx.reduced() ? 600 : flightTime, signal, (progress) => {
    const u = crashAt === 0 ? progress * 0.02 : progress;
    const value = crashAt === 0 ? 0 : valueAt(u);
    const x = toX(u), y = toY(value) - (crashAt === 0 ? progress * 12 : 0);
    const angle = Math.atan2(y - lastY, Math.max(0.5, x - lastX)) * 180 / Math.PI;
    lastX = x; lastY = y;
    points.push(x.toFixed(1) + ' ' + y.toFixed(1));
    curvePath.setAttribute("d", "M 50 320 L " + points.join(" L "));
    areaFill.setAttribute("d", "M 50 320 L " + points.join(" L ") + " L " + x.toFixed(1) + " 320 Z");
    rocket.setAttribute("transform", 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') rotate(' + angle.toFixed(1) + ')');
    if (!cashed && u >= cashU) {
      cashed = true;
      cashout.setAttribute("transform", 'translate(' + toX(cashU).toFixed(1) + ' ' + toY(score).toFixed(1) + ')');
      cashout.setAttribute("opacity", "1");
      labelText.textContent = "ENCAISSÉ ! LA FUSÉE CONTINUE…";
    }
    valText.textContent = (cashed ? score : Math.min(score, Math.floor(value))) + "%";
  });
  if (!flown) return false;

  explosion.setAttribute("transform", 'translate(' + lastX.toFixed(1) + ' ' + lastY.toFixed(1) + ')');
  rocket.setAttribute("opacity", "0");
  game.classList.remove("is-flying");
  game.classList.add("is-crashed");
  if (!(await fx.animate(explosion, [
    { opacity: 1, transform: `translate(${lastX.toFixed(1)}px, ${lastY.toFixed(1)}px) scale(.2)` },
    { opacity: 0, transform: `translate(${lastX.toFixed(1)}px, ${lastY.toFixed(1)}px) scale(2.4)` },
  ], { duration: 650, easing: "ease-out", fill: "forwards" }, signal))) return false;

  reveal(stage, "[data-rc-val]", score);
  labelText.textContent = "CRASH À " + Math.round(crashAt) + "% · GAIN " + score + "%";
  return true;
};

/* ==========================================================================
   5. PINBALL FRENZY (Flipper vintage avec catapulte et bumpers néons)
   ========================================================================== */

const makePinballMarkup = (score: number) => {
  return '<div class="pinball-game impact-game">' + scoreReadout()
    + '<svg class="pb-stage-svg" viewBox="0 0 500 540">'
    + '  <defs>'
    + '    <radialGradient id="pb-ball-silver" cx="30%" cy="30%"><stop offset="0%" stop-color="#ffffff"/><stop offset="40%" stop-color="#d4dee8"/><stop offset="100%" stop-color="#4a5a6b"/></radialGradient>'
    + '    <filter id="pb-glow"><feGaussianBlur stdDeviation="7" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
    + '  </defs>'
    + '  <rect x="20" y="20" width="460" height="500" rx="32" class="pb-cabinet-bg"/>'
    + '  <rect x="32" y="32" width="436" height="476" rx="24" class="pb-cabinet-rim"/>'
    + '  <!-- Outer Launch Chute -->'
    + '  <path d="M 432,460 L 432,120 M 465,460 L 465,85 Q465,35 415,35 L250,35" class="pb-chute-rail"/>'
    + '  <!-- Bumpers néons -->'
    + '  <g class="pb-bumper" id="pb-b1" transform="translate(170 180)"><circle r="30" class="pb-bumper-ring"/><circle r="22" class="pb-bumper-core"/><text y="5" text-anchor="middle" class="pb-bumper-txt">+</text></g>'
    + '  <g class="pb-bumper" id="pb-b2" transform="translate(330 180)"><circle r="30" class="pb-bumper-ring"/><circle r="22" class="pb-bumper-core"/><text y="5" text-anchor="middle" class="pb-bumper-txt">+</text></g>'
    + '  <g class="pb-bumper" id="pb-b3" transform="translate(250 270)"><circle r="34" class="pb-bumper-ring"/><circle r="26" class="pb-bumper-core"/><text y="5" text-anchor="middle" class="pb-bumper-txt">+</text></g>'
    + '  <!-- Jackpot Saucer Hole -->'
    + '  <g class="pb-jackpot-saucer" transform="translate(250 478)" filter="url(#pb-glow)">'
    + '    <circle r="44" class="pb-saucer-outer"/>'
    + '    <circle r="34" class="pb-saucer-inner"/>'
    + '    <text y="7" text-anchor="middle" class="pb-saucer-score">' + '—</text>'
    + '  </g>'
    + '  <!-- Flippers bas -->'
    + '  <path d="M40 360 L230 460 M460 360 L270 460" class="physics-rail"/>'
    + '  <path data-flipper="0" d="M90 400 L247 430" class="powered-flipper" style="transform-origin:90px 400px"/>'
    + '  <path data-flipper="1" d="M410 400 L253 430" class="powered-flipper" style="transform-origin:410px 400px"/>'
    + '  <!-- Bille argentée en SVG direct -->'
    + '  <circle cx="436" cy="460" r="12" fill="url(#pb-ball-silver)" stroke="#ffffff" stroke-width="1.5" id="pb-silver-ball"/>'
    + '</svg>'
    + '<p class="pb-status-banner">Lancement de la bille…</p>'
    + '</div>';
};

const runPinball = async (stage: HTMLElement, score: number, signal: AbortSignal, fx: FxHelpers) => {
  const ball = stage.querySelector<SVGCircleElement>("#pb-silver-ball")!;
  ball.setAttribute("r", "10");
  const obstacles = [...stage.querySelectorAll<SVGGElement>(".pb-bumper")];
  const pegs = obstacles.map(el => {
    const m = el.transform.baseVal.consolidate()!.matrix;
    return { x: m.e, y: m.f, r: el.querySelector("circle")!.r.baseVal.value, boost: 110 };
  });
  return runBoard(stage, score, signal, fx, ball, pegs, obstacles, true);
};

/* ==========================================================================
   6. LUCKY LOTTO (Tambour de loterie 3D + tirage de la boule jackpot dorée)
   ========================================================================== */

const miniColors = ["#ff3366", "#ffd700", "#00f0ff", "#7be4c2", "#b366ff", "#ff9900"];

const makeLottoMarkup = (_score: number) => `<div class="lotto-game">
  <svg class="lt-stage-svg" viewBox="0 0 500 520">
    <defs><radialGradient id="lt-metal" cx="32%" cy="25%"><stop stop-color="#fff7ca"/><stop offset=".35" stop-color="#f2c66d"/><stop offset="1" stop-color="#8d601c"/></radialGradient></defs>
    <path d="M218 345 V452 Q250 480 282 452 V345" class="lt-tube"/>
    <circle cx="250" cy="210" r="158" class="lt-drum"/>
    <g class="lt-balls">${Array.from({length:12}, (_,i)=>`<g class="lt-physical-ball"><circle r="15" fill="${miniColors[i%miniColors.length]}"/><circle r="5" cx="-4" cy="-5" fill="white" opacity=".4"/><text text-anchor="middle" y="5">${i+1}</text></g>`).join("")}</g>
    <path d="M135 165 A126 126 0 0 1 225 88" class="lt-reflection"/>
    <rect x="145" y="474" width="210" height="38" rx="10" fill="#22362b"/>
    <text x="250" y="499" text-anchor="middle" class="lt-result-label">TIRAGE EN COURS</text>
  </svg><p class="lt-status-banner">Les boules se mélangent…</p></div>`;

const runLotto = async (stage: HTMLElement, score: number, signal: AbortSignal, fx: FxHelpers) => {
  const elements = [...stage.querySelectorAll<SVGGElement>(".lt-physical-ball")];
  const balls: Body[] = elements.map((_, i) => ({ x: 190 + i%4*40, y: 135+Math.floor(i/4)*45, vx:rand(-160,160), vy:rand(-140,140), r:15 }));
  const place = () => balls.forEach((b,i)=>elements[i].setAttribute("transform", `translate(${b.x} ${b.y})`));
  const boundary = (b: Body) => {
    const dx=b.x-250, dy=b.y-210, distance=Math.hypot(dx,dy), limit=141;
    if (distance>limit) { const nx=dx/distance,ny=dy/distance; b.x=250+nx*limit;b.y=210+ny*limit; reflect(b,-nx,-ny,.82); }
  };
  place();
  let step = 0;
  if (!(await frameLoop(fx.reduced()?300:2600, signal, p=>{
    const target=Math.floor(p*312);
    while(step<target) {
      balls.forEach(b=>{
        // Air blower applies a circulating force; walls and other balls provide collisions.
        b.vx += (-(b.y-210)*4-b.vx*.45)*STEP;
        b.vy += ((b.x-250)*4-b.vy*.45-120)*STEP;
        advance(b,160); boundary(b);
      });
      for(let i=0;i<balls.length;i++) for(let j=i+1;j<balls.length;j++) {
        const a=balls[i],b=balls[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||.01;
        if(d<30){ const nx=dx/d,ny=dy/d,overlap=(30-d)/2;
          a.x-=nx*overlap;a.y-=ny*overlap;b.x+=nx*overlap;b.y+=ny*overlap;
          const relative=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;
          if(relative>0){a.vx-=relative*nx*.9;a.vy-=relative*ny*.9;b.vx+=relative*nx*.9;b.vy+=relative*ny*.9;}
        }
      }
      balls.forEach(boundary); step++;
    }
    place();
  }))) return false;
  // Select the ball physically nearest the outlet, then open its gate.
  const winner=balls.map((b,i)=>({i,d:Math.hypot(b.x-250,b.y-351)})).sort((a,b)=>a.d-b.d)[0].i;
  const hero=balls[winner], element=elements[winner];
  element.querySelector("circle")!.setAttribute("fill","url(#lt-metal)");
  stage.querySelector(".lt-balls")!.append(element);
  let released=false, steps=0, settled=false;
  const frames: {x:number;y:number}[][]=[balls.map(b=>({x:b.x,y:b.y}))];
  // The outlet's suction centers the ball; gravity carries it through the tube.
  while(steps++<1200 && !settled){
    hero.vx += ((250-hero.x)*12-hero.vx*5)*STEP;
    advance(hero,500);
    if(!released && hero.y>338 && Math.abs(hero.x-250)<16) released=true;
    if(!released) boundary(hero);
    else {
      if(hero.x<234){hero.x=234;reflect(hero,1,0,.3);}
      if(hero.x>266){hero.x=266;reflect(hero,-1,0,.3);}
      if(hero.y>450){hero.y=450;reflect(hero,0,-1,.32);if(Math.abs(hero.vy)<18) settled=true;}
    }
    // Keep the remaining drum contents falling while the selected ball exits.
    balls.forEach((b,i)=>{if(i!==winner){b.vx*=.985;b.vy*=.99;advance(b,420);boundary(b);}});
    for(let i=0;i<balls.length;i++) for(let j=i+1;j<balls.length;j++) {
      if(i===winner||j===winner)continue;
      const a=balls[i],b=balls[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||.01;
      if(d<30){const nx=dx/d,ny=dy/d,overlap=(30-d)/2;
        a.x-=nx*overlap;a.y-=ny*overlap;b.x+=nx*overlap;b.y+=ny*overlap;
        const relative=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;
        if(relative>0){a.vx-=relative*nx*.7;a.vy-=relative*ny*.7;b.vx+=relative*nx*.7;b.vy+=relative*ny*.7;}
      }
    }
    balls.forEach((b,i)=>{if(i!==winner)boundary(b);});
    frames.push(balls.map(b=>({x:b.x,y:b.y})));
  }
  if(!settled) throw new Error("Lotto outlet did not settle");
  if(!(await frameLoop(fx.reduced()?200:1500,signal,p=>{
    const frame=p*(frames.length-1),i=Math.floor(frame),t=frame-i,a=frames[i],b=frames[i+1]??a;
    elements.forEach((el,n)=>el.setAttribute("transform",`translate(${a[n].x+(b[n].x-a[n].x)*t} ${a[n].y+(b[n].y-a[n].y)*t})`));
  }))) return false;
  // Enlarge in place within the collector; the extracted ball is never replaced.
  if(!(await frameLoop(fx.reduced()?60:220,signal,p=>element.setAttribute("transform",`translate(${hero.x} ${hero.y}) scale(${1+p*.7})`))))return false;
  reveal(stage,".lt-physical-ball:last-child text",score);
  stage.querySelector(".lt-result-label")!.textContent="RÉSULTAT DU TIRAGE";
  stage.querySelector(".lt-status-banner")!.textContent="Boule tirée · résultat confirmé";
  return true;
};

/* ==========================================================================
   7. SHELL CUPS (Gobelets en laiton 3D et balle dorée au centre)
   ========================================================================== */

const makeCupsMarkup = () => {
  const cup = (i: number) => '<div class="cp-cup" data-cup="' + i + '"><span class="cp-cup-shadow"></span><div class="cp-cup-shape"><span class="cp-cup-band"></span><span class="cp-cup-knob"></span></div></div>';
  return '<div class="cups-game">'
    + '<div class="cp-felt-table">'
    + '  <div class="cp-surface"></div>'
    + '  <div class="cp-lane">'
    + '    <span class="cp-gold-ball" data-cp-ball></span>'
    + cup(0) + cup(1) + cup(2)
    + '  </div>'
    + '</div>'
    + '<p class="cp-status-banner">Regardez bien où est la boule…</p>'
    + '</div>';
};

const runCups = async (stage: HTMLElement, score: number, signal: AbortSignal, fx: FxHelpers) => {
  const ball = stage.querySelector<HTMLElement>("[data-cp-ball]")!;
  const cups = [...stage.querySelectorAll<HTMLElement>(".cp-cup")];
  const lane = stage.querySelector<HTMLElement>(".cp-lane")!;
  const banner = stage.querySelector<HTMLElement>(".cp-status-banner")!;
  const slots = [0,1,2];
  const winner = Math.floor(Math.random()*3); // Ball stays under this cup throughout every swap.
  const spacing = () => Math.min(200, lane.clientWidth / 3.1);
  const x = (slot:number) => (slot-1)*spacing();
  const lift = () => cups[0].offsetHeight * .85;
  const place = (i:number, slot:number, y=0, scale=1) => {
    const transform = `translate(${x(slot).toFixed(1)}px, ${y.toFixed(1)}px) scale(${scale.toFixed(3)})`;
    cups[i].style.transform = transform;
    cups[i].style.setProperty("--lift", String(clamp(-y / Math.max(1, lift()), 0, 1)));
    if (i === winner) ball.style.transform = `translate(${x(slot).toFixed(1)}px, ${(Math.max(0, y) * .6).toFixed(1)}px) scale(${scale.toFixed(3)})`;
  };
  cups.forEach((_,i)=>place(i,i,-lift()));
  ball.style.transform = `translate(${x(winner)}px, 0px)`;
  if(!(await fx.wait(900,signal)))return false;
  if(!(await frameLoop(fx.reduced()?120:500,signal,p=>cups.forEach((_,i)=>place(i,i,-lift()*(1-p*p))))))return false;
  if(!(await fx.wait(250,signal)))return false;
  banner.textContent="Mélange en cours…";
  const rounds = fx.reduced() ? 1 : 7;
  for(let round=0;round<rounds;round++){
    const a=Math.floor(Math.random()*3),b=(a+1+Math.floor(Math.random()*2))%3;
    const fromA=slots[a],fromB=slots[b];
    // One cup passes in front (lower, bigger), the other behind (higher, smaller), like on a real table.
    cups[a].style.zIndex="4";cups[b].style.zIndex="2";
    if(!(await frameLoop(Math.max(300, 620-round*45),signal,p=>{
      const t=p*p*(3-2*p), arc=Math.sin(p*Math.PI);
      const depth = cups[0].offsetHeight*.28*arc;
      cups[a].style.transform=`translate(${(x(fromA)+(x(fromB)-x(fromA))*t).toFixed(1)}px, ${depth.toFixed(1)}px) scale(${(1+.1*arc).toFixed(3)})`;
      cups[b].style.transform=`translate(${(x(fromB)+(x(fromA)-x(fromB))*t).toFixed(1)}px, ${(-depth).toFixed(1)}px) scale(${(1-.1*arc).toFixed(3)})`;
      if (a === winner || b === winner) ball.style.transform = cups[winner].style.transform;
    })))return false;
    [slots[a],slots[b]]=[slots[b],slots[a]];
  }
  cups.forEach(c => { c.style.zIndex = "3"; });
  banner.textContent="Où est la boule ?";
  if(!(await fx.wait(450,signal)))return false;
  if(!(await frameLoop(fx.reduced()?150:550,signal,p=>place(winner,slots[winner],-lift()*(1-Math.pow(1-p,3))))))return false;
  reveal(stage,"[data-cp-ball]",score);
  ball.classList.add("is-revealed");
  banner.textContent="Trouvée ! Voici votre score";
  return true;
};

/* ==========================================================================
   REGISTRY EXPORT
   ========================================================================== */

export const getExtraGameMarkup = (game: ExtraGameId, score: number) => {
  switch (game) {
    case "marbles": return makeMarblesMarkup(score);
    case "pachinko": return makePachinkoMarkup(score);
    case "derby": return makeDerbyMarkup(score);
    case "crash": return makeCrashMarkup();
    case "pinball": return makePinballMarkup(score);
    case "lotto": return makeLottoMarkup(score);
    case "cups": return makeCupsMarkup();
  }
};

export const runExtraGame = (game: ExtraGameId, stage: HTMLElement, score: number, signal: AbortSignal, fx: FxHelpers) => {
  switch (game) {
    case "marbles": return runMarbles(stage, score, signal, fx);
    case "pachinko": return runPachinko(stage, score, signal, fx);
    case "derby": return runDerby(stage, score, signal, fx);
    case "crash": return runCrash(stage, score, signal, fx);
    case "pinball": return runPinball(stage, score, signal, fx);
    case "lotto": return runLotto(stage, score, signal, fx);
    case "cups": return runCups(stage, score, signal, fx);
  }
};

export const extraGameStyles = `
  /* Shared Theme Accents */
  .game-panel[data-game="marbles"] { --accent: #00f0ff; --active-line: rgb(0 240 255 / 45%); }
  .game-panel[data-game="pachinko"] { --accent: #ff007f; --active-line: rgb(255 0 127 / 45%); }
  .game-panel[data-game="derby"] { --accent: #ffd700; --active-line: rgb(255 215 0 / 45%); }
  .game-panel[data-game="crash"] { --accent: #ff0055; --active-line: rgb(255 0 85 / 45%); }
  .game-panel[data-game="pinball"] { --accent: #b366ff; --active-line: rgb(179 102 255 / 45%); }
  .game-panel[data-game="lotto"] { --accent: #ffe259; --active-line: rgb(255 226 89 / 45%); }
  .game-panel[data-game="cups"] { --accent: #ffd700; --active-line: rgb(255 215 0 / 45%); }

  /* 1. MARBLE RUN */
  .marble-run-game { position: relative; z-index: 1; display: grid; justify-items: center; gap: 14px; width: min(94vw, 880px); }
  .mr-hud { display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 10px 18px; border-radius: 18px; background: #0c1813; border: 1px solid rgb(0 240 255 / 30%); }
  .mr-hud-title { display: flex; flex-direction: column; }
  .mr-hud-title span { color: #8fa094; font-size: 11px; font-weight: 700; letter-spacing: .15em; }
  .mr-hud-title strong { color: #00f0ff; font-size: 16px; font-weight: 900; }
  .mr-leaderboard { display: flex; gap: 12px; }
  .mr-rank { display: flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; background: #14241b; font-size: 12px; font-weight: 800; }
  .mr-dot { width: 8px; height: 8px; border-radius: 50%; }
  .mr-stage-svg { width: 100%; max-height: clamp(280px, 50vh, 480px); display: block; overflow: visible; }
  .mr-frame-bg { fill: #0a1410; stroke: #1e362a; stroke-width: 3; }
  .mr-pipe-shadow { fill: none; stroke: rgb(0 0 0 / 70%); stroke-width: 68; stroke-linecap: round; stroke-linejoin: round; filter: blur(4px); }
  .mr-pipe-body { fill: none; stroke: url(#rail-track); stroke-width: 62; stroke-linecap: round; stroke-linejoin: round; }
  .mr-pipe-core { fill: none; stroke: #00f0ff; stroke-width: 4; stroke-linecap: round; stroke-dasharray: 8 16; opacity: 0.6; }
  .mr-finish-pod circle.mr-pod-base { fill: #0a1610; stroke: #00f0ff; stroke-width: 4; filter: drop-shadow(0 0 16px #00f0ff); }
  .mr-finish-pod circle.mr-pod-inner { fill: #13241b; stroke: #ffffff; stroke-width: 2; }
  .mr-pod-score { fill: #ffffff; font-size: 18px; font-weight: 900; font-family: ui-rounded, sans-serif; }
  .mr-finish-pod.is-won circle.mr-pod-base { fill: #00f0ff; stroke: #ffffff; filter: drop-shadow(0 0 28px #00f0ff); }
  .mr-finish-pod.is-won .mr-pod-score { fill: #0a1610; font-weight: 950; font-size: 20px; }
  .mr-status-banner, .pk-status-banner, .dr-status-banner, .pb-status-banner, .lt-status-banner, .cp-status-banner { margin: 0; color: var(--muted); font-size: 14px; font-weight: 800; letter-spacing: .12em; text-align: center; text-transform: uppercase; }

  /* 2. PACHINKO FEVER */
  .pachinko-game { position: relative; z-index: 1; display: grid; justify-items: center; gap: 14px; width: min(92vw, 600px); }
  .pk-stage-svg { width: 100%; max-height: clamp(280px, 50vh, 480px); display: block; overflow: visible; }
  .pk-board-bg { fill: #0b1410; stroke: #ff007f; stroke-width: 3; }
  .pk-board-rim { fill: #101c16; stroke: #1a3026; stroke-width: 2; }
  .pk-pin { fill: #ffe259; stroke: #ffffff; stroke-width: 0.8; filter: drop-shadow(0 0 4px #ffe259); }
  .pk-bumper { fill: #20132b; stroke: #00f0ff; stroke-width: 3; filter: drop-shadow(0 0 10px #00f0ff); transition: fill 150ms ease; }
  .pk-bumper.is-lit { fill: #00f0ff; filter: drop-shadow(0 0 26px #00f0ff); }
  .pk-slot-side { fill: #121c17; stroke: #314a3e; stroke-width: 2; }
  .pk-slot-text { fill: #8fa094; font-size: 14px; font-weight: 800; }
  .pk-jackpot-pocket { fill: #1c0e22; stroke: #ff007f; stroke-width: 4; filter: drop-shadow(0 0 20px #ff007f); transition: fill 200ms ease; }
  .pk-jackpot-pocket.is-won { fill: #ff007f; stroke: #ffffff; filter: drop-shadow(0 0 35px #ff007f); }
  .pk-jackpot-score { fill: #ffffff; font-size: 26px; font-weight: 900; }
  .pk-jackpot-pocket.is-won + .pk-jackpot-score { fill: #000000; }
  .pk-jackpot-label { fill: #ff99cc; font-size: 11px; font-weight: 850; letter-spacing: .1em; }

  /* 3. DERBY RACE */
  .derby-game { position: relative; z-index: 1; display: grid; gap: 12px; width: min(94vw, 920px); }
  .dr-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 18px; border-radius: 16px; background: #0c1813; border: 1px solid rgb(255 215 0 / 30%); }
  .dr-title { color: #ffd700; font-size: 15px; font-weight: 900; letter-spacing: .1em; }
  .dr-track-meta { display: flex; gap: 18px; color: #8fa094; font-size: 12px; font-weight: 750; }
  .dr-stadium { perspective: 1100px; perspective-origin: 50% -20%; }
  .dr-turf-field { display: grid; gap: 4px; padding: 12px; border: 3px solid #f4f1e6; border-radius: 20px; background: linear-gradient(90deg, #1f5a32, #2a7040 50%, #1f5a32); transform: rotateX(24deg); transform-origin: 50% 100%; box-shadow: 0 28px 40px rgb(0 0 0 / 45%); }
  .dr-lane { display: grid; grid-template-columns: 80px 1fr; align-items: center; gap: 10px; height: clamp(46px, 8.5vh, 70px); padding: 0 12px; border-bottom: 2px solid rgb(255 255 255 / 55%); background: repeating-linear-gradient(90deg, rgb(255 255 255 / 4%) 0 46px, transparent 46px 92px); transition: background 200ms, box-shadow 200ms, opacity 300ms; }
  .dr-lane:last-child { border-bottom: 0; }
  .dr-lane.is-won { background: repeating-linear-gradient(90deg, rgb(255 255 255 / 6%) 0 46px, transparent 46px 92px), rgb(255 215 0 / 18%); box-shadow: inset 0 0 0 2px #ffd700, 0 0 32px rgb(255 215 0 / 40%); border-radius: 10px; }
  .dr-lane.is-lost { opacity: .6; }
  .dr-lane-info { display: flex; align-items: center; gap: 8px; }
  .dr-lane-num { display: grid; width: 28px; height: 28px; place-items: center; border-radius: 6px; color: #000; font-size: 13px; font-weight: 900; }
  .dr-lane-score { color: #ffffff; font-size: 18px; font-weight: 900; }
  .dr-lane.is-won .dr-lane-score { color: #ffd700; }
  .dr-leader { color: #ffd700; }
  .dr-track-run { position: relative; height: 100%; border-right: 6px solid; border-image: repeating-linear-gradient(180deg, #fff 0 6px, #111 6px 12px) 6; }
  .dr-runner { position: absolute; top: 0; bottom: 0; left: 0; display: flex; align-items: center; will-change: transform; }
  .dr-horse { width: clamp(58px, 11vh, 92px); height: auto; overflow: visible; }
  .dr-horse-shadow { fill: rgb(0 0 0 / 35%); }
  .dr-mane { fill: #140b05; }
  .dr-leg { fill: none; stroke: #2a170b; stroke-width: 3.4; stroke-linecap: round; stroke-linejoin: round; transform-box: fill-box; transform-origin: 50% 0; }
  .dr-saddle-num { fill: #fff; font-size: 8px; font-weight: 900; }
  .derby-game.is-galloping .dr-horse { animation: dr-bob var(--stride, 260ms) ease-in-out infinite alternate; }
  .derby-game.is-galloping .dr-leg-a { animation: dr-leg var(--stride, 260ms) ease-in-out infinite alternate; }
  .derby-game.is-galloping .dr-leg-b { animation: dr-leg var(--stride, 260ms) ease-in-out infinite alternate-reverse; }
  .dr-runner { --stride: 260ms; }
  @keyframes dr-bob { from { transform: translateY(0) rotate(0deg); } to { transform: translateY(-4px) rotate(-3deg); } }
  @keyframes dr-leg { from { transform: rotate(-28deg); } to { transform: rotate(30deg); } }

  /* 4. ROCKET CRASH */
  .rocket-crash-game { position: relative; z-index: 1; width: min(94vw, 880px); }
  .rc-stage-svg { display: block; width: 100%; height: auto; max-height: calc(100dvh - 200px); overflow: visible; }
  .rc-board-bg { fill: #0b1410; stroke: #ff0055; stroke-width: 3; filter: drop-shadow(0 0 16px rgb(255 0 85 / 25%)); }
  .rc-grid-line { stroke: rgb(255 255 255 / 10%); stroke-width: 1; }
  .rc-axis-text { fill: #8fa094; font-size: 12px; font-weight: 750; }
  .rc-area-fill { fill: url(#rc-area-glow); }
  .rc-trail-curve { fill: none; stroke: url(#rc-trail-glow); stroke-width: 5; stroke-linecap: round; filter: drop-shadow(0 0 10px #ff0055); }
  .rc-star { fill: #fff; opacity: .35; }
  .rc-flame { fill: #ffb000; opacity: 0; transform-box: fill-box; transform-origin: 100% 50%; }
  .rocket-crash-game.is-flying .rc-flame { opacity: 1; animation: rc-flame 90ms linear infinite alternate; }
  @keyframes rc-flame { from { transform: scaleX(.7); fill: #ffd34d; } to { transform: scaleX(1.25); fill: #ff5a00; } }
  .rocket-crash-game.is-flying .rc-rocket-body { animation: rc-shake 70ms linear infinite alternate; }
  @keyframes rc-shake { to { transform: translateY(1px); } }
  .rocket-crash-game.is-crashed .rc-trail-curve { stroke: #ff2a2a; }
  .rc-cashout-line { stroke: #7bff9a; stroke-width: 2; stroke-dasharray: 3 3; }
  .rc-cashout-dot { fill: #7bff9a; filter: drop-shadow(0 0 8px #7bff9a); }
  .rc-cashout-text { fill: #7bff9a; font-size: 12px; font-weight: 900; letter-spacing: .08em; }
  .rc-explosion { transform-box: fill-box; }
  .rc-hud-readout { position: absolute; top: 28px; left: 80px; display: flex; flex-direction: column; }
  .rc-hud-readout strong { color: #ffffff; font-size: clamp(56px, 11vw, 110px); font-weight: 950; line-height: 1; text-shadow: 0 0 35px #ff0055; }
  .rc-hud-readout span { margin-top: 6px; color: #ff99bb; font-size: 14px; font-weight: 850; letter-spacing: .15em; }

  /* 5. PINBALL FRENZY */
  .pinball-game { position: relative; z-index: 1; display: grid; justify-items: center; gap: 14px; width: min(92vw, 600px); }
  .pb-stage-svg { width: 100%; max-height: clamp(280px, 50vh, 480px); display: block; overflow: visible; }
  .pb-cabinet-bg { fill: #0c1410; stroke: #b366ff; stroke-width: 4; filter: drop-shadow(0 0 20px rgb(179 102 255 / 35%)); }
  .pb-cabinet-rim { fill: #111e17; stroke: #233e30; stroke-width: 2; }
  .pb-chute-rail { fill: none; stroke: #ffd700; stroke-width: 3.5; stroke-linecap: round; }
  .pb-bumper circle.pb-bumper-ring { fill: #1e102d; stroke: #00f0ff; stroke-width: 3.5; filter: drop-shadow(0 0 10px #00f0ff); transition: fill 150ms; }
  .pb-bumper circle.pb-bumper-core { fill: #2e1a45; }
  .pb-bumper text.pb-bumper-txt { fill: #ffffff; font-size: 14px; font-weight: 900; }
  .pb-bumper.is-active circle.pb-bumper-ring { fill: #00f0ff; filter: drop-shadow(0 0 25px #00f0ff); }
  .pb-saucer-outer { fill: #1a0f28; stroke: #ffd700; stroke-width: 4; }
  .pb-saucer-inner { fill: #28173e; stroke: #ffffff; stroke-width: 1.5; }
  .pb-saucer-score { fill: #ffffff; font-size: 22px; font-weight: 900; font-family: ui-rounded, sans-serif; }
  .pb-jackpot-saucer.is-won .pb-saucer-outer { fill: #ffd700; filter: drop-shadow(0 0 32px #ffd700); }
  .pb-jackpot-saucer.is-won .pb-saucer-score { fill: #000000; font-size: 24px; font-weight: 950; }
  .pb-flipper-bar { stroke: #ff007f; stroke-width: 8; stroke-linecap: round; }

  /* 6. LUCKY LOTTO */
  .lotto-game { position: relative; z-index: 1; display: grid; justify-items: center; gap: 20px; }
  .lt-globe-pod { display: grid; justify-items: center; }
  .lt-glass-sphere { position: relative; width: clamp(200px, 34vh, 320px); aspect-ratio: 1; border-radius: 50%; border: 3px solid #ffd700; background: radial-gradient(circle at 35% 25%, rgb(255 255 255 / 25%), rgb(0 0 0 / 40%) 80%), #0d1b14; box-shadow: 0 0 40px rgb(255 215 0 / 30%), inset 0 0 40px rgb(0 0 0 / 70%); overflow: hidden; }
  .lt-mini-ball { position: absolute; left: var(--lx); top: var(--ly); display: grid; width: 22%; aspect-ratio: 1; place-items: center; border-radius: 50%; color: #000; background: radial-gradient(circle at 35% 30%, #fff 0 15%, var(--c) 16% 100%); font-size: clamp(10px, 1.5vh, 14px); font-weight: 900; box-shadow: inset -3px -3px 6px rgb(0 0 0 / 30%); }
  .lt-chute-mouth { width: 70px; height: 32px; border: 2px solid #ffd700; border-top: 0; border-radius: 0 0 16px 16px; background: linear-gradient(#2a3e32, #111a15); }
  .lt-golden-jackpot-pod { display: flex; justify-content: center; align-items: center; min-height: 130px; }
  .lt-jackpot-sphere { width: clamp(110px, 18vh, 150px); aspect-ratio: 1; border-radius: 50%; display: grid; place-items: center; color: #000; background: radial-gradient(circle at 35% 28%, #ffffff 0 12%, #ffd700 15% 65%, #b38600 100%); font-size: clamp(34px, 6.5vh, 52px); font-weight: 950; font-family: ui-rounded, sans-serif; box-shadow: 0 0 45px rgb(255 215 0 / 80%), inset -8px -10px 16px rgb(0 0 0 / 35%); opacity: 0; }

  /* 7. SHELL CUPS */
  .cups-game { position: relative; z-index: 1; display: grid; justify-items: center; gap: 16px; }
  .cp-felt-table { position: relative; width: min(92vw, 760px); height: clamp(240px, 42vh, 380px); perspective: 900px; display: grid; place-items: center; }
  .cp-surface { position: absolute; inset: 8% 0 0; border-radius: 40px; border: 10px solid #4a2c1a; background: radial-gradient(ellipse at 50% 40%, #2f7a4b, #15412a 70%, #0c2618); box-shadow: inset 0 0 0 2px #c79a52, inset 0 20px 40px rgb(0 0 0 / 40%), 0 30px 50px rgb(0 0 0 / 50%); transform: rotateX(52deg); transform-origin: 50% 70%; }
  .cp-lane { position: relative; width: 100%; height: 100%; }
  .cp-cup { --w: clamp(100px, 17vh, 150px); --lift: 0; position: absolute; left: 50%; bottom: 26%; width: var(--w); height: calc(var(--w) * 1.1); margin-left: calc(var(--w) / -2); will-change: transform; z-index: 3; }
  .cp-cup-shape { position: absolute; inset: 0; clip-path: polygon(20% 0, 80% 0, 100% 100%, 0 100%); border-radius: 18px 18px 6px 6px; background: linear-gradient(90deg, #6e1414, #c62828 30%, #ff6b5f 46%, #c62828 62%, #5a0d0d); }
  .cp-cup-band { position: absolute; left: 0; right: 0; bottom: 12%; height: 9%; background: linear-gradient(90deg, #8a6418, #ffd76a 45%, #8a6418); }
  .cp-cup::before { content: ""; position: absolute; z-index: 1; top: -5%; left: 19%; width: 62%; height: 11%; border-radius: 50%; background: radial-gradient(ellipse at 45% 40%, #ff7b70, #b71f1f 60%, #6e1414); box-shadow: inset 0 -2px 3px rgb(0 0 0 / 35%); }
  .cp-cup-knob { position: absolute; z-index: 2; top: -9%; left: 50%; width: 22%; height: 10%; margin-left: -11%; border-radius: 50%; background: radial-gradient(circle at 40% 30%, #ffd2cc, #e04848 45%, #8a1414); box-shadow: 0 2px 3px rgb(0 0 0 / 45%); }
  .cp-cup-shadow { position: absolute; left: -6%; right: -6%; bottom: -7%; height: 16%; border-radius: 50%; background: radial-gradient(ellipse, rgb(0 0 0 / 55%), transparent 70%); transform: translateY(calc(var(--lift) * var(--w) * .9)) scale(calc(1 - var(--lift) * .35)); opacity: calc(1 - var(--lift) * .5); }
  .cp-gold-ball { --b: calc(clamp(100px, 17vh, 150px) * .5); position: absolute; left: 50%; bottom: 26%; z-index: 1; width: var(--b); height: var(--b); margin-left: calc(var(--b) / -2); border-radius: 50%; display: grid; place-items: center; color: #000; background: radial-gradient(circle at 35% 28%, #ffffff 0 14%, #ffd700 16% 70%, #996e00 100%); box-shadow: 0 6px 10px rgb(0 0 0 / 45%); font-size: clamp(16px, 2.6vh, 24px); font-weight: 950; }
  .cp-gold-ball.is-revealed { z-index: 5; box-shadow: 0 0 45px #ffd700, 0 0 0 3px #ffffff; }
`;


export const physicalGameStyles = `
  .result-spark { fill:#f2c66d;pointer-events:none;animation:result-sparks 750ms cubic-bezier(.12,.6,.2,1) forwards; }
  @keyframes result-sparks { 0% { opacity:0;transform:translate(0,0) scale(.5); } 15% { opacity:1; } 100% { opacity:0;transform:translate(var(--dx),var(--dy)) scale(0); } }
  .impact-game { gap:8px; }
  .impact-hud { display:grid;justify-items:center;gap:2px;position:relative;z-index:2; }
  .impact-hud span { font-size:11px;letter-spacing:.09em;color:#c1cbc2; }
  .impact-hud strong { font-size:clamp(36px,7vh,60px);line-height:1.1;font-variant-numeric:tabular-nums;color:#f3eedf; }
  .impact-hud small { font-size:11px;color:#c1cbc2; }
  .impact-game .pk-stage-svg,.impact-game .pb-stage-svg { max-height:59dvh; }
  .powered-flipper { fill:none;stroke:#f2c66d;stroke-width:13;stroke-linecap:round;filter:drop-shadow(0 4px 2px #000); }
  .target-award { fill:#e5ffad;font-size:11px;font-weight:850;paint-order:stroke;stroke:#102017;stroke-width:3; }
  .pk-pin:not(.is-scoring),.pk-bumper:not(.is-scoring),.pb-bumper:not(.is-scoring) { opacity:.48; }
  .is-scoring { filter:drop-shadow(0 0 5px #d8ff6a); }
  .impact-points { fill:#e5ffad;font-size:20px;font-weight:900;paint-order:stroke;stroke:#101b15;stroke-width:3;pointer-events:none;animation:impact-rise 850ms ease-out forwards; }
  @keyframes impact-rise { from {opacity:1;transform:translateY(0)} to {opacity:0;transform:translateY(-30px)} }
  .plinko-scoring { display:grid;justify-items:center;gap:16px; }
  .plinko-scoring .stage-svg { max-height:60dvh; }
  .plinko-peg.is-hit { fill:#fff;filter:drop-shadow(0 0 7px #d8ff6a); }
  .physics-rail { fill:none; stroke:#8caa9a; stroke-width:4; stroke-linecap:round; filter:drop-shadow(0 5px 2px #000); }
  .physics-ball,.mr-marble { filter:drop-shadow(0 4px 2px rgb(0 0 0 / 55%)); }
  .is-hit,.is-hit .pb-bumper-ring { fill:#f3eedf; }
  .game-stage[data-phase="result"] [data-result] { filter:drop-shadow(0 2px 5px rgb(242 198 109 / 40%)); }
  .game-panel:has(.game-stage[data-phase="result"]) .score-result { display:none; }
  .game-panel:has(.marble-run-game,.pachinko-game,.derby-game,.rocket-crash-game,.pinball-game,.lotto-game,.cups-game) .game-stage { padding:60px 16px 24px; }
  .mr-stage-svg,.pk-stage-svg,.pb-stage-svg { max-height:min(72dvh,680px); }
  .mr-leaderboard { flex-wrap:wrap;justify-content:flex-end;gap:6px; }
  .mr-rank { font-size:11px;padding:4px 7px; }
  .mr-hud { gap:12px; }
  .mr-pipe-core { stroke:#8eaa9c;stroke-width:1;stroke-dasharray:3 10; }
  .mr-finish-pod { filter:none; }
  .mr-finish-pod circle.mr-pod-base { filter:none; }
  .mr-pod-score { font-size:24px; }
  .mr-finish-pod.is-won .mr-pod-score { font-size:24px; }
  .mr-status-banner,.pk-status-banner,.dr-status-banner,.pb-status-banner,.lt-status-banner,.cp-status-banner { font-size:12px;letter-spacing:.02em; }
  .dr-header { flex-wrap:wrap;gap:8px; }
  .dr-lane { grid-template-columns:100px 1fr; }
  .dr-lane-info { justify-content:space-between; }
  .dr-lane.is-won .dr-lane-score { font-size:26px; }
  .dr-lane.is-won { animation:finish-flash 300ms ease-out; }
  @keyframes finish-flash { from { background:#879277; } }
  .lotto-game { width:min(90vw,600px);gap:12px; }
  .lt-stage-svg { width:100%;max-height:74dvh;overflow:visible; }
  .lt-drum { fill:rgb(13 27 20 / 88%);stroke:#c8b584;stroke-width:4; }
  .lt-tube { fill:#15251b;stroke:#c8b584;stroke-width:3; }
  .lt-reflection { fill:none;stroke:rgb(255 255 255 / 25%);stroke-width:9;stroke-linecap:round; }
  .lt-physical-ball { filter:drop-shadow(0 3px 2px #0008); }
  .lt-physical-ball text { fill:#09140e;font-size:11px;font-weight:850; }
  .lt-physical-ball text[data-result] { font-size:13px; }
  .lt-result-label { fill:#d7e0d4;font-size:13px;letter-spacing:1px; }
  .rc-hud-readout { top:6%;left:12%; }
  .rc-hud-readout strong { font-size:clamp(38px,8vw,86px); }
  @media(max-width:550px) {
    .mr-hud { align-items:flex-start;padding:8px; }
    .mr-hud-title strong { font-size:12px; }
    .mr-hud-title span { display:none; }
    .mr-leaderboard { max-width:65%; }
    .dr-lane { grid-template-columns:82px 1fr;padding:0 7px;gap:6px; }
    .dr-track-meta { display:none; }
    .dr-title { font-size:12px; }
    .mr-stage-svg { max-height:64dvh; }
  }
  @media(prefers-reduced-motion:reduce) { .dr-horse,.dr-leg,.rc-flame,.rc-rocket-body { animation:none!important; } }
`;
