import type { SymbolName } from "./game-engine";

interface OscillatorCue {
  duration: number;
  endFrequency?: number;
  frequency: number;
  start?: number;
  type?: OscillatorType;
  volume: number;
}

interface NoiseCue {
  duration: number;
  endFrequency: number;
  frequency: number;
  start?: number;
  type?: BiquadFilterType;
  volume: number;
}

export class AudioController {
  private context: AudioContext | undefined;
  private enabled = true;
  private unlocked = false;
  private readonly sources = new Set<AudioScheduledSourceNode>();

  public get isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Unlocks audio after a trusted pointer or keyboard interaction.
   */
  public unlock(): void {
    this.unlocked = true;
  }

  public toggle(): boolean {
    this.enabled = !this.enabled;
    if (this.enabled) this.relay(true);
    return this.enabled;
  }

  public press(): void {
    const context = this.activeContext();
    if (!context) return;
    this.noise(context, context.currentTime, {
      duration: 0.022,
      frequency: 2_800,
      endFrequency: 720,
      type: "bandpass",
      volume: 0.018,
    });
  }

  public adjust(position: number): void {
    const context = this.activeContext();
    if (!context) return;
    const frequency = 220 + position * 38;
    this.oscillator(context, context.currentTime, {
      duration: 0.07,
      frequency,
      endFrequency: frequency * 1.04,
      type: "sine",
      volume: 0.018,
    });
  }

  public route(position: number, powered: boolean): void {
    const context = this.activeContext();
    if (!context) return;
    const now = context.currentTime;
    this.noise(context, now, {
      duration: 0.04,
      frequency: 1_900 + position * 80,
      endFrequency: 520,
      type: "bandpass",
      volume: 0.03,
    });
    this.oscillator(context, now, {
      start: 0.025,
      duration: 0.12,
      frequency: powered ? 392 + position * 16 : 196,
      endFrequency: powered ? 523 + position * 16 : 174,
      type: powered ? "sine" : "triangle",
      volume: 0.022,
    });
  }

  public balance(position: number): void {
    const context = this.activeContext();
    if (!context) return;
    const frequency = 164 + position * 54;
    this.oscillator(context, context.currentTime, {
      duration: 0.11,
      frequency,
      endFrequency: frequency,
      type: "triangle",
      volume: 0.024,
    });
  }

  public chapter(index: number): void {
    const context = this.activeContext();
    if (!context) return;
    const now = context.currentTime;
    [330, 440, 554].forEach((frequency, note) => {
      this.oscillator(context, now, {
        start: note * 0.13,
        duration: 0.32,
        frequency: frequency + index * 9,
        endFrequency: frequency + index * 9,
        type: "sine",
        volume: 0.02,
      });
    });
  }

  public relay(active: boolean): void {
    const context = this.activeContext();
    if (!context) return;
    const now = context.currentTime;
    this.noise(context, now, {
      duration: 0.035,
      frequency: 3_200,
      endFrequency: 780,
      type: "bandpass",
      volume: 0.04,
    });
    this.oscillator(context, now, {
      start: 0.018,
      duration: 0.14,
      frequency: 392,
      endFrequency: active ? 587 : 247,
      type: "triangle",
      volume: 0.032,
    });
    if (active) {
      this.oscillator(context, now, {
        start: 0.075,
        duration: 0.14,
        frequency: 587,
        endFrequency: 784,
        type: "sine",
        volume: 0.024,
      });
    }
  }

  public ratchet(position: number): void {
    const context = this.activeContext();
    if (!context) return;
    const now = context.currentTime;
    this.noise(context, now, {
      duration: 0.028,
      frequency: 2_100 + position * 90,
      endFrequency: 680,
      type: "bandpass",
      volume: 0.04,
    });
    this.oscillator(context, now, {
      duration: 0.045,
      frequency: 52 + position * 1.4,
      endFrequency: 34,
      type: "triangle",
      volume: 0.028,
    });
  }

  public error(): void {
    const context = this.activeContext();
    if (!context) return;
    const now = context.currentTime;
    this.oscillator(context, now, {
      duration: 0.16,
      frequency: 233,
      endFrequency: 185,
      type: "square",
      volume: 0.022,
    });
    this.oscillator(context, now, {
      start: 0.17,
      duration: 0.24,
      frequency: 147,
      endFrequency: 98,
      type: "sawtooth",
      volume: 0.025,
    });
  }

  public success(level = 0): void {
    const context = this.activeContext();
    if (!context) return;
    const now = context.currentTime;
    const offset = level * 12;
    [392, 523, 659].forEach((frequency, index) => {
      this.oscillator(context, now, {
        start: index * 0.105,
        duration: 0.24,
        frequency: frequency + offset,
        endFrequency: frequency + offset,
        type: index === 2 ? "sine" : "triangle",
        volume: 0.027,
      });
    });
  }

  public memory(symbol: SymbolName, matched = true): void {
    if (!matched) {
      this.error();
      return;
    }
    const context = this.activeContext();
    if (!context) return;
    const now = context.currentTime;

    if (symbol === "triangle") {
      this.oscillator(context, now, {
        duration: 0.2,
        frequency: 880,
        endFrequency: 1_046,
        type: "triangle",
        volume: 0.032,
      });
      return;
    }
    if (symbol === "diamond") {
      this.oscillator(context, now, {
        duration: 0.14,
        frequency: 622,
        type: "sine",
        volume: 0.032,
      });
      this.oscillator(context, now, {
        start: 0.11,
        duration: 0.18,
        frequency: 932,
        type: "sine",
        volume: 0.028,
      });
      return;
    }
    if (symbol === "circle") {
      this.oscillator(context, now, {
        duration: 0.38,
        frequency: 294,
        type: "sine",
        volume: 0.038,
      });
      this.oscillator(context, now, {
        duration: 0.32,
        frequency: 147,
        type: "sine",
        volume: 0.015,
      });
      return;
    }

    this.noise(context, now, {
      duration: 0.055,
      frequency: 2_600,
      endFrequency: 420,
      type: "bandpass",
      volume: 0.04,
    });
    this.oscillator(context, now, {
      duration: 0.11,
      frequency: 440,
      endFrequency: 392,
      type: "square",
      volume: 0.023,
    });
  }

  public dataPulse(index: number): void {
    const context = this.activeContext();
    if (!context) return;
    const now = context.currentTime;
    this.noise(context, now, {
      duration: 0.11,
      frequency: 1_100 + index * 370,
      endFrequency: 240,
      type: "bandpass",
      volume: 0.035,
    });
    this.oscillator(context, now, {
      duration: 0.16,
      frequency: 52 + index * 8,
      endFrequency: 32,
      type: "square",
      volume: 0.016,
    });
  }

  public breach(): void {
    const context = this.activeContext();
    if (!context) return;
    const now = context.currentTime;
    this.noise(context, now, {
      duration: 1.45,
      frequency: 110,
      endFrequency: 2_800,
      type: "bandpass",
      volume: 0.05,
    });
    this.oscillator(context, now, {
      duration: 1.7,
      frequency: 84,
      endFrequency: 27,
      type: "sawtooth",
      volume: 0.045,
    });
    this.oscillator(context, now, {
      start: 0.18,
      duration: 1.25,
      frequency: 1_480,
      endFrequency: 184,
      type: "triangle",
      volume: 0.015,
    });
  }

  public transmission(): void {
    const context = this.activeContext();
    if (!context) return;
    const now = context.currentTime;
    this.noise(context, now, {
      duration: 3.4,
      frequency: 260,
      endFrequency: 1_800,
      type: "bandpass",
      volume: 0.024,
    });
    [43, 43.6].forEach((frequency, index) => {
      this.oscillator(context, now, {
        duration: 3.6,
        frequency,
        endFrequency: 58 + index * 2,
        type: index === 0 ? "sawtooth" : "triangle",
        volume: index === 0 ? 0.024 : 0.018,
      });
    });
  }

  public finalEvent(): void {
    const context = this.activeContext();
    if (!context) return;
    const now = context.currentTime;
    this.noise(context, now, {
      duration: 5.5,
      frequency: 90,
      endFrequency: 4_800,
      type: "bandpass",
      volume: 0.045,
    });
    const voices = [34, 51, 76];
    voices.forEach((frequency, index) => {
      this.oscillator(context, now, {
        start: index * 0.09,
        duration: 5.2 - index * 0.2,
        frequency,
        endFrequency: frequency * 2.2,
        type: index === 0 ? "sawtooth" : "triangle",
        volume: index === 0 ? 0.038 : 0.022,
      });
    });
  }

  public stopAll(): void {
    this.sources.forEach((source) => {
      try {
        source.stop();
      } catch {
        // A source that already ended needs no further cleanup.
      }
      source.disconnect();
    });
    this.sources.clear();
  }

  public destroy(): void {
    this.stopAll();
    if (this.context) void this.context.close().catch(() => undefined);
    this.context = undefined;
    this.unlocked = false;
  }

  private activeContext(): AudioContext | undefined {
    if (!this.enabled || !this.unlocked || !("AudioContext" in window)) {
      return undefined;
    }

    try {
      this.context ??= new AudioContext();
    } catch {
      return undefined;
    }
    if (this.context.state === "suspended") {
      void this.context.resume().catch(() => undefined);
    }
    return this.context;
  }

  private oscillator(
    context: AudioContext,
    now: number,
    cue: OscillatorCue,
  ): void {
    const start = now + (cue.start ?? 0);
    const end = start + cue.duration;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = cue.type ?? "sine";
    oscillator.frequency.setValueAtTime(cue.frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(
      cue.endFrequency ?? cue.frequency,
      end,
    );
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(cue.volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(gain).connect(context.destination);
    this.trackSource(oscillator);
    oscillator.start(start);
    oscillator.stop(end + 0.03);
  }

  private noise(context: AudioContext, now: number, cue: NoiseCue): void {
    const start = now + (cue.start ?? 0);
    const end = start + cue.duration;
    const frameCount = Math.max(
      1,
      Math.round(context.sampleRate * cue.duration),
    );
    const buffer = context.createBuffer(1, frameCount, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < frameCount; index += 1) {
      channel[index] = Math.random() * 2 - 1;
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    filter.type = cue.type ?? "bandpass";
    filter.Q.value = cue.type === "lowpass" ? 0.8 : 2.8;
    filter.frequency.setValueAtTime(cue.frequency, start);
    filter.frequency.exponentialRampToValueAtTime(cue.endFrequency, end);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(cue.volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    source.connect(filter).connect(gain).connect(context.destination);
    this.trackSource(source);
    source.start(start);
    source.stop(end + 0.02);
  }

  private trackSource(source: AudioScheduledSourceNode): void {
    this.sources.add(source);
    source.addEventListener(
      "ended",
      () => {
        this.sources.delete(source);
        source.disconnect();
      },
      { once: true },
    );
  }
}
