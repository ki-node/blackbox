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
  private enabled = false;

  public get isEnabled(): boolean {
    return this.enabled;
  }

  public toggle(): boolean {
    this.enabled = !this.enabled;
    if (this.enabled) this.relay(true);
    return this.enabled;
  }

  public relay(active: boolean): void {
    const context = this.activeContext();
    if (!context) return;
    const now = context.currentTime;
    this.noise(context, now, {
      duration: 0.045,
      frequency: active ? 2_800 : 1_900,
      endFrequency: 520,
      type: "bandpass",
      volume: 0.055,
    });
    this.oscillator(context, now, {
      duration: active ? 0.075 : 0.1,
      frequency: active ? 74 : 58,
      endFrequency: 34,
      type: "square",
      volume: 0.022,
    });
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
      duration: 0.34,
      frequency: 118,
      endFrequency: 43,
      type: "sawtooth",
      volume: 0.026,
    });
    this.noise(context, now, {
      start: 0.06,
      duration: 0.22,
      frequency: 760,
      endFrequency: 120,
      type: "lowpass",
      volume: 0.03,
    });
  }

  public success(level = 0): void {
    const context = this.activeContext();
    if (!context) return;
    const now = context.currentTime;
    this.noise(context, now, {
      duration: 0.38,
      frequency: 180,
      endFrequency: 3_400,
      type: "bandpass",
      volume: 0.035,
    });
    [64, 96, 145].forEach((frequency, index) => {
      this.oscillator(context, now, {
        start: index * 0.055,
        duration: 0.42,
        frequency: frequency + level * 7,
        endFrequency: frequency * 1.28 + level * 9,
        type: index === 0 ? "sawtooth" : "triangle",
        volume: index === 0 ? 0.024 : 0.014,
      });
    });
  }

  public memory(symbolIndex: number, matched = true): void {
    const context = this.activeContext();
    if (!context) return;
    if (!matched) {
      this.error();
      return;
    }
    const now = context.currentTime;
    const frequency = 210 + symbolIndex * 76;
    this.oscillator(context, now, {
      duration: 0.19,
      frequency,
      endFrequency: frequency * 0.985,
      type: "sine",
      volume: 0.034,
    });
    this.oscillator(context, now, {
      start: 0.015,
      duration: 0.13,
      frequency: frequency * 2.72,
      endFrequency: frequency * 2.2,
      type: "triangle",
      volume: 0.009,
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

  public destroy(): void {
    if (this.context) void this.context.close();
    this.context = undefined;
  }

  private activeContext(): AudioContext | undefined {
    if (!this.enabled) return undefined;
    this.context ??= new AudioContext();
    if (this.context.state === "suspended") void this.context.resume();
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
    source.start(start);
    source.stop(end + 0.02);
  }
}
