import { frameLoop } from "./timing";
import { arcadeGameStyles, getArcadeGameMarkup, isArcadeGame, runArcadeGame } from "./arcadeGames";

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
  if (isArcadeGame(game)) return getArcadeGameMarkup(game);
  switch (game) {
    case "derby": return makeDerbyMarkup(score);
    case "crash": return makeCrashMarkup();
    case "cups": return makeCupsMarkup();
  }
};

export const runExtraGame = (game: ExtraGameId, stage: HTMLElement, score: number, signal: AbortSignal, fx: FxHelpers) => {
  if (isArcadeGame(game)) return runArcadeGame(game, stage, score, signal, fx);
  switch (game) {
    case "derby": return runDerby(stage, score, signal, fx);
    case "crash": return runCrash(stage, score, signal, fx);
    case "cups": return runCups(stage, score, signal, fx);
  }
};

export const extraGameStyles = `
  /* Shared Theme Accents */
  .game-panel[data-game="derby"] { --accent: #ffd700; --active-line: rgb(255 215 0 / 45%); }
  .game-panel[data-game="crash"] { --accent: #ff0055; --active-line: rgb(255 0 85 / 45%); }
  .game-panel[data-game="cups"] { --accent: #ffd700; --active-line: rgb(255 215 0 / 45%); }

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
${arcadeGameStyles}`;


export const physicalGameStyles = `
  .result-spark { fill:#f2c66d;pointer-events:none;animation:result-sparks 750ms cubic-bezier(.12,.6,.2,1) forwards; }
  @keyframes result-sparks { 0% { opacity:0;transform:translate(0,0) scale(.5); } 15% { opacity:1; } 100% { opacity:0;transform:translate(var(--dx),var(--dy)) scale(0); } }
  .impact-game { gap:8px; }
  .impact-hud { display:grid;justify-items:center;gap:2px;position:relative;z-index:2; }
  .impact-hud span { font-size:11px;letter-spacing:.09em;color:#c1cbc2; }
  .impact-hud strong { font-size:clamp(36px,7vh,60px);line-height:1.1;font-variant-numeric:tabular-nums;color:#f3eedf; }
  .impact-hud small { font-size:11px;color:#c1cbc2; }
  .powered-flipper { fill:none;stroke:#f2c66d;stroke-width:13;stroke-linecap:round;filter:drop-shadow(0 4px 2px #000); }
  .target-award { fill:#e5ffad;font-size:11px;font-weight:850;paint-order:stroke;stroke:#102017;stroke-width:3; }
  .is-scoring { filter:drop-shadow(0 0 5px #d8ff6a); }
  .impact-points { fill:#e5ffad;font-size:20px;font-weight:900;paint-order:stroke;stroke:#101b15;stroke-width:3;pointer-events:none;animation:impact-rise 850ms ease-out forwards; }
  @keyframes impact-rise { from {opacity:1;transform:translateY(0)} to {opacity:0;transform:translateY(-30px)} }
  .plinko-scoring { display:grid;justify-items:center;gap:16px; }
  .plinko-scoring .stage-svg { max-height:60dvh; }
  .plinko-peg.is-hit { fill:#fff;filter:drop-shadow(0 0 7px #d8ff6a); }
  .physics-rail { fill:none; stroke:#8caa9a; stroke-width:4; stroke-linecap:round; filter:drop-shadow(0 5px 2px #000); }
  .is-hit { fill:#f3eedf; }
  .game-stage[data-phase="result"] [data-result] { filter:drop-shadow(0 2px 5px rgb(242 198 109 / 40%)); }
  .game-panel:has(.game-stage[data-phase="result"]) .score-result { display:none; }
  .game-panel:has(.derby-game,.rocket-crash-game,.cups-game) .game-stage { padding:60px 16px 24px; }
  .dr-header { flex-wrap:wrap;gap:8px; }
  .dr-lane { grid-template-columns:100px 1fr; }
  .dr-lane-info { justify-content:space-between; }
  .dr-lane.is-won .dr-lane-score { font-size:26px; }
  .dr-lane.is-won { animation:finish-flash 300ms ease-out; }
  @keyframes finish-flash { from { background:#879277; } }
  .rc-hud-readout { top:6%;left:12%; }
  .rc-hud-readout strong { font-size:clamp(38px,8vw,86px); }
  @media(max-width:550px) {
    .dr-lane { grid-template-columns:82px 1fr;padding:0 7px;gap:6px; }
    .dr-track-meta { display:none; }
    .dr-title { font-size:12px; }
  }
  @media(prefers-reduced-motion:reduce) { .dr-horse,.dr-leg,.rc-flame,.rc-rocket-body { animation:none!important; } }
`;
