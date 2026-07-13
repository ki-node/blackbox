type InputModality = "keyboard" | "pointer";

const modifierKeys = new Set(["Alt", "Control", "Meta", "Shift"]);

export class InputModalityController {
  private initialized = false;

  public constructor(
    private readonly root: HTMLElement = document.documentElement,
    private readonly target: Document = document,
  ) {}

  public init(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.setModality("pointer");
    this.target.addEventListener("pointerdown", this.handlePointer, true);
    this.target.addEventListener("keydown", this.handleKey, true);
  }

  public destroy(): void {
    if (!this.initialized) return;
    this.initialized = false;
    this.target.removeEventListener("pointerdown", this.handlePointer, true);
    this.target.removeEventListener("keydown", this.handleKey, true);
    delete this.root.dataset.inputModality;
  }

  private readonly handlePointer = (): void => {
    this.setModality("pointer");
  };

  private readonly handleKey = (event: KeyboardEvent): void => {
    if (modifierKeys.has(event.key)) return;
    this.setModality("keyboard");
  };

  private setModality(modality: InputModality): void {
    this.root.dataset.inputModality = modality;
  }
}
