import type { AudioController } from "./audio-controller";

type FeedbackKind = "tap" | "adjust" | "success" | "error";

const vibrationPatterns: Record<FeedbackKind, number | number[]> = {
  tap: 8,
  adjust: 6,
  success: [18, 35, 34],
  error: [28, 32, 28],
};

export class FeedbackController {
  public constructor(private readonly audio: AudioController) {}

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
  ): void {
    this.audio.memory(symbol, matched);
    this.vibrate(matched ? "adjust" : "error");
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
    this.vibrate("success");
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

  private flash(element: HTMLElement, kind: FeedbackKind): void {
    element.dataset.feedback = kind;
    const duration = {
      tap: 280,
      adjust: 460,
      success: 680,
      error: 560,
    }[kind];
    window.setTimeout(() => {
      if (element.dataset.feedback === kind) delete element.dataset.feedback;
    }, duration);
  }

  private vibrate(kind: FeedbackKind): void {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if ("vibrate" in navigator) navigator.vibrate(vibrationPatterns[kind]);
  }
}
