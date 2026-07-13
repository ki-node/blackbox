import "./styles.css";
import { AudioController } from "./audio-controller";
import { FinaleController } from "./finale-controller";
import { MachineEffectsController } from "./machine-effects-controller";
import {
  MEMORY_SEQUENCE,
  createInitialState,
  currentStage,
  enterMemorySymbol,
  isLockCorrect,
  isPowerCorrect,
  isSignalCorrect,
  restoreState,
  signalDistance,
  type SignalSettings,
  type Stage,
  type SymbolName,
} from "./game-engine";
import { ScopeRenderer } from "./scope-renderer";

const STORAGE_KEY = "black-box-progress-v1";

const stageCopy: Record<Stage, string> = {
  power: "Level 1 von 6: Schalte die Relais wie in der Gravur ein.",
  signal: "Level 2 von 6: Stelle die drei Regler auf die eingeritzten Werte.",
  memory: "Level 3 von 6: Höre das Formenmuster und spiele es nach.",
  lock: "Level 4 von 6: Bilde den Code aus Relais, Frequenz und Echo-Länge.",
  complete: "4 von 6 Levels geschafft. Öffne die Nachricht der Asteria.",
};

const symbolLabels: Record<SymbolName, string> = {
  triangle: "Dreieck",
  diamond: "Raute",
  circle: "Kreis",
  square: "Quadrat",
};

const hints: Record<Exclude<Stage, "complete">, readonly [string, string]> = {
  power: [
    "Die Gravur oberhalb der Relais ist kein Logo. Gefüllte Kreise führen Strom.",
    "Stelle R1, R3 und R4 auf EIN. R2 bleibt AUS.",
  ],
  signal: [
    "Die drei eingeritzten römischen Zahlen gehören der Reihe nach zu den drei Reglern.",
    "Frequenz 7, Stärke 3, Versatz 2.",
  ],
  memory: [
    "Das Echo besteht aus fünf Impulsen. Spiele es erneut ab und achte auf jedes Symbol.",
    "Dreieck, Raute, Kreis, Dreieck, Quadrat.",
  ],
  lock: [
    "R, F und E stehen für aktive Relais, Frequenz und Echo-Länge.",
    "Drei Relais, Frequenz sieben, fünf Echo-Impulse: 375.",
  ],
};

function requireElement<T extends Element>(
  selector: string,
  root: ParentNode = document,
): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}

class BlackBoxApp {
  private state = restoreState(localStorage.getItem(STORAGE_KEY));
  private readonly audio = new AudioController();
  private readonly effects = new MachineEffectsController(
    requireElement<HTMLElement>("[data-machine]"),
  );
  private readonly scope: ScopeRenderer;
  private readonly status = requireElement<HTMLElement>("[data-status]");
  private readonly systemState = requireElement<HTMLElement>(
    "[data-system-state]",
  );
  private readonly hintText = requireElement<HTMLElement>("[data-hint]");
  private readonly echoAnnouncement = requireElement<HTMLElement>(
    "[data-echo-announcement]",
  );
  private readonly transmission = requireElement<HTMLDialogElement>(
    "[data-transmission]",
  );
  private readonly finale = new FinaleController(
    this.transmission,
    this.audio,
    () => this.reset(),
  );
  private readonly cleanup: Array<() => void> = [];
  private sequenceTimers: number[] = [];
  private resetTimer = 0;
  private isPlaying = false;

  public constructor() {
    const canvas = requireElement<HTMLCanvasElement>("[data-scope]");
    this.scope = new ScopeRenderer(canvas, this.state.signal);
    this.bindEvents();
    this.render();
    requireElement<HTMLElement>("[data-year]").textContent = String(
      new Date().getFullYear(),
    );

    if (currentStage(this.state) === "complete") {
      window.setTimeout(() => this.openTransmission(), 350);
    }
  }

  private listen(
    element: EventTarget,
    type: string,
    listener: EventListener,
  ): void {
    element.addEventListener(type, listener);
    this.cleanup.push(() => element.removeEventListener(type, listener));
  }

  private bindEvents(): void {
    document
      .querySelectorAll<HTMLButtonElement>("[data-relay]")
      .forEach((button) => {
        this.listen(button, "click", () => {
          const index = Number(button.dataset.relay);
          const power = [...this.state.power];
          power[index] = !power[index];
          this.state = { ...this.state, power };
          this.audio.relay(power[index] ?? false);
          this.persistAndRender();
        });
      });

    this.listen(requireElement("[data-check-power]"), "click", () =>
      this.checkPower(),
    );
    this.listen(requireElement("[data-check-signal]"), "click", () =>
      this.checkSignal(),
    );

    document
      .querySelectorAll<HTMLInputElement>("[data-signal]")
      .forEach((input) => {
        this.listen(input, "input", () => {
          const key = input.dataset.signal as keyof SignalSettings;
          this.state = {
            ...this.state,
            signal: { ...this.state.signal, [key]: Number(input.value) },
          };
          this.scope.update(this.state.signal);
          this.persistAndRender();
        });
      });

    this.listen(requireElement("[data-play-sequence]"), "click", () =>
      this.playSequence(),
    );
    document
      .querySelectorAll<HTMLButtonElement>("[data-symbol]")
      .forEach((button) => {
        this.listen(button, "click", () => {
          if (!this.isPlaying)
            this.enterSymbol(button.dataset.symbol as SymbolName);
        });
      });

    document.querySelectorAll<HTMLElement>("[data-wheel]").forEach((wheel) => {
      const index = Number(wheel.dataset.wheel);
      this.listen(requireElement("[data-wheel-up]", wheel), "click", () =>
        this.turnWheel(index, 1),
      );
      this.listen(requireElement("[data-wheel-down]", wheel), "click", () =>
        this.turnWheel(index, -1),
      );
    });

    this.listen(requireElement("[data-unseal]"), "click", () => this.unseal());
    this.listen(requireElement("[data-hint-button]"), "click", () =>
      this.revealHint(),
    );
    this.listen(requireElement("[data-audio]"), "click", () =>
      this.toggleAudio(),
    );
    this.listen(requireElement("[data-reset]"), "click", () =>
      this.armOrReset(),
    );
    this.listen(window, "resize", () => this.scope.resize());
    this.listen(window, "beforeunload", () => this.destroy());
  }

  private checkPower(): void {
    if (!isPowerCorrect(this.state.power)) {
      this.setStatus(
        "Relaisfehler. Stromkreis instabil – Gravur erneut prüfen.",
        true,
      );
      this.audio.error();
      return;
    }

    this.state = {
      ...this.state,
      hints: 0,
      solved: { ...this.state.solved, power: true },
    };
    this.audio.success(0);
    this.advance("signal");
  }

  private checkSignal(): void {
    if (!isSignalCorrect(this.state.signal)) {
      const distance = signalDistance(this.state.signal);
      this.setStatus(`Keine Kopplung. Signalabweichung: ${distance}.`, true);
      this.audio.error();
      return;
    }

    this.state = {
      ...this.state,
      hints: 0,
      solved: { ...this.state.solved, signal: true },
    };
    this.audio.success(1);
    this.advance("memory");
  }

  private playSequence(): void {
    if (this.isPlaying) return;
    this.clearSequenceTimers();
    this.isPlaying = true;
    this.toggleSymbolButtons(true);
    this.setStatus("Echo-Wiedergabe läuft …");

    MEMORY_SEQUENCE.forEach((symbol, index) => {
      const timer = window.setTimeout(() => {
        const echo = requireElement<HTMLElement>(`[data-echo="${symbol}"]`);
        echo.classList.add("is-active");
        this.echoAnnouncement.textContent = `Impuls ${index + 1}: ${symbolLabels[symbol]}`;
        this.audio.memory(index);
        const offTimer = window.setTimeout(
          () => echo.classList.remove("is-active"),
          330,
        );
        this.sequenceTimers.push(offTimer);
      }, index * 620);
      this.sequenceTimers.push(timer);
    });

    const finishTimer = window.setTimeout(
      () => {
        this.isPlaying = false;
        this.toggleSymbolButtons(false);
        this.echoAnnouncement.textContent =
          "Echo beendet. Folge jetzt wiederholen.";
        this.setStatus("Echo beendet. Eingabebereit.");
      },
      MEMORY_SEQUENCE.length * 620 + 120,
    );
    this.sequenceTimers.push(finishTimer);
  }

  private enterSymbol(symbol: SymbolName): void {
    const result = enterMemorySymbol(this.state, symbol);
    this.state = result.state;
    this.audio.memory(this.state.memoryProgress, result.matched);

    if (!result.matched) {
      this.setStatus("Echo abgebrochen. Die Folge beginnt von vorn.", true);
    } else if (result.complete) {
      this.state = { ...this.state, hints: 0 };
      this.audio.success(2);
      this.advance("lock");
      return;
    } else {
      this.setStatus(
        `Echo bestätigt: ${this.state.memoryProgress} von 5 Impulsen.`,
      );
    }
    this.persistAndRender(false);
  }

  private turnWheel(index: number, direction: number): void {
    const lock = [...this.state.lock];
    lock[index] = ((lock[index] ?? 0) + direction + 10) % 10;
    this.state = { ...this.state, lock };
    this.audio.ratchet(lock[index] ?? 0);
    this.persistAndRender();
  }

  private unseal(): void {
    if (!isLockCorrect(this.state.lock)) {
      this.setStatus(
        "Der Code stimmt noch nicht. Lies R · F · E von links nach rechts.",
        true,
      );
      this.audio.error();
      return;
    }

    this.state = {
      ...this.state,
      solved: { ...this.state.solved, lock: true },
    };
    this.persistAndRender();
    this.effects.surge("lock");
    this.audio.breach();
    this.setStatus(stageCopy.complete);
    window.setTimeout(() => this.openTransmission(), 650);
  }

  private advance(stage: Exclude<Stage, "power" | "complete">): void {
    const completedStage = {
      signal: "power",
      memory: "signal",
      lock: "memory",
    }[stage] as Exclude<Stage, "complete">;
    this.effects.surge(completedStage);
    this.persistAndRender();
    this.setStatus(stageCopy[stage]);
    window.setTimeout(
      () => requireElement<HTMLElement>(`#${stage}-title`).focus(),
      120,
    );
  }

  private revealHint(): void {
    const stage = currentStage(this.state);
    if (stage === "complete") {
      this.hintText.textContent =
        "Die Box ist offen. Mehr gibt dieses Gerät nicht preis.";
      return;
    }

    const nextLevel = Math.min(this.state.hints + 1, 2);
    this.state = { ...this.state, hints: nextLevel };
    this.hintText.textContent = hints[stage][nextLevel - 1] ?? hints[stage][1];
    this.persist();
    const button = requireElement<HTMLButtonElement>("[data-hint-button]");
    button.textContent =
      nextLevel === 1 ? "Deutlicherer Hinweis" : "Hinweis vollständig";
    button.disabled = nextLevel === 2;
  }

  private toggleAudio(): void {
    const enabled = this.audio.toggle();
    const button = requireElement<HTMLButtonElement>("[data-audio]");
    button.setAttribute("aria-pressed", String(enabled));
    requireElement<HTMLElement>("[data-audio-label]").textContent = enabled
      ? "Ton an"
      : "Ton aus";
  }

  private armOrReset(): void {
    const button = requireElement<HTMLButtonElement>("[data-reset]");
    if (button.dataset.armed === "true") {
      window.clearTimeout(this.resetTimer);
      this.reset();
      return;
    }

    button.dataset.armed = "true";
    button.textContent = "Wirklich zurücksetzen?";
    this.resetTimer = window.setTimeout(() => {
      delete button.dataset.armed;
      button.textContent = "Zurücksetzen";
    }, 4000);
  }

  private reset(): void {
    this.clearSequenceTimers();
    this.finale.reset();
    this.state = createInitialState();
    localStorage.removeItem(STORAGE_KEY);
    const button = requireElement<HTMLButtonElement>("[data-reset]");
    delete button.dataset.armed;
    button.textContent = "Zurücksetzen";
    this.hintText.textContent = "Noch kein Hinweis angefordert.";
    this.scope.update(this.state.signal);
    this.render();
    this.setStatus(stageCopy.power);
    requireElement<HTMLElement>("#power-title").focus();
  }

  private openTransmission(): void {
    this.finale.open();
  }

  private render(): void {
    const stage = currentStage(this.state);
    document.documentElement.dataset.stage = stage;
    this.systemState.textContent =
      stage === "complete"
        ? "MESSAGE FOUND · 4/6"
        : `MISSION ${Math.min(4, this.completedCount() + 1)}/6`;

    document
      .querySelectorAll<HTMLButtonElement>("[data-relay]")
      .forEach((button, index) => {
        const active = this.state.power[index] ?? false;
        button.setAttribute("aria-pressed", String(active));
        button.classList.toggle("is-active", active);
        requireElement<HTMLElement>("[data-relay-label]", button).textContent =
          active ? "EIN" : "AUS";
      });

    (Object.keys(this.state.signal) as Array<keyof SignalSettings>).forEach(
      (key) => {
        requireElement<HTMLInputElement>(`[data-signal="${key}"]`).value =
          String(this.state.signal[key]);
        requireElement<HTMLOutputElement>(
          `[data-output="${key}"]`,
        ).textContent = String(this.state.signal[key]);
      },
    );

    const memoryMeter = requireElement<HTMLElement>(".memory-meter");
    memoryMeter.setAttribute(
      "aria-valuenow",
      String(this.state.memoryProgress),
    );
    memoryMeter
      .querySelectorAll<HTMLElement>("i")
      .forEach((indicator, index) => {
        indicator.classList.toggle(
          "is-filled",
          index < this.state.memoryProgress,
        );
      });

    document
      .querySelectorAll<HTMLElement>("[data-wheel]")
      .forEach((wheel, index) => {
        requireElement<HTMLOutputElement>("output", wheel).textContent = String(
          this.state.lock[index] ?? 0,
        );
      });

    const stages: Array<Exclude<Stage, "complete">> = [
      "power",
      "signal",
      "memory",
      "lock",
    ];
    stages.forEach((name, index) => {
      const module = requireElement<HTMLElement>(`[data-module="${name}"]`);
      const solved = this.state.solved[name];
      const unlocked = index <= this.completedCount();
      module.classList.toggle("is-locked", !unlocked);
      module.classList.toggle("is-solved", solved);
      module.inert = !unlocked;
      module.setAttribute("aria-disabled", String(!unlocked));
      requireElement<HTMLElement>("[data-module-status]", module).textContent =
        solved ? "RESTORED" : unlocked ? "ACTIVE" : "LOCKED";

      const progress = requireElement<HTMLElement>(`[data-progress="${name}"]`);
      progress.classList.toggle("is-complete", solved);
      progress.classList.toggle("is-current", name === stage);
      if (name === stage) progress.setAttribute("aria-current", "step");
      else progress.removeAttribute("aria-current");
    });
    this.effects.updateProgress(this.completedCount());

    if (this.state.hints > 0 && stage !== "complete") {
      this.hintText.textContent =
        hints[stage][Math.min(this.state.hints, 2) - 1] ?? hints[stage][1];
    }
    const hintButton = requireElement<HTMLButtonElement>("[data-hint-button]");
    hintButton.disabled = this.state.hints >= 2 || stage === "complete";
    hintButton.textContent =
      this.state.hints === 0
        ? "Hinweis entschlüsseln"
        : this.state.hints === 1
          ? "Deutlicherer Hinweis"
          : "Hinweis vollständig";
  }

  private completedCount(): number {
    return Object.values(this.state.solved).filter(Boolean).length;
  }

  private toggleSymbolButtons(disabled: boolean): void {
    document
      .querySelectorAll<HTMLButtonElement>("[data-symbol]")
      .forEach((button) => {
        button.disabled = disabled;
      });
    requireElement<HTMLButtonElement>("[data-play-sequence]").disabled =
      disabled;
  }

  private setStatus(message: string, error = false): void {
    this.status.textContent = message;
    this.status
      .closest(".machine__display")
      ?.classList.toggle("is-error", error);
    if (error) this.effects.reject();
  }

  private persistAndRender(updateStatus = true): void {
    this.persist();
    this.render();
    if (updateStatus) this.setStatus(stageCopy[currentStage(this.state)]);
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // The game remains fully playable when storage is unavailable.
    }
  }

  private clearSequenceTimers(): void {
    this.sequenceTimers.forEach((timer) => window.clearTimeout(timer));
    this.sequenceTimers = [];
    this.isPlaying = false;
    document.querySelectorAll(".echo-display .is-active").forEach((element) => {
      element.classList.remove("is-active");
    });
    this.toggleSymbolButtons(false);
  }

  private destroy(): void {
    this.clearSequenceTimers();
    window.clearTimeout(this.resetTimer);
    this.cleanup.forEach((remove) => remove());
    this.scope.destroy();
    this.finale.destroy();
    this.effects.destroy();
    this.audio.destroy();
  }
}

new BlackBoxApp();
