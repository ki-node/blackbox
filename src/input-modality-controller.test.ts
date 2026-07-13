import { describe, expect, it } from "vitest";
import { InputModalityController } from "./input-modality-controller";

function keyboardEvent(key: string): Event {
  const event = new Event("keydown");
  Object.defineProperty(event, "key", { value: key });
  return event;
}

describe("input modality controller", () => {
  it("shows focus styling only after a real keyboard input", () => {
    const target = new EventTarget() as Document;
    const root = { dataset: {} } as unknown as HTMLElement;
    const controller = new InputModalityController(root, target);

    controller.init();
    expect(root.dataset.inputModality).toBe("pointer");

    target.dispatchEvent(keyboardEvent("Tab"));
    expect(root.dataset.inputModality).toBe("keyboard");

    target.dispatchEvent(new Event("pointerdown"));
    expect(root.dataset.inputModality).toBe("pointer");

    controller.destroy();
    expect(root.dataset.inputModality).toBeUndefined();
  });

  it("ignores modifier-only key presses", () => {
    const target = new EventTarget() as Document;
    const root = { dataset: {} } as unknown as HTMLElement;
    const controller = new InputModalityController(root, target);

    controller.init();
    target.dispatchEvent(keyboardEvent("Shift"));

    expect(root.dataset.inputModality).toBe("pointer");
  });
});
