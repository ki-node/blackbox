import type { AudioController } from "./audio-controller";
import { AnomalyRenderer, type AnomalyMode } from "./anomaly-renderer";

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
  private readonly endingKicker: HTMLElement;
  private readonly endingActions: HTMLElement;
  private readonly renderer: AnomalyRenderer;

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
    this.endingKicker = requireElement("[data-event-kicker]", dialog);
    this.endingActions = requireElement("[data-ending-actions]", dialog);
    this.renderer = new AnomalyRenderer(
      requireElement<HTMLCanvasElement>("[data-anomaly-canvas]", dialog),
    );

    this.listen(requireElement("[data-reconstruct]", dialog), "click", () =>
      this.reconstruct(),
    );
    dialog
      .querySelectorAll<HTMLButtonElement>("[data-finale-choice]")
      .forEach((button) => {
        this.listen(button, "click", () => {
          this.choose(button.dataset.finaleChoice as AnomalyMode);
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
      this.renderer.stop();
      if (!document.documentElement.dataset.ending) this.restoreMachine();
    });
    this.listen(window, "resize", () => {
      if (this.renderer.isRendering) this.renderer.resize();
    });
  }

  public open(): void {
    this.clearTimers();
    this.renderer.stop();
    this.showScreen("breach");
    this.transcriptLines.forEach((line) => {
      line.hidden = true;
      line.classList.remove("is-revealed");
    });
    this.calibration.hidden = true;
    this.endingActions.hidden = true;
    delete document.documentElement.dataset.ending;
    delete document.documentElement.dataset.eventPhase;
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
    this.renderer.stop();
    if (this.dialog.open) this.dialog.close();
    delete document.documentElement.dataset.anomaly;
    delete document.documentElement.dataset.ending;
    delete document.documentElement.dataset.eventPhase;
  }

  public destroy(): void {
    this.reset();
    this.renderer.destroy();
    this.cleanup.forEach((remove) => remove());
  }

  private reconstruct(): void {
    this.clearTimers();
    this.showScreen("transmission");
    document.documentElement.dataset.anomaly = "calibrating";
    this.audio.transmission();

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const delay = reducedMotion ? 0 : transcriptDelay;

    this.transcriptLines.forEach((line, index) => {
      this.schedule(() => {
        line.hidden = false;
        line.classList.add("is-revealed");
        this.audio.dataPulse(index);
      }, delay * index);
    });

    this.schedule(
      () => {
        this.calibration.hidden = false;
        document.documentElement.dataset.anomaly = "awake";
        this.relabelMachine();
        this.audio.success(3);
        requireElement<HTMLElement>(
          "[data-calibration-title]",
          this.dialog,
        ).focus();
      },
      delay * this.transcriptLines.length + (reducedMotion ? 0 : 260),
    );
  }

  private choose(mode: AnomalyMode): void {
    this.clearTimers();
    this.showScreen("ending");
    this.endingActions.hidden = true;
    document.documentElement.dataset.ending = mode;
    document.documentElement.dataset.anomaly = "released";
    document.documentElement.dataset.eventPhase = "opening";
    this.renderer.start(mode);
    this.audio.finalEvent(mode);

    if (mode === "shutdown") {
      this.endingKicker.textContent = "EMERGENCY SEAL / COMMAND SENT";
      this.endingTitle.textContent = "Notabschaltung läuft.";
      this.endingCopy.textContent =
        "Vier mechanische Sperren fahren gleichzeitig in den Kern.";
      this.endingCode.textContent = "INTERLOCK RESPONSE: WAITING";
    } else {
      this.endingKicker.textContent = "UPLINK OPENING / LOCAL ECHO DETECTED";
      this.endingTitle.textContent = "Kontaktsequenz läuft.";
      this.endingCopy.textContent =
        "Der Kern faltet das rekonstruierte Muster zurück auf seine Quelle.";
      this.endingCode.textContent = "RETURN LATENCY: MEASURING";
    }
    this.endingTitle.focus();

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reducedMotion) {
      this.revealEnding(mode);
      return;
    }

    this.schedule(() => {
      document.documentElement.dataset.eventPhase = "contact";
      this.endingKicker.textContent =
        mode === "contact"
          ? "RETURN LATENCY: 0.000 MS"
          : "INTERLOCK RESPONSE: NONE";
    }, 900);
    this.schedule(() => {
      document.documentElement.dataset.eventPhase = "rupture";
      this.endingKicker.textContent =
        mode === "contact" ? "SECOND SIGNAL: 0.0 M" : "CORE MASS: 0.000 KG";
    }, 1_900);
    this.schedule(() => this.revealEnding(mode), 3_250);
  }

  private revealEnding(mode: AnomalyMode): void {
    document.documentElement.dataset.eventPhase = "resolved";
    if (mode === "shutdown") {
      this.endingKicker.textContent =
        "COMMAND OVERRIDDEN / CHANNEL REMAINS OPEN";
      this.endingTitle.textContent = "Notabschaltung fehlgeschlagen.";
      this.endingCopy.textContent =
        "Die Sicherungen schließen. Der Kern ist bereits leer. Im Rauschen läuft dein Abschaltbefehl weiter – von außerhalb des Geräts.";
      this.endingCode.textContent =
        "CONTAINMENT: EMPTY // SIGNAL SOURCE: LOCAL";
    } else {
      this.endingKicker.textContent = "ORIGIN RESOLVED / THIS DEVICE";
      this.endingTitle.textContent = "Kontakt hergestellt.";
      this.endingCopy.textContent =
        "Der Kern antwortet nicht aus der Box. Das Muster zeichnet sich um dein Gerät herum nach. Du hast keine Box geöffnet. Du hast eine Tür gebaut.";
      this.endingCode.textContent =
        "ORIGIN: THIS DEVICE // CONTAINMENT: EXTERNAL";
    }
    this.endingActions.hidden = false;
    this.endingTitle.focus();
  }

  private showScreen(name: string): void {
    this.screens.forEach((screen) => {
      screen.hidden = screen.dataset.finaleScreen !== name;
    });
  }

  private relabelMachine(): void {
    const labels: Record<string, string> = {
      power: "RELEASED",
      signal: "BREACHED",
      memory: "EXPOSED",
      lock: "OPEN",
    };
    Object.entries(labels).forEach(([module, label]) => {
      requireElement<HTMLElement>(
        `[data-module="${module}"] [data-module-status]`,
      ).textContent = label;
    });
    requireElement<HTMLElement>("[data-system-state]").textContent =
      "CONTAINMENT LOST";
    requireElement<HTMLElement>("[data-status]").textContent =
      "Vier Sicherungen aufgehoben. Kernquelle nicht mehr lokalisierbar.";
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
