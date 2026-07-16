import { describe, expect, it } from "vitest";
import { createRuntime, isRuntimeContext } from "./runtime";

describe("runtime context", () => {
  it("exposes the web capability set", () => {
    expect(createRuntime("web")).toEqual({
      context: "web",
      isEmbedded: false,
      isWeb: true,
      allowsFullscreen: true,
      supportsPwa: true,
    });
  });

  it("exposes the embedded capability set", () => {
    expect(createRuntime("embedded")).toEqual({
      context: "embedded",
      isEmbedded: true,
      isWeb: false,
      allowsFullscreen: false,
      supportsPwa: false,
    });
  });

  it("rejects unknown contexts", () => {
    expect(isRuntimeContext("web")).toBe(true);
    expect(isRuntimeContext("embedded")).toBe(true);
    expect(isRuntimeContext("orbit")).toBe(false);
  });
});
