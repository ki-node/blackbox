import type { AudioController } from "./audio-controller";
import type { HapticEvent, HapticsController } from "./haptics-controller";

type FeedbackKind = "tap" | "adjust" | "success" | "error";

const hapticEvents: Record<FeedbackKind, HapticEvent> = {
  tap: "light",
  adjust: "medium",
  success: "success",
  error: "error",
};

export class FeedbackController {
  private readonly timers = new Set<number>();

  public constructor(
    private readonly audio: AudioController,
    private readonly haptics: HapticsController,
  ) {}

  public tap(element?: HTMLElement): void {
    this.audio.press();
    this.vibrate("tap");
    if (element) this.flash(element, "tap");
  }

  public adjust(element: HTMLElement, value: number): void {
    this.audio.adjust(value);
    this.vibrate("adjust");
    this.flash(element, "adjust");
  }

  public relay(element: HTMLElement, active: boolean): void {
    this.audio.relay(active);
    this.vibrate("tap");
    this.flash(element, active ? "success" : "tap");
  }

  public memory(
    element: HTMLElement | undefined,
    symbol: Parameters<AudioController["memory"]>[0],
    matched = true,
    withHaptics = true,
  ): void {
    this.audio.memory(symbol, matched);
    if (withHaptics) this.vibrate(matched ? "adjust" : "error");
    if (element) this.flash(element, matched ? "adjust" : "error");
  }

  public route(element: HTMLElement, position: number, powered: boolean): void {
    this.audio.route(position, powered);
    this.vibrate("adjust");
    this.flash(element, powered ? "success" : "adjust");
  }

  public balance(element: HTMLElement, position: number): void {
    this.audio.balance(position);
    this.vibrate("adjust");
    this.flash(element, "adjust");
  }

  public ratchet(element: HTMLElement, position: number): void {
    this.audio.ratchet(position);
    this.vibrate("adjust");
    this.flash(element, "adjust");
  }

  public chapter(index: number): void {
    this.audio.chapter(index);
  }

  public breach(): void {
    this.audio.breach();
    this.vibrate("success");
  }

  public success(element?: HTMLElement, level = 0): void {
    this.audio.success(level);
    this.vibrate("success");
    if (element) this.flash(element, "success");
  }

  public error(element?: HTMLElement): void {
    this.audio.error();
    this.vibrate("error");
    if (element) this.flash(element, "error");
  }

  public pulse(element: HTMLElement, kind: FeedbackKind = "tap"): void {
    this.flash(element, kind);
  }

  public destroy(): void {
    this.timers.forEach((timer) => window.clearTimeout(timer));
    this.timers.clear();
    document
      .querySelectorAll<HTMLElement>("[data-feedback]")
      .forEach((element) => delete element.dataset.feedback);
  }

  private flash(element: HTMLElement, kind: FeedbackKind): void {
    element.dataset.feedback = kind;
    const duration = {
      tap: 280,
      adjust: 460,
      success: 680,
      error: 560,
    }[kind];
    const timer = window.setTimeout(() => {
      this.timers.delete(timer);
      if (element.dataset.feedback === kind) delete element.dataset.feedback;
    }, duration);
    this.timers.add(timer);
  }

  private vibrate(kind: FeedbackKind): void {
    this.haptics.trigger(hapticEvents[kind]);
  }
}
