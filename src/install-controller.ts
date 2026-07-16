interface InstallChoice {
  outcome: "accepted" | "dismissed";
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<InstallChoice>;
}

interface StandaloneNavigator extends Navigator {
  standalone?: boolean;
}

export class InstallController {
  private readonly cleanup: Array<() => void> = [];
  private deferredPrompt: BeforeInstallPromptEvent | undefined;

  public constructor(
    private readonly button: HTMLButtonElement,
    private readonly dialog: HTMLDialogElement,
  ) {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as StandaloneNavigator).standalone);
    document.documentElement.dataset.displayMode = standalone
      ? "standalone"
      : "browser";
    this.button.hidden = standalone;

    this.listen(this.button, "click", () => void this.install());
    this.listen(
      this.dialog.querySelector<HTMLButtonElement>("[data-close-install]") ??
        this.dialog,
      "click",
      () => this.dialog.close(),
    );
    this.listen(window, "beforeinstallprompt", (event) => {
      event.preventDefault();
      this.deferredPrompt = event as BeforeInstallPromptEvent;
      this.button.hidden = false;
    });
    this.listen(window, "appinstalled", () => {
      this.deferredPrompt = undefined;
      this.button.hidden = true;
      document.documentElement.dataset.displayMode = "standalone";
    });
  }

  public destroy(): void {
    this.cleanup.forEach((remove) => remove());
    if (this.dialog.open) this.dialog.close();
  }

  private async install(): Promise<void> {
    if (!this.deferredPrompt) {
      if (!this.dialog.open) this.dialog.showModal();
      return;
    }

    try {
      await this.deferredPrompt.prompt();
      const choice = await this.deferredPrompt.userChoice;
      if (choice.outcome === "accepted") this.button.hidden = true;
    } catch {
      // Installation remains optional when the browser rejects the prompt.
    } finally {
      this.deferredPrompt = undefined;
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
}
