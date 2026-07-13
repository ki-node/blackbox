import type { AudioController } from "./audio-controller";

type FinaleChoice = "answer" | "disconnect";

const transcriptDelay = 720;

function requireElement<T extends Element>(
  selector: string,
  root: ParentNode = document,
): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing finale element: ${selector}`);
  return element;
}

export class FinaleController {
  private readonly cleanup: Array<() => void> = [];
  private readonly timers: number[] = [];
  private readonly screens: HTMLElement[];
  private readonly transcriptLines: HTMLElement[];
  private readonly calibration: HTMLElement;
  private readonly endingTitle: HTMLElement;
  private readonly endingCopy: HTMLElement;
  private readonly endingCode: HTMLElement;

  public constructor(
    private readonly dialog: HTMLDialogElement,
    private readonly audio: AudioController,
    private readonly onRestart: () => void,
  ) {
    this.screens = [
      ...dialog.querySelectorAll<HTMLElement>("[data-finale-screen]"),
    ];
    this.transcriptLines = [
      ...dialog.querySelectorAll<HTMLElement>("[data-transcript-line]"),
    ];
    this.calibration = requireElement("[data-calibration]", dialog);
    this.endingTitle = requireElement("[data-ending-title]", dialog);
    this.endingCopy = requireElement("[data-ending-copy]", dialog);
    this.endingCode = requireElement("[data-ending-code]", dialog);

    this.listen(requireElement("[data-reconstruct]", dialog), "click", () =>
      this.reconstruct(),
    );
    dialog
      .querySelectorAll<HTMLButtonElement>("[data-finale-choice]")
      .forEach((button) => {
        this.listen(button, "click", () => {
          this.choose(button.dataset.finaleChoice as FinaleChoice);
        });
      });
    this.listen(
      requireElement("[data-close-transmission]", dialog),
      "click",
      () => dialog.close(),
    );
    this.listen(requireElement("[data-restart]", dialog), "click", () => {
      this.reset();
      this.onRestart();
    });
    this.listen(dialog, "close", () => {
      this.clearTimers();
      if (!document.documentElement.dataset.ending) this.restoreMachine();
    });
  }

  public open(): void {
    this.clearTimers();
    this.showScreen("breach");
    this.transcriptLines.forEach((line) => {
      line.hidden = true;
      line.classList.remove("is-revealed");
    });
    this.calibration.hidden = true;
    document.documentElement.dataset.anomaly = "breach";

    if (!this.dialog.open) this.dialog.showModal();
    window.requestAnimationFrame(() => {
      requireElement<HTMLButtonElement>(
        "[data-reconstruct]",
        this.dialog,
      ).focus();
    });
  }

  public reset(): void {
    this.clearTimers();
    if (this.dialog.open) this.dialog.close();
    delete document.documentElement.dataset.anomaly;
    delete document.documentElement.dataset.ending;
  }

  public destroy(): void {
    this.reset();
    this.cleanup.forEach((remove) => remove());
  }

  private reconstruct(): void {
    this.clearTimers();
    this.showScreen("transmission");
    document.documentElement.dataset.anomaly = "calibrating";
    this.audio.impact(64, 0.5, 0.045);
    this.schedule(() => this.audio.tone(192, 0.3, 0.035), 120);

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const delay = reducedMotion ? 0 : transcriptDelay;

    this.transcriptLines.forEach((line, index) => {
      this.schedule(() => {
        line.hidden = false;
        line.classList.add("is-revealed");
        this.audio.tone(126 + index * 48, 0.11, 0.025);
      }, delay * index);
    });

    this.schedule(
      () => {
        this.calibration.hidden = false;
        document.documentElement.dataset.anomaly = "awake";
        this.relabelMachine();
        this.audio.tone(220, 0.32, 0.04);
        this.schedule(() => this.audio.tone(440, 0.4, 0.035), 140);
        requireElement<HTMLElement>(
          "[data-calibration-title]",
          this.dialog,
        ).focus();
      },
      delay * this.transcriptLines.length + (reducedMotion ? 0 : 260),
    );
  }

  private choose(choice: FinaleChoice): void {
    this.showScreen("ending");
    document.documentElement.dataset.ending = choice;

    if (choice === "disconnect") {
      this.endingTitle.textContent = "Befehl abgelehnt.";
      this.endingCopy.textContent =
        "Das Display erlischt. Nur ein Kanal bleibt aktiv – und sendet weiter in einen Raum, der plötzlich nicht mehr leer klingt.";
      this.endingCode.textContent =
        "LINK PERSISTENT // REMOTE CHANNEL LISTENING";
      this.audio.tone(58, 0.65, 0.05);
    } else {
      this.endingTitle.textContent = "Antwort empfangen.";
      this.endingCopy.textContent =
        "Die Box sendet den rekonstruierten Impuls. Aus dem Rauschen antwortet dasselbe Muster – näher, klarer und nicht mehr allein.";
      this.endingCode.textContent =
        "HANDSHAKE ACCEPTED // SECOND DEVICE DETECTED";
      [220, 330, 494, 660].forEach((frequency, index) => {
        this.schedule(
          () => this.audio.tone(frequency, 0.34, 0.035),
          index * 105,
        );
      });
    }

    this.endingTitle.focus();
  }

  private showScreen(name: string): void {
    this.screens.forEach((screen) => {
      screen.hidden = screen.dataset.finaleScreen !== name;
    });
  }

  private relabelMachine(): void {
    const labels: Record<string, string> = {
      power: "CAPTURED",
      signal: "MATCHED",
      memory: "LEARNED",
      lock: "GRANTED",
    };
    Object.entries(labels).forEach(([module, label]) => {
      requireElement<HTMLElement>(
        `[data-module="${module}"] [data-module-status]`,
      ).textContent = label;
    });
    requireElement<HTMLElement>("[data-system-state]").textContent =
      "LINK ACTIVE";
    requireElement<HTMLElement>("[data-status]").textContent =
      "Operator-Muster erfasst. Kalibrierung abgeschlossen.";
  }

  private restoreMachine(): void {
    delete document.documentElement.dataset.anomaly;
    ["power", "signal", "memory", "lock"].forEach((module) => {
      requireElement<HTMLElement>(
        `[data-module="${module}"] [data-module-status]`,
      ).textContent = "RESTORED";
    });
    requireElement<HTMLElement>("[data-system-state]").textContent =
      "ARCHIVE OPEN";
    requireElement<HTMLElement>("[data-status]").textContent =
      "Archiv entsiegelt. Anomale Übertragung wiederhergestellt.";
  }

  private schedule(callback: () => void, delay: number): void {
    const timer = window.setTimeout(callback, delay);
    this.timers.push(timer);
  }

  private clearTimers(): void {
    this.timers.splice(0).forEach((timer) => window.clearTimeout(timer));
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
