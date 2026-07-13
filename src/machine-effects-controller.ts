import type { Stage } from "./game-engine";

const pulseDuration = 760;

export class MachineEffectsController {
  private readonly cleanup: Array<() => void> = [];
  private pulseTimer = 0;
  private impactTimer = 0;

  public constructor(private readonly machine: HTMLElement) {
    this.listen(machine, "pointermove", (event) => {
      this.trackPointer(event as PointerEvent);
    });
    this.listen(machine, "pointerdown", (event) => {
      const pointer = event as PointerEvent;
      this.setPointerPosition(pointer);
      machine.classList.remove("is-impact");
      window.requestAnimationFrame(() => machine.classList.add("is-impact"));
      window.clearTimeout(this.impactTimer);
      this.impactTimer = window.setTimeout(
        () => machine.classList.remove("is-impact"),
        420,
      );
    });
    this.listen(machine, "pointerleave", () => this.resetTilt());
  }

  public surge(stage: Exclude<Stage, "complete">): void {
    window.clearTimeout(this.pulseTimer);
    this.machine.dataset.surge = stage;
    this.machine.classList.remove("is-surging");
    window.requestAnimationFrame(() =>
      this.machine.classList.add("is-surging"),
    );
    this.pulseTimer = window.setTimeout(() => {
      this.machine.classList.remove("is-surging");
      delete this.machine.dataset.surge;
    }, pulseDuration);
  }

  public reject(): void {
    this.machine.classList.remove("is-rejecting");
    window.requestAnimationFrame(() =>
      this.machine.classList.add("is-rejecting"),
    );
    window.setTimeout(() => this.machine.classList.remove("is-rejecting"), 360);
  }

  public updateProgress(completed: number): void {
    this.machine.style.setProperty(
      "--recovery-progress",
      String(completed / 4),
    );
  }

  public destroy(): void {
    window.clearTimeout(this.pulseTimer);
    window.clearTimeout(this.impactTimer);
    this.cleanup.forEach((remove) => remove());
    this.machine.classList.remove("is-impact", "is-rejecting", "is-surging");
    this.resetTilt();
  }

  private trackPointer(event: PointerEvent): void {
    this.setPointerPosition(event);
    if (
      event.pointerType !== "mouse" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const bounds = this.machine.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    this.machine.style.setProperty("--machine-ry", `${x * 1.2}deg`);
    this.machine.style.setProperty("--machine-rx", `${y * -0.8}deg`);
  }

  private setPointerPosition(event: PointerEvent): void {
    const bounds = this.machine.getBoundingClientRect();
    const x = Math.min(
      100,
      Math.max(0, ((event.clientX - bounds.left) / bounds.width) * 100),
    );
    const y = Math.min(
      100,
      Math.max(0, ((event.clientY - bounds.top) / bounds.height) * 100),
    );
    this.machine.style.setProperty("--pointer-x", `${x}%`);
    this.machine.style.setProperty("--pointer-y", `${y}%`);
  }

  private resetTilt(): void {
    this.machine.style.setProperty("--machine-rx", "0deg");
    this.machine.style.setProperty("--machine-ry", "0deg");
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
