import { describe, expect, it } from "vitest";
import {
  BALANCE_TARGET,
  ROUTE_TARGET,
  balanceDistance,
  completedCount,
  createInitialState,
  currentStage,
  enterMemorySymbol,
  isBalanceCorrect,
  isLockCorrect,
  isPowerCorrect,
  isRouteCorrect,
  isSignalCorrect,
  restoreState,
  routePowerLength,
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

  it("resets an incorrect memory sequence and unlocks the route", () => {
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
    expect(currentStage(state)).toBe("route");
  });

  it("powers only the correct prefix of the route", () => {
    expect(routePowerLength(ROUTE_TARGET)).toBe(9);
    expect(isRouteCorrect(ROUTE_TARGET)).toBe(true);

    const broken = [...ROUTE_TARGET];
    broken[4] = 1;
    expect(routePowerLength(broken)).toBe(4);
    expect(isRouteCorrect(broken)).toBe(false);
  });

  it("validates the balance rules and final five-part code", () => {
    expect(balanceDistance(BALANCE_TARGET)).toBe(0);
    expect(isBalanceCorrect(BALANCE_TARGET)).toBe(true);
    expect(isBalanceCorrect([2, 3, 4, 3])).toBe(false);
    expect(isLockCorrect([3, 7, 5, 4, 2])).toBe(true);
    expect(isLockCorrect([3, 7, 5, 4, 1])).toBe(false);
  });

  it("tracks six solved stages before completion", () => {
    const state = createInitialState();
    expect(completedCount(state)).toBe(0);
    const complete = {
      ...state,
      solved: Object.fromEntries(
        Object.keys(state.solved).map((stage) => [stage, true]),
      ) as typeof state.solved,
    };
    expect(completedCount(complete)).toBe(6);
    expect(currentStage(complete)).toBe("complete");
  });

  it("restores only complete version-two data", () => {
    const state = createInitialState();
    state.started = true;
    state.route = [...ROUTE_TARGET];
    expect(restoreState(JSON.stringify(state))).toEqual(state);
    expect(restoreState("{bad json")).toEqual(createInitialState());
    expect(
      restoreState(JSON.stringify({ version: 1, power: ["yes"] })),
    ).toEqual(createInitialState());
  });
});
