export const casinoStyles = `
  :host {
    --ink: #08110e;
    --felt: #111d18;
    --felt-raised: #192820;
    --line: #405348;
    --paper: #f3eedf;
    --muted: #c1cbc2;
    --lime: #d8ff6a;
    --mint: #7be4c2;
    --coral: #ff7771;
    --gold: #f2c66d;
    --blue: #82dff0;
    color: var(--paper);
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 14px;
    line-height: 1.45;
    pointer-events: none;
  }

  *, *::before, *::after { box-sizing: border-box; }

  .casino-overlay[hidden] { display: none; }

  .casino-overlay {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    display: grid;
    place-items: center;
    overflow: hidden;
    background: radial-gradient(ellipse at center, rgb(14 26 19 / 88%), rgb(3 6 4 / 94%));
    backdrop-filter: blur(8px);
    pointer-events: auto;
    opacity: 0;
    transition: opacity 180ms ease-out;
  }

  .casino-overlay.is-open { opacity: 1; }

  .casino-dialog {
    position: relative;
    isolation: isolate;
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
    background: transparent;
    outline: none;
  }

  .casino-close {
    position: absolute;
    z-index: 6;
    top: max(14px, env(safe-area-inset-top));
    right: max(14px, env(safe-area-inset-right));
    display: grid;
    width: 48px;
    height: 48px;
    place-items: center;
    border: 1px solid rgb(193 203 194 / 25%);
    border-radius: 50%;
    color: var(--paper);
    background: #101b15;
    cursor: pointer;
    transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
  }

  .casino-close:hover { border-color: var(--paper); background: #1b2a21; }
  .casino-close svg { width: 20px; height: 20px; }

  .sr-only {
    position: absolute !important;
    width: 1px !important;
    height: 1px !important;
    padding: 0 !important;
    overflow: hidden !important;
    clip: rect(0, 0, 0, 0) !important;
    white-space: nowrap !important;
    border: 0 !important;
  }

  .game-panel {
    position: absolute;
    inset: 0;
    min-width: 0;
    overflow: hidden;
    background: transparent;
  }

  .game-panel[data-game="wheel"] { --accent: var(--lime); --active-wash: rgb(216 255 106 / 9%); --active-line: rgb(216 255 106 / 42%); }
  .game-panel[data-game="plinko"] { --accent: var(--blue); --active-wash: rgb(130 223 240 / 9%); --active-line: rgb(130 223 240 / 42%); }
  .game-panel[data-game="roulette"] { --accent: var(--coral); --active-wash: rgb(255 119 113 / 9%); --active-line: rgb(255 119 113 / 42%); }
  .game-panel[data-game="slots"] { --accent: #e7a2ed; --active-wash: rgb(231 162 237 / 9%); --active-line: rgb(231 162 237 / 42%); }
  .game-panel[data-game="dice"] { --accent: var(--gold); --active-wash: rgb(242 198 109 / 9%); --active-line: rgb(242 198 109 / 42%); }
  .game-panel[data-game="scratch"] { --accent: var(--mint); --active-wash: rgb(123 228 194 / 9%); --active-line: rgb(123 228 194 / 42%); }

  .game-stage {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    overflow: hidden;
    padding: calc(20px + env(safe-area-inset-top)) 16px calc(100px + env(safe-area-inset-bottom));
    background: radial-gradient(ellipse at 50% 52%, rgb(58 87 65 / 4%), transparent 68%);
  }

  .stage-svg { position: relative; z-index: 1; display: block; width: min(92vw, 84dvh, 1000px); max-height: calc(100dvh - 132px); overflow: visible; }
  .stage-svg text { font-family: ui-sans-serif, system-ui, sans-serif; }

  .wheel-rotor, .roulette-rotor { transform-box: view-box; transform-origin: 50% 50%; }
  .roulette-scene { transform: perspective(1000px) rotateX(22deg) scaleY(.92); transform-origin: 50% 54%; filter: drop-shadow(0 24px 22px rgb(0 0 0 / 42%)); }
  .wheel-label { fill: #fff8e8; font-size: 16px; font-weight: 760; paint-order: stroke; stroke: rgb(0 0 0 / 34%); stroke-width: 2px; stroke-linejoin: round; transform-box: fill-box; transform-origin: center; will-change: transform; }
  .wheel-pointer { fill: var(--accent); filter: drop-shadow(0 2px 5px rgb(0 0 0 / 48%)); }
  .wheel-hub { fill: #122019; stroke: var(--accent); stroke-width: 3; }
  .wheel-hub-text { fill: var(--paper); font-size: 10px; font-weight: 820; letter-spacing: .09em; }
  .roulette-label { fill: #fff8e8; font-size: 14px; font-weight: 760; transform-box: fill-box; transform-origin: center; will-change: transform; }
  .roulette-track { fill: none; stroke: #d4b56b; stroke-width: 3; }
  .roulette-track-inner { fill: none; stroke: #8f7140; stroke-width: 2; }
  .roulette-ball { stroke: #765b2c; stroke-width: 1.5; filter: drop-shadow(0 2px 3px rgb(0 0 0 / 58%)) drop-shadow(0 0 5px rgb(255 244 213 / 45%)); }
  .roulette-center { fill: #101a14; stroke: #bd9a52; stroke-width: 4; }
  .roulette-center-text { fill: #e9d9ad; font-size: 11px; font-weight: 800; letter-spacing: .12em; }

  .plinko-board { width: min(94vw, 1120px); max-height: min(78dvh, 700px); }
  .plinko-peg { fill: #536b60; stroke: #819b8c; stroke-width: 1; }
  .plinko-ball { fill: #eafffd; stroke: var(--accent); stroke-width: 3; filter: drop-shadow(0 0 9px var(--accent)); }
  .plinko-slot { fill: #c1cbc2; font-size: 10px; font-weight: 720; }
  .plinko-slot.active { fill: var(--accent); font-size: 12px; font-weight: 900; }
  .plinko-divider { stroke: #405348; stroke-width: 1.5; }

  .slots-cabinet { position: relative; z-index: 1; display: grid; justify-items: center; gap: 14px; padding: 18px clamp(18px, 3vw, 34px) 34px; border-radius: 30px 30px 18px 18px; background: linear-gradient(180deg, #8c1d2c, #4c0d18 60%, #2a0710); box-shadow: inset 0 2px 0 rgb(255 255 255 / 25%), inset 0 -10px 24px rgb(0 0 0 / 45%), 0 24px 50px rgb(0 0 0 / 55%); }
  .slots-marquee { position: relative; display: grid; place-items: center; width: 100%; min-height: 46px; border-radius: 16px; background: linear-gradient(#2a0710, #170409); }
  .slots-marquee strong { position: relative; color: #ffd76a; font-size: clamp(20px, 3.4vw, 32px); font-weight: 950; letter-spacing: .22em; text-shadow: 0 0 12px rgb(255 190 60 / 80%); }
  .slot-bulb { position: absolute; top: 50%; left: calc(4% + var(--bulb) * 6.9%); width: 7px; height: 7px; border-radius: 50%; background: #ffe39a; box-shadow: 0 0 8px #ffbf3b; transform: translateY(-50%); animation: slot-bulb 900ms calc(var(--bulb) * -120ms) infinite steps(2, jump-none); opacity: .35; }
  @keyframes slot-bulb { 50% { opacity: 1; } }
  .slots-machine { position: relative; display: flex; align-items: center; gap: clamp(8px, 1.6vw, 16px); padding: 12px; border: 4px solid #d4a64a; border-radius: 18px; background: #12070a; box-shadow: inset 0 0 18px rgb(0 0 0 / 80%); }
  .slot-reel { position: relative; width: clamp(72px, 13vw, 140px); height: clamp(92px, 18vh, 174px); overflow: hidden; border-radius: 10px; background: #f6efe0; color: #1b1a17; }
  .slot-glass { position: absolute; inset: 0; pointer-events: none; background: linear-gradient(180deg, rgb(0 0 0 / 78%), rgb(0 0 0 / 12%) 26%, rgb(255 255 255 / 18%) 46%, rgb(0 0 0 / 0%) 54%, rgb(0 0 0 / 12%) 74%, rgb(0 0 0 / 78%)); }
  .slot-reel.is-stopped { animation: slot-thunk 220ms ease-out; }
  @keyframes slot-thunk { 40% { transform: translateY(3px); } }
  .slots-payline { position: absolute; left: 4px; right: 4px; top: 50%; height: 2px; background: rgb(255 70 70 / 70%); box-shadow: 0 0 8px rgb(255 70 70 / 80%); pointer-events: none; }
  .slots-cabinet.is-win .slots-payline { background: #ffd76a; box-shadow: 0 0 14px #ffd76a; }
  .slots-cabinet.is-win .slot-bulb { animation-duration: 260ms; }
  .slot-strip { display: flex; flex-direction: column; align-items: center; }
  .game-panel.is-running .slot-strip { will-change: transform; }
  .slot-digit { display: grid; width: 100%; height: clamp(92px, 18vh, 174px); flex: 0 0 auto; place-items: center; font-family: ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif; font-size: clamp(48px, 9vw, 100px); font-weight: 900; font-variant-numeric: tabular-nums; }
  .slots-caption { color: #ffd9a8; font-size: 12px; font-weight: 780; letter-spacing: .12em; text-transform: uppercase; white-space: nowrap; }
  .slots-lever { position: absolute; top: 34%; right: -30px; width: 18px; height: 120px; perspective: 400px; }
  .slots-lever-arm { position: absolute; left: 6px; bottom: 0; width: 7px; height: 100%; border-radius: 4px; background: linear-gradient(90deg, #8a8f96, #e8ecf0, #8a8f96); transform-origin: 50% 100%; }
  .slots-lever-knob { position: absolute; top: -14px; left: -8px; width: 24px; height: 24px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #ff9c9c, #c21a2a 60%, #6d0610); box-shadow: 0 4px 10px rgb(0 0 0 / 45%); }

  .dice-table { position: relative; z-index: 1; display: grid; place-items: center; width: min(90vw, 820px); min-height: clamp(260px, 46vh, 500px); padding: 24px; overflow: hidden; border: 10px solid #4a2c1a; border-radius: 34px; background: radial-gradient(ellipse at 50% 40%, #2f7a4b, #15412a 70%, #0c2618); box-shadow: inset 0 0 0 2px #c79a52, inset 0 18px 40px rgb(0 0 0 / 45%), 0 24px 50px rgb(0 0 0 / 50%); perspective: 1100px; }
  .dice-felt { position: absolute; inset: 18px; border: 2px dashed rgb(242 220 160 / 28%); border-radius: 22px; pointer-events: none; }
  .dice-row { position: relative; display: flex; gap: clamp(22px, 4vw, 54px); transform: rotateX(28deg); transform-style: preserve-3d; }
  .die-slot { --die-size: clamp(66px, 14vw, 132px); --die-half: calc(var(--die-size) / 2); position: relative; flex: 0 0 auto; width: var(--die-size); height: var(--die-size); transform-style: preserve-3d; }
  .die-shadow { position: absolute; left: 6%; right: 6%; bottom: -14%; height: 26%; border-radius: 50%; background: radial-gradient(ellipse, rgb(0 0 0 / 55%), transparent 70%); }
  .die { position: absolute; inset: 0; transform-style: preserve-3d; }
  .die-cube { position: absolute; inset: 0; transform-style: preserve-3d; will-change: transform; }
  .die-face { position: absolute; inset: 0; display: grid; place-items: center; border-radius: 18%; color: #7a1010; font-family: ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif; font-size: calc(var(--die-size) * .52); font-weight: 900; font-variant-numeric: tabular-nums; line-height: 1; backface-visibility: hidden; box-shadow: inset 0 0 0 1px rgb(120 90 60 / 35%), inset -6px -8px 14px rgb(120 90 60 / 25%), inset 4px 5px 10px rgb(255 255 255 / 70%); }
  .die-face-front { transform: translateZ(var(--die-half)); background: linear-gradient(145deg, #fffdf6, #ebe2cf); }
  .die-face-back { transform: rotateY(180deg) translateZ(var(--die-half)); background: linear-gradient(145deg, #e6dcc8, #c9bca2); }
  .die-face-right { transform: rotateY(90deg) translateZ(var(--die-half)); background: linear-gradient(145deg, #eee5d4, #d2c5ac); }
  .die-face-left { transform: rotateY(-90deg) translateZ(var(--die-half)); background: linear-gradient(145deg, #eee5d4, #c4b69c); }
  .die-face-top { transform: rotateX(90deg) translateZ(var(--die-half)); background: linear-gradient(145deg, #fffdf4, #e0d5c0); }
  .die-face-bottom { transform: rotateX(-90deg) translateZ(var(--die-half)); background: linear-gradient(145deg, #c7b99e, #a79a80); }
  .dice-total { position: absolute; bottom: 22px; margin: 0; padding: 6px 18px; border-radius: 999px; background: rgb(8 20 13 / 80%); color: #f6d77d; font-size: clamp(22px, 4vw, 34px); font-weight: 900; letter-spacing: .04em; animation: dice-total-pop 420ms cubic-bezier(.2,1.6,.4,1) both; }
  .dice-total[hidden] { display: none; }
  @keyframes dice-total-pop { from { opacity: 0; transform: scale(.4); } to { opacity: 1; transform: scale(1); } }

  .scratch-area { position: relative; z-index: 1; width: min(86vw, 900px); }
  .scratch-card { position: relative; overflow: hidden; border: 1px solid rgb(123 228 194 / 55%); border-radius: 24px; background: #18372c; box-shadow: 0 16px 35px rgb(0 0 0 / 30%); }
  .scratch-score { display: grid; min-height: clamp(220px, 42vh, 420px); place-content: center; justify-items: center; gap: 8px; color: var(--paper); }
  .scratch-score strong { font-size: clamp(72px, 15vw, 172px); font-weight: 840; letter-spacing: -.05em; font-variant-numeric: tabular-nums; }
  .scratch-score span { color: #c8d8ce; font-size: 13px; font-weight: 770; letter-spacing: .12em; text-transform: uppercase; }
  .scratch-canvas { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; cursor: crosshair; transition: opacity 340ms ease, transform 340ms ease; }
  .scratch-canvas.is-cleared { opacity: 0; transform: scaleY(.92); pointer-events: none; }
  .scratch-hint { margin: 18px 0 0; color: var(--muted); font-size: 14px; text-align: center; }
  .scratch-reveal { display: block; min-height: 52px; margin: 14px auto 0; padding: 10px 20px; border: 1px solid var(--line); border-radius: 999px; color: var(--paper); background: var(--felt-raised); font: inherit; font-size: 14px; font-weight: 740; cursor: pointer; }

  .score-result { position: absolute; z-index: 3; bottom: calc(18px + env(safe-area-inset-bottom)); left: 50%; display: flex; min-width: 168px; flex-direction: column; align-items: center; gap: 0; margin: 0; padding: 11px 22px 8px; translate: -50% 0; border: 1px solid var(--active-line, rgb(216 255 106 / 42%)); border-radius: 18px; background: #101b15; box-shadow: 0 14px 36px rgb(0 0 0 / 48%); text-align: center; animation: result-arrive 360ms cubic-bezier(.16, 1, .3, 1) both; }
  .score-result[hidden] { display: none; }
  .score-result-label { color: var(--muted); font-size: 11px; font-weight: 660; }
  .score-result-value { color: var(--accent); font-size: clamp(36px, 6vw, 62px); font-weight: 860; letter-spacing: -.04em; font-variant-numeric: tabular-nums; line-height: 1.1; }
  @keyframes result-arrive { from { opacity: 0; translate: -50% 8px; filter: blur(3px); } to { opacity: 1; translate: -50% 0; filter: blur(0); } }

  :where(button):focus-visible { outline: 3px solid var(--paper); outline-offset: 3px; box-shadow: 0 0 0 5px rgb(216 255 106 / 55%); }

  @media (max-width: 600px) {
    .casino-close { top: max(10px, env(safe-area-inset-top)); right: max(10px, env(safe-area-inset-right)); width: 44px; height: 44px; }
    .game-stage { padding-inline: 8px; padding-bottom: calc(104px + env(safe-area-inset-bottom)); }
    .stage-svg { width: min(92vw, 82dvh, 820px); max-height: calc(100dvh - 140px); }
    .plinko-board { width: 96vw; max-height: 74dvh; }
    .slots-machine { gap: 9px; padding: 14px 12px; }
    .slot-reel { width: clamp(64px, 19vw, 104px); height: clamp(82px, 17vh, 132px); border-radius: 12px; }
    .slot-digit { height: clamp(82px, 17vh, 132px); font-size: clamp(44px, 13vw, 72px); }
    .dice-table { width: 94vw; min-height: clamp(210px, 38vh, 360px); gap: clamp(8px, 2.5vw, 16px); padding: 14px 8px; border-radius: 22px; }
    .die-slot { --die-size: clamp(54px, 18vw, 96px); }
    .scratch-area { width: 90vw; }
    .scratch-score { min-height: clamp(205px, 35vh, 310px); }
    .scratch-score strong { font-size: clamp(68px, 17vw, 112px); }
    .scratch-hint { max-width: 34ch; margin-inline: auto; font-size: 12px; }
    .scratch-reveal { min-height: 48px; margin-top: 10px; }
    .score-result { bottom: calc(12px + env(safe-area-inset-bottom)); }
  }

  @media (max-height: 540px) {
    .game-stage { padding-top: calc(10px + env(safe-area-inset-top)); padding-bottom: calc(82px + env(safe-area-inset-bottom)); }
    .stage-svg { width: min(88vw, 70dvh, 760px); max-height: calc(100dvh - 112px); }
    .plinko-board { width: min(92vw, 960px); max-height: 76dvh; }
    .slots-machine { padding-block: 10px; }
    .slot-reel, .slot-digit { height: min(22dvh, 106px); }
    .dice-table { min-height: 35dvh; }
    .scratch-score { min-height: 28dvh; }
    .scratch-score strong { font-size: min(15vw, 22dvh); }
    .scratch-hint { margin-top: 8px; }
    .scratch-reveal { min-height: 40px; margin-top: 6px; }
    .score-result { bottom: calc(8px + env(safe-area-inset-bottom)); }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
    .slot-strip { will-change: auto; }
  }
`;
