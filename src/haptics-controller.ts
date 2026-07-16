import type { RuntimeContext } from "./runtime";

export const HAPTIC_EVENTS = [
  "light",
  "medium",
  "heavy",
  "success",
  "warning",
  "error",
] as const;

export type HapticEvent = (typeof HAPTIC_EVENTS)[number];

export interface HapticBridgeMessage {
  channel: "ki-node.project-bridge";
  type: "haptic";
  protocolVersion: 1;
  project: "blackbox";
  event: HapticEvent;
}

interface HapticsEnvironment {
  context: RuntimeContext;
  navigator: { vibrate?: Navigator["vibrate"] };
  selfWindow: Pick<Window, "parent" | "postMessage">;
}

const vibrationPatterns: Record<HapticEvent, number | number[]> = {
  light: 8,
  medium: 14,
  heavy: 24,
  success: [18, 35, 34],
  warning: [22, 40, 16],
  error: [28, 32, 28],
};

/**
 * Validates the closed set of semantic haptic events.
 */
export function isHapticEvent(value: unknown): value is HapticEvent {
  return HAPTIC_EVENTS.includes(value as HapticEvent);
}

/**
 * Sends semantic haptic feedback to the browser or the embedding host.
 */
export class HapticsController {
  public constructor(private readonly environment: HapticsEnvironment) {}

  public trigger(event: HapticEvent): void {
    if (!isHapticEvent(event)) return;

    if (this.environment.context === "embedded") {
      this.postToHost(event);
      return;
    }

    this.vibrate(event);
  }

  private postToHost(event: HapticEvent): void {
    const { selfWindow } = this.environment;
    if (selfWindow.parent === selfWindow) return;

    const message: HapticBridgeMessage = {
      channel: "ki-node.project-bridge",
      type: "haptic",
      protocolVersion: 1,
      project: "blackbox",
      event,
    };

    try {
      selfWindow.parent.postMessage(message, "*");
    } catch {
      // A missing or inaccessible host is an intentional no-op.
    }
  }

  private vibrate(event: HapticEvent): void {
    try {
      this.environment.navigator.vibrate?.(vibrationPatterns[event]);
    } catch {
      // Haptics are optional and must never affect the mission.
    }
  }
}
