import type { SignalSettings } from "./game-engine";
import { SIGNAL_TARGET, signalDistance } from "./game-engine";

export class ScopeRenderer {
  private readonly context: CanvasRenderingContext2D;
  private signal: SignalSettings;
  private frame = 0;
  private animationFrame = 0;
  private readonly reducedMotion = matchMedia(
    "(prefers-reduced-motion: reduce)",
  );

  public constructor(
    private readonly canvas: HTMLCanvasElement,
    signal: SignalSettings,
  ) {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D is unavailable");
    this.context = context;
    this.signal = signal;
    this.resize();
    this.render();
    this.reducedMotion.addEventListener("change", this.handleMotionChange);
    if (!this.reducedMotion.matches) this.animate();
  }

  public update(signal: SignalSettings): void {
    this.signal = signal;
    this.canvas.setAttribute(
      "aria-label",
      `Oszilloskop. Abweichung vom Zielsignal: ${signalDistance(signal)}.`,
    );
    this.render();
  }

  public resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const ratio = Math.min(devicePixelRatio, 2);
    this.canvas.width = Math.max(1, Math.round(rect.width * ratio));
    this.canvas.height = Math.max(1, Math.round(rect.height * ratio));
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.render();
  }

  private animate = (): void => {
    this.frame += 0.018;
    this.render();
    this.animationFrame = requestAnimationFrame(this.animate);
  };

  private readonly handleMotionChange = (): void => {
    window.cancelAnimationFrame(this.animationFrame);
    this.animationFrame = 0;
    this.render();
    if (!this.reducedMotion.matches) this.animate();
  };

  private render(): void {
    const { width, height } = this.canvas.getBoundingClientRect();
    const context = this.context;
    context.clearRect(0, 0, width, height);

    // The game shell starts hidden. A zero-sized canvas must not enter the
    // grid loops below because their increment would also be zero.
    if (width <= 0 || height <= 0) return;

    context.fillStyle = "#07100f";
    context.fillRect(0, 0, width, height);

    context.strokeStyle = "rgba(99, 255, 190, 0.1)";
    context.lineWidth = 1;
    for (let x = 0; x <= width; x += width / 8) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }
    for (let y = 0; y <= height; y += height / 4) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }

    this.drawWave(
      SIGNAL_TARGET,
      width,
      height,
      "rgba(255, 177, 64, 0.72)",
      2,
      0,
    );
    this.drawWave(this.signal, width, height, "#63ffbe", 2.2, this.frame);
  }

  private drawWave(
    signal: SignalSettings,
    width: number,
    height: number,
    color: string,
    lineWidth: number,
    offset: number,
  ): void {
    const amplitude = height * (0.08 + signal.gain * 0.025);
    const cycles = 0.7 + signal.carrier * 0.23;
    const phase = signal.phase * 0.32 + offset;
    this.context.beginPath();
    for (let x = 0; x <= width; x += 2) {
      const progress = x / width;
      const y =
        height / 2 +
        Math.sin(progress * Math.PI * 2 * cycles + phase) * amplitude;
      if (x === 0) this.context.moveTo(x, y);
      else this.context.lineTo(x, y);
    }
    this.context.strokeStyle = color;
    this.context.lineWidth = lineWidth;
    this.context.stroke();
  }

  public destroy(): void {
    cancelAnimationFrame(this.animationFrame);
    this.animationFrame = 0;
    this.reducedMotion.removeEventListener("change", this.handleMotionChange);
  }
}
