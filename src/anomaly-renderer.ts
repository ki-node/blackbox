export type AnomalyMode = "contact" | "shutdown";

export class AnomalyRenderer {
  private readonly context: CanvasRenderingContext2D;
  private frame = 0;
  private startedAt = 0;
  private mode: AnomalyMode = "contact";
  private width = 0;
  private height = 0;
  private dpr = 1;

  public constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Anomaly canvas is unavailable");
    this.context = context;
  }

  public get isRendering(): boolean {
    return this.canvas.dataset.rendering === "true";
  }

  public start(mode: AnomalyMode): void {
    this.stop();
    this.mode = mode;
    this.resize();
    this.canvas.dataset.rendering = "true";

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.draw(4_000);
      return;
    }

    this.startedAt = performance.now();
    this.loop(this.startedAt);
  }

  public stop(): void {
    window.cancelAnimationFrame(this.frame);
    this.frame = 0;
    delete this.canvas.dataset.rendering;
    this.context.clearRect(0, 0, this.width, this.height);
  }

  public resize(): void {
    const bounds = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.max(1, Math.round(bounds.width));
    this.height = Math.max(1, Math.round(bounds.height));
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (
      this.isRendering &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      this.draw(4_000);
    }
  }

  public destroy(): void {
    this.stop();
  }

  private loop = (now: number): void => {
    this.draw(now - this.startedAt);
    this.frame = window.requestAnimationFrame(this.loop);
  };

  private draw(elapsed: number): void {
    const context = this.context;
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const shortSide = Math.min(this.width, this.height);
    const progress = Math.min(1, elapsed / 3_200);
    const pulse = (Math.sin(elapsed * 0.004) + 1) / 2;
    const accent = this.mode === "contact" ? "99, 255, 190" : "255, 107, 81";

    context.fillStyle = `rgba(2, 5, 4, ${progress < 0.35 ? 0.34 : 0.18})`;
    context.fillRect(0, 0, this.width, this.height);

    const glow = context.createRadialGradient(
      centerX,
      centerY,
      0,
      centerX,
      centerY,
      shortSide * 0.58,
    );
    glow.addColorStop(0, `rgba(${accent}, ${0.2 + pulse * 0.12})`);
    glow.addColorStop(0.2, "rgba(0, 0, 0, 0.96)");
    glow.addColorStop(0.45, `rgba(${accent}, 0.08)`);
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, this.width, this.height);

    context.save();
    context.translate(centerX, centerY);
    context.globalCompositeOperation = "screen";

    for (let ring = 0; ring < 7; ring += 1) {
      const baseRadius = shortSide * (0.08 + ring * 0.065);
      const expansion = progress * shortSide * (ring % 2 === 0 ? 0.055 : 0.025);
      const radius =
        baseRadius + expansion + Math.sin(elapsed * 0.0018 + ring) * 6;
      context.beginPath();
      const points = 96;
      for (let point = 0; point <= points; point += 1) {
        const angle = (point / points) * Math.PI * 2;
        const distortion =
          Math.sin(angle * (3 + (ring % 3)) + elapsed * 0.001 + ring) *
          (2 + ring * 0.7);
        const x = Math.cos(angle) * (radius + distortion);
        const y = Math.sin(angle) * (radius + distortion);
        if (point === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.strokeStyle = `rgba(${accent}, ${0.42 - ring * 0.045})`;
      context.lineWidth = ring === 0 ? 2.2 : 1;
      context.setLineDash(ring % 2 === 0 ? [] : [4 + ring, 9 + ring]);
      context.lineDashOffset = elapsed * (ring % 2 === 0 ? 0.012 : -0.008);
      context.stroke();
    }

    context.setLineDash([]);
    const rays = this.mode === "contact" ? 18 : 11;
    for (let ray = 0; ray < rays; ray += 1) {
      const angle = (ray / rays) * Math.PI * 2 + elapsed * 0.00008;
      const inner = shortSide * (0.11 + ((ray * 7) % 5) * 0.012);
      const outer = shortSide * (0.34 + ((ray * 13) % 7) * 0.025) * progress;
      context.beginPath();
      context.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      context.lineTo(
        Math.cos(angle + Math.sin(ray) * 0.04) * outer,
        Math.sin(angle + Math.sin(ray) * 0.04) * outer,
      );
      context.strokeStyle = `rgba(${accent}, ${0.08 + ((ray * 3) % 5) * 0.025})`;
      context.lineWidth = ray % 5 === 0 ? 2 : 1;
      context.stroke();
    }

    context.globalCompositeOperation = "source-over";
    context.beginPath();
    context.arc(0, 0, shortSide * (0.07 + pulse * 0.012), 0, Math.PI * 2);
    context.fillStyle = "#000";
    context.fill();
    context.strokeStyle = `rgba(${accent}, 0.9)`;
    context.lineWidth = 2;
    context.stroke();

    if (this.mode === "contact") {
      context.scale(1, 0.34 + pulse * 0.1);
      context.beginPath();
      context.arc(0, 0, shortSide * 0.045, 0, Math.PI * 2);
      context.fillStyle = `rgba(${accent}, 0.78)`;
      context.shadowColor = `rgb(${accent})`;
      context.shadowBlur = 30;
      context.fill();
      context.beginPath();
      context.arc(0, 0, shortSide * 0.017, 0, Math.PI * 2);
      context.fillStyle = "#000";
      context.shadowBlur = 0;
      context.fill();
    } else {
      context.strokeStyle = `rgba(${accent}, 0.9)`;
      context.lineWidth = 3;
      for (let fracture = 0; fracture < 8; fracture += 1) {
        const angle = (fracture / 8) * Math.PI * 2 + 0.2;
        context.beginPath();
        context.moveTo(
          Math.cos(angle) * shortSide * 0.06,
          Math.sin(angle) * shortSide * 0.06,
        );
        context.lineTo(
          Math.cos(angle + 0.08) *
            shortSide *
            (0.18 + fracture * 0.018) *
            progress,
          Math.sin(angle + 0.08) *
            shortSide *
            (0.18 + fracture * 0.018) *
            progress,
        );
        context.stroke();
      }
    }

    context.restore();
  }
}
