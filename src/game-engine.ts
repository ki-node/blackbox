export const POWER_TARGET = [true, false, true, true] as const;
export const SIGNAL_TARGET = { carrier: 7, gain: 3, phase: 2 } as const;
export const MEMORY_SEQUENCE = [
  "triangle",
  "diamond",
  "circle",
  "triangle",
  "square",
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
export const ROUTE_TARGET = [0, 0, 1, 2, 0, 0, 3, 0, 0] as const;
export const BALANCE_TARGET = [2, 3, 3, 4] as const;
export const LOCK_TARGET = [3, 7, 5, 4, 2] as const;

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

export function routePowerLength(route: readonly number[]): number {
  let powered = 0;
  for (let index = 0; index < ROUTE_TARGET.length; index += 1) {
    if (!isRouteTileCorrect(index, route[index] ?? -1)) break;
    powered += 1;
  }
  return powered;
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

export function restoreState(raw: string | null): GameState {
  if (!raw) return createInitialState();

  try {
    const candidate = JSON.parse(raw) as Partial<GameState>;
    const initial = createInitialState();
    if (
      candidate.version !== 2 ||
      !Array.isArray(candidate.power) ||
      candidate.power.length !== 4 ||
      !candidate.power.every((value) => typeof value === "boolean") ||
      !candidate.signal ||
      !isNumberArray(candidate.route, 9, 3) ||
      !isNumberArray(candidate.balance, 4, 4) ||
      !isNumberArray(candidate.lock, 5) ||
      !candidate.solved
    ) {
      return initial;
    }

    const signal = candidate.signal;
    if (![signal.carrier, signal.gain, signal.phase].every(isDigit))
      return initial;

    const solved = GAME_STAGES.reduce(
      (result, stage) => {
        result[stage] = Boolean(candidate.solved?.[stage]);
        return result;
      },
      { ...initial.solved },
    );

    return {
      version: 2,
      started: Boolean(candidate.started),
      power: candidate.power,
      signal,
      memoryProgress: Math.min(
        MEMORY_SEQUENCE.length,
        Math.max(0, Math.trunc(candidate.memoryProgress ?? 0)),
      ),
      route: candidate.route,
      balance: candidate.balance,
      lock: candidate.lock,
      solved,
      hints: Math.min(2, Math.max(0, Math.trunc(candidate.hints ?? 0))),
      storySeen: Math.min(
        GAME_STAGES.length,
        Math.max(0, Math.trunc(candidate.storySeen ?? 0)),
      ),
    };
  } catch {
    return createInitialState();
  }
}
