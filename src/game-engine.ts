export const POWER_TARGET = [true, false, true, true] as const;
export const SIGNAL_TARGET = { carrier: 7, gain: 3, phase: 2 } as const;
export const MEMORY_SEQUENCE = [
  "triangle",
  "diamond",
  "circle",
  "triangle",
  "square",
] as const;
export const LOCK_TARGET = [3, 7, 5] as const;

export type SymbolName = (typeof MEMORY_SEQUENCE)[number];
export type Stage = "power" | "signal" | "memory" | "lock" | "complete";

export interface SignalSettings {
  carrier: number;
  gain: number;
  phase: number;
}

export interface GameState {
  version: 1;
  power: boolean[];
  signal: SignalSettings;
  memoryProgress: number;
  lock: number[];
  solved: {
    power: boolean;
    signal: boolean;
    memory: boolean;
    lock: boolean;
  };
  hints: number;
}

export interface MemoryResult {
  state: GameState;
  matched: boolean;
  complete: boolean;
}

export function createInitialState(): GameState {
  return {
    version: 1,
    power: [false, false, false, false],
    signal: { carrier: 4, gain: 5, phase: 6 },
    memoryProgress: 0,
    lock: [0, 0, 0],
    solved: { power: false, signal: false, memory: false, lock: false },
    hints: 0,
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

export function isLockCorrect(lock: readonly number[]): boolean {
  return LOCK_TARGET.every((target, index) => lock[index] === target);
}

export function currentStage(state: GameState): Stage {
  if (!state.solved.power) return "power";
  if (!state.solved.signal) return "signal";
  if (!state.solved.memory) return "memory";
  if (!state.solved.lock) return "lock";
  return "complete";
}

export function stageNumber(state: GameState): number {
  const stages: Stage[] = ["power", "signal", "memory", "lock", "complete"];
  return stages.indexOf(currentStage(state)) + 1;
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

export function restoreState(raw: string | null): GameState {
  if (!raw) return createInitialState();

  try {
    const candidate = JSON.parse(raw) as Partial<GameState>;
    const initial = createInitialState();
    if (
      candidate.version !== 1 ||
      !Array.isArray(candidate.power) ||
      candidate.power.length !== 4 ||
      !candidate.power.every((value) => typeof value === "boolean") ||
      !candidate.signal ||
      !Array.isArray(candidate.lock) ||
      candidate.lock.length !== 3 ||
      !candidate.lock.every(isDigit) ||
      !candidate.solved
    ) {
      return initial;
    }

    const signal = candidate.signal;
    if (![signal.carrier, signal.gain, signal.phase].every(isDigit))
      return initial;

    const memoryProgress = Math.min(
      MEMORY_SEQUENCE.length,
      Math.max(0, Math.trunc(candidate.memoryProgress ?? 0)),
    );

    return {
      version: 1,
      power: candidate.power,
      signal,
      memoryProgress,
      lock: candidate.lock,
      solved: {
        power: Boolean(candidate.solved.power),
        signal: Boolean(candidate.solved.signal),
        memory: Boolean(candidate.solved.memory),
        lock: Boolean(candidate.solved.lock),
      },
      hints: Math.max(0, Math.trunc(candidate.hints ?? 0)),
    };
  } catch {
    return createInitialState();
  }
}
