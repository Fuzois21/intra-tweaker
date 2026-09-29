import React, { useEffect, useRef, useState } from "react";
import "./App.css";
import { ShortModule } from "../../types/global";

type DemoGameId = "wheel" | "plinko" | "roulette" | "slots" | "dice" | "scratch";

type DemoGame = {
  id: DemoGameId;
  name: string;
  description: string;
};

type DemoRound = {
  score: number;
  wheelValues: number[];
  wheelRotation: number;
  plinkoTarget: number;
  dice: [number, number];
  slotDigits: string;
};

const demoGames: DemoGame[] = [
  { id: "wheel", name: "Prize wheel", description: "Spin the wheel and wait for a random score." },
  { id: "plinko", name: "Plinko", description: "Follow the ball through the pegs. The middle pays 100%." },
  { id: "roulette", name: "Roulette", description: "Watch the ball circle the table and settle on a score." },
  { id: "slots", name: "Lucky slots", description: "Let the reels spin and reveal a random percentage." },
  { id: "dice", name: "Lucky dice", description: "Roll the dice to reveal a score from 0% to 100%." },
  { id: "scratch", name: "Scratch card", description: "The foil clears away to uncover your random score." },
];

const wheelColors = ["#28523a", "#293b30", "#6b5225", "#273947", "#6b3936", "#243f3a", "#27544c", "#3b3d2d"];
const rouletteColors = ["#236548", "#242622", "#843b35", "#242622", "#843b35", "#242622", "#843b35", "#242622", "#843b35", "#242622", "#843b35", "#242622"];
const plinkoScores = [0, 20, 40, 60, 80, 100, 80, 60, 40, 20, 0];

const shuffle = <T,>(items: T[]): T[] => {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
};

const makeWheelValues = (score: number, count: number) => {
  const uniqueValues = new Set<number>([0, 100, score]);
  while (uniqueValues.size < count) uniqueValues.add(Math.floor(Math.random() * 101));

  const otherValues = shuffle([...uniqueValues].filter((value) => value !== score));
  const targetIndex = Math.floor(Math.random() * count);
  otherValues.splice(targetIndex, 0, score);
  return { values: otherValues, targetIndex };
};

const makeDemoRound = (game: DemoGameId): DemoRound => {
  const round: DemoRound = {
    score: Math.floor(Math.random() * 101),
    wheelValues: [],
    wheelRotation: 0,
    plinkoTarget: 5,
    dice: [1, 1],
    slotDigits: "000",
  };

  if (game === "wheel" || game === "roulette") {
    const count = game === "roulette" ? rouletteColors.length : 8;
    const { values, targetIndex } = makeWheelValues(round.score, count);
    const targetCenter = targetIndex * (360 / count) + 180 / count;
    const alignment = (360 - targetCenter + 360) % 360;
    round.wheelValues = values;
    round.wheelRotation = (4 + Math.floor(Math.random() * 2)) * 360 + alignment;
  } else if (game === "plinko") {
    let target = 5;
    for (let bounce = 0; bounce < 10; bounce++) {
      target = Math.max(0, Math.min(10, target + (Math.random() < 0.5 ? -1 : 1)));
    }
    round.plinkoTarget = target;
    round.score = plinkoScores[target];
  } else if (game === "dice") {
    round.dice = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
    round.score = Math.round((round.dice[0] + round.dice[1] - 2) * 10);
  }

  round.slotDigits = String(round.score).padStart(3, "0");
  return round;
};

const pickDemoGame = (exclude?: DemoGameId) => {
  const choices = demoGames.filter((game) => game.id !== exclude);
  return choices[Math.floor(Math.random() * choices.length)];
};

const prefersReducedMotion = () =>
  typeof window !== "undefined"
  && typeof window.matchMedia === "function"
  && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const diePips: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const DemoGameArt = ({
  game,
  round,
  spinning,
  rotation,
  result,
}: {
  game: DemoGame;
  round: DemoRound;
  spinning: boolean;
  rotation: number;
  result: number | null;
}) => {
  if (game.id === "wheel" || game.id === "roulette") {
    const isRoulette = game.id === "roulette";
    const colors = isRoulette ? rouletteColors : wheelColors;
    const angleStep = 360 / round.wheelValues.length;
    const gradient = round.wheelValues
      .map((_, index) => `${colors[index % colors.length]} ${index * angleStep}deg ${(index + 1) * angleStep}deg`)
      .join(", ");

    return (
      <div className={`test-wheel-stage${isRoulette ? " is-roulette" : ""}`}>
        <svg className="test-wheel-pointer" viewBox="0 0 28 34" aria-hidden="true">
          <path d="M14 33 1.5 1h25L14 33Z" />
        </svg>
        <div
          className={`test-wheel-disc${spinning ? " is-spinning" : ""}${isRoulette ? " is-roulette" : ""}`}
          role="img"
          aria-label={`${game.name} with percentage pockets`}
          style={{ background: `conic-gradient(${gradient})`, transform: `rotate(${rotation}deg)` }}
        >
          {round.wheelValues.map((value, index) => {
            const angle = index * angleStep + angleStep / 2;
            const radius = isRoulette ? "-87px" : "-83px";
            return (
              <span
                key={`${value}-${index}`}
                className="test-wheel-value"
                style={{ transform: `rotate(${angle}deg) translateY(${radius}) rotate(-${angle}deg)` }}
              >
                {value}%
              </span>
            );
          })}
        </div>
        {isRoulette && (
          <div
            className={`test-roulette-orbit${spinning ? " is-spinning" : ""}`}
            style={spinning ? undefined : { transform: "rotate(1260deg)" }}
            aria-hidden="true"
          >
            <span />
          </div>
        )}
        <span className="test-wheel-hub">{isRoulette ? "INTRA" : "GO"}</span>
      </div>
    );
  }

  if (game.id === "plinko") {
    return (
      <div
        className="test-plinko-board"
        role="img"
        aria-label="Plinko board, with 0 percent at the edges and 100 percent in the centre"
        style={{ "--plinko-target-x": `${(round.plinkoTarget - 5) * 28.7}px` } as React.CSSProperties}
      >
        <div className="test-plinko-pins" aria-hidden="true">
          {Array.from({ length: 9 }, (_, row) =>
            Array.from({ length: row + 1 }, (_, column) => (
              <span
                key={`${row}-${column}`}
                style={{ left: `${50 + (column - row / 2) * 6.4}%`, top: `${8 + row * 8.4}%` }}
              />
            )),
          )}
        </div>
        <span className={`test-plinko-ball${spinning ? " is-dropping" : result !== null ? " has-landed" : ""}`} aria-hidden="true" />
        <div className="test-plinko-bins" aria-hidden="true">
          {plinkoScores.map((score, index) => (
            <span
              className={result !== null && index === round.plinkoTarget ? "is-target" : ""}
              key={`${score}-${index}`}
            >
              {score}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (game.id === "slots") {
    return (
      <div className={`test-slots-machine${spinning ? " is-spinning" : ""}`} role="img" aria-label={`Slot reels show ${round.slotDigits.split("").join(" ")}`}>
        <div className="test-slot-reels">
          {round.slotDigits.split("").map((digit, index) => (
            <span className="test-slot-window" key={`${index}-${digit}`}>
              <span className="test-slot-digit">{digit}</span>
            </span>
          ))}
        </div>
        <span className="test-slots-caption">LUCKY SCORE</span>
      </div>
    );
  }

  if (game.id === "dice") {
    return (
      <div className={`test-dice-table${spinning ? " is-rolling" : ""}`} role="img" aria-label={`Dice show ${round.dice[0]} and ${round.dice[1]}`}>
        {round.dice.map((value, dieIndex) => (
          <span className={`test-die test-die-${dieIndex + 1}`} key={dieIndex}>
            {Array.from({ length: 9 }, (_, pipIndex) => (
              <span className={diePips[value].includes(pipIndex) ? "is-on" : ""} key={pipIndex} />
            ))}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="test-scratch-card">
      <div className="test-scratch-score">
        <span>DEMO SCORE</span>
        <strong>{result === null ? "??%" : `${round.score}%`}</strong>
        <small>Random result</small>
      </div>
      <div className={`test-scratch-foil${spinning ? " is-scratching" : result !== null ? " is-scratched" : ""}`} aria-hidden="true">
        <span>SCRATCH TO REVEAL</span>
        <i />
        <i />
        <i />
      </div>
    </div>
  );
};

const TestMiniGameRound = ({ game }: { game: DemoGame }) => {
  const [reducedMotion] = useState(prefersReducedMotion);
  const [round] = useState(() => makeDemoRound(game.id));
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(!reducedMotion);
  const [result, setResult] = useState<number | null>(() => reducedMotion ? round.score : null);

  useEffect(() => {
    setRotation(round.wheelRotation);
    if (reducedMotion) return;

    const timer = window.setTimeout(() => {
      setResult(round.score);
      setSpinning(false);
    }, 3400);
    return () => window.clearTimeout(timer);
  }, [reducedMotion, round]);

  return (
    <>
      <div className="test-game-intro">
        <h1 id="testGameTitle">{game.name}</h1>
        <p>{game.description}</p>
      </div>

      <DemoGameArt game={game} round={round} spinning={spinning} rotation={rotation} result={result} />

      <div className="test-game-result" aria-live="polite">
        <span>Random result</span>
        <strong>{result === null ? "—" : `${result}%`}</strong>
      </div>
      <p className="test-game-status" role="status" aria-live="polite">
        {spinning ? `${game.name} in progress…` : `Demo result: ${result}%.`}
      </p>
    </>
  );
};

const TestMiniGamesView = ({ onBack }: { onBack: () => void }) => {
  const [game, setGame] = useState(() => pickDemoGame());
  const [roundNumber, setRoundNumber] = useState(0);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const gameIndex = demoGames.findIndex((candidate) => candidate.id === game.id);

  useEffect(() => {
    backButtonRef.current?.focus();
  }, []);

  const chooseAnotherGame = () => {
    setGame((currentGame) => pickDemoGame(currentGame.id));
    setRoundNumber((currentRound) => currentRound + 1);
  };

  return (
    <section className="test-game-view" aria-labelledby="testGameTitle">
      <header className="test-game-header">
        <button ref={backButtonRef} type="button" className="test-game-back" onClick={onBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6M9 12h12" />
          </svg>
          <span>Modules</span>
        </button>
        <span className="test-game-mark">GAME {gameIndex + 1} / {demoGames.length}</span>
      </header>

      <div key={`${game.id}-${roundNumber}`} className="test-game-round" data-game={game.id}>
        <TestMiniGameRound game={game} />
      </div>

      <button type="button" className="test-game-next" onClick={chooseAnotherGame}>
        Try another game
      </button>
    </section>
  );
};

export default () => {
  const [modules, setModules] = useState<ShortModule[]>([]);
  const [searchValue, setSearchValue] = useState<string>("");
  const [userScriptsPermission, setUserScriptsPermission] = useState<boolean>(false);
  const [demoOpen, setDemoOpen] = useState(false);

  const version = browser.runtime.getManifest().version;

  const fetchModules = () => {
    browser.runtime
      .sendMessage({ action: "fetchModules" })
      .then((m) => setModules(m ?? []));
  };

  const fetchUserScriptsPermission = async () => {
    browser.runtime
      .sendMessage({ action: "fetchUserScriptsPermission" })
      .then(setUserScriptsPermission);
  };

  useEffect(() => {
    fetchUserScriptsPermission();
    fetchModules();
  }, []);

  const getFilteredModules = () => {
    return modules.filter((m) =>
      m.name
        .replaceAll(" ", "")
        .toLowerCase()
        .includes(searchValue.replaceAll(" ", "").toLowerCase())
    );
  };

  const testGamesButton = (
    <button type="button" className="test-game-entry" onClick={() => setDemoOpen(true)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="2.5" />
        <path d="M12 3v6.5M20.5 12H14.5M12 21v-6.5M3.5 12h6.5" />
      </svg>
      <span className="test-game-entry-copy">
        <strong>Try a random mini-game</strong>
        <small>Wheel · Plinko · roulette · 3 more</small>
      </span>
      <svg className="test-game-entry-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m9 18 6-6-6-6" />
      </svg>
    </button>
  );

  return (
    <>
      <div className="main-container">
        {demoOpen ? (
          <TestMiniGamesView onBack={() => setDemoOpen(false)} />
        ) : userScriptsPermission ? (
          <>
            <span className="version">v{version}</span>
            <input
              type="text"
              id="moduleSearch"
              placeholder="Search a module"
              autoFocus
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
            {testGamesButton}
            <span id="resultCount">
              {getFilteredModules().length} module
              {getFilteredModules().length < 2 ? "" : "s"} found
            </span>
            <div id="list">
              {getFilteredModules()
                .sort((m1, m2) => {
                  if (m1.active == m2.active) return m1.name.localeCompare(m2.name);
                  return m1.active ? -1 : 1;
                })
                .map(({ name, author, active }) => (
                  <div
                    key={name + author}
                    className={"module-card" + (active ? " active" : "")}
                    onClick={() => {
                      browser.runtime
                        .sendMessage({ action: "toggleModule", name })
                        .then(() => fetchModules());
                    }}
                  >
                    <div className="left">
                      <span className="module-name">{name}</span>
                      <span className="module-author">By {author}</span>
                    </div>
                    <div className="right">
                      <span className="on">ON</span>
                      <span className="off">OFF</span>
                    </div>
                  </div>
                ))}
            </div>
          </>
        ) : (
          <>
            <span className="version">v{version}</span>
            {testGamesButton}
            <button
              id="grantPermissionButton"
              onClick={() => {
                browser.permissions
                  .request({
                    permissions: ["userScripts"],
                  })
                  .then((granted) => {
                    if (granted) {
                      browser.runtime.sendMessage({ action: "initModules" }).then(() => {
                        fetchModules();
                        setUserScriptsPermission(true);
                      });
                    }
                  });
              }}
            >
              Give permission
            </button>
          </>
        )}
      </div>
    </>
  );
};
