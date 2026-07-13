import "./styles.css";
import "./game-shell.css";
import { AudioController } from "./audio-controller";
import { FeedbackController } from "./feedback-controller";
import { FinaleController } from "./finale-controller";
import {
  GAME_STAGES,
  MEMORY_SEQUENCE,
  ROUTE_TILES,
  balanceDistance,
  completedCount,
  createInitialState,
  currentStage,
  enterMemorySymbol,
  isBalanceCorrect,
  isLockCorrect,
  isPowerCorrect,
  isRouteCorrect,
  isSignalCorrect,
  restoreState,
  routePowerLength,
  signalDistance,
  type PuzzleStage,
  type RouteTile,
  type SignalSettings,
  type Stage,
  type SymbolName,
} from "./game-engine";
import { InstallController } from "./install-controller";
import { MachineEffectsController } from "./machine-effects-controller";
import { ScopeRenderer } from "./scope-renderer";

const STORAGE_KEY = "black-box-progress-v2";

const stageNames: Record<Stage, string> = {
  power: "Energie",
  signal: "Signal",
  memory: "Echo",
  route: "Leitungsnetz",
  balance: "Balance",
  lock: "Verschluss",
  complete: "Mission erfüllt",
};

const stageCopy: Record<Stage, string> = {
  power: "Schalte die Relais wie in der Gravur ein.",
  signal: "Stelle die drei Werte auf VII · III · II.",
  memory: "Höre fünf Formen und spiele dieselbe Folge.",
  route: "Baue eine durchgehende Leitung von IN nach OUT.",
  balance: "Verteile genau zwölf Einheiten nach den drei Regeln.",
  lock: "Übertrage die fünf gesammelten Schlüssel in den Verschluss.",
  complete: "Die Asteria hat geantwortet. Rettungsschiffe sind unterwegs.",
};

const symbolLabels: Record<SymbolName, string> = {
  triangle: "Dreieck",
  diamond: "Raute",
  circle: "Kreis",
  square: "Quadrat",
};

const routeDescriptions: Record<RouteTile, readonly string[]> = {
  straight: ["waagerecht", "senkrecht"],
  corner: [
    "rechts und unten",
    "links und unten",
    "links und oben",
    "rechts und oben",
  ],
};

const routeGlyphs: Record<RouteTile, readonly string[]> = {
  straight: ["━", "┃"],
  corner: ["┏", "┓", "┛", "┗"],
};

const hints: Record<PuzzleStage, readonly [string, string]> = {
  power: [
    "Gefüllte Kreise in der Gravur bedeuten EIN, leere Kreise AUS.",
    "Stelle R1, R3 und R4 auf EIN. R2 bleibt AUS.",
  ],
  signal: [
    "Die römischen Zahlen gehören von links nach rechts zu den drei Reglern.",
    "Frequenz 7, Stärke 3, Versatz 2.",
  ],
  memory: [
    "Jede Form besitzt immer denselben Ton. Du kannst die Folge beliebig oft abspielen.",
    "Dreieck, Raute, Kreis, Dreieck, Quadrat.",
  ],
  route: [
    "Strom leuchtet nur bis zur ersten falsch gedrehten Kachel. Folge dem grünen Weg.",
    "Oben nach rechts, rechts hinunter, in der Mitte zurück nach links, dann unten zum Ausgang.",
  ],
  balance: [
    "Beginne mit den gleichen mittleren Kammern. Links ist eins weniger, rechts das Doppelte von links.",
    "Von links nach rechts: 2, 3, 3, 4.",
  ],
  lock: [
    "Die fünf Werte stehen bereits direkt oberhalb der Zahlenräder.",
    "Der Code lautet 3 · 7 · 5 · 4 · 2.",
  ],
};

const chapters = [
  {
    kicker: "KANAL 01 / LIVE-SIGNAL",
    title: "Das ist keine Aufzeichnung.",
    copy: "„Wenn jemand diese Kapsel aktiviert: Wir leben.“",
    context:
      "Der erste Satz kommt ohne Datumsfehler und ohne Archivmarke. Jemand auf der Asteria spricht gerade jetzt.",
  },
  {
    kicker: "KANAL 02 / ZEITABGLEICH",
    title: "23 Jahre. Für sie elf Tage.",
    copy: "„Das Feld hält uns fest. Draußen rennt die Zeit weiter.“",
    context:
      "Die Crew ist nicht gealtert, während die Erde sie längst aufgegeben hat. Die Verbindung wird schwächer.",
  },
  {
    kicker: "KANAL 03 / ECHO BESTÄTIGT",
    title: "Sie haben dich gehört.",
    copy: "„Das Echo kam zurück. Da ist wirklich jemand.“",
    context:
      "Deine Formenfolge war ein Handshake. Zum ersten Mal seit elf Tagen weiß die Crew, dass die Kapsel gefunden wurde.",
  },
  {
    kicker: "KANAL 04 / SICHERE ROUTE",
    title: "Der direkte Weg wäre tödlich.",
    copy: "„Folgt dem geknickten Lichtweg. Fliegt niemals gerade auf uns zu.“",
    context:
      "Das Leitungsnetz bildet einen Umweg um das Zeitfeld. Noch fehlt der Kapsel genug Energie, um ihn zu senden.",
  },
  {
    kicker: "KANAL 05 / RESTENERGIE",
    title: "31 Stunden.",
    copy: "„Danach reicht unsere Energie nicht mehr für Lebenserhaltung und Sender.“",
    context:
      "Die letzte Sicherung ist mechanisch. Dahinter liegen Route und Sendekern. Öffne sie jetzt.",
  },
] as const;

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
  private readonly feedback = new FeedbackController(this.audio);
  private readonly install = new InstallController(
    requireElement<HTMLButtonElement>("[data-install]"),
    requireElement<HTMLDialogElement>("[data-install-dialog]"),
  );
  private readonly machine = requireElement<HTMLElement>("[data-machine]");
  private readonly effects = new MachineEffectsController(this.machine);
  private readonly scope: ScopeRenderer;
  private readonly status = requireElement<HTMLElement>("[data-status]");
  private readonly systemState = requireElement<HTMLElement>(
    "[data-system-state]",
  );
  private readonly storyDialog = requireElement<HTMLDialogElement>(
    "[data-story-dialog]",
  );
  private readonly hintDialog =
    requireElement<HTMLDialogElement>("[data-hint-dialog]");
  private readonly echoAnnouncement = requireElement<HTMLElement>(
    "[data-echo-announcement]",
  );
  private readonly finale: FinaleController;
  private readonly cleanup: Array<() => void> = [];
  private sequenceTimers: number[] = [];
  private resetTimer = 0;
  private isPlaying = false;

  public constructor() {
    this.scope = new ScopeRenderer(
      requireElement<HTMLCanvasElement>("[data-scope]"),
      this.state.signal,
    );
    this.finale = new FinaleController(
      requireElement<HTMLDialogElement>("[data-transmission]"),
      this.audio,
      this.feedback,
      () => this.reset(),
      () => this.focusCompletion(),
    );
    this.bindEvents();
    this.render();
    this.setStatus(stageCopy[currentStage(this.state)]);

    if (this.state.started) {
      window.setTimeout(() => {
        if (currentStage(this.state) === "complete") this.finale.open();
        else this.openPendingStory();
      }, 220);
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
    for (const selector of ["[data-install]", "[data-close-install]"]) {
      this.listen(requireElement(selector), "click", (event) =>
        this.feedback.tap(event.currentTarget as HTMLElement),
      );
    }

    this.listen(requireElement("[data-start]"), "click", (event) => {
      this.feedback.tap(event.currentTarget as HTMLElement);
      this.state = { ...this.state, started: true };
      this.persist();
      this.render();
      this.setStatus(stageCopy.power);
      window.requestAnimationFrame(() =>
        requireElement<HTMLElement>("#power-title").focus(),
      );
    });

    document
      .querySelectorAll<HTMLButtonElement>("[data-relay]")
      .forEach((button) => {
        this.listen(button, "click", () => {
          const index = Number(button.dataset.relay);
          const power = [...this.state.power];
          power[index] = !power[index];
          this.state = { ...this.state, power };
          this.feedback.relay(button, power[index] ?? false);
          this.persistAndRender();
          this.setStatus(
            `Relais ${index + 1} ${power[index] ? "eingeschaltet" : "ausgeschaltet"}.`,
          );
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
          this.setSignal(key, Number(input.value), input);
        });
      });
    document
      .querySelectorAll<HTMLButtonElement>("[data-signal-step]")
      .forEach((button) => {
        this.listen(button, "click", () => {
          const key = button.dataset.signalStep as keyof SignalSettings;
          const direction = Number(button.dataset.direction);
          this.setSignal(
            key,
            this.state.signal[key] + direction,
            requireElement<HTMLInputElement>(`[data-signal="${key}"]`),
          );
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
            this.enterSymbol(button.dataset.symbol as SymbolName, button);
        });
      });

    document
      .querySelectorAll<HTMLButtonElement>("[data-route]")
      .forEach((button) => {
        this.listen(button, "click", () =>
          this.turnRoute(Number(button.dataset.route), button),
        );
      });
    this.listen(requireElement("[data-check-route]"), "click", () =>
      this.checkRoute(),
    );

    document.querySelectorAll<HTMLElement>("[data-balance]").forEach((cell) => {
      const index = Number(cell.dataset.balance);
      this.listen(requireElement("[data-balance-up]", cell), "click", () =>
        this.turnBalance(index, 1, cell),
      );
      this.listen(requireElement("[data-balance-down]", cell), "click", () =>
        this.turnBalance(index, -1, cell),
      );
    });
    this.listen(requireElement("[data-check-balance]"), "click", () =>
      this.checkBalance(),
    );

    document.querySelectorAll<HTMLElement>("[data-wheel]").forEach((wheel) => {
      const index = Number(wheel.dataset.wheel);
      this.listen(requireElement("[data-wheel-up]", wheel), "click", () =>
        this.turnWheel(index, 1, wheel),
      );
      this.listen(requireElement("[data-wheel-down]", wheel), "click", () =>
        this.turnWheel(index, -1, wheel),
      );
    });
    this.listen(requireElement("[data-unseal]"), "click", () => this.unseal());

    this.listen(requireElement("[data-story-continue]"), "click", () =>
      this.continueStory(),
    );
    this.listen(this.storyDialog, "cancel", (event) => event.preventDefault());
    this.listen(requireElement("[data-transmission]"), "cancel", (event) =>
      event.preventDefault(),
    );

    this.listen(requireElement("[data-hint-button]"), "click", () =>
      this.openHint(),
    );
    this.listen(requireElement("[data-more-hint]"), "click", () =>
      this.revealMoreHint(),
    );
    this.listen(requireElement("[data-close-hint]"), "click", () => {
      this.feedback.tap();
      this.hintDialog.close();
      this.focusCurrentStage();
    });

    this.listen(requireElement("[data-audio]"), "click", () =>
      this.toggleAudio(),
    );
    this.listen(requireElement("[data-reset]"), "click", () =>
      this.armOrReset(),
    );
    this.listen(requireElement("[data-reopen-finale]"), "click", () => {
      this.feedback.tap();
      this.finale.open();
    });
    this.listen(window, "resize", () => this.scope.resize());
    this.listen(window, "beforeunload", () => this.destroy());
  }

  private checkPower(): void {
    if (!isPowerCorrect(this.state.power)) {
      this.reject(
        "Die Gravur und die vier Relais stimmen noch nicht überein.",
        requireElement("[data-check-power]"),
      );
      return;
    }
    this.completeStage("power");
  }

  private setSignal(
    key: keyof SignalSettings,
    requestedValue: number,
    input: HTMLInputElement,
  ): void {
    const value = Math.min(9, Math.max(0, requestedValue));
    if (value === this.state.signal[key]) return;
    this.state = {
      ...this.state,
      signal: { ...this.state.signal, [key]: value },
    };
    this.scope.update(this.state.signal);
    this.feedback.adjust(
      input.closest<HTMLElement>(".signal-adjuster") ?? input,
      value,
    );
    this.persistAndRender();
  }

  private checkSignal(): void {
    if (!isSignalCorrect(this.state.signal)) {
      const distance = signalDistance(this.state.signal);
      this.reject(
        `Noch nicht eingerastet. Insgesamt ${distance} Schritte vom Ziel entfernt.`,
        requireElement("[data-check-signal]"),
      );
      return;
    }
    this.completeStage("signal");
  }

  private playSequence(): void {
    if (this.isPlaying) return;
    this.feedback.tap(requireElement("[data-play-sequence]"));
    this.clearSequenceTimers();
    this.isPlaying = true;
    this.toggleSymbolButtons(true);
    this.setStatus("Hör genau hin: fünf Formen folgen.");

    MEMORY_SEQUENCE.forEach((symbol, index) => {
      const timer = window.setTimeout(() => {
        const echo = requireElement<HTMLElement>(`[data-echo="${symbol}"]`);
        echo.classList.add("is-active");
        this.echoAnnouncement.textContent = `Form ${index + 1}: ${symbolLabels[symbol]}`;
        this.feedback.memory(echo, symbol);
        const offTimer = window.setTimeout(
          () => echo.classList.remove("is-active"),
          440,
        );
        this.sequenceTimers.push(offTimer);
      }, index * 780);
      this.sequenceTimers.push(timer);
    });

    const finishTimer = window.setTimeout(
      () => {
        this.isPlaying = false;
        this.toggleSymbolButtons(false);
        this.echoAnnouncement.textContent =
          "Folge beendet. Wiederhole jetzt die fünf Formen.";
        this.setStatus("Jetzt bist du dran: Wiederhole die fünf Formen.");
      },
      MEMORY_SEQUENCE.length * 780 + 160,
    );
    this.sequenceTimers.push(finishTimer);
  }

  private enterSymbol(symbol: SymbolName, button: HTMLElement): void {
    const result = enterMemorySymbol(this.state, symbol);
    this.state = result.state;
    this.feedback.memory(button, symbol, result.matched);

    if (!result.matched) {
      this.setStatus(
        `${symbolLabels[symbol]} war nicht die nächste Form. Die Eingabe beginnt wieder bei eins.`,
        true,
      );
      this.effects.reject();
    } else if (result.complete) {
      this.state = { ...this.state, hints: 0 };
      this.completeStage("memory", false);
      return;
    } else {
      this.setStatus(
        `Richtig: ${this.state.memoryProgress} von 5 Formen bestätigt.`,
      );
    }
    this.persistAndRender();
  }

  private turnRoute(index: number, button: HTMLElement): void {
    const route = [...this.state.route];
    route[index] = ((route[index] ?? 0) + 1) % 4;
    this.state = { ...this.state, route };
    const powered = routePowerLength(route);
    this.feedback.route(button, index, index < powered);
    this.persistAndRender();
    this.setStatus(
      powered === 0
        ? "Der Strom erreicht die erste Kachel noch nicht."
        : `Stromweg: ${powered} von 9 Kacheln verbunden.`,
    );
  }

  private checkRoute(): void {
    if (!isRouteCorrect(this.state.route)) {
      const powered = routePowerLength(this.state.route);
      this.reject(
        `Die Leitung bricht nach ${powered} von 9 Kacheln ab. Folge dem grünen Strom.`,
        requireElement("[data-check-route]"),
      );
      return;
    }
    this.completeStage("route");
  }

  private turnBalance(
    index: number,
    direction: number,
    cell: HTMLElement,
  ): void {
    const balance = [...this.state.balance];
    balance[index] = ((balance[index] ?? 0) + direction + 5) % 5;
    this.state = { ...this.state, balance };
    this.feedback.balance(cell, balance[index] ?? 0);
    this.persistAndRender();
  }

  private checkBalance(): void {
    if (!isBalanceCorrect(this.state.balance)) {
      const total = this.state.balance.reduce((sum, value) => sum + value, 0);
      const distance = balanceDistance(this.state.balance);
      this.reject(
        total !== 12
          ? `Die Kammern enthalten zusammen ${total} statt 12 Einheiten.`
          : `Die Summe stimmt, aber ${distance} Verteilungsschritte fehlen noch.`,
        requireElement("[data-check-balance]"),
      );
      return;
    }
    this.completeStage("balance");
  }

  private turnWheel(
    index: number,
    direction: number,
    wheel: HTMLElement,
  ): void {
    const lock = [...this.state.lock];
    lock[index] = ((lock[index] ?? 0) + direction + 10) % 10;
    this.state = { ...this.state, lock };
    this.feedback.ratchet(wheel, lock[index] ?? 0);
    this.persistAndRender();
  }

  private unseal(): void {
    if (!isLockCorrect(this.state.lock)) {
      this.reject(
        "Mindestens eine Ziffer stimmt nicht mit den fünf Schlüsseln überein.",
        requireElement("[data-unseal]"),
      );
      return;
    }

    this.state = {
      ...this.state,
      solved: { ...this.state.solved, lock: true },
      storySeen: 6,
    };
    this.persistAndRender();
    this.effects.surge("lock");
    this.feedback.breach();
    this.setStatus("Alle sechs Sicherungen gelöst. Die Black Box öffnet sich.");
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    window.setTimeout(() => this.finale.open(), reducedMotion ? 0 : 720);
  }

  private completeStage(
    stage: Exclude<PuzzleStage, "lock">,
    playSound = true,
  ): void {
    this.state = {
      ...this.state,
      hints: 0,
      solved: { ...this.state.solved, [stage]: true },
    };
    this.persistAndRender();
    this.effects.surge(stage);
    if (playSound)
      this.feedback.success(
        requireElement<HTMLElement>(`[data-module="${stage}"]`),
        GAME_STAGES.indexOf(stage),
      );
    else this.feedback.success(undefined, GAME_STAGES.indexOf(stage));
    this.setStatus(`${stageNames[stage]} gelöst. Neue Nachricht empfangen.`);

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    window.setTimeout(() => this.openPendingStory(), reducedMotion ? 0 : 520);
  }

  private openPendingStory(): void {
    const solvedCount = completedCount(this.state);
    const index = this.state.storySeen;
    if (
      this.storyDialog.open ||
      index >= solvedCount ||
      index >= chapters.length ||
      currentStage(this.state) === "complete"
    ) {
      return;
    }

    const chapter = chapters[index];
    if (!chapter) return;
    requireElement<HTMLElement>("[data-chapter-kicker]").textContent =
      chapter.kicker;
    requireElement<HTMLElement>("[data-chapter-title]").textContent =
      chapter.title;
    requireElement<HTMLElement>("[data-chapter-copy]").textContent =
      chapter.copy;
    requireElement<HTMLElement>("[data-chapter-context]").textContent =
      chapter.context;
    requireElement<HTMLButtonElement>("[data-story-continue]").textContent =
      `Weiter zu Level ${Math.min(6, index + 2)}`;
    this.feedback.chapter(index);
    this.storyDialog.showModal();
    requireElement<HTMLElement>("[data-chapter-title]").focus();
  }

  private continueStory(): void {
    const completed = completedCount(this.state);
    this.feedback.tap(requireElement("[data-story-continue]"));
    this.state = { ...this.state, storySeen: completed };
    this.persist();
    this.storyDialog.close();
    this.render();
    const stage = currentStage(this.state);
    this.setStatus(stageCopy[stage]);
    this.focusCurrentStage();
  }

  private openHint(): void {
    this.feedback.tap(requireElement("[data-hint-button]"));
    const stage = currentStage(this.state);
    if (stage === "complete") return;
    if (this.state.hints === 0) {
      this.state = { ...this.state, hints: 1 };
      this.persist();
    }
    this.renderHint(stage);
    this.hintDialog.showModal();
  }

  private revealMoreHint(): void {
    const stage = currentStage(this.state);
    if (stage === "complete") return;
    this.feedback.tap(requireElement("[data-more-hint]"));
    this.state = { ...this.state, hints: 2 };
    this.persist();
    this.renderHint(stage);
  }

  private renderHint(stage: PuzzleStage): void {
    const level = Math.max(1, Math.min(2, this.state.hints));
    requireElement<HTMLElement>("[data-hint]").textContent =
      hints[stage][level - 1] ?? hints[stage][0];
    const more = requireElement<HTMLButtonElement>("[data-more-hint]");
    more.hidden = level >= 2;
  }

  private toggleAudio(): void {
    const enabled = this.audio.toggle();
    const button = requireElement<HTMLButtonElement>("[data-audio]");
    button.setAttribute("aria-pressed", String(enabled));
    requireElement<HTMLElement>("[data-audio-label]").textContent = enabled
      ? "Ton an"
      : "Ton aus";
    this.feedback.tap(button);
    this.feedback.pulse(button, enabled ? "success" : "tap");
  }

  private armOrReset(): void {
    const button = requireElement<HTMLButtonElement>("[data-reset]");
    this.feedback.tap(button);
    if (button.dataset.armed === "true") {
      window.clearTimeout(this.resetTimer);
      this.reset();
      return;
    }

    button.dataset.armed = "true";
    button.textContent = "Wirklich?";
    this.resetTimer = window.setTimeout(() => {
      delete button.dataset.armed;
      button.textContent = "Neustart";
    }, 4000);
  }

  private reset(): void {
    this.clearSequenceTimers();
    this.finale.reset();
    if (this.storyDialog.open) this.storyDialog.close();
    if (this.hintDialog.open) this.hintDialog.close();
    this.state = createInitialState();
    localStorage.removeItem(STORAGE_KEY);
    const button = requireElement<HTMLButtonElement>("[data-reset]");
    delete button.dataset.armed;
    button.textContent = "Neustart";
    this.scope.update(this.state.signal);
    this.render();
    this.setStatus(stageCopy.power);
    requireElement<HTMLButtonElement>("[data-start]").focus();
  }

  private render(): void {
    const stage = currentStage(this.state);
    const solvedCount = completedCount(this.state);
    document.documentElement.dataset.stage = stage;
    document.documentElement.classList.toggle(
      "has-started",
      this.state.started,
    );
    requireElement<HTMLElement>("[data-intro]").hidden = this.state.started;
    this.machine.hidden = !this.state.started;

    const stageIndex =
      stage === "complete"
        ? GAME_STAGES.length - 1
        : GAME_STAGES.indexOf(stage);
    requireElement<HTMLElement>("[data-stage-count]").textContent =
      stage === "complete"
        ? "06 / 06"
        : `${String(stageIndex + 1).padStart(2, "0")} / 06`;
    requireElement<HTMLElement>("[data-stage-name]").textContent =
      stageNames[stage];
    this.systemState.textContent =
      stage === "complete"
        ? "MISSION COMPLETE"
        : `LEVEL ${String(stageIndex + 1).padStart(2, "0")}/06`;
    requireElement<HTMLElement>("[data-progress-copy]").textContent =
      `${solvedCount} von 6 Sicherungen gelöst`;

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
        const value = this.state.signal[key];
        const input = requireElement<HTMLInputElement>(
          `[data-signal="${key}"]`,
        );
        input.value = String(value);
        input.style.setProperty("--range-value", `${(value / 9) * 100}%`);
        requireElement<HTMLOutputElement>(
          `[data-output="${key}"]`,
        ).textContent = String(value);
      },
    );

    const memoryMeter = requireElement<HTMLElement>(".memory-meter");
    memoryMeter.setAttribute(
      "aria-valuenow",
      String(this.state.memoryProgress),
    );
    memoryMeter
      .querySelectorAll<HTMLElement>("i")
      .forEach((indicator, index) =>
        indicator.classList.toggle(
          "is-filled",
          index < this.state.memoryProgress,
        ),
      );

    const powered = routePowerLength(this.state.route);
    document
      .querySelectorAll<HTMLButtonElement>("[data-route]")
      .forEach((button, index) => {
        const tile = ROUTE_TILES[index] ?? "straight";
        const orientation = this.state.route[index] ?? 0;
        const normalized =
          tile === "straight" ? orientation % 2 : orientation % 4;
        button.textContent = routeGlyphs[tile][normalized] ?? "━";
        button.classList.toggle("is-powered", index < powered);
        button.setAttribute(
          "aria-label",
          `Leitung ${index + 1} drehen, aktuell ${routeDescriptions[tile][normalized]}`,
        );
      });
    requireElement<HTMLElement>("[data-route-status]").textContent =
      powered === 9
        ? "Durchgehende Leitung hergestellt."
        : `Strom erreicht ${powered} von 9 Kacheln.`;

    document
      .querySelectorAll<HTMLElement>("[data-balance]")
      .forEach((cell, index) => {
        const value = this.state.balance[index] ?? 0;
        requireElement<HTMLOutputElement>("output", cell).textContent =
          String(value);
        requireElement<HTMLElement>("i span", cell).style.height =
          `${value * 25}%`;
      });
    requireElement<HTMLElement>("[data-balance-total]").textContent = String(
      this.state.balance.reduce((sum, value) => sum + value, 0),
    );

    document
      .querySelectorAll<HTMLElement>("[data-wheel]")
      .forEach((wheel, index) => {
        requireElement<HTMLOutputElement>("output", wheel).textContent = String(
          this.state.lock[index] ?? 0,
        );
      });

    GAME_STAGES.forEach((name) => {
      const module = requireElement<HTMLElement>(`[data-module="${name}"]`);
      const active = name === stage;
      module.hidden = !active;
      module.inert = !active;
      module.classList.toggle("is-solved", this.state.solved[name]);
      module.classList.toggle("is-locked", !active && !this.state.solved[name]);
      module.setAttribute("aria-disabled", String(!active));
      requireElement<HTMLElement>("[data-module-status]", module).textContent =
        this.state.solved[name] ? "GELÖST" : active ? "AKTIV" : "GESPERRT";

      const progress = requireElement<HTMLElement>(`[data-progress="${name}"]`);
      progress.classList.toggle("is-complete", this.state.solved[name]);
      progress.classList.toggle("is-current", active);
      if (active) progress.setAttribute("aria-current", "step");
      else progress.removeAttribute("aria-current");
    });

    const completePanel = requireElement<HTMLElement>("[data-complete-panel]");
    completePanel.hidden = stage !== "complete";
    this.effects.updateProgress(solvedCount);
  }

  private reject(message: string, element: HTMLElement): void {
    this.feedback.error(element);
    this.setStatus(message, true);
    this.effects.reject();
  }

  private setStatus(message: string, error = false): void {
    this.status.textContent = message;
    const display = this.status.closest<HTMLElement>(".machine__display");
    display?.classList.toggle("is-error", error);
    display?.classList.remove("is-updated");
    window.requestAnimationFrame(() => display?.classList.add("is-updated"));
  }

  private persistAndRender(): void {
    this.persist();
    this.render();
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // The mission remains playable when storage is unavailable.
    }
  }

  private focusCurrentStage(): void {
    const stage = currentStage(this.state);
    if (stage === "complete") {
      this.focusCompletion();
      return;
    }
    window.requestAnimationFrame(() =>
      requireElement<HTMLElement>(`#${stage}-title`).focus(),
    );
  }

  private focusCompletion(): void {
    window.requestAnimationFrame(() =>
      requireElement<HTMLElement>("[data-complete-panel] h3").focus(),
    );
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
    this.install.destroy();
    this.audio.destroy();
  }
}

new BlackBoxApp();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
    });
  });
}
