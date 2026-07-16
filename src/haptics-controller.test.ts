import { describe, expect, it, vi } from "vitest";
import {
  HapticsController,
  isHapticEvent,
  type HapticBridgeMessage,
} from "./haptics-controller";

describe("haptics controller", () => {
  it("accepts only the versioned semantic event set", () => {
    expect(isHapticEvent("light")).toBe(true);
    expect(isHapticEvent("success")).toBe(true);
    expect(isHapticEvent("custom-impact")).toBe(false);
  });

  it("uses safe browser vibration feedback", () => {
    const vibrate = vi.fn(() => true);
    const selfWindow = { postMessage: vi.fn() } as unknown as Window;
    Object.defineProperty(selfWindow, "parent", { value: selfWindow });
    const controller = new HapticsController({
      context: "web",
      navigator: { vibrate },
      selfWindow,
    });

    controller.trigger("medium");

    expect(vibrate).toHaveBeenCalledOnce();
  });

  it("sends the expected embedded host message", () => {
    const postMessage = vi.fn();
    const parent = { postMessage } as unknown as Window;
    const selfWindow = { parent, postMessage: vi.fn() } as unknown as Window;
    const controller = new HapticsController({
      context: "embedded",
      navigator: { vibrate: vi.fn() },
      selfWindow,
    });

    controller.trigger("success");

    const expected: HapticBridgeMessage = {
      channel: "ki-node.project-bridge",
      type: "haptic",
      protocolVersion: 1,
      project: "blackbox",
      event: "success",
    };
    expect(postMessage).toHaveBeenCalledWith(expected, "*");
  });

  it("does nothing when no embedded host exists", () => {
    const postMessage = vi.fn();
    const selfWindow = { postMessage } as unknown as Window;
    Object.defineProperty(selfWindow, "parent", { value: selfWindow });
    const controller = new HapticsController({
      context: "embedded",
      navigator: { vibrate: vi.fn() },
      selfWindow,
    });

    expect(() => controller.trigger("warning")).not.toThrow();
    expect(postMessage).not.toHaveBeenCalled();
  });
});
