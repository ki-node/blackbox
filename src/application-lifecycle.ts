export interface ApplicationInstance {
  destroy(): void;
}

type ApplicationFactory<T extends ApplicationInstance> = () => T;

/**
 * Owns one application instance and makes initialization and cleanup idempotent.
 */
export class ApplicationLifecycle<T extends ApplicationInstance> {
  private instance: T | undefined;
  private listening = false;
  private waitingForPageShow = false;

  public constructor(
    private readonly factory: ApplicationFactory<T>,
    private readonly target: Window = window,
  ) {}

  public init(): T {
    this.bindLifecycle();
    this.instance ??= this.factory();
    return this.instance;
  }

  public destroy(): void {
    this.releaseInstance();
    this.unbindLifecycle();
    if (this.waitingForPageShow) {
      this.waitingForPageShow = false;
      this.target.removeEventListener("pageshow", this.handlePageShow);
    }
  }

  private readonly handlePageHide = (): void => {
    this.releaseInstance();
    this.unbindLifecycle();
    this.waitingForPageShow = true;
    this.target.addEventListener("pageshow", this.handlePageShow, {
      once: true,
    });
  };

  private readonly handlePageShow = (): void => {
    this.waitingForPageShow = false;
    this.init();
  };

  private bindLifecycle(): void {
    if (this.listening) return;
    this.listening = true;
    this.target.addEventListener("pagehide", this.handlePageHide);
  }

  private unbindLifecycle(): void {
    if (!this.listening) return;
    this.listening = false;
    this.target.removeEventListener("pagehide", this.handlePageHide);
  }

  private releaseInstance(): void {
    this.instance?.destroy();
    this.instance = undefined;
  }
}
