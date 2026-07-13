import type { AudioController } from "./audio-controller";
import { AnomalyRenderer } from "./anomaly-renderer";

const transcriptDelay = 720;
const directionGlyphs = ["↑", "→", "↓", "←"] as const;
const directionNames = ["oben", "rechts", "unten", "links"] as const;
const locationTarget = [1, 3, 0] as const;

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
  private readonly directionButtons: HTMLButtonElement[];
  private readonly locationStatus: HTMLElement;
  private readonly endingTitle: HTMLElement;
  private readonly endingCopy: HTMLElement;
  private readonly endingCode: HTMLElement;
  private readonly endingKicker: HTMLElement;
  private readonly endingActions: HTMLElement;
  private readonly renderer: AnomalyRenderer;
  private directions = [0, 1, 3];

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
    this.directionButtons = [
      ...dialog.querySelectorAll<HTMLButtonElement>("[data-direction-button]"),
    ];
    this.locationStatus = requireElement("[data-location-status]", dialog);
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
    this.directionButtons.forEach((button, index) => {
      this.listen(button, "click", () => this.turnDirection(index));
    });
    this.listen(requireElement("[data-check-location]", dialog), "click", () =>
      this.checkLocation(),
    );
    this.listen(requireElement("[data-send-signal]", dialog), "click", () =>
      this.sendSignal(),
    );
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
    this.directions = [0, 1, 3];
    this.renderDirections();
    this.locationStatus.textContent =
      "Noch zeigen nicht alle Pfeile zur Mitte.";
    this.locationStatus.classList.remove("is-error");
    this.updateMissionProgress("waiting");
    delete document.documentElement.dataset.ending;
    delete document.documentElement.dataset.eventPhase;
    document.documentElement.dataset.anomaly = "message";

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
    this.updateMissionProgress("waiting");
  }

  public destroy(): void {
    this.reset();
    this.renderer.destroy();
    this.cleanup.forEach((remove) => remove());
  }

  private reconstruct(): void {
    this.clearTimers();
    this.showScreen("transmission");
    document.documentElement.dataset.anomaly = "message-playing";
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
        document.documentElement.dataset.anomaly = "crew-found";
        this.updateMissionProgress("location");
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

  private turnDirection(index: number): void {
    this.directions[index] = ((this.directions[index] ?? 0) + 1) % 4;
    this.locationStatus.textContent = "Pfeil gedreht. Position erneut prüfen.";
    this.locationStatus.classList.remove("is-error");
    this.audio.ratchet(this.directions[index] ?? 0);
    this.renderDirections();
  }

  private checkLocation(): void {
    const correct = locationTarget.every(
      (direction, index) => this.directions[index] === direction,
    );
    if (!correct) {
      this.locationStatus.textContent =
        "Noch nicht gefunden: Alle drei Pfeile müssen zur leuchtenden Mitte zeigen.";
      this.locationStatus.classList.add("is-error");
      this.audio.error();
      return;
    }

    this.locationStatus.textContent = "Position gefunden.";
    this.locationStatus.classList.remove("is-error");
    this.audio.success(4);
    this.updateMissionProgress("send");
    this.showScreen("send");
    requireElement<HTMLElement>("[data-send-title]", this.dialog).focus();
  }

  private sendSignal(): void {
    this.clearTimers();
    this.showScreen("ending");
    this.endingActions.hidden = true;
    document.documentElement.dataset.ending = "rescue";
    document.documentElement.dataset.anomaly = "signal-sent";
    document.documentElement.dataset.eventPhase = "opening";
    this.updateMissionProgress("complete");
    this.relabelMachine(true);
    this.renderer.start();
    this.audio.finalEvent();

    this.endingKicker.textContent = "RETTUNGSSIGNAL WIRD GESENDET";
    this.endingTitle.textContent = "Signal unterwegs.";
    this.endingCopy.textContent =
      "Die Position der Asteria wird an alle erreichbaren Rettungsschiffe übertragen.";
    this.endingCode.textContent = "MISSION 06/06 // SENDUNG LÄUFT";
    this.endingTitle.focus();

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reducedMotion) {
      this.revealEnding();
      return;
    }

    this.schedule(() => {
      document.documentElement.dataset.eventPhase = "contact";
      this.endingKicker.textContent = "SIGNAL HAT DIE ERDE VERLASSEN";
    }, 900);
    this.schedule(() => {
      document.documentElement.dataset.eventPhase = "rupture";
      this.endingKicker.textContent = "ANTWORT DER ASTERIA EMPFANGEN";
    }, 1_900);
    this.schedule(() => this.revealEnding(), 3_250);
  }

  private revealEnding(): void {
    document.documentElement.dataset.eventPhase = "resolved";
    this.endingKicker.textContent = "CREW GEFUNDEN / RETTUNG UNTERWEGS";
    this.endingTitle.textContent = "Mission erfüllt.";
    this.endingCopy.textContent =
      "Die Asteria hat geantwortet. Ihre Crew lebt, die Rettung kennt jetzt ihre Position und ist unterwegs. Du bist fertig.";
    this.endingCode.textContent = "6 VON 6 LEVELS ABGESCHLOSSEN";
    this.endingActions.hidden = false;
    this.endingTitle.focus();
  }

  private renderDirections(): void {
    this.directionButtons.forEach((button, index) => {
      const direction = this.directions[index] ?? 0;
      requireElement<HTMLElement>("b", button).textContent =
        directionGlyphs[direction] ?? "↑";
      button.setAttribute(
        "aria-label",
        `Suchpunkt ${String.fromCharCode(65 + index)} drehen, zeigt ${directionNames[direction] ?? "oben"}`,
      );
    });
  }

  private updateMissionProgress(
    state: "waiting" | "location" | "send" | "complete",
  ): void {
    const location = requireElement<HTMLElement>('[data-progress="location"]');
    const send = requireElement<HTMLElement>('[data-progress="send"]');
    location.classList.toggle("is-current", state === "location");
    location.classList.toggle(
      "is-complete",
      state === "send" || state === "complete",
    );
    send.classList.toggle("is-current", state === "send");
    send.classList.toggle("is-complete", state === "complete");
    if (state === "location") location.setAttribute("aria-current", "step");
    else location.removeAttribute("aria-current");
    if (state === "send") send.setAttribute("aria-current", "step");
    else send.removeAttribute("aria-current");
  }

  private showScreen(name: string): void {
    this.screens.forEach((screen) => {
      screen.hidden = screen.dataset.finaleScreen !== name;
    });
  }

  private relabelMachine(complete = false): void {
    ["power", "signal", "memory", "lock"].forEach((module) => {
      requireElement<HTMLElement>(
        `[data-module="${module}"] [data-module-status]`,
      ).textContent = "RESTORED";
    });
    requireElement<HTMLElement>("[data-system-state]").textContent = complete
      ? "MISSION COMPLETE"
      : "CREW SIGNAL FOUND";
    requireElement<HTMLElement>("[data-status]").textContent = complete
      ? "Mission erfüllt. Rettungsroute gesendet."
      : "Notruf wiederhergestellt. Crew wartet auf das Rettungssignal.";
  }

  private restoreMachine(): void {
    delete document.documentElement.dataset.anomaly;
    this.relabelMachine(false);
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
