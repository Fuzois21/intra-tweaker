import React, { useEffect, useState } from "react";
import browser from "webextension-polyfill";
import "./App.css";
import type { ShortModule } from "../../types/global";
import {
  DEFAULT_WINWHEEL_GAME_SETTINGS,
  normalizeWinwheelGameSettings,
  WINWHEEL_GAMES,
  type WinwheelGameId,
  type WinwheelGameSettings,
} from "../../utils/winwheelGames";

export default () => {
  const [modules, setModules] = useState<ShortModule[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [userScriptsPermission, setUserScriptsPermission] = useState(false);
  const [gameSettings, setGameSettings] = useState<WinwheelGameSettings>(
    DEFAULT_WINWHEEL_GAME_SETTINGS,
  );
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [updatingGameId, setUpdatingGameId] = useState<WinwheelGameId | null>(null);
  const [launchingDemo, setLaunchingDemo] = useState(false);
  const [demoStatus, setDemoStatus] = useState("");

  const version = browser.runtime.getManifest().version;
  const enabledGameCount = WINWHEEL_GAMES.filter(({ id }) => gameSettings[id]).length;

  const fetchModules = () => {
    browser.runtime
      .sendMessage({ action: "fetchModules" })
      .then((result) => setModules(Array.isArray(result) ? result as ShortModule[] : []))
      .catch(() => setModules([]));
  };

  useEffect(() => {
    browser.runtime
      .sendMessage({ action: "fetchUserScriptsPermission" })
      .then((granted) => setUserScriptsPermission(granted === true))
      .catch(() => setUserScriptsPermission(false));
    fetchModules();

    browser.runtime
      .sendMessage({ action: "fetchWinwheelGameSettings" })
      .then((settings) => {
        if (settings) setGameSettings(normalizeWinwheelGameSettings(settings));
      })
      .catch(() => {})
      .finally(() => setSettingsLoaded(true));
  }, []);

  const toggleGame = async (gameId: WinwheelGameId, enabled: boolean) => {
    setUpdatingGameId(gameId);
    setDemoStatus("");
    try {
      const settings = await browser.runtime.sendMessage({
        action: "toggleWinwheelGame",
        gameId,
        enabled,
      }) as WinwheelGameSettings | null;
      if (settings) setGameSettings(settings);
      else setDemoStatus("Could not save mini-game settings.");
    } catch {
      setDemoStatus("Could not save mini-game settings.");
    } finally {
      setUpdatingGameId(null);
    }
  };

  const launchDemo = async () => {
    if (launchingDemo || enabledGameCount === 0) return;

    setLaunchingDemo(true);
    setDemoStatus("");
    try {
      const result = await browser.runtime.sendMessage({ action: "launchWinwheelDemo" }) as { ok?: boolean; reason?: string } | null;
      if (result?.ok) {
        window.close();
        return;
      }

      setDemoStatus(result?.reason === "page-not-supported"
        ? "This browser page does not allow extensions to run demos."
        : result?.reason === "no-games-enabled"
          ? "Enable at least one mini-game first."
          : "Could not start the demo in this tab.");
    } catch {
      setDemoStatus("Could not start the demo in this tab.");
    } finally {
      setLaunchingDemo(false);
    }
  };

  const filteredModules = modules.filter((module) =>
    module.name
      .replaceAll(" ", "")
      .toLowerCase()
      .includes(searchValue.replaceAll(" ", "").toLowerCase()),
  );

  return (
    <div className="main-container">
      <span className="version">v{version}</span>
      <button
        type="button"
        className="test-game-entry"
        disabled={!settingsLoaded || enabledGameCount === 0 || launchingDemo}
        onClick={launchDemo}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="2.5" />
          <path d="M12 3v6.5M20.5 12H14.5M12 21v-6.5M3.5 12h6.5" />
        </svg>
        <span className="test-game-entry-copy">
          <strong>{launchingDemo ? "Starting demo…" : "Test a random mini-game"}</strong>
          <small>{enabledGameCount} of {WINWHEEL_GAMES.length} active · launches over this tab</small>
        </span>
        <svg className="test-game-entry-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>

      <details className="game-settings">
        <summary>
          <strong>Winwheel mini-games</strong>
          <span>{enabledGameCount} / {WINWHEEL_GAMES.length} on</span>
        </summary>
        <fieldset className="game-toggle-list" disabled={!settingsLoaded || updatingGameId !== null}>
          <legend className="sr-only">Choose which mini-games can appear</legend>
          {WINWHEEL_GAMES.map(({ id, label }) => (
            <label className="game-toggle" key={id}>
              <span>{label}</span>
              <span className="game-toggle-control">
                <input
                  type="checkbox"
                  checked={gameSettings[id]}
                  onChange={(event) => void toggleGame(id, event.currentTarget.checked)}
                />
                <span aria-hidden="true">{gameSettings[id] ? "ON" : "OFF"}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </details>

      {demoStatus && <p className="demo-status" role="status">{demoStatus}</p>}

      {userScriptsPermission ? (
        <>
          <input
            type="text"
            id="moduleSearch"
            placeholder="Search a module"
            aria-label="Search a module"
            value={searchValue}
            onChange={(event) => setSearchValue(event.currentTarget.value)}
          />
          <span id="resultCount">
            {filteredModules.length} module{filteredModules.length === 1 ? "" : "s"} found
          </span>
          <div id="list">
            {filteredModules
              .sort((first, second) => {
                if (first.active === second.active) return first.name.localeCompare(second.name);
                return first.active ? -1 : 1;
              })
              .map(({ name, author, active }) => (
                <div
                  key={name + author}
                  className={`module-card${active ? " active" : ""}`}
                  onClick={() => {
                    browser.runtime
                      .sendMessage({ action: "toggleModule", name })
                      .then((result: any) => {
                        if (!result?.ok) setDemoStatus(result?.reason ?? "Activation impossible.");
                        fetchModules();
                      }).catch((error) => setDemoStatus(String(error)));
                  }}
                >
                  <div className="left">
                    <span className="module-name">{name}</span>
                    <span className="module-author">By {author}</span>
                  </div>
                  <div className="right" aria-label={active ? "Enabled" : "Disabled"}>
                    <span className="on">ON</span>
                    <span className="off">OFF</span>
                  </div>
                </div>
              ))}
          </div>
        </>
      ) : (
        <section className="permission-panel">
          <p>Enable extension modules on Intra Forge.</p>
          <button
            id="grantPermissionButton"
            type="button"
            onClick={() => {
              browser.permissions
                .request({ permissions: ["userScripts"] })
                .then((granted) => {
                  if (!granted) return;
                  browser.runtime.sendMessage({ action: "initModules" }).then((result: any) => {
                    if (!result?.ok) {
                      setDemoStatus(result?.reason ?? "Chargement impossible.");
                      return;
                    }
                    fetchModules();
                    setUserScriptsPermission(true);
                  });
                });
            }}
          >
            Give permission
          </button>
        </section>
      )}
    </div>
  );
};
