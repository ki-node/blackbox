import { describe, expect, it } from "vitest";
import {
  createInitialState,
  currentStage,
  enterMemorySymbol,
  isLockCorrect,
  isPowerCorrect,
  isSignalCorrect,
  restoreState,
  signalDistance,
} from "./game-engine";

describe("game engine", () => {
  it("validates the relay configuration", () => {
    expect(isPowerCorrect([true, false, true, true])).toBe(true);
    expect(isPowerCorrect([true, true, true, true])).toBe(false);
  });

  it("measures and validates signal tuning", () => {
    expect(signalDistance({ carrier: 4, gain: 5, phase: 6 })).toBe(9);
    expect(isSignalCorrect({ carrier: 7, gain: 3, phase: 2 })).toBe(true);
  });

  it("resets an incorrect memory sequence and completes a correct one", () => {
    let state = createInitialState();
    state = {
      ...state,
      solved: { ...state.solved, power: true, signal: true },
    };

    const wrong = enterMemorySymbol(state, "circle");
    expect(wrong.matched).toBe(false);
    expect(wrong.state.memoryProgress).toBe(0);

    for (const symbol of [
      "triangle",
      "diamond",
      "circle",
      "triangle",
      "square",
    ] as const) {
      state = enterMemorySymbol(state, symbol).state;
    }
    expect(state.solved.memory).toBe(true);
    expect(currentStage(state)).toBe("lock");
  });

  it("validates the derived lock code", () => {
    expect(isLockCorrect([3, 7, 5])).toBe(true);
    expect(isLockCorrect([3, 7, 4])).toBe(false);
  });

  it("rejects malformed persisted data", () => {
    expect(restoreState("{bad json")).toEqual(createInitialState());
    expect(
      restoreState(JSON.stringify({ version: 1, power: ["yes"] })),
    ).toEqual(createInitialState());
  });
});
