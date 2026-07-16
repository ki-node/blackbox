import { describe, expect, it } from "vitest";
import { AudioController } from "./audio-controller";

describe("audio controller", () => {
  it("does not create or play audio before a user interaction unlock", () => {
    const audio = new AudioController();

    expect(() => {
      audio.press();
      audio.success();
      audio.chapter(0);
    }).not.toThrow();

    audio.destroy();
  });
});
