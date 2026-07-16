import { describe, expect, it, vi } from "vitest";
import { ApplicationLifecycle } from "./application-lifecycle";

describe("application lifecycle", () => {
  it("initializes and destroys exactly once per lifecycle", () => {
    const destroy = vi.fn();
    const factory = vi.fn(() => ({ destroy }));
    const target = new EventTarget() as Window;
    const lifecycle = new ApplicationLifecycle(factory, target);

    expect(lifecycle.init()).toBe(lifecycle.init());
    expect(factory).toHaveBeenCalledOnce();

    lifecycle.destroy();
    lifecycle.destroy();
    expect(destroy).toHaveBeenCalledOnce();

    lifecycle.init();
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it("cleans up on pagehide and reinitializes on pageshow", () => {
    const destroy = vi.fn();
    const factory = vi.fn(() => ({ destroy }));
    const target = new EventTarget() as Window;
    const lifecycle = new ApplicationLifecycle(factory, target);

    lifecycle.init();
    target.dispatchEvent(new Event("pagehide"));
    target.dispatchEvent(new Event("pagehide"));
    expect(destroy).toHaveBeenCalledOnce();

    target.dispatchEvent(new Event("pageshow"));
    expect(factory).toHaveBeenCalledTimes(2);
  });
});
