export class AudioController {
  private context: AudioContext | undefined;
  private enabled = false;

  public get isEnabled(): boolean {
    return this.enabled;
  }

  public toggle(): boolean {
    this.enabled = !this.enabled;
    if (this.enabled) this.tone(180, 0.08, 0.025);
    return this.enabled;
  }

  public tone(frequency: number, duration = 0.12, volume = 0.04): void {
    if (!this.enabled) return;

    const context = this.getContext();
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const overtone = context.createOscillator();
    const gain = context.createGain();
    const overtoneGain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, now);
    overtone.type = "triangle";
    overtone.frequency.setValueAtTime(frequency * 2.005, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    overtoneGain.gain.setValueAtTime(0.0001, now);
    overtoneGain.gain.exponentialRampToValueAtTime(volume * 0.16, now + 0.015);
    overtoneGain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + duration * 0.82,
    );
    oscillator.connect(gain).connect(context.destination);
    overtone.connect(overtoneGain).connect(context.destination);
    oscillator.start(now);
    overtone.start(now);
    oscillator.stop(now + duration + 0.02);
    overtone.stop(now + duration + 0.02);
  }

  public impact(frequency = 72, duration = 0.32, volume = 0.05): void {
    if (!this.enabled) return;

    const context = this.getContext();
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const oscillatorGain = context.createGain();
    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(frequency * 1.8, now);
    oscillator.frequency.exponentialRampToValueAtTime(
      frequency,
      now + duration,
    );
    oscillatorGain.gain.setValueAtTime(volume, now);
    oscillatorGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(oscillatorGain).connect(context.destination);

    const frameCount = Math.max(1, Math.round(context.sampleRate * duration));
    const buffer = context.createBuffer(1, frameCount, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < frameCount; index += 1) {
      channel[index] = (Math.random() * 2 - 1) * (1 - index / frameCount);
    }
    const noise = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const noiseGain = context.createGain();
    noise.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(120, now + duration);
    noiseGain.gain.setValueAtTime(volume * 0.5, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    noise.connect(filter).connect(noiseGain).connect(context.destination);

    oscillator.start(now);
    noise.start(now);
    oscillator.stop(now + duration + 0.02);
    noise.stop(now + duration + 0.02);
  }

  public destroy(): void {
    if (this.context) void this.context.close();
    this.context = undefined;
  }

  private getContext(): AudioContext {
    this.context ??= new AudioContext();
    if (this.context.state === "suspended") void this.context.resume();
    return this.context;
  }
}
