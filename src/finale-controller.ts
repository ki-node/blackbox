import { AnomalyRenderer } from "./anomaly-renderer";
import type { AudioController } from "./audio-controller";
import type { FeedbackController } from "./feedback-controller";

function requireElement<T extends Element>(
  selector: string,
  root: ParentNode,
): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing finale element: ${selector}`);
  return element;
}

export class FinaleController {
  private readonly renderer: AnomalyRenderer;
  private readonly screens: HTMLElement[];
  private readonly cleanup: Array<() => void> = [];
  private replyTimer = 0;

  public constructor(
    private readonly dialog: HTMLDialogElement,
    private readonly audio: AudioController,
    private readonly feedback: FeedbackController,
    private readonly onReset: () => void,
    private readonly onClose: () => void,
  ) {
    this.renderer = new AnomalyRenderer(
      requireElement<HTMLCanvasElement>("[data-anomaly-canvas]", dialog),
    );
    this.screens = [
      ...dialog.querySelectorAll<HTMLElement>("[data-finale-screen]"),
    ];

    dialog
      .querySelectorAll<HTMLButtonElement>("[data-finale-next]")
      .forEach((button, index) => {
        this.listen(button, "click", () => {
          this.feedback.tap(button);
          this.audio.dataPulse(index);
          this.showScreen(button.dataset.finaleNext ?? "message");
        });
      });
    this.listen(
      requireElement<HTMLButtonElement>("[data-send-signal]", dialog),
      "click",
      () => this.send(),
    );
    this.listen(
      requireElement<HTMLButtonElement>("[data-read-reply]", dialog),
      "click",
      () => this.revealReply(),
    );
    this.listen(
      requireElement<HTMLButtonElement>("[data-close-transmission]", dialog),
      "click",
      () => {
        this.feedback.tap();
        this.dialog.close();
        this.onClose();
      },
    );
    this.listen(
      requireElement<HTMLButtonElement>("[data-restart]", dialog),
      "click",
      () => {
        this.feedback.tap();
        this.reset();
        this.onReset();
      },
    );
  }

  public open(): void {
    window.clearTimeout(this.replyTimer);
    this.showScreen("open");
    this.renderer.stop();
    document.documentElement.dataset.ending = "rescue";
    if (!this.dialog.open) this.dialog.showModal();
  }

  public reset(): void {
    window.clearTimeout(this.replyTimer);
    this.renderer.stop();
    delete document.documentElement.dataset.ending;
    this.showScreen("open", false);
    if (this.dialog.open) this.dialog.close();
  }

  public destroy(): void {
    window.clearTimeout(this.replyTimer);
    this.cleanup.forEach((remove) => remove());
    this.renderer.destroy();
  }

  private send(): void {
    const sendButton = requireElement<HTMLButtonElement>(
      "[data-send-signal]",
      this.dialog,
    );
    this.feedback.success(sendButton, 5);
    this.audio.transmission();
    this.showScreen("sending");
    this.renderer.start();

    const reply = requireElement<HTMLButtonElement>(
      "[data-read-reply]",
      this.dialog,
    );
    reply.disabled = true;
    reply.textContent = "Warte auf Antwort …";

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    this.replyTimer = window.setTimeout(
      () => {
        reply.disabled = false;
        reply.textContent = "Antwort der Asteria lesen";
        reply.focus();
      },
      reducedMotion ? 0 : 2_600,
    );
  }

  private revealReply(): void {
    const reply = requireElement<HTMLButtonElement>(
      "[data-read-reply]",
      this.dialog,
    );
    this.feedback.success(reply, 6);
    this.audio.finalEvent();
    this.showScreen("ending");
  }

  private showScreen(name: string, focus = true): void {
    this.screens.forEach((screen) => {
      screen.hidden = screen.dataset.finaleScreen !== name;
    });
    if (!focus) return;
    window.requestAnimationFrame(() => {
      this.dialog
        .querySelector<HTMLElement>(
          `[data-finale-screen="${name}"] h2[tabindex="-1"]`,
        )
        ?.focus();
    });
  }

  private listen(
    element: EventTarget,
    type: string,
    listener: EventListener,
  ): void {
    element.addEventListener(type, listener);
    this.cleanup.push(() => element.removeEventListener(type, listener));
  }
}
