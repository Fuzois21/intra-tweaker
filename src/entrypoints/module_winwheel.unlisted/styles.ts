export const casinoStyles = `
  :host {
    --ink: #08110e;
    --felt: #111d18;
    --felt-raised: #192820;
    --felt-deep: #0c1511;
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
    padding: 16px;
    overflow: auto;
    background: rgb(3 8 6 / 78%);
    backdrop-filter: blur(7px);
    pointer-events: auto;
    opacity: 0;
    transition: opacity 180ms ease-out;
  }

  .casino-overlay.is-open { opacity: 1; }

  .casino-dialog {
    width: min(980px, 100%);
    max-height: min(900px, calc(100dvh - 32px));
    overflow: auto;
    border: 1px solid var(--line);
    border-radius: 22px;
    background: var(--felt);
    box-shadow: 0 28px 90px rgb(0 0 0 / 62%);
    transform: translateY(10px) scale(.99);
    transition: transform 240ms cubic-bezier(.16, 1, .3, 1);
  }

  .is-open .casino-dialog { transform: translateY(0) scale(1); }

  .casino-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    min-height: 66px;
    padding: 12px 22px;
    border-bottom: 1px solid var(--line);
  }

  .casino-brand {
    display: flex;
    align-items: center;
    gap: 11px;
    color: var(--paper);
    font-size: 12px;
    font-weight: 760;
    letter-spacing: .04em;
    text-transform: uppercase;
  }

  .brand-mark {
    display: grid;
    width: 34px;
    height: 34px;
    place-items: center;
    border: 1px solid rgb(216 255 106 / 48%);
    border-radius: 11px;
    color: var(--lime);
    background: rgb(216 255 106 / 8%);
  }

  .brand-mark svg, .game-icon svg { width: 20px; height: 20px; }

  .casino-close {
    display: grid;
    width: 42px;
    height: 42px;
    place-items: center;
    border: 1px solid transparent;
    border-radius: 12px;
    color: var(--paper);
    background: transparent;
    cursor: pointer;
    transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
  }

  .casino-close:hover { border-color: var(--line); background: var(--felt-raised); }
  .casino-close svg { width: 18px; height: 18px; }

  .casino-main { padding: 24px; }

  .casino-intro { margin: 0 0 20px; }

  .casino-intro h2 {
    margin: 0;
    color: var(--paper);
    font-size: clamp(23px, 3vw, 32px);
    font-weight: 790;
    letter-spacing: -.025em;
    line-height: 1.12;
  }

  .casino-intro p {
    max-width: 62ch;
    margin: 8px 0 0;
    color: var(--muted);
    font-size: 14px;
  }

  .game-layout {
    display: grid;
    grid-template-columns: 176px minmax(0, 1fr);
    gap: 20px;
    align-items: start;
  }

  .game-picker { min-width: 0; }

  .picker-label {
    margin: 0 0 9px 4px;
    color: var(--muted);
    font-size: 11px;
    font-weight: 760;
    letter-spacing: .08em;
    text-transform: uppercase;
  }

  .game-selector { display: grid; gap: 5px; }

  .game-choice {
    display: flex;
    min-height: 46px;
    align-items: center;
    gap: 10px;
    padding: 8px 11px;
    border: 1px solid transparent;
    border-radius: 12px;
    color: var(--muted);
    background: transparent;
    font: inherit;
    font-size: 13px;
    font-weight: 680;
    text-align: left;
    cursor: pointer;
    transition: color 150ms ease, background 150ms ease, border-color 150ms ease, transform 150ms ease;
  }

  .game-choice:hover:not(:disabled) { color: var(--paper); background: var(--felt-raised); }
  .game-choice[aria-pressed="true"] {
    border-color: color-mix(in srgb, var(--choice-accent, var(--lime)) 48%, transparent);
    color: var(--paper);
    background: color-mix(in srgb, var(--choice-accent, var(--lime)) 10%, transparent);
  }

  .game-choice:disabled { cursor: default; opacity: .55; }
  .game-choice[aria-pressed="true"]:disabled { opacity: 1; }
  .game-icon { display: grid; width: 23px; height: 23px; place-items: center; color: var(--choice-accent, var(--lime)); }

  .game-panel {
    min-width: 0;
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: 18px;
    background: var(--felt-deep);
  }

  .game-panel.has-result .game-stage { min-height: 238px; }
  .game-panel.has-result .stage-svg { max-height: 224px; }
  .game-panel.has-result .plinko-board { max-height: 240px; }

  .game-panel[data-game="wheel"] { --accent: var(--lime); --active-wash: rgb(216 255 106 / 9%); --active-line: rgb(216 255 106 / 42%); }
  .game-panel[data-game="plinko"] { --accent: var(--blue); --active-wash: rgb(130 223 240 / 9%); --active-line: rgb(130 223 240 / 42%); }
  .game-panel[data-game="roulette"] { --accent: var(--coral); --active-wash: rgb(255 119 113 / 9%); --active-line: rgb(255 119 113 / 42%); }
  .game-panel[data-game="slots"] { --accent: #e7a2ed; --active-wash: rgb(231 162 237 / 9%); --active-line: rgb(231 162 237 / 42%); }
  .game-panel[data-game="dice"] { --accent: var(--gold); --active-wash: rgb(242 198 109 / 9%); --active-line: rgb(242 198 109 / 42%); }
  .game-panel[data-game="scratch"] { --accent: var(--mint); --active-wash: rgb(123 228 194 / 9%); --active-line: rgb(123 228 194 / 42%); }

  .game-panel-head {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 18px;
    padding: 17px 20px 12px;
  }

  .game-panel-head h3 {
    margin: 0;
    color: var(--paper);
    font-size: 19px;
    font-weight: 760;
    letter-spacing: -.015em;
  }

  .game-panel-head p { margin: 4px 0 0; color: var(--muted); font-size: 12px; }

  .game-count {
    flex: 0 0 auto;
    padding: 5px 9px;
    border: 1px solid var(--line);
    border-radius: 999px;
    color: var(--muted);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }

  .game-stage {
    position: relative;
    display: grid;
    min-height: 300px;
    place-items: center;
    overflow: hidden;
    padding: 10px 18px 14px;
    background: radial-gradient(ellipse at 50% 53%, rgb(58 87 65 / 25%), transparent 66%);
  }

  .game-stage::before {
    position: absolute;
    inset: 13px 15px;
    border: 1px solid rgb(193 203 194 / 9%);
    border-radius: 14px;
    content: "";
    pointer-events: none;
  }

  .stage-svg { position: relative; z-index: 1; display: block; width: min(100%, 410px); max-height: 300px; overflow: visible; }
  .stage-svg text { font-family: ui-sans-serif, system-ui, sans-serif; }

  .wheel-rotor, .roulette-rotor, .roulette-orbit { transform-box: view-box; transform-origin: 50% 50%; }
  .wheel-label { fill: #fff8e8; font-size: 16px; font-weight: 760; paint-order: stroke; stroke: rgb(0 0 0 / 34%); stroke-width: 2px; stroke-linejoin: round; }
  .wheel-pointer { fill: var(--accent); filter: drop-shadow(0 2px 5px rgb(0 0 0 / 48%)); }
  .wheel-hub { fill: #122019; stroke: var(--accent); stroke-width: 3; }
  .wheel-hub-text { fill: var(--paper); font-size: 10px; font-weight: 820; letter-spacing: .09em; }
  .roulette-label { fill: #fff8e8; font-size: 14px; font-weight: 760; }
  .roulette-ball { fill: #fff4d5; stroke: #785b27; stroke-width: 2; filter: drop-shadow(0 0 5px rgb(255 244 213 / 70%)); }
  .roulette-center { fill: #101a14; stroke: #bd9a52; stroke-width: 4; }
  .roulette-center-text { fill: #e9d9ad; font-size: 11px; font-weight: 800; letter-spacing: .12em; }

  .plinko-board { width: min(100%, 620px); max-height: 310px; }
  .plinko-peg { fill: #536b60; stroke: #819b8c; stroke-width: 1; }
  .plinko-path { fill: none; stroke: var(--accent); stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; opacity: .24; }
  .plinko-ball { fill: #eafffd; stroke: var(--accent); stroke-width: 3; filter: drop-shadow(0 0 9px var(--accent)); }
  .plinko-slot { fill: #c1cbc2; font-size: 10px; font-weight: 720; }
  .plinko-slot.active { fill: var(--accent); font-size: 12px; font-weight: 900; }
  .plinko-divider { stroke: #405348; stroke-width: 1.5; }

  .slots-machine { position: relative; z-index: 1; display: flex; align-items: center; gap: 11px; padding: 20px 25px; border: 1px solid #78527a; border-radius: 20px; background: linear-gradient(160deg, #302137, #161722 72%); box-shadow: 0 16px 38px rgb(0 0 0 / 28%); }
  .slot-reel { width: clamp(64px, 10vw, 86px); height: clamp(82px, 13vw, 104px); overflow: hidden; border: 1px solid rgb(242 226 213 / 50%); border-radius: 13px; background: #f2eadc; color: #212019; box-shadow: inset 0 0 0 5px rgb(83 56 68 / 12%); }
  .slot-strip { display: flex; flex-direction: column; align-items: center; }
  .game-panel.is-running .slot-strip { will-change: transform; }
  .slot-digit { display: grid; width: 100%; height: clamp(82px, 13vw, 104px); flex: 0 0 auto; place-items: center; font-family: ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif; font-size: clamp(42px, 7vw, 60px); font-weight: 900; font-variant-numeric: tabular-nums; }
  .slot-separator { color: var(--accent); font-size: 23px; font-weight: 900; }
  .slots-caption { position: absolute; bottom: -15px; left: 50%; color: #ded2df; font-size: 10px; font-weight: 780; letter-spacing: .12em; text-transform: uppercase; transform: translateX(-50%); white-space: nowrap; }

  .dice-table { position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; gap: clamp(14px, 4vw, 34px); width: min(100%, 420px); min-height: 200px; border: 1px solid rgb(242 198 109 / 32%); border-radius: 24px; background: radial-gradient(ellipse, #263427, #101a14 72%); }
  .die { display: grid; width: clamp(76px, 16vw, 112px); aspect-ratio: 1; grid-template: repeat(3, 1fr) / repeat(3, 1fr); gap: 4px; padding: 12px; border: 1px solid #eadbb4; border-radius: 18px; background: #f3eedf; box-shadow: 0 12px 25px rgb(0 0 0 / 30%); }
  .die-dot { align-self: center; justify-self: center; width: 10px; aspect-ratio: 1; border-radius: 50%; background: #232a21; opacity: 0; }
  .die-dot.visible { opacity: 1; }
  .dice-plus { color: var(--accent); font-size: 30px; font-weight: 600; }
  .dice-table.is-rolling .die:first-child { animation: die-roll 420ms ease-in-out infinite alternate; }
  .dice-table.is-rolling .die:last-child { animation: die-roll 510ms ease-in-out infinite alternate-reverse; }
  @keyframes die-roll { from { transform: rotate(-9deg) translateY(-2px); } to { transform: rotate(11deg) translateY(3px); } }

  .scratch-area { position: relative; z-index: 1; width: min(100%, 480px); }
  .scratch-card { position: relative; overflow: hidden; border: 1px solid rgb(123 228 194 / 55%); border-radius: 18px; background: #18372c; box-shadow: 0 16px 35px rgb(0 0 0 / 30%); }
  .scratch-score { display: grid; min-height: 166px; place-content: center; justify-items: center; gap: 4px; color: var(--paper); }
  .scratch-score strong { font-size: clamp(44px, 9vw, 68px); font-weight: 840; letter-spacing: -.05em; font-variant-numeric: tabular-nums; }
  .scratch-score span { color: #c8d8ce; font-size: 10px; font-weight: 770; letter-spacing: .12em; text-transform: uppercase; }
  .scratch-canvas { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; cursor: crosshair; transition: opacity 340ms ease, transform 340ms ease; }
  .scratch-canvas.is-cleared { opacity: 0; transform: scaleY(.92); pointer-events: none; }
  .scratch-hint { margin: 11px 0 0; color: var(--muted); font-size: 12px; text-align: center; }
  .scratch-reveal { display: block; min-height: 42px; margin: 10px auto 0; padding: 8px 14px; border: 1px solid var(--line); border-radius: 11px; color: var(--paper); background: var(--felt-raised); font: inherit; font-size: 12px; font-weight: 720; cursor: pointer; }

  .game-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    min-height: 62px;
    padding: 10px 18px;
    border-top: 1px solid var(--line);
  }

  .game-status { margin: 0; color: var(--muted); font-size: 12px; }
  .game-status strong { color: var(--paper); }

  .game-start {
    display: inline-flex;
    min-width: 142px;
    min-height: 44px;
    align-items: center;
    justify-content: center;
    gap: 9px;
    padding: 10px 15px;
    border: 1px solid var(--accent);
    border-radius: 12px;
    color: #10170e;
    background: var(--accent);
    font: inherit;
    font-size: 13px;
    font-weight: 820;
    cursor: pointer;
    transition: filter 150ms ease, transform 150ms ease, opacity 150ms ease;
  }

  .game-start:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
  .game-start:disabled { cursor: default; opacity: .58; }
  .game-start svg { width: 16px; height: 16px; }

  .score-result {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin: 0 18px 14px;
    padding: 13px 16px;
    border: 1px solid var(--active-line, rgb(216 255 106 / 42%));
    border-radius: 14px;
    background: var(--active-wash, rgb(216 255 106 / 9%));
    animation: result-arrive 360ms cubic-bezier(.16, 1, .3, 1) both;
  }

  .score-result[hidden] { display: none; }
  .score-result-label { color: var(--muted); font-size: 12px; font-weight: 660; }
  .score-result-value { color: var(--accent); font-size: 34px; font-weight: 860; letter-spacing: -.04em; font-variant-numeric: tabular-nums; }
  @keyframes result-arrive { from { opacity: 0; transform: translateY(7px); filter: blur(3px); } to { opacity: 1; transform: translateY(0); filter: blur(0); } }

  .casino-note { margin: 18px 0 0; color: var(--muted); font-size: 11px; text-align: center; }

  :where(button):focus-visible {
    outline: 3px solid var(--paper);
    outline-offset: 3px;
    box-shadow: 0 0 0 5px rgb(216 255 106 / 55%);
  }

  @media (max-width: 720px) {
    .casino-overlay { padding: 12px; }
    .casino-dialog { max-height: calc(100dvh - 24px); border-radius: 18px; }
    .casino-header { min-height: 58px; padding: 9px 14px; }
    .casino-main { padding: 17px 14px 19px; }
    .game-layout { grid-template-columns: minmax(0, 1fr); gap: 13px; }
    .picker-label { margin-left: 2px; }
    .game-selector { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; padding: 2px; }
    .game-choice { min-width: 0; min-height: 44px; padding: 7px 9px; }
    .game-panel-head { padding: 14px 15px 9px; }
    .game-stage { min-height: 275px; padding-inline: 12px; }
    .game-controls { padding: 10px 12px; }
    .game-status { max-width: 48%; }
    .game-start { min-width: 132px; }
  }

  @media (max-width: 420px) {
    .casino-overlay { padding: 7px; }
    .casino-dialog { max-height: calc(100dvh - 14px); }
    .casino-main { padding: 15px 10px 16px; }
    .casino-intro { margin-bottom: 15px; }
    .casino-intro p { font-size: 13px; }
    .brand-mark { width: 31px; height: 31px; }
    .game-panel-head { padding-inline: 12px; }
    .game-panel-head h3 { font-size: 17px; }
    .game-stage { min-height: 245px; padding-inline: 7px; }
    .game-stage::before { inset: 9px 8px; }
    .game-selector { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .game-count { padding-inline: 7px; }
    .game-controls { gap: 8px; }
    .game-status { max-width: 44%; font-size: 11px; }
    .game-start { min-width: 124px; padding-inline: 10px; }
    .score-result { margin-inline: 11px; }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
    .slot-strip { will-change: auto; }
  }
`;
