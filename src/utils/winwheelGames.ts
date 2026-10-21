export const WINWHEEL_GAMES = [
  { id: "wheel", label: "Prize wheel" },
  { id: "plinko", label: "Plinko" },
  { id: "roulette", label: "Roulette" },
  { id: "slots", label: "Lucky slots" },
  { id: "dice", label: "Lucky dice" },
  { id: "scratch", label: "Scratch card" },
  { id: "marbles", label: "Marble run" },
  { id: "pachinko", label: "Pachinko fever" },
  { id: "derby", label: "Derby race" },
  { id: "crash", label: "Rocket crash" },
  { id: "pinball", label: "Pinball frenzy" },
  { id: "lotto", label: "Lucky lotto" },
  { id: "cups", label: "Shell cups" },
] as const;

export type WinwheelGameId = (typeof WINWHEEL_GAMES)[number]["id"];
export type WinwheelGameSettings = Record<WinwheelGameId, boolean>;

export const DEFAULT_WINWHEEL_GAME_SETTINGS: WinwheelGameSettings = {
  wheel: true,
  plinko: true,
  roulette: true,
  slots: true,
  dice: true,
  scratch: true,
  marbles: true,
  pachinko: true,
  derby: true,
  crash: true,
  pinball: true,
  lotto: true,
  cups: true,
};

export const normalizeWinwheelGameSettings = (value: unknown): WinwheelGameSettings => {
  const settings = typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : {};

  return Object.fromEntries(
    WINWHEEL_GAMES.map(({ id }) => [
      id,
      typeof settings[id] === "boolean"
        ? settings[id]
        : DEFAULT_WINWHEEL_GAME_SETTINGS[id],
    ]),
  ) as WinwheelGameSettings;
};

