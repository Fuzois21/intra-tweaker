import { watchTagResults } from "./tagWatcher";
import { frameLoop } from "./timing";
import { impactAwards, scoreReadout, showImpact } from "./scoring";
import { getAllTags, type Tag } from "../background/common/tags";
import { WINWHEEL_GAMES, type WinwheelGameId } from "../../utils/winwheelGames";
import { casinoStyles } from "./styles";
import {
  extraGameStyles,
  physicalGameStyles,
  getExtraGameMarkup,
  runExtraGame,
  type ExtraGameId,
  type FxHelpers,
} from "./extraGames";

type GameId = WinwheelGameId;

type GameDefinition = {
  id: GameId;
  name: string;
  description: string;
};

const gameDescriptions: Record<GameId, string> = {
  wheel: "Spin the original wheel to reveal your tag score.",
  plinko: "Les contacts avec les clous allumés construisent le score de la partie.",
  roulette: "Watch the ball settle on your saved percentage.",
  slots: "Line up the digits of your tag score.",
  dice: "Roll first; your saved score unlocks after the toss.",
  scratch: "Rub away the ticket to uncover your percentage.",
  crash: "Watch the rocket multiply your score before it crashes.",
  lotto: "Spin the drum and draw the golden jackpot score ball.",
  derby: "5 thoroughbred horses race for the winning score.",
  cups: "Track the golden ball through lightning-fast shuffles.",
  marbles: "4 high-speed marbles battle down the winding track.",
  pachinko: "Arcade fever spheres bounce through pins into the jackpot pocket.",
  pinball: "Catapult the chrome ball into neon bumpers and the jackpot saucer.",
};

const games: GameDefinition[] = WINWHEEL_GAMES.map(({ id, label }) => ({
  id,
  name: label,
  description: gameDescriptions[id],
}));
const isGameId = (value: unknown): value is GameId => games.some((game) => game.id === value);

const colors = ["#d8ff6a", "#ff7771", "#82dff0", "#f2c66d", "#7be4c2", "#bd9cf2", "#ef9dc8", "#f4eedf"];
const rouletteColors = ["#14734f", "#151d19", "#a53e36", "#151d19", "#a53e36", "#151d19", "#a53e36", "#151d19", "#a53e36", "#151d19", "#a53e36", "#151d19"];
const activeAnimations = new Set<Animation>();

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const prefersReducedMotion = () => typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const motionTime = (milliseconds: number) => prefersReducedMotion() ? Math.min(milliseconds, 420) : milliseconds;

const shuffle = <T,>(items: T[]): T[] => {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
};

const makeOutcomes = (score: number, count: number) => {
  const outcomes = new Set<number>([score, 0, 100]);
  while (outcomes.size < count) outcomes.add(Math.floor(Math.random() * 101));
  return shuffle([...outcomes].slice(0, count));
};

const polar = (center: number, radius: number, degrees: number) => {
  const radians = (degrees * Math.PI) / 180;
  return { x: center + Math.cos(radians) * radius, y: center + Math.sin(radians) * radius };
};

const makeWheelMarkup = (game: "wheel" | "roulette", score: number) => {
  const isRoulette = game === "roulette";
  const count = isRoulette ? rouletteColors.length : 8;
  const outcomes = makeOutcomes(score, count);
  const step = 360 / count;
  const center = 220;
  const radius = isRoulette ? 184 : 190;
  const landingFraction = isRoulette
    ? 0.5
    : Math.random() < 0.5
      ? 0.055 + Math.random() * 0.1
      : 0.845 + Math.random() * 0.1;
  const segments = outcomes.map((outcome, index) => {
    const start = -90 + index * step;
    const end = start + step;
    const from = polar(center, radius, start);
    const to = polar(center, radius, end);
    const middle = polar(center, radius * 0.68, start + step / 2);
    const fill = isRoulette ? rouletteColors[index] : colors[index % colors.length];
    return `<path d="M ${center} ${center} L ${from.x.toFixed(2)} ${from.y.toFixed(2)} A ${radius} ${radius} 0 0 1 ${to.x.toFixed(2)} ${to.y.toFixed(2)} Z" fill="${fill}" stroke="#18241d" stroke-width="2"/><text class="${isRoulette ? "roulette-label" : "wheel-label"}" x="${middle.x.toFixed(2)}" y="${middle.y.toFixed(2)}" text-anchor="middle" dominant-baseline="middle">${outcome}%</text>`;
  }).join("");
  const pointer = isRoulette
    ? `<circle class="roulette-ball" cx="220" cy="22" r="7"/>`
    : `<path class="wheel-pointer" d="M 220 48 L 202 12 L 238 12 Z"/>`;
  const centerMark = isRoulette
    ? `<circle class="roulette-center" cx="220" cy="220" r="39"/><text class="roulette-center-text" x="220" y="224" text-anchor="middle">INTRA</text>`
    : `<circle class="wheel-hub" cx="220" cy="220" r="34"/><text class="wheel-hub-text" x="220" y="224" text-anchor="middle">SPIN</text>`;
  const rouletteTrack = isRoulette
    ? `<circle class="roulette-track" cx="220" cy="220" r="199"/><circle class="roulette-track-inner" cx="220" cy="220" r="188"/>`
    : "";
  return `<svg class="stage-svg${isRoulette ? " roulette-scene" : ""}" viewBox="0 0 440 440" role="img" aria-label="${isRoulette ? "Roulette wheel" : "Prize wheel"} with percentage pockets"><defs><radialGradient id="roulette-ball-gradient" cx="32%" cy="25%"><stop offset="0" stop-color="#fffef3"/><stop offset=".48" stop-color="#f8edc9"/><stop offset="1" stop-color="#9a7840"/></radialGradient></defs><circle cx="220" cy="220" r="209" fill="#0b130f" stroke="#53695c" stroke-width="2"/><circle cx="220" cy="220" r="198" fill="none" stroke="#b29658" stroke-width="2"/>${rouletteTrack}<g class="${isRoulette ? "roulette-rotor" : "wheel-rotor"}" data-target="${outcomes.indexOf(score)}" data-count="${count}" data-landing="${landingFraction}">${segments}<circle cx="220" cy="220" r="39" fill="#101a14" stroke="#bd9a52" stroke-width="3"/></g>${centerMark}${isRoulette ? pointer.replace('<circle class="roulette-ball"', '<circle fill="url(#roulette-ball-gradient)" class="roulette-ball"') : pointer}</svg>`;
};

const makePlinkoMarkup = (score: number) => {
  const left = 38;
  const slotWidth = 52.4;
  const targetIndex = Math.floor(Math.random() * 11);

  const pegs = Array.from({ length: 10 }, (_, row) => {
    const y = 35 + row * 25;
    return Array.from({ length: 11 }, (_, column) => {
      const x = 38 + column * 52.4 + (row % 2 ? 26.2 : 0);
      if (x > 600) return "";
      return `<circle class="plinko-peg" cx="${x.toFixed(1)}" cy="${y}" r="3.3"/>`;
    }).join("");
  }).join("");
  const dividers = Array.from({ length: 12 }, (_, index) => {
    const x = left + index * slotWidth;
    return `<line class="plinko-divider" x1="${x.toFixed(1)}" y1="294" x2="${x.toFixed(1)}" y2="322"/>`;
  }).join("");
  const labels = Array.from({ length: 11 }, (_, index) => {
    const x = left + slotWidth * (index + 0.5);
    return `<text class="plinko-slot" data-slot="${index}" x="${x.toFixed(1)}" y="340" text-anchor="middle">?</text>`;
  }).join("");

  return `<div class="plinko-scoring">${scoreReadout()}<svg class="stage-svg plinko-board" viewBox="0 0 652.4 350" role="img" aria-label="Plinko : chaque contact lumineux rapporte des points."><g>${pegs}</g><g class="plinko-ball" data-target-slot="${targetIndex}" transform="translate(326.2 20)"><circle r="8"/></g>${dividers}<path class="plinko-divider" d="M38 322h576.4"/>${labels}</svg></div>`;
};

const makeSlotsMarkup = () => {
  const reels = [0, 1, 2].map(() => {
    const digits = Array.from({ length: 40 }, (_, index) => `<span class="slot-digit">${index % 10}</span>`).join("");
    return `<div class="slot-reel" aria-hidden="true"><div class="slot-strip">${digits}</div><span class="slot-glass"></span></div>`;
  }).join("");
  const bulbs = Array.from({ length: 14 }, (_, index) => `<span class="slot-bulb" style="--bulb:${index}"></span>`).join("");
  return `<div class="slots-cabinet"><div class="slots-marquee">${bulbs}<strong>JACKPOT</strong></div><div class="slots-machine" aria-label="Three spinning score reels">${reels}<span class="slots-payline" aria-hidden="true"></span></div><span class="slots-caption">Lucky score</span><div class="slots-lever" data-slots-lever aria-hidden="true"><span class="slots-lever-arm"><span class="slots-lever-knob"></span></span></div></div>`;
};

const diceDigits = (score: number) => score === 100 ? "100" : String(score).padStart(2, "0");

const makeDiceMarkup = (score: number) => {
  const digits = diceDigits(score);
  const faceNames = ["front", "right", "back", "left", "top", "bottom"];
  const dice = [...digits].map((digit) => {
    const others = shuffle([..."0123456789"].filter((value) => value !== digit)).slice(0, 5);
    const faces = faceNames.map((face, index) => {
      const value = index === 0 ? digit : others[index - 1];
      return `<span class="die-face die-face-${face}" data-face="${face}" aria-hidden="true">${value}</span>`;
    }).join("");
    return `<div class="die-slot" data-die-slot data-target="${digit}" role="img" aria-label="Number die rolling"><div class="die-shadow" data-die-shadow></div><div class="die"><div class="die-cube" data-die-cube>${faces}</div></div></div>`;
  }).join("");
  return `<div class="dice-table" data-dice-table><div class="dice-felt"></div><div class="dice-row">${dice}</div><p class="dice-total" data-dice-total hidden></p></div>`;
};

const makeScratchMarkup = (score: number) => `<div class="scratch-area"><div class="scratch-card"><div class="scratch-score"><strong>${score}%</strong><span>Recorded tag score</span></div><canvas class="scratch-canvas" width="720" height="300" aria-hidden="true"></canvas></div><p class="scratch-hint">Drag across the ticket, or use the button below.</p><button class="scratch-reveal" type="button">Reveal scratch card</button></div>`;

const getGameMarkup = (game: GameId, score: number) => {
  switch (game) {
    case "wheel":
    case "roulette":
      return makeWheelMarkup(game, score);
    case "plinko":
      return makePlinkoMarkup(score);
    case "slots":
      return makeSlotsMarkup();
    case "dice":
      return makeDiceMarkup(score);
    case "scratch":
      return makeScratchMarkup(score);
    case "crash":
    case "lotto":
    case "derby":
    case "cups":
    case "marbles":
    case "pachinko":
    case "pinball":
      return getExtraGameMarkup(game as ExtraGameId, score);
  }
};

const wait = (milliseconds: number, signal: AbortSignal) => new Promise<boolean>((resolve) => {
  if (signal.aborted) return resolve(false);
  let timeout = 0;
  const done = (completed: boolean) => {
    window.clearTimeout(timeout);
    signal.removeEventListener("abort", onAbort);
    resolve(completed);
  };
  const onAbort = () => done(false);
  timeout = window.setTimeout(() => done(true), motionTime(milliseconds));
  signal.addEventListener("abort", onAbort, { once: true });
});

const animate = (
  element: Element,
  frames: Keyframe[],
  options: KeyframeAnimationOptions,
  signal: AbortSignal
) => new Promise<boolean>((resolve) => {
  if (signal.aborted) return resolve(false);
  const animation = element.animate(frames, { ...options, duration: motionTime(Number(options.duration ?? 0)) });
  activeAnimations.add(animation);
  const finish = (completed: boolean) => {
    activeAnimations.delete(animation);
    signal.removeEventListener("abort", onAbort);
    resolve(completed);
  };
  const onAbort = () => animation.cancel();
  animation.addEventListener("finish", () => finish(true), { once: true });
  animation.addEventListener("cancel", () => finish(false), { once: true });
  signal.addEventListener("abort", onAbort, { once: true });
});

type RouletteBallPoint = { angle: number; radius: number };
type RouletteBallPath = { points: RouletteBallPoint[]; duration: number };

const makeRouletteBallPath = (reducedMotion: boolean): RouletteBallPath => {
  const targetAngle = -Math.PI / 2;
  const initialSpeed = 2 * Math.PI * (reducedMotion ? 0.8 + Math.random() * 0.25 : 5.2 + Math.random() * 1.8);
  const drag = reducedMotion ? 1.15 : 0.48 + Math.random() * 0.13;
  const stopSpeed = 0.22;
  const stepTime = 1 / 60;
  const totalTravel = (initialSpeed - stopSpeed) / drag;
  let angle = targetAngle + totalTravel;
  let angularSpeed = initialSpeed;
  let radius = 198;
  let radialSpeed = 0;
  const rawPoints: RouletteBallPoint[] = [{ angle, radius }];
  const wobblePhase = Math.random() * Math.PI * 2;

  for (let step = 0; angularSpeed > stopSpeed && step < 1600; step++) {
    const nextAngularSpeed = angularSpeed * Math.exp(-drag * stepTime);
    angle -= ((angularSpeed + nextAngularSpeed) / 2) * stepTime;
    angularSpeed = nextAngularSpeed;

    const progress = step / Math.max(1, Math.ceil(Math.log(initialSpeed / stopSpeed) / drag / stepTime));
    const energy = angularSpeed / initialSpeed;
    const restingRadius = 157 + 41 * energy;
    const radialAcceleration = (restingRadius - radius) * 42 - radialSpeed * 11 - 8;
    radialSpeed += radialAcceleration * stepTime;
    radius += radialSpeed * stepTime;

    if (radius > 203) {
      radius = 203;
      radialSpeed = -Math.abs(radialSpeed) * 0.42;
    } else if (radius < 148) {
      radius = 148;
      radialSpeed = Math.abs(radialSpeed) * 0.34;
    }

    const settling = clamp((progress - 0.68) / 0.32, 0, 1);
    const bounceEnvelope = Math.sin(settling * Math.PI);
    angle += Math.sin(settling * Math.PI * 8 + wobblePhase) * 0.045 * bounceEnvelope;
    radius += Math.sin(settling * Math.PI * 7 + wobblePhase) * 6 * bounceEnvelope;
    rawPoints.push({ angle, radius });
  }

  const lastPoint = rawPoints[rawPoints.length - 1];
  const angleCorrection = targetAngle - lastPoint.angle;
  const radiusCorrection = 156 - lastPoint.radius;
  const points = rawPoints.map((point, index) => {
    const progress = index / Math.max(1, rawPoints.length - 1);
    const correction = progress * progress * (3 - 2 * progress);
    return {
      angle: point.angle + angleCorrection * correction,
      radius: clamp(point.radius + radiusCorrection * correction, 145, 203),
    };
  });

  return { points, duration: (points.length - 1) * stepTime * 1000 };
};

const animateRouletteBall = (
  ball: SVGCircleElement,
  path: RouletteBallPath,
  signal: AbortSignal,
) => new Promise<boolean>((resolve) => {
  if (signal.aborted || path.points.length < 2) return resolve(false);
  let animationFrame = 0;
  let startedAt: number | null = null;
  let finished = false;

  const paint = (point: RouletteBallPoint) => {
    ball.setAttribute("cx", (220 + Math.cos(point.angle) * point.radius).toFixed(2));
    ball.setAttribute("cy", (220 + Math.sin(point.angle) * point.radius).toFixed(2));
  };
  const finish = (completed: boolean) => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(animationFrame);
    signal.removeEventListener("abort", onAbort);
    if (completed) paint(path.points[path.points.length - 1]);
    resolve(completed);
  };
  const onAbort = () => finish(false);
  const tick = (now: number) => {
    if (signal.aborted) return finish(false);
    startedAt ??= now;
    const progress = clamp((now - startedAt) / motionTime(path.duration), 0, 1);
    const position = progress * (path.points.length - 1);
    const lowerIndex = Math.floor(position);
    const upperIndex = Math.min(path.points.length - 1, lowerIndex + 1);
    const fraction = position - lowerIndex;
    const lower = path.points[lowerIndex];
    const upper = path.points[upperIndex];
    paint({
      angle: lower.angle + (upper.angle - lower.angle) * fraction,
      radius: lower.radius + (upper.radius - lower.radius) * fraction,
    });
    if (progress >= 1) return finish(true);
    animationFrame = requestAnimationFrame(tick);
  };

  signal.addEventListener("abort", onAbort, { once: true });
  animationFrame = requestAnimationFrame(tick);
});

const rollWheel = async (stage: HTMLElement, game: "wheel" | "roulette", signal: AbortSignal) => {
  const rotor = stage.querySelector<SVGElement>(game === "roulette" ? ".roulette-rotor" : ".wheel-rotor");
  if (!rotor) return false;
  const target = Number(rotor.dataset.target);
  const count = Number(rotor.dataset.count);
  const landing = game === "roulette" ? 0.5 : Number(rotor.dataset.landing);
  const reducedMotion = prefersReducedMotion();
  const turns = reducedMotion
    ? (game === "roulette" ? 1 : 2)
    : game === "roulette"
      ? 8 + Math.floor(Math.random() * 4)
      : 10 + Math.floor(Math.random() * 5);
  const end = 360 * turns - ((target + landing) * 360) / count;
  const ball = game === "roulette" ? stage.querySelector<SVGCircleElement>(".roulette-ball") : null;
  const ballPath = ball ? makeRouletteBallPath(reducedMotion) : null;
  const duration = ballPath?.duration ?? 8200 + Math.random() * 2400;
  const animationOptions = {
    duration,
    easing: game === "roulette" ? "cubic-bezier(.07,.82,.13,1)" : "cubic-bezier(.045,.86,.12,1)",
    fill: "forwards",
  } as const;
  const rotorRun = animate(rotor, [{ transform: "rotate(0deg)" }, { transform: `rotate(${end}deg)` }], animationOptions, signal);
  const labelRuns = [...rotor.querySelectorAll<SVGTextElement>(".wheel-label, .roulette-label")].map((label) => animate(label, [
    { transform: "rotate(0deg)" },
    { transform: `rotate(${-end}deg)` },
  ], animationOptions, signal));
  const wheelRun = Promise.all([rotorRun, ...labelRuns]).then((results) => results.every(Boolean));

  if (ball && ballPath) {
    const ballRun = animateRouletteBall(ball, ballPath, signal);
    const [wheelDone, ballDone] = await Promise.all([wheelRun, ballRun]);
    return wheelDone && ballDone;
  }
  return wheelRun;
};

const runPlinko = async (stage: HTMLElement, score: number, signal: AbortSignal) => {
  const ball = stage.querySelector<SVGGElement>(".plinko-ball");
  if (!ball) return false;
  let targetIndex = Number(ball.dataset.targetSlot);
  const pegs = [...stage.querySelectorAll<SVGCircleElement>(".plinko-peg")].map((peg) => ({
    x: Number(peg.getAttribute("cx")),
    y: Number(peg.getAttribute("cy")),
    radius: Number(peg.getAttribute("r")),
  }));
  if (!Number.isInteger(targetIndex) || pegs.length === 0) return false;

  const leftEdge = 38;
  const slotWidth = 52.4;
  const rightEdge = leftEdge + slotWidth * 11;
  const boardCenter = (leftEdge + rightEdge) / 2;
  const ballRadius = 8;
  let targetLeft = leftEdge + targetIndex * slotWidth;
  let targetRight = targetLeft + slotWidth;
  const targetX = (targetLeft + targetRight) / 2;
  const stepTime = 1 / 120;

  const simulateDrop = () => {
    const attempts = 32;
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (signal.aborted) return null;

      let x = boardCenter + (Math.random() - 0.5) * 12;
      let y = 20;
      let vx = (targetX - x) / 0.88 + (Math.random() - 0.5) * 112;
      let vy = Math.random() * 24;
      let enteredTarget = false;
      let floorContacts = 0;
      let points = [{ x, y, hit: -1 }];

      for (let step = 0; step < 1500; step++) {
        if (signal.aborted) return null;

        let hit = -1;
        vy += 740 * stepTime;
        x += vx * stepTime;
        y += vy * stepTime;

        if (!enteredTarget) {
          for (const [pegIndex, peg] of pegs.entries()) {
            const dx = x - peg.x;
            const dy = y - peg.y;
            const minimumDistance = ballRadius + peg.radius;
            const distanceSquared = dx * dx + dy * dy;
            if (distanceSquared >= minimumDistance * minimumDistance) continue;

            const distance = Math.sqrt(distanceSquared) || 0.001;
            const normalX = distance > 0.001 ? dx / distance : (Math.random() > 0.5 ? 1 : -1);
            const normalY = distance > 0.001 ? dy / distance : -0.1;
            x = peg.x + normalX * minimumDistance;
            y = peg.y + normalY * minimumDistance;

            const normalSpeed = vx * normalX + vy * normalY;
            if (normalSpeed < 0) {
              hit = pegIndex;
              const restitution = 0.76 + Math.random() * 0.12;
              vx -= (1 + restitution) * normalSpeed * normalX;
              vy -= (1 + restitution) * normalSpeed * normalY;

              const tangentSpeed = vx * -normalY + vy * normalX;
              const pinSpin = clamp(tangentSpeed * 0.045 + (Math.random() - 0.5) * 14, -18, 18);
              vx += pinSpin * normalY;
              vy -= pinSpin * normalX;
            }
          }

          if (x < leftEdge + ballRadius) {
            x = leftEdge + ballRadius;
            if (vx < 0) vx = -vx * 0.78;
          } else if (x > rightEdge - ballRadius) {
            x = rightEdge - ballRadius;
            if (vx > 0) vx = -vx * 0.78;
          }

          if (y >= 294) {
            targetIndex = clamp(Math.floor((x - leftEdge) / slotWidth), 0, 10);
            targetLeft = leftEdge + targetIndex * slotWidth;
            targetRight = targetLeft + slotWidth;
            enteredTarget = true;
            // Entry stays at the simulated position; the slot walls stop it on contact.
            vx *= .72;
          }
        } else {
          if (x < targetLeft + ballRadius) {
            x = targetLeft + ballRadius;
            if (vx < 0) vx = -vx * 0.2;
          } else if (x > targetRight - ballRadius) {
            x = targetRight - ballRadius;
            if (vx > 0) vx = -vx * 0.2;
          }

          if (y > 322 - ballRadius) {
            y = 322 - ballRadius;
            vy = -Math.abs(vy) * 0.24;
            vx *= 0.72;
            floorContacts++;
            if (floorContacts >= 3 && Math.abs(vy) < 80) {
              points.push({ x, y, hit });
              return points;
            }
          }
        }

        points.push({ x, y, hit });
      }
    }
    return null;
  };

  let points = simulateDrop();
  for (let retry = 0; points && !points.some(p => p.hit >= 0) && retry < 32; retry++) points = simulateDrop();
  if (!points || signal.aborted) return false;
  const awards = impactAwards(points.flatMap((p, frame) => p.hit >= 0 ? [{frame,target:p.hit,x:p.x,y:p.y}] : []), score);
  const svg = ball.ownerSVGElement!;
  const live = stage.querySelector<HTMLElement>("[data-live-score]")!;
  const caption = stage.querySelector<HTMLElement>("[data-impact-caption]")!;
  const pegElements = [...stage.querySelectorAll<SVGCircleElement>(".plinko-peg")];
  let awarded = 0, total = 0;
  const updateTargets = () => pegElements.forEach((el,i) => {
    const next=awards.slice(awarded).find(a=>a.target===i);
    el.classList.toggle("is-scoring",(next?.points??1)>0);
  });
  updateTargets();
  const flashes = new Map<number,number>();
  const completed = await frameLoop(prefersReducedMotion()?450:4800,signal,p=>{
    const frame=p*(points!.length-1),index=Math.floor(frame),mix=frame-index;
    const a=points![index],b=points![index+1]??a;
    ball.setAttribute("transform",`translate(${a.x+(b.x-a.x)*mix} ${a.y+(b.y-a.y)*mix})`);
    while(awarded<awards.length&&awards[awarded].frame<=index){
      const award=awards[awarded++];total+=award.points;
      live.textContent=`${total}%`;live.dataset.total=String(total);
      caption.textContent=award.points?`Impact +${award.points}%`:'Impact neutre · aucun point';
      flashes.set(award.target,p);
      if(!prefersReducedMotion())showImpact(svg,award);
      updateTargets();
    }
    pegElements.forEach((el,i)=>el.classList.toggle("is-hit",p-(flashes.get(i)??-1)<.06));
  });
  if (!completed) return false;
  if(total!==score)throw new Error("Plinko impact total mismatch");
  stage.dataset.phase="result";
  live.dataset.result=String(total);
  caption.textContent="Partie terminée · points conservés";
  const targetSlot = stage.querySelector<SVGTextElement>(`.plinko-slot[data-slot="${targetIndex}"]`);
  if (targetSlot) {
    targetSlot.textContent = `${score}%`;
    targetSlot.classList.add("active");
  }
  return true;
};

const runSlots = async (stage: HTMLElement, score: number, signal: AbortSignal) => {
  const strips = [...stage.querySelectorAll<HTMLElement>(".slot-strip")];
  const lever = stage.querySelector<HTMLElement>("[data-slots-lever] .slots-lever-arm");
  const digits = String(score).padStart(3, "0");
  if (lever && !(await animate(lever, [
    { transform: "rotateX(0deg)" },
    { transform: "rotateX(-62deg)", offset: 0.45 },
    { transform: "rotateX(0deg)" },
  ], { duration: 650, easing: "ease-in-out" }, signal))) return false;
  const animations = strips.map(async (strip, index) => {
    const digit = Number(digits[index]);
    const rowHeight = strip.querySelector<HTMLElement>(".slot-digit")?.getBoundingClientRect().height ?? 82;
    const end = (30 + digit) * rowHeight;
    // Reels stop left to right, overshoot slightly and snap back like a real mechanical stop.
    const landed = await animate(strip, [
      { transform: "translateY(0px)", filter: "blur(0px)", offset: 0 },
      { transform: `translateY(-${(end * 0.25).toFixed(1)}px)`, filter: "blur(3px)", offset: 0.25 },
      { transform: `translateY(-${(end * 0.9).toFixed(1)}px)`, filter: "blur(2px)", offset: 0.72 },
      { transform: `translateY(-${(end + rowHeight * 0.16).toFixed(1)}px)`, filter: "blur(0px)", offset: 0.9 },
      { transform: `translateY(-${end.toFixed(1)}px)`, filter: "blur(0px)", offset: 1 },
    ], {
      duration: 2100 + index * 750,
      easing: "cubic-bezier(.3,.1,.3,1)",
      fill: "forwards",
    }, signal);
    if (landed) strip.parentElement?.classList.add("is-stopped");
    return landed;
  });
  const results = await Promise.all(animations);
  if (!results.every(Boolean)) return false;
  stage.querySelector(".slots-cabinet")?.classList.add("is-win");
  return wait(450, signal);
};

const runDice = async (stage: HTMLElement, score: number, signal: AbortSignal) => {
  const slots = [...stage.querySelectorAll<HTMLElement>("[data-die-slot]")];
  const total = stage.querySelector<HTMLElement>("[data-dice-total]");
  const expectedDigits = diceDigits(score);
  if (slots.length !== expectedDigits.length
    || slots.some((slot, index) => slot.dataset.target !== expectedDigits[index])) return false;

  const reduced = prefersReducedMotion();
  const rolls = slots.map(async (slot, index) => {
    const cube = slot.querySelector<HTMLElement>("[data-die-cube]");
    const die = slot.querySelector<HTMLElement>(".die");
    const shadow = slot.querySelector<HTMLElement>("[data-die-shadow]");
    if (!cube || !die || !shadow) return false;
    if (!(await wait(index * 90, signal))) return false;

    // Each die is thrown from the left edge, bounces three times and tumbles until it rests on its front face.
    const throwX = -(260 + index * 70 + Math.random() * 60);
    const drift = (Math.random() - 0.5) * 40;
    const turnsX = reduced ? 1 : 3 + Math.floor(Math.random() * 2);
    const turnsY = reduced ? 1 : 2 + Math.floor(Math.random() * 2);
    const finalX = turnsX * 360;
    const finalY = turnsY * 360;
    const duration = 2300 + Math.random() * 500;
    const hops = [
      { offset: 0, x: throwX, y: -150, z: 0.05 },
      { offset: 0.3, x: throwX * 0.45, y: 0, z: 0.55 },
      { offset: 0.48, x: throwX * 0.22, y: -70, z: 0.72 },
      { offset: 0.64, x: throwX * 0.08, y: 0, z: 0.86 },
      { offset: 0.76, x: throwX * 0.03, y: -22, z: 0.94 },
      { offset: 0.86, x: 0, y: 0, z: 0.985 },
      { offset: 1, x: 0, y: 0, z: 1 },
    ];
    const easing = "cubic-bezier(.3,.6,.4,1)";
    const moved = await Promise.all([
      animate(die, hops.map(({ offset, x, y }) => ({
        offset,
        transform: `translate3d(${x.toFixed(1)}px, ${(y + drift * (1 - offset)).toFixed(1)}px, 0)`,
        easing: y === 0 ? "cubic-bezier(.2,.7,.4,1)" : "cubic-bezier(.6,0,.8,.4)",
      })), { duration, fill: "forwards" }, signal),
      animate(cube, hops.map(({ offset, z }) => ({
        offset,
        transform: `rotateX(${(finalX * z).toFixed(1)}deg) rotateY(${(finalY * z).toFixed(1)}deg) rotateZ(${((1 - z) * 140).toFixed(1)}deg)`,
      })), { duration, easing, fill: "forwards" }, signal),
      animate(shadow, hops.map(({ offset, x, y }) => ({
        offset,
        transform: `translateX(${x.toFixed(1)}px) scale(${(1 + y / 260).toFixed(3)})`,
        opacity: String((0.65 + y / 400).toFixed(3)),
      })), { duration, fill: "forwards" }, signal),
    ]);
    if (!moved.every(Boolean)) return false;
    cube.style.transform = `rotateX(${finalX}deg) rotateY(${finalY}deg)`;
    slot.classList.add("is-landed");
    slot.setAttribute("aria-label", `Die landed on ${slot.dataset.target ?? "0"}`);
    return true;
  });
  if (!(await Promise.all(rolls)).every(Boolean)) return false;
  if (total) {
    total.textContent = `${score}%`;
    total.hidden = false;
  }
  return wait(500, signal);
};

const drawScratchLayer = (canvas: HTMLCanvasElement) => {
  const context = canvas.getContext("2d");
  if (!context) return null;
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#e1d0a1");
  gradient.addColorStop(.52, "#a89058");
  gradient.addColorStop(1, "#d6c18a");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.globalAlpha = .24;
  context.strokeStyle = "#fff3ce";
  context.lineWidth = 2;
  for (let x = -canvas.height; x < canvas.width; x += 24) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x + canvas.height, canvas.height);
    context.stroke();
  }
  context.globalAlpha = 1;
  context.fillStyle = "#19251c";
  context.font = "700 24px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("RUB TO REVEAL", canvas.width / 2, canvas.height / 2);
  context.font = "600 13px system-ui, sans-serif";
  context.fillText("INTRA TWEAKER  /  SCORE TICKET", canvas.width / 2, canvas.height / 2 + 36);
  return context;
};

const runScratch = async (stage: HTMLElement, signal: AbortSignal) => {
  const canvas = stage.querySelector<HTMLCanvasElement>(".scratch-canvas");
  const revealButton = stage.querySelector<HTMLButtonElement>(".scratch-reveal");
  const context = canvas ? drawScratchLayer(canvas) : null;
  if (!canvas || !revealButton || !context) return false;

  return new Promise<boolean>((resolve) => {
    let finished = false;
    let clearedPoints = 0;
    let lastPoint: { x: number; y: number } | null = null;

    const cleanup = () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      revealButton.removeEventListener("click", onRevealClick);
      signal.removeEventListener("abort", onAbort);
    };

    const finish = async (completed: boolean) => {
      if (finished) return;
      finished = true;
      cleanup();
      revealButton.disabled = true;
      if (completed) {
        await animate(canvas, [
          { opacity: 1, transform: "scaleY(1)" },
          { opacity: 0, transform: "scaleY(.92)" },
        ], { duration: 360, easing: "ease-out", fill: "forwards" }, signal);
      }
      resolve(completed && !signal.aborted);
    };

    const scratchAt = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const point = {
        x: ((event.clientX - rect.left) / rect.width) * canvas.width,
        y: ((event.clientY - rect.top) / rect.height) * canvas.height,
      };
      context.globalCompositeOperation = "destination-out";
      context.lineCap = "round";
      context.lineJoin = "round";
      context.lineWidth = 58;
      context.beginPath();
      if (lastPoint) {
        context.moveTo(lastPoint.x, lastPoint.y);
        context.lineTo(point.x, point.y);
      } else {
        context.arc(point.x, point.y, 29, 0, Math.PI * 2);
      }
      context.stroke();
      context.globalCompositeOperation = "source-over";
      lastPoint = point;
      clearedPoints++;
    };

    const enoughScratched = () => {
      if (clearedPoints < 16) return false;
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let cleared = 0;
      let total = 0;
      for (let index = 3; index < pixels.length; index += 4 * 10) {
        total++;
        if (pixels[index] < 90) cleared++;
      }
      return cleared / total > .28;
    };

    const onPointerDown = (event: PointerEvent) => {
      event.preventDefault();
      canvas.setPointerCapture(event.pointerId);
      lastPoint = null;
      scratchAt(event);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!canvas.hasPointerCapture(event.pointerId)) return;
      scratchAt(event);
      if (enoughScratched()) void finish(true);
    };
    const onPointerUp = () => { lastPoint = null; };
    const onRevealClick = () => { void finish(true); };
    const onAbort = () => { void finish(false); };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    revealButton.addEventListener("click", onRevealClick);
    signal.addEventListener("abort", onAbort, { once: true });
  });
};

const runGame = (game: GameId, stage: HTMLElement, score: number, signal: AbortSignal) => {
  switch (game) {
    case "wheel":
    case "roulette":
      return rollWheel(stage, game, signal);
    case "plinko":
      return runPlinko(stage, score, signal);
    case "slots":
      return runSlots(stage, score, signal);
    case "dice":
      return runDice(stage, score, signal);
    case "scratch":
      return runScratch(stage, signal);
    case "crash":
    case "lotto":
    case "derby":
    case "cups":
    case "marbles":
    case "pachinko":
    case "pinball":
    {
      const fx: FxHelpers = {
        animate,
        wait,
        reduced: prefersReducedMotion,
      };
      return runExtraGame(game as ExtraGameId, stage, score, signal, fx);
    }
  }
};

const demoRequestKey = "__intraTweakerWinwheelDemo";

const getEnabledGameIds = async (): Promise<GameId[]> => {
  const extension = globalThis as typeof globalThis & {
    browser?: { runtime?: { sendMessage?: (message: unknown) => Promise<any> } };
    chrome?: { runtime?: { sendMessage?: (message: unknown) => Promise<any> } };
  };
  const runtime = extension.browser?.runtime ?? extension.chrome?.runtime;
  if (!runtime?.sendMessage) return games.map(({ id }) => id);

  try {
    const settings = await runtime.sendMessage({ action: "fetchWinwheelGameSettings" });
    return games.filter(({ id }) => settings?.[id] === true).map(({ id }) => id);
  } catch {
    return [];
  }
};

let tagOverlaySequence = 0;

const createGameOverlay = ({
  score,
  tag,
  isDemo,
  initialGame,
}: {
  score: number;
  tag: Tag | null;
  isDemo: boolean;
  initialGame: GameId;
}) => {
  const tracePercentage = tag?.element.getElementsByTagName("trace-symbol").item(0) as HTMLElement | null;
  const actionContainer = tag?.element.getElementsByClassName("list__item__right").item(0) as HTMLElement | null;
  if (!isDemo && (!tag || !tracePercentage || !actionContainer)) return;

  const rootId = isDemo ? "intra-tweaker-winwheel-demo-root" : `intra-tweaker-winwheel-root${tagOverlaySequence++ ? "-" + tagOverlaySequence : ""}`;
  if (document.getElementById(rootId)) return;

  const originalDisplay = tracePercentage?.style.display ?? "";
  const originalRole = tag?.element.getAttribute("role");
  const originalTabIndex = tag?.element.getAttribute("tabindex");
  const host = document.createElement("div");
  host.id = rootId;
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = casinoStyles + extraGameStyles + physicalGameStyles;

  const overlay = document.createElement("div");
  overlay.className = "casino-overlay";
  overlay.hidden = true;
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = [
    '<section class="casino-dialog" role="dialog" aria-modal="true" aria-labelledby="game-title" aria-describedby="game-description" tabindex="-1">',
    '<h2 class="sr-only" id="game-title">Prize wheel</h2>',
    '<p class="sr-only" id="game-description"></p>',
    '<button class="casino-close" type="button" aria-label="Close game"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>',
    '<section class="game-panel" data-game="wheel" aria-label="Mini-game">',
    '<div class="game-stage" id="game-stage"></div>',
    '<p class="game-status sr-only" role="status" aria-live="polite">Ready when you are.</p>',
    '<div class="score-result" hidden tabindex="-1"><span class="score-result-label">Your saved tag score</span><strong class="score-result-value"></strong></div>',
    '</section></section>',
  ].join("");
  shadow.append(style, overlay);
  document.body.appendChild(host);

  const panel = shadow.querySelector<HTMLElement>(".game-panel")!;
  const stage = shadow.querySelector<HTMLElement>("#game-stage")!;
  const gameName = shadow.querySelector<HTMLElement>("#game-title")!;
  const gameDescription = shadow.querySelector<HTMLElement>("#game-description")!;
  const gameStatus = shadow.querySelector<HTMLElement>(".game-status")!;
  const scoreResult = shadow.querySelector<HTMLElement>(".score-result")!;
  const scoreResultLabel = shadow.querySelector<HTMLElement>(".score-result-label")!;
  const scoreResultValue = shadow.querySelector<HTMLElement>(".score-result-value")!;
  const closeButton = shadow.querySelector<HTMLButtonElement>(".casino-close")!;

  let selectedGame: GameId = initialGame;
  let isOpen = false;
  let isRunning = false;
  let hasRevealed = false;
  let activeController: AbortController | null = null;
  let closeTimer: number | null = null;
  let triggerButton: HTMLButtonElement | null = null;
  let previousOverflow = "";
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const cancelRun = () => {
    activeController?.abort();
    activeController = null;
    for (const animation of activeAnimations) animation.cancel();
    activeAnimations.clear();
    isRunning = false;
    panel.classList.remove("is-running");
  };

  const renderGame = (id: GameId) => {
    const game = games.find((candidate) => candidate.id === id)!;
    selectedGame = id;
    panel.dataset.game = id;
    panel.classList.remove("has-result");
    gameName.textContent = game.name;
    gameDescription.textContent = game.description;
    delete stage.dataset.phase;
    stage.innerHTML = getGameMarkup(id, score);
    scoreResult.hidden = true;
    scoreResultValue.textContent = "";
    gameStatus.textContent = "Ready when you are.";
  };

  const finishReveal = () => {
    if (!hasRevealed || isDemo || !tag || !tracePercentage) return;
    if (originalDisplay) tracePercentage.style.display = originalDisplay;
    else tracePercentage.style.removeProperty("display");
    triggerButton?.remove();
    if (originalRole) tag.element.setAttribute("role", originalRole);
    else tag.element.removeAttribute("role");
    if (originalTabIndex) tag.element.setAttribute("tabindex", originalTabIndex);
    else tag.element.removeAttribute("tabindex");
  };

  const closeOverlay = () => {
    if (!isOpen) return;
    if (closeTimer !== null) {
      window.clearTimeout(closeTimer);
      closeTimer = null;
    }
    cancelRun();
    isOpen = false;
    overlay.classList.remove("is-open");
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
    document.documentElement.style.overflow = previousOverflow;
    const revealed = hasRevealed;
    const restoreFocus = triggerButton;
    if (revealed) finishReveal();
    triggerButton = null;
    if (isDemo) host.remove();
    if (tag && revealed) (tag.element as HTMLElement).focus();
    else if (restoreFocus) restoreFocus.focus();
    else previousFocus?.focus();
  };

  const openOverlay = (button: HTMLButtonElement | null, gameId: GameId) => {
    triggerButton = button;
    hasRevealed = false;
    previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    renderGame(gameId);
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    isOpen = true;
    requestAnimationFrame(() => overlay.classList.add("is-open"));
    closeButton.focus();
    void startGame();
  };

  async function startGame() {
    if (isRunning || !isOpen) return;

    isRunning = true;
    panel.classList.add("is-running");
    gameStatus.textContent = selectedGame === "scratch"
      ? "Drag across the card, or use its reveal button."
      : isDemo
        ? "A random score is waiting at the finish."
        : "Your tag score is waiting at the finish.";
    const controller = new AbortController();
    activeController = controller;
    try {
      const completed = await runGame(selectedGame, stage, score, controller.signal);
      if (controller.signal.aborted || !isOpen) return;
      if (!completed) throw new Error("Game animation did not complete");

      hasRevealed = true;
      isRunning = false;
      panel.classList.remove("is-running");
      panel.classList.add("has-result");
      scoreResultLabel.textContent = isDemo ? "Random demo result" : "Your saved tag score";
      scoreResultValue.textContent = String(score) + "%";
      scoreResult.hidden = false;
      gameStatus.textContent = isDemo
        ? "Random demo result: " + score + "%."
        : "Saved tag score revealed: " + score + "%.";
      closeTimer = window.setTimeout(() => {
        closeTimer = null;
        closeOverlay();
      }, 2600);
    } catch (error) {
      if (!controller.signal.aborted && isOpen) {
        console.error("Winwheel animation failed", selectedGame, error);
        gameStatus.classList.remove("sr-only");
        gameStatus.textContent = "Animation interrompue. Fermez puis relancez le jeu.";
      }
    } finally {
      if (activeController === controller) {
        activeController = null;
        if (!hasRevealed && !controller.signal.aborted) {
          isRunning = false;
          panel.classList.remove("is-running");
        }
      }
    }
  }

  closeButton.addEventListener("click", closeOverlay);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeOverlay();
  });
  overlay.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeOverlay();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...shadow.querySelectorAll<HTMLElement>("button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex='-1'])")]
      .filter((element) => element.offsetParent !== null);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && shadow.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && shadow.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  if (isDemo) {
    openOverlay(null, initialGame);
    return;
  }

  if (!tag || !tracePercentage || !actionContainer) return;
  const button = document.createElement("button");
  button.type = "button";
  button.classList.add("button__big");
  button.textContent = "Lancer un mini-jeu";
  button.setAttribute("aria-haspopup", "dialog");
  tag.element.setAttribute("role", "group");
  tag.element.setAttribute("tabindex", "-1");
  tracePercentage.style.display = "none";
  button.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (isOpen || button.disabled) return;

    const enabledGames = await getEnabledGameIds();
    if (enabledGames.length === 0) {
      button.textContent = "Enable a mini-game in Intra Tweaker";
      return;
    }

    button.textContent = "Lancer un mini-jeu";
    const gameId = enabledGames[Math.floor(Math.random() * enabledGames.length)];
    openOverlay(button, gameId);
  });
  actionContainer.prepend(button);
  return () => {
    if (isOpen) closeOverlay();
    else cancelRun();
    button.remove();
    host.remove();
    tracePercentage.style.display = originalDisplay;
    if (originalRole === null || originalRole === undefined) tag.element.removeAttribute("role");
    else tag.element.setAttribute("role", originalRole);
    if (originalTabIndex === null || originalTabIndex === undefined) tag.element.removeAttribute("tabindex");
    else tag.element.setAttribute("tabindex", originalTabIndex);
  };
};

const run = () => {
  const globalScope = globalThis as typeof globalThis & Record<string, unknown>;
  const requestedDemoGame = globalScope[demoRequestKey];
  delete globalScope[demoRequestKey];

  const tag = getAllTags()?.find((candidate) =>
    candidate.status === "SUCCEEDED" && candidate.percentage !== undefined,
  );

  if (isGameId(requestedDemoGame)) {
    createGameOverlay({
      score: tag?.status === "SUCCEEDED" ? clamp(Math.round(tag.percentage ?? 0), 0, 100) : Math.floor(Math.random() * 101),
      tag: null,
      isDemo: true,
      initialGame: requestedDemoGame,
    });
    return;
  }

  const watcherKey = "__intraTweakerWinwheelWatcher";
  const previous = globalScope[watcherKey];
  if (typeof previous === "function") previous();
  globalScope[watcherKey] = watchTagResults((tag, score) => createGameOverlay({
    score, tag, isDemo: false, initialGame: "wheel",
  }));
};

export default defineUnlistedScript(() => {
  run();
});
