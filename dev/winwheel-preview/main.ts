import { WINWHEEL_GAMES } from "../../src/utils/winwheelGames";
import "./style.css";

declare global {
  interface Window {
    defineUnlistedScript?: (entrypoint: () => void) => void;
  }
}

const scoreQuery = new URLSearchParams(window.location.search).get("score");
const gameQuery = new URLSearchParams(window.location.search).get("game");
if (gameQuery) {
  (globalThis as any).__intraTweakerWinwheelDemo = gameQuery;
}
const requestedScore = scoreQuery === null ? Number.NaN : Number(scoreQuery);
const hasValidScore = Number.isInteger(requestedScore) && requestedScore >= 0 && requestedScore <= 100;
const score = hasValidScore ? requestedScore : Math.floor(Math.random() * 101);
const scoreElement = document.querySelector<HTMLElement>("trace-symbol");
const moduleStatus = document.querySelector<HTMLElement>("#module-status");
const newTestButton = document.querySelector<HTMLButtonElement>("#new-test");

if (!scoreElement || !moduleStatus || !newTestButton) {
  throw new Error("Winwheel preview markup is incomplete.");
}

scoreElement.setAttribute("successpercent", String(score));
scoreElement.setAttribute("validated", String(score === 100));
scoreElement.textContent = `${score}%`;

if (!hasValidScore) {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("score", String(score));
  window.history.replaceState(null, "", nextUrl);
}

newTestButton.addEventListener("click", () => {
  let nextScore = score;
  while (nextScore === score) nextScore = Math.floor(Math.random() * 101);
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("score", String(nextScore));
  window.location.assign(nextUrl);
});

const previousDefinition = window.defineUnlistedScript;
window.defineUnlistedScript = (entrypoint) => entrypoint();

try {
  await import("../../src/entrypoints/module_winwheel.unlisted/index");
} finally {
  window.defineUnlistedScript = previousDefinition;
}

if (document.querySelector("#intra-tweaker-winwheel-root") || document.querySelector("#intra-tweaker-winwheel-demo-root")) {
  moduleStatus.dataset.state = "ready";
  moduleStatus.lastElementChild!.textContent = "Module prêt · score masqué";
} else {
  moduleStatus.dataset.state = "error";
  moduleStatus.lastElementChild!.textContent = "Module non chargé";
}

const controls = document.createElement("form");
controls.className = "preview-controls";
controls.innerHTML = `<label>Jeu <select name="game">${WINWHEEL_GAMES.map(g=>`<option value="${g.id}"${g.id===gameQuery?' selected':''}>${g.label}</option>`).join('')}</select></label><label>Score <input name="score" type="number" min="0" max="100" step="1" value="${score}" required></label><button type="submit">Lancer la démo</button><a href="/audit.html">Contrôle des 7 jeux</a>`;
controls.addEventListener("submit",event=>{
  event.preventDefault();
  const data = new FormData(controls), next = new URL(location.href);
  next.searchParams.set("game",String(data.get("game")));
  next.searchParams.set("score",String(data.get("score")));
  location.assign(next);
});
document.querySelector(".page-intro")!.after(controls);
