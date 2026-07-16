export const POWER_TARGET = [true, false, true, true] as const;
export const SIGNAL_TARGET = { carrier: 7, gain: 3, phase: 2 } as const;
export const MEMORY_SEQUENCE = [
  "triangle",
  "diamond",
  "circle",
  "square",
  "triangle",
  "circle",
] as const;

export const ROUTE_TILES = [
  "straight",
  "straight",
  "corner",
  "corner",
  "straight",
  "corner",
  "corner",
  "straight",
  "straight",
] as const;
export const ROUTE_PATH = [0, 1, 2, 5, 4, 3, 6, 7, 8] as const;
export const ROUTE_TARGET = [0, 0, 1, 0, 0, 2, 3, 0, 0] as const;
export const BALANCE_TARGET = [2, 3, 3, 4] as const;
export const LOCK_TARGET = [3, 7, 6, 4, 2] as const;

export const GAME_STAGES = [
  "power",
  "signal",
  "memory",
  "route",
  "balance",
  "lock",
] as const;

export type SymbolName = (typeof MEMORY_SEQUENCE)[number];
export type PuzzleStage = (typeof GAME_STAGES)[number];
export type Stage = PuzzleStage | "complete";
export type RouteTile = (typeof ROUTE_TILES)[number];
export type RouteDirection = "up" | "right" | "down" | "left";

export interface SignalSettings {
  carrier: number;
  gain: number;
  phase: number;
}

export interface GameState {
  version: 2;
  started: boolean;
  power: boolean[];
  signal: SignalSettings;
  memoryProgress: number;
  route: number[];
  balance: number[];
  lock: number[];
  solved: Record<PuzzleStage, boolean>;
  hints: number;
  storySeen: number;
}

export interface MemoryResult {
  state: GameState;
  matched: boolean;
  complete: boolean;
}

export function createInitialState(): GameState {
  return {
    version: 2,
    started: false,
    power: [false, false, false, false],
    signal: { carrier: 4, gain: 5, phase: 6 },
    memoryProgress: 0,
    route: [1, 0, 0, 2, 1, 3, 2, 0, 1],
    balance: [0, 1, 4, 1],
    lock: [0, 0, 0, 0, 0],
    solved: {
      power: false,
      signal: false,
      memory: false,
      route: false,
      balance: false,
      lock: false,
    },
    hints: 0,
    storySeen: 0,
  };
}

export function isPowerCorrect(power: readonly boolean[]): boolean {
  return POWER_TARGET.every((target, index) => power[index] === target);
}

export function signalDistance(signal: SignalSettings): number {
  return (
    Math.abs(signal.carrier - SIGNAL_TARGET.carrier) +
    Math.abs(signal.gain - SIGNAL_TARGET.gain) +
    Math.abs(signal.phase - SIGNAL_TARGET.phase)
  );
}

export function isSignalCorrect(signal: SignalSettings): boolean {
  return signalDistance(signal) === 0;
}

export function normalizeRouteOrientation(
  tile: RouteTile,
  orientation: number,
): number {
  const normalized = ((orientation % 4) + 4) % 4;
  return tile === "straight" ? normalized % 2 : normalized;
}

export function isRouteTileCorrect(
  index: number,
  orientation: number,
): boolean {
  const tile = ROUTE_TILES[index];
  const target = ROUTE_TARGET[index];
  if (!tile || target === undefined) return false;
  return (
    normalizeRouteOrientation(tile, orientation) ===
    normalizeRouteOrientation(tile, target)
  );
}

export function routeConnections(
  tile: RouteTile,
  orientation: number,
): readonly RouteDirection[] {
  const normalized = normalizeRouteOrientation(tile, orientation);
  if (tile === "straight") {
    return normalized === 0 ? ["left", "right"] : ["up", "down"];
  }

  return (
    (
      [
        ["right", "down"],
        ["left", "down"],
        ["left", "up"],
        ["right", "up"],
      ] as const
    )[normalized] ?? ["right", "down"]
  );
}

export function routePoweredTiles(route: readonly number[]): number[] {
  const powered: number[] = [];
  for (const index of ROUTE_PATH) {
    if (!isRouteTileCorrect(index, route[index] ?? -1)) break;
    powered.push(index);
  }
  return powered;
}

export function routePowerLength(route: readonly number[]): number {
  return routePoweredTiles(route).length;
}

export function isRouteCorrect(route: readonly number[]): boolean {
  return routePowerLength(route) === ROUTE_TARGET.length;
}

export function balanceDistance(balance: readonly number[]): number {
  return BALANCE_TARGET.reduce(
    (distance, target, index) =>
      distance + Math.abs(target - (balance[index] ?? 0)),
    0,
  );
}

export function isBalanceCorrect(balance: readonly number[]): boolean {
  return balanceDistance(balance) === 0;
}

export function isLockCorrect(lock: readonly number[]): boolean {
  return LOCK_TARGET.every((target, index) => lock[index] === target);
}

export function currentStage(state: GameState): Stage {
  return GAME_STAGES.find((stage) => !state.solved[stage]) ?? "complete";
}

export function completedCount(state: GameState): number {
  return GAME_STAGES.filter((stage) => state.solved[stage]).length;
}

export function stageNumber(state: GameState): number {
  const stage = currentStage(state);
  return stage === "complete"
    ? GAME_STAGES.length
    : GAME_STAGES.indexOf(stage) + 1;
}

export function enterMemorySymbol(
  state: GameState,
  symbol: SymbolName,
): MemoryResult {
  if (state.solved.memory) return { state, matched: true, complete: true };

  const expected = MEMORY_SEQUENCE[state.memoryProgress];
  if (symbol !== expected) {
    return {
      state: { ...state, memoryProgress: 0 },
      matched: false,
      complete: false,
    };
  }

  const nextProgress = state.memoryProgress + 1;
  const complete = nextProgress === MEMORY_SEQUENCE.length;
  return {
    state: {
      ...state,
      memoryProgress: nextProgress,
      solved: complete ? { ...state.solved, memory: true } : state.solved,
    },
    matched: true,
    complete,
  };
}

function isDigit(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 9
  );
}

function isNumberArray(
  value: unknown,
  length: number,
  maximum = 9,
): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === length &&
    value.every(
      (item) =>
        typeof item === "number" &&
        Number.isInteger(item) &&
        item >= 0 &&
        item <= maximum,
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.trunc(value)));
}

export function restoreState(raw: string | null): GameState {
  if (!raw) return createInitialState();

  try {
    const parsed: unknown = JSON.parse(raw);
    const initial = createInitialState();
    if (!isRecord(parsed) || parsed.version !== 2) return initial;
    const candidate = parsed;

    const power =
      Array.isArray(candidate.power) &&
      candidate.power.length === 4 &&
      candidate.power.every((value) => typeof value === "boolean")
        ? candidate.power
        : initial.power;
    const signalCandidate = isRecord(candidate.signal)
      ? candidate.signal
      : undefined;
    const signal =
      signalCandidate &&
      [
        signalCandidate.carrier,
        signalCandidate.gain,
        signalCandidate.phase,
      ].every(isDigit)
        ? {
            carrier: signalCandidate.carrier as number,
            gain: signalCandidate.gain as number,
            phase: signalCandidate.phase as number,
          }
        : initial.signal;
    const solvedCandidate = isRecord(candidate.solved) ? candidate.solved : {};

    const solved = GAME_STAGES.reduce(
      (result, stage) => {
        result[stage] =
          typeof solvedCandidate[stage] === "boolean"
            ? solvedCandidate[stage]
            : initial.solved[stage];
        return result;
      },
      { ...initial.solved },
    );

    return {
      version: 2,
      started:
        typeof candidate.started === "boolean"
          ? candidate.started
          : initial.started,
      power,
      signal,
      memoryProgress: boundedInteger(
        candidate.memoryProgress,
        0,
        MEMORY_SEQUENCE.length,
        initial.memoryProgress,
      ),
      route: isNumberArray(candidate.route, 9, 3)
        ? candidate.route
        : initial.route,
      balance: isNumberArray(candidate.balance, 4, 4)
        ? candidate.balance
        : initial.balance,
      lock: isNumberArray(candidate.lock, 5) ? candidate.lock : initial.lock,
      solved,
      hints: boundedInteger(candidate.hints, 0, 2, initial.hints),
      storySeen: boundedInteger(
        candidate.storySeen,
        0,
        GAME_STAGES.length,
        initial.storySeen,
      ),
    };
  } catch {
    return createInitialState();
  }
}
