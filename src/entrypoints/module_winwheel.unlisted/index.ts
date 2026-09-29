import { getAllTags } from "../background/common/tags";
import { casinoStyles } from "./styles";

type GameId = "wheel" | "plinko" | "roulette" | "slots" | "dice" | "scratch";

type GameDefinition = {
  id: GameId;
  name: string;
  description: string;
  icon: string;
  accent: string;
};

const iconMarkup: Record<GameId, string> = {
  wheel: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.64 5.64l12.72 12.72M18.36 5.64 5.64 18.36"/><circle cx="12" cy="12" r="2.4"/></svg>`,
  plinko: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16M5 8h14M4 12h16M5 16h14M4 20h16"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/><circle cx="15" cy="12" r="1.2" fill="currentColor"/><circle cx="10" cy="16" r="1.2" fill="currentColor"/></svg>`,
  roulette: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><path d="M12 3v4.5M20 9l-4.2 1.4M17 19l-2.6-3.7M7 19l2.6-3.7M4 9l4.2 1.4"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>`,
  slots: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M8 5v14M16 5v14M6 11h.01M12 13h.01M18 10h.01"/></svg>`,
  dice: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01" stroke-width="2.8"/></svg>`,
  scratch: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8 15 7-7M8 9l2-2m4 10 3-3M7 18h10"/><circle cx="17" cy="7" r="1" fill="currentColor"/></svg>`,
};

const games: GameDefinition[] = [
  { id: "wheel", name: "Prize wheel", description: "Spin the original wheel to reveal your tag score.", icon: iconMarkup.wheel, accent: "#d8ff6a" },
  { id: "plinko", name: "Plinko", description: "0% sits at the edges; 100% sits in the center.", icon: iconMarkup.plinko, accent: "#82dff0" },
  { id: "roulette", name: "Roulette", description: "Watch the ball settle on your saved percentage.", icon: iconMarkup.roulette, accent: "#ff7771" },
  { id: "slots", name: "Lucky slots", description: "Line up the digits of your tag score.", icon: iconMarkup.slots, accent: "#e7a2ed" },
  { id: "dice", name: "Lucky dice", description: "Roll first; your saved score unlocks after the toss.", icon: iconMarkup.dice, accent: "#f2c66d" },
  { id: "scratch", name: "Scratch card", description: "Rub away the ticket to uncover your percentage.", icon: iconMarkup.scratch, accent: "#7be4c2" },
];

const colors = ["#d8ff6a", "#ff7771", "#82dff0", "#f2c66d", "#7be4c2", "#bd9cf2", "#ef9dc8", "#f4eedf"];
const rouletteColors = ["#14734f", "#151d19", "#a53e36", "#151d19", "#a53e36", "#151d19", "#a53e36", "#151d19", "#a53e36", "#151d19", "#a53e36", "#151d19"];
const activeAnimations = new Set<Animation>();

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const motionTime = (milliseconds: number) => {
  const reduceMotion = typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return reduceMotion ? Math.min(milliseconds, 420) : milliseconds;
};

const isGameId = (value: string | undefined): value is GameId => games.some((game) => game.id === value);

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
    ? `<g class="roulette-orbit"><circle class="roulette-ball" cx="220" cy="30" r="8"/></g>`
    : `<path class="wheel-pointer" d="M 220 7 L 236 44 L 220 37 L 204 44 Z"/>`;
  const centerMark = isRoulette
    ? `<circle class="roulette-center" cx="220" cy="220" r="39"/><text class="roulette-center-text" x="220" y="224" text-anchor="middle">INTRA</text>`
    : `<circle class="wheel-hub" cx="220" cy="220" r="34"/><text class="wheel-hub-text" x="220" y="224" text-anchor="middle">SPIN</text>`;
  return `<svg class="stage-svg" viewBox="0 0 440 440" role="img" aria-label="${isRoulette ? "Roulette wheel" : "Prize wheel"} with percentage pockets"><circle cx="220" cy="220" r="209" fill="#0b130f" stroke="#53695c" stroke-width="2"/><circle cx="220" cy="220" r="198" fill="none" stroke="#b29658" stroke-width="2"/><g class="${isRoulette ? "roulette-rotor" : "wheel-rotor"}" data-target="${outcomes.indexOf(score)}" data-count="${count}">${segments}<circle cx="220" cy="220" r="39" fill="#101a14" stroke="#bd9a52" stroke-width="3"/></g>${centerMark}${pointer}</svg>`;
};

const makePlinkoMarkup = (score: number) => {
  const center = 300;
  const left = 38;
  const slotWidth = 52.4;
  const edgeDistance = (100 - score) / 100;
  const side = score === 100 || Math.random() > 0.5 ? -1 : 1;
  const targetIndex = clamp(Math.round(5 + side * edgeDistance * 5), 0, 10);
  const targetX = left + slotWidth * (targetIndex + 0.5);
  const points = [{ x: center, y: 20 }];

  for (let row = 1; row <= 10; row++) {
    const progress = row / 10;
    const idealX = center + (targetX - center) * progress;
    const jitter = row === 10 ? 0 : (Math.random() - 0.5) * 38;
    points.push({
      x: row === 10 ? targetX : clamp(idealX + jitter, 39, 561),
      y: 20 + row * 26,
    });
  }

  const pegs = Array.from({ length: 10 }, (_, row) => {
    const y = 35 + row * 25;
    return Array.from({ length: 11 }, (_, column) => {
      const x = 38 + column * 52.4 + (row % 2 ? 26.2 : 0);
      if (x > 568) return "";
      return `<circle class="plinko-peg" cx="${x.toFixed(1)}" cy="${y}" r="3.3"/>`;
    }).join("");
  }).join("");
  const dividers = Array.from({ length: 12 }, (_, index) => {
    const x = left + index * slotWidth;
    return `<line class="plinko-divider" x1="${x.toFixed(1)}" y1="294" x2="${x.toFixed(1)}" y2="322"/>`;
  }).join("");
  const labels = Array.from({ length: 11 }, (_, index) => {
    const x = left + slotWidth * (index + 0.5);
    const value = index <= 5 ? index * 20 : (10 - index) * 20;
    return `<text class="plinko-slot${index === targetIndex ? " active" : ""}" data-slot="${index}" x="${x.toFixed(1)}" y="340" text-anchor="middle">${value}%</text>`;
  }).join("");
  const pointText = points.map((point) => `${point.x.toFixed(1)},${point.y}`).join(";");

  return `<svg class="stage-svg plinko-board" viewBox="0 0 600 350" role="img" aria-label="Plinko board. Zero percent at both edges, one hundred percent in the center."><path class="plinko-path" d="M ${points.map((point) => `${point.x.toFixed(1)} ${point.y}`).join(" L ")}"/><g>${pegs}</g><g class="plinko-ball" data-path="${pointText}" transform="translate(300 20)"><circle r="8"/></g>${dividers}<path d="M38 294h524" stroke="#53695c" stroke-width="2"/>${labels}</svg>`;
};

const makeSlotsMarkup = () => {
  const reels = [0, 1, 2].map(() => {
    const digits = Array.from({ length: 40 }, (_, index) => `<span class="slot-digit">${index % 10}</span>`).join("");
    return `<div class="slot-reel" aria-hidden="true"><div class="slot-strip">${digits}</div></div>`;
  }).join(`<span class="slot-separator" aria-hidden="true">·</span>`);
  return `<div class="slots-machine" aria-label="Three spinning score reels">${reels}<span class="slots-caption">Lucky score</span></div>`;
};

const makeDiceMarkup = () => {
  const die = () => `<div class="die" data-die aria-hidden="true">${Array.from({ length: 9 }, () => `<span class="die-dot"></span>`).join("")}</div>`;
  return `<div class="dice-table" data-dice-table>${die()}<span class="dice-plus" aria-hidden="true">+</span>${die()}</div>`;
};

const makeScratchMarkup = () => `<div class="scratch-area"><div class="scratch-card"><div class="scratch-score"><strong>?</strong><span>Recorded tag score</span></div><canvas class="scratch-canvas" width="720" height="300" aria-hidden="true"></canvas></div><p class="scratch-hint">Drag across the ticket, or use the button below.</p><button class="scratch-reveal" type="button">Reveal scratch card</button></div>`;

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
      return makeDiceMarkup();
    case "scratch":
      return makeScratchMarkup();
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

const rollWheel = async (stage: HTMLElement, game: "wheel" | "roulette", signal: AbortSignal) => {
  const rotor = stage.querySelector<SVGElement>(game === "roulette" ? ".roulette-rotor" : ".wheel-rotor");
  if (!rotor) return false;
  const target = Number(rotor.dataset.target);
  const count = Number(rotor.dataset.count);
  const end = 360 * (game === "roulette" ? 9 : 7) - ((target + 0.5) * 360) / count;
  const rotorRun = animate(rotor, [{ transform: "rotate(0deg)" }, { transform: `rotate(${end}deg)` }], {
    duration: game === "roulette" ? 4600 : 4100,
    easing: "cubic-bezier(.08,.78,.17,1)",
    fill: "forwards",
  }, signal);

  if (game === "roulette") {
    const orbit = stage.querySelector<SVGElement>(".roulette-orbit");
    if (orbit) {
      const ballRun = animate(orbit, [{ transform: "rotate(0deg)" }, { transform: "rotate(3600deg)" }], {
        duration: 4500,
        easing: "cubic-bezier(.12,.75,.18,1)",
        fill: "forwards",
      }, signal);
      const [wheelDone, ballDone] = await Promise.all([rotorRun, ballRun]);
      return wheelDone && ballDone;
    }
  }
  return rotorRun;
};

const runPlinko = async (stage: HTMLElement, score: number, signal: AbortSignal) => {
  const ball = stage.querySelector<SVGGElement>(".plinko-ball");
  if (!ball) return false;
  const points = (ball.dataset.path ?? "").split(";").map((point) => {
    const [x, y] = point.split(",").map(Number);
    return { x, y };
  });
  const frames = points.map((point, index) => ({
    transform: `translate(${point.x}px, ${point.y}px)`,
    offset: index / Math.max(points.length - 1, 1),
  }));
  const completed = await animate(ball, frames, {
    duration: 3300,
    easing: "cubic-bezier(.25,.24,.16,1)",
    fill: "forwards",
  }, signal);
  if (!completed) return false;
  const targetSlot = stage.querySelector<SVGTextElement>(".plinko-slot.active");
  if (targetSlot) targetSlot.textContent = `${score}%`;
  return true;
};

const runSlots = async (stage: HTMLElement, score: number, signal: AbortSignal) => {
  const strips = [...stage.querySelectorAll<HTMLElement>(".slot-strip")];
  const digits = String(score).padStart(3, "0");
  const animations = strips.map(async (strip, index) => {
    if (!(await wait(index * 130, signal))) return false;
    const digit = Number(digits[index]);
    const rowHeight = strip.querySelector<HTMLElement>(".slot-digit")?.getBoundingClientRect().height ?? 82;
    return animate(strip, [
      { transform: "translateY(0px)" },
      { transform: `translateY(-${(30 + digit) * rowHeight}px)` },
    ], {
      duration: 2700,
      easing: "cubic-bezier(.12,.78,.17,1)",
      fill: "forwards",
    }, signal);
  });
  const results = await Promise.all(animations);
  return results.every(Boolean);
};

const setDieValue = (die: HTMLElement, value: number) => {
  const pips: Record<number, number[]> = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
  };
  die.querySelectorAll<HTMLElement>(".die-dot").forEach((dot, index) => {
    dot.classList.toggle("visible", pips[value].includes(index));
  });
};

const runDice = async (stage: HTMLElement, signal: AbortSignal) => {
  const table = stage.querySelector<HTMLElement>("[data-dice-table]");
  const dice = [...stage.querySelectorAll<HTMLElement>("[data-die]")];
  if (!table || dice.length !== 2) return false;
  const first = Math.floor(Math.random() * 6) + 1;
  const second = Math.floor(Math.random() * 6) + 1;
  table.classList.add("is-rolling");
  const rolled = await wait(1500, signal);
  table.classList.remove("is-rolling");
  if (!rolled) return false;
  setDieValue(dice[0], first);
  setDieValue(dice[1], second);
  return animate(table, [
    { transform: "translateY(4px) scale(.98)" },
    { transform: "translateY(-5px) scale(1.02)" },
    { transform: "translateY(0) scale(1)" },
  ], { duration: 460, easing: "cubic-bezier(.16,1,.3,1)" }, signal);
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
      return runDice(stage, signal);
    case "scratch":
      return runScratch(stage, signal);
  }
};

const run = () => {
  const tags = getAllTags();
  const tag = tags?.[0];
  if (!tag || tag.status !== "SUCCEEDED" || tag.percentage === undefined) return;

  const score = clamp(Math.round(tag.percentage), 0, 100);
  const tracePercentage = tag.element.getElementsByTagName("trace-symbol").item(0) as HTMLElement | null;
  const actionContainer = tag.element.getElementsByClassName("list__item__right").item(0) as HTMLElement | null;
  if (!tracePercentage || !actionContainer) return;

  const originalDisplay = tracePercentage.style.display;
  const originalRole = tag.element.getAttribute("role");
  const originalTabIndex = tag.element.getAttribute("tabindex");
  const host = document.createElement("div");
  host.id = "intra-tweaker-winwheel-root";
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = casinoStyles;

  const overlay = document.createElement("div");
  overlay.className = "casino-overlay";
  overlay.hidden = true;
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = `
    <section class="casino-dialog" role="dialog" aria-modal="true" aria-labelledby="casino-title" tabindex="-1">
      <header class="casino-header">
        <div class="casino-brand"><span class="brand-mark">${iconMarkup.wheel}</span><span>Intra Tweaker · Score reveal</span></div>
        <button class="casino-close" type="button" aria-label="Close score reveal"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
      </header>
      <main class="casino-main">
        <div class="casino-intro"><h2 id="casino-title">Pick your game</h2><p>Choose a little luck before seeing your tag percentage.</p></div>
        <div class="game-layout">
          <aside class="game-picker"><p class="picker-label">Choose a game</p><nav class="game-selector" aria-label="Choose a mini-game">${games.map((game) => `<button class="game-choice" type="button" data-game="${game.id}" style="--choice-accent:${game.accent}" aria-pressed="false"><span class="game-icon">${game.icon}</span><span>${game.name}</span></button>`).join("")}</nav></aside>
          <section class="game-panel" data-game="wheel" aria-label="Selected mini-game">
            <div class="game-panel-head"><div><h3 class="game-name">Prize wheel</h3><p class="game-description"></p></div><span class="game-count"></span></div>
            <div class="game-stage" id="game-stage"></div>
            <div class="game-controls"><p class="game-status" role="status" aria-live="polite">Ready when you are.</p><button class="game-start" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 10 7-10 7z"/></svg><span>Start the reveal</span></button></div>
            <div class="score-result" hidden tabindex="-1"><span class="score-result-label">Your saved tag score</span><strong class="score-result-value"></strong></div>
          </section>
        </div>
        <p class="casino-note">The game only reveals your saved tag score. It never changes the result.</p>
      </main>
    </section>`;
  shadow.append(style, overlay);
  document.body.appendChild(host);

  const choiceButtons = [...shadow.querySelectorAll<HTMLButtonElement>(".game-choice")];
  const panel = shadow.querySelector<HTMLElement>(".game-panel")!;
  const stage = shadow.querySelector<HTMLElement>("#game-stage")!;
  const gameName = shadow.querySelector<HTMLElement>(".game-name")!;
  const gameDescription = shadow.querySelector<HTMLElement>(".game-description")!;
  const gameCount = shadow.querySelector<HTMLElement>(".game-count")!;
  const gameStatus = shadow.querySelector<HTMLElement>(".game-status")!;
  const startButton = shadow.querySelector<HTMLButtonElement>(".game-start")!;
  const startLabel = startButton.querySelector<HTMLElement>("span")!;
  const scoreResult = shadow.querySelector<HTMLElement>(".score-result")!;
  const scoreResultValue = shadow.querySelector<HTMLElement>(".score-result-value")!;
  const closeButton = shadow.querySelector<HTMLButtonElement>(".casino-close")!;
  const dialog = shadow.querySelector<HTMLElement>(".casino-dialog")!;

  let selectedGame: GameId = "wheel";
  let isOpen = false;
  let isRunning = false;
  let hasRevealed = false;
  let activeController: AbortController | null = null;
  let triggerButton: HTMLButtonElement | null = null;
  let previousOverflow = "";

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
    gameCount.textContent = `Game ${games.findIndex((candidate) => candidate.id === id) + 1} / ${games.length}`;
    stage.innerHTML = getGameMarkup(id, score);
    if (id === "dice") {
      const dice = [...stage.querySelectorAll<HTMLElement>("[data-die]")];
      setDieValue(dice[0], 2);
      setDieValue(dice[1], 5);
    }
    scoreResult.hidden = true;
    scoreResultValue.textContent = "";
    gameStatus.textContent = "Ready when you are.";
    startButton.disabled = false;
    startLabel.textContent = "Start the reveal";
    choiceButtons.forEach((button) => {
      button.disabled = false;
      button.setAttribute("aria-pressed", String(button.dataset.game === id));
    });
  };

  const finishReveal = () => {
    if (!hasRevealed) return;
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
    if (revealed) (tag.element as HTMLElement).focus();
    else restoreFocus?.focus();
  };

  const openOverlay = (button: HTMLButtonElement) => {
    triggerButton = button;
    hasRevealed = false;
    previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    renderGame(games[Math.floor(Math.random() * games.length)].id);
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    isOpen = true;
    requestAnimationFrame(() => overlay.classList.add("is-open"));
    closeButton.focus();
  };

  const startGame = async () => {
    if (hasRevealed) {
      closeOverlay();
      return;
    }
    if (isRunning || !isOpen) return;

    isRunning = true;
    panel.classList.add("is-running");
    startButton.disabled = true;
    startLabel.textContent = selectedGame === "scratch" ? "Scratch the ticket…" : "In progress…";
    gameStatus.textContent = selectedGame === "scratch"
      ? "Drag across the card, or use its reveal button."
      : "Your tag score is waiting at the finish.";
    gameStatus.tabIndex = -1;
    gameStatus.focus();
    choiceButtons.forEach((button) => { button.disabled = true; });

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
      scoreResultValue.textContent = `${score}%`;
      scoreResult.hidden = false;
      gameStatus.textContent = `Saved tag score revealed: ${score}%.`;
      startButton.disabled = false;
      startLabel.textContent = "Done";
      startButton.focus();
      choiceButtons.forEach((button) => { button.disabled = true; });
    } catch {
      if (!controller.signal.aborted && isOpen) {
        gameStatus.textContent = "Game could not finish. Try again.";
        startButton.disabled = false;
        startLabel.textContent = "Try again";
        choiceButtons.forEach((button) => { button.disabled = false; });
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
  };

  shadow.querySelector(".game-selector")!.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(".game-choice");
    const nextGame = button?.dataset.game;
    if (!button || !isGameId(nextGame) || hasRevealed) return;
    cancelRun();
    renderGame(nextGame);
  });

  startButton.addEventListener("click", () => { void startGame(); });
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

  const button = document.createElement("button");
  button.type = "button";
  button.classList.add("button__big");
  button.textContent = "Reveal your score";
  button.setAttribute("aria-haspopup", "dialog");
  tag.element.setAttribute("role", "group");
  tag.element.setAttribute("tabindex", "-1");
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (isOpen || button.disabled) return;
    tracePercentage.style.display = "none";
    openOverlay(button);
  });

  tracePercentage.style.display = "none";
  actionContainer.prepend(button);
};

export default defineUnlistedScript(() => {
  run();
});
