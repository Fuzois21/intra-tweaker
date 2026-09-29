import React, { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import { ShortModule } from "../../types/global";

const wheelColors = ["#28523a", "#293b30", "#6b5225", "#273947", "#6b3936", "#243f3a", "#27544c", "#3b3d2d"];

const makeWheelValues = (score: number) => {
  const uniqueValues = new Set<number>([0, 100, score]);
  while (uniqueValues.size < 8) uniqueValues.add(Math.floor(Math.random() * 101));

  const otherValues = [...uniqueValues].filter((value) => value !== score);
  for (let index = otherValues.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [otherValues[index], otherValues[swapIndex]] = [otherValues[swapIndex], otherValues[index]];
  }

  const targetIndex = Math.floor(Math.random() * 8);
  otherValues.splice(targetIndex, 0, score);
  return { values: otherValues, targetIndex };
};

const TestWheelView = ({ onBack }: { onBack: () => void }) => {
  const [values, setValues] = useState([0, 14, 29, 43, 57, 71, 86, 100]);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(true);
  const [result, setResult] = useState<number | null>(null);
  const rotationRef = useRef(0);
  const timerRef = useRef<number | undefined>(undefined);
  const backButtonRef = useRef<HTMLButtonElement>(null);

  const spin = useCallback(() => {
    const score = Math.floor(Math.random() * 101);
    const { values: nextValues, targetIndex } = makeWheelValues(score);
    const targetCenter = targetIndex * 45 + 22.5;
    const currentOffset = ((rotationRef.current % 360) + 360) % 360;
    const alignment = (360 - targetCenter - currentOffset + 360) % 360;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const turns = reducedMotion ? 0 : 4 + Math.floor(Math.random() * 2);
    const nextRotation = rotationRef.current + turns * 360 + alignment;

    if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
    rotationRef.current = nextRotation;
    setValues(nextValues);
    setResult(null);
    setRotation(nextRotation);
    setSpinning(!reducedMotion);

    if (reducedMotion) {
      setResult(score);
      return;
    }

    timerRef.current = window.setTimeout(() => {
      setResult(score);
      setSpinning(false);
      timerRef.current = undefined;
    }, 3650);
  }, []);

  useEffect(() => {
    backButtonRef.current?.focus();
    spin();
    return () => {
      if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
    };
  }, [spin]);

  const gradient = `conic-gradient(${values.map((_, index) => `${wheelColors[index]} ${index * 45}deg ${(index + 1) * 45}deg`).join(", ")})`;

  return (
    <section className="test-wheel-view" aria-labelledby="testWheelTitle">
      <header className="test-wheel-header">
        <button ref={backButtonRef} type="button" className="test-wheel-back" onClick={onBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6M9 12h12" />
          </svg>
          <span>Modules</span>
        </button>
        <span className="test-wheel-mark">DEMO</span>
      </header>

      <div className="test-wheel-intro">
        <h1 id="testWheelTitle">Test the wheel</h1>
        <p>Random percentage. Your saved tags stay untouched.</p>
      </div>

      <div className="test-wheel-stage">
        <svg className="test-wheel-pointer" viewBox="0 0 28 34" aria-hidden="true">
          <path d="M14 33 1.5 1h25L14 33Z" />
        </svg>
        <div
          className={`test-wheel-disc${spinning ? " is-spinning" : ""}`}
          role="img"
          aria-label="Wheel with eight percentage sectors"
          style={{ background: gradient, transform: `rotate(${rotation}deg)` }}
        >
          {values.map((value, index) => {
            const angle = index * 45 + 22.5;
            return (
              <span
                key={`${value}-${index}`}
                className="test-wheel-value"
                style={{ transform: `rotate(${angle}deg) translateY(-83px) rotate(-${angle}deg)` }}
              >
                {value}%
              </span>
            );
          })}
          <span className="test-wheel-hub">GO</span>
        </div>
      </div>

      <div className="test-wheel-result" aria-live="polite">
        <span>Random result</span>
        <strong>{result === null ? "—" : `${result}%`}</strong>
      </div>
      <p className="test-wheel-status" role="status" aria-live="polite">
        {spinning ? "The wheel is spinning…" : result === null ? "Preparing the wheel…" : `Demo result: ${result}%.`}
      </p>
      <button type="button" className="test-wheel-spin" onClick={spin} disabled={spinning}>
        {spinning ? "Spinning…" : "Spin again"}
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

  const testWheelButton = (
    <button type="button" className="test-wheel-entry" onClick={() => setDemoOpen(true)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="2.5" />
        <path d="M12 3v6.5M20.5 12H14.5M12 21v-6.5M3.5 12h6.5" />
      </svg>
      <span className="test-wheel-entry-copy">
        <strong>Test Winwheel</strong>
        <small>Spin a random demo score</small>
      </span>
      <svg className="test-wheel-entry-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m9 18 6-6-6-6" />
      </svg>
    </button>
  );

  return (
    <>
      <div className="main-container">
        {demoOpen ? (
          <TestWheelView onBack={() => setDemoOpen(false)} />
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
            {testWheelButton}
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
            {testWheelButton}
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
