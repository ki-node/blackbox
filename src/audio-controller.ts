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

    this.context ??= new AudioContext();
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  public destroy(): void {
    if (this.context) void this.context.close();
    this.context = undefined;
  }
}
