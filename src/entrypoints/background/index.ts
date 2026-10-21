import browser from "webextension-polyfill";

import modules from "./modules";
import type { BackgroundScriptConfig, Module, ShortModule } from "../../types/global";
import { getItem, setItem } from "../../utils/localStorage";
import {
  DEFAULT_WINWHEEL_GAME_SETTINGS,
  normalizeWinwheelGameSettings,
  WINWHEEL_GAMES,
  type WinwheelGameId,
} from "../../utils/winwheelGames";
const backgroundScriptConfigs: { name: string; config: BackgroundScriptConfig }[] = [];
const winwheelGameSettingsKey = "winwheelGameSettings";

const getWinwheelGameSettings = async () => {
  const stored = await getItem(winwheelGameSettingsKey);
  if (!stored) return { ...DEFAULT_WINWHEEL_GAME_SETTINGS };

  try {
    return normalizeWinwheelGameSettings(JSON.parse(stored));
  } catch {
    return { ...DEFAULT_WINWHEEL_GAME_SETTINGS };
  }
};

const launchWinwheelDemo = async () => {
  const settings = await getWinwheelGameSettings();
  const enabledGames = WINWHEEL_GAMES.filter(({ id }) => settings[id]);
  if (enabledGames.length === 0) return { ok: false, reason: "no-games-enabled" };

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return { ok: false, reason: "no-active-tab" };

  const game = enabledGames[Math.floor(Math.random() * enabledGames.length)];
  try {
    await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: (gameId: string) => {
        (globalThis as any).__intraTweakerWinwheelDemo = gameId;
      },
      args: [game.id],
    });
    await browser.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["./module_winwheel.js"],
    });
    return { ok: true };
  } catch (error) {
    console.error("Could not launch the Winwheel demo in the active tab.", error);
    return { ok: false, reason: "page-not-supported" };
  }
};

// Serialize startup and popup changes: Chrome must finish registration before reload.
let moduleChanges: Promise<unknown> = Promise.resolve();
const enqueueModuleChange = (change: () => Promise<unknown>) => {
  const pending = moduleChanges.then(change);
  moduleChanges = pending.catch(() => {});
  return pending;
};

const initModules = async () => {
  const modulesState = await initModulesState(modules);

  await browser.userScripts.configureWorld({
    messaging: true,
  });

  for (let module of modules) {
    let i = 0;
    for (let subModule of module.children) {
      if (subModule.kind == "background") {
        import(`./scripts/${module.folder}/${subModule.name}.ts`)
          .then((backgroundScript) => {
            if (modulesState.get(module.name)) backgroundScript.default.start();
            backgroundScriptConfigs.push({
              name: module.name,
              config: backgroundScript.default,
            });
          })
          .catch(console.error);
      } else if (subModule.kind == "content") {
        if (modulesState.get(module.name))
          await registerScript(
            `./module_${module.folder}.js`,
            subModule.matches,
            module.name + i++,
          );
      }
    }
  }
};

const registerScript = async (file: string, matches: string[], id: string) => {
  if (!(await browser.permissions.contains({ permissions: ["userScripts"] })))
    throw new Error("Autorisation userScripts indisponible.");

  const script = { id, js: [{ file }], matches };
  const existing = await browser.userScripts.getScripts({ ids: [id] });
  if (existing.length) await browser.userScripts.update([script]);
  else await browser.userScripts.register([script]);
};

const unregisterScript = async (id: string) => {
  const existing = await browser.userScripts.getScripts({ ids: [id] });
  if (existing.length) await browser.userScripts.unregister({ ids: [id] });
};

const getModulesState = async () => {
  const storage = await getItem("modulesState");
  if (!storage) return;
  try {
    return new Map(JSON.parse(storage)) as Map<string, boolean>;
  } catch {
    return new Map(modules.values().map((m) => [m.name, m.default ?? false]));
  }
};

const setModulesState = async (moduleName: string, state: boolean) => {
  const modulesState = await getModulesState();
  if (!modulesState) return;

  modulesState.set(moduleName, state);

  await setItem("modulesState", JSON.stringify([...modulesState.entries()]));
};

const initModulesState = async (modules: Module[]) => {
  const modulesState = (await getModulesState()) ?? new Map<string, boolean>();
  modules.forEach((m) => {
    if (!modulesState.has(m.name)) modulesState.set(m.name, m.default ?? false);
  });
  await setItem("modulesState", JSON.stringify([...modulesState.entries()]));
  return modulesState;
};

const reloadTabsForModule = async (name: string) => {
  const module = modules.find((m) => m.name == name);
  if (!module) return;

  // reload all pages matching its filters
  const tabsToReaload: number[] = [];

  const children = module.children.filter((c) => c.kind == "content");

  for (let c of children) {
    const tabs = await browser.tabs.query({ url: c.matches });
    for (let tab of tabs) {
      if (tab.id && !tabsToReaload.includes(tab.id)) {
        tabsToReaload.push(tab.id);
      }
    }
  }

  for (let tabId of tabsToReaload) {
    await browser.tabs.reload(tabId);
  }
};

export const init = async () => {
  let userScriptsPermission = await browser.permissions.contains({
    permissions: ["userScripts"],
  });
  if (import.meta.env.BROWSER === "firefox") {
    if (!userScriptsPermission) {
      const url = browser.runtime.getURL("/html/index.html");
      browser.tabs.create({
        url,
      });
    }
  }

  // must return true when async
  const handleMessage = (message: any, sendResponse: (_: any) => void): void => {
    if (!message.action) return;

    if (message.action == "fetchModules") {
      const formattedModules: ShortModule[] = [];
      for (let module of modules) {
        getModulesState().then((m) => {
          const active = m?.get(module.name) ?? false;
          formattedModules.push({ name: module.name, author: module.author, active });
          if (formattedModules.length === modules.length) sendResponse(formattedModules);
        });
      }
      return;
    } else if (message.action === "fetchWinwheelGameSettings") {
      getWinwheelGameSettings().then(sendResponse);
      return;
    } else if (message.action === "toggleWinwheelGame") {
      const gameId = message.gameId as WinwheelGameId;
      if (!WINWHEEL_GAMES.some((game) => game.id === gameId)
        || typeof message.enabled !== "boolean") {
        sendResponse(null);
        return;
      }

      getWinwheelGameSettings().then(async (settings) => {
        settings[gameId] = message.enabled;
        await setItem(winwheelGameSettingsKey, JSON.stringify(settings));
        sendResponse(settings);
      }).catch(() => sendResponse(null));
      return;
    } else if (message.action === "launchWinwheelDemo") {
      launchWinwheelDemo().then(sendResponse);
      return;
    } else if (message.action == "toggleModule") {
      enqueueModuleChange(async () => {
        const state = await initModulesState(modules);
        const module = modules.find((m) => m.name === message.name);
        if (!module) throw new Error("Module inconnu.");
        const enabled = !state.get(module.name);
        let i = 0;
        for (const child of module.children) {
          if (child.kind !== "content") continue;
          const id = module.name + i++;
          if (enabled) await registerScript(`./module_${module.folder}.js`, child.matches, id);
          else await unregisterScript(id);
        }
        for (const c of backgroundScriptConfigs.filter((c) => c.name === module.name)) {
          if (enabled) c.config.start();
          else c.config.stop();
        }
        await setModulesState(module.name, enabled);
        await reloadTabsForModule(module.name);
      }).then(() => sendResponse({ ok: true }), (error) =>
        sendResponse({ ok: false, reason: String(error) }));

      return;
    } else if (message.action === "fetchUserScriptsPermission") {
      browser.permissions
        .contains({
          permissions: ["userScripts"],
        })
        .then(sendResponse);
      return;
    } else if (message.action === "initModules") {
      enqueueModuleChange(initModules).then(
        () => sendResponse({ ok: true }),
        (error) => sendResponse({ ok: false, reason: String(error) }),
      );
      return;
    }
  };

  const runtimeMessageListener = (message: any) =>
    new Promise((res) => handleMessage(message, res));
  browser.runtime.onMessage.addListener(runtimeMessageListener);
  (browser.runtime as any).onUserScriptMessage?.addListener(runtimeMessageListener);

  if (userScriptsPermission) await enqueueModuleChange(initModules).catch(console.error);
};

export default defineBackground(() => {
  init();
});
