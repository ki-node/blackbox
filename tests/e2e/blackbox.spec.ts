import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function solvePower(page: Page): Promise<void> {
  await page.getByRole("button", { name: /R1 AUS/ }).click();
  await page.getByRole("button", { name: /R3 AUS/ }).click();
  await page.getByRole("button", { name: /R4 AUS/ }).click();
  await page.getByRole("button", { name: "Stromkreis schließen" }).click();
}

async function solveSignal(page: Page): Promise<void> {
  await page.locator('[data-signal="carrier"]').fill("7");
  await page.locator('[data-signal="gain"]').fill("3");
  await page.locator('[data-signal="phase"]').fill("2");
  await page.getByRole("button", { name: "Signal koppeln" }).click();
}

async function solveMemory(page: Page): Promise<void> {
  for (const label of ["Dreieck", "Raute", "Kreis", "Dreieck", "Quadrat"]) {
    await page.getByRole("button", { name: label, exact: true }).click();
  }
}

async function solveLock(page: Page): Promise<void> {
  for (let index = 0; index < 3; index += 1) {
    await page.getByRole("button", { name: "Erste Ziffer erhöhen" }).click();
  }
  for (let index = 0; index < 7; index += 1) {
    await page.getByRole("button", { name: "Zweite Ziffer erhöhen" }).click();
  }
  for (let index = 0; index < 5; index += 1) {
    await page.getByRole("button", { name: "Dritte Ziffer erhöhen" }).click();
  }
  await page.getByRole("button", { name: "Black Box öffnen" }).click();
}

async function reachFinale(page: Page): Promise<void> {
  await solvePower(page);
  await solveSignal(page);
  await solveMemory(page);
  await solveLock(page);
}

test.beforeEach(async ({ page }) => {
  await page.goto("./");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Was ist in der Box?",
  );
});

test("restores all systems and reveals the final transmission", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await solvePower(page);
  await expect(page.locator('[data-module="signal"]')).toHaveAttribute(
    "aria-disabled",
    "false",
  );

  await solveSignal(page);
  await expect(page.locator('[data-module="memory"]')).toHaveAttribute(
    "aria-disabled",
    "false",
  );

  await solveMemory(page);
  await expect(page.locator('[data-module="lock"]')).toHaveAttribute(
    "aria-disabled",
    "false",
  );

  await solveLock(page);

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading")).toHaveText("Archivbruch erkannt.");
  await dialog
    .getByRole("button", { name: "Übertragung rekonstruieren" })
    .click();
  await expect(dialog.getByRole("heading", { level: 2 })).toHaveText(
    "Das ist keine Black Box.",
  );
  await expect(dialog).toContainText(
    "Die vier Systeme sind keine Reparaturpfade",
  );
  await expect(
    dialog.getByRole("heading", { name: "Das war keine Reparatur." }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Kontakt herstellen" }).click();
  await expect(page.locator("[data-anomaly-canvas]")).toHaveAttribute(
    "data-rendering",
    "true",
  );
  await expect(dialog.getByRole("heading")).toHaveText("Kontakt hergestellt.");
  await expect(dialog).toContainText("ORIGIN: THIS DEVICE");
  await dialog
    .getByRole("button", { name: "Zur veränderten Maschine" })
    .click();
  await expect(
    page.locator('[data-module="memory"] [data-module-status]'),
  ).toHaveText("EXPOSED");
  await expect(page.locator("[data-system-state]")).toHaveText(
    "CONTAINMENT LOST",
  );
});

test("offers a distinct shutdown ending and keeps the finale accessible", async ({
  page,
  browserName,
}) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await reachFinale(page);

  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Übertragung rekonstruieren" })
    .click();
  await dialog.getByRole("button", { name: "Notabschaltung" }).click();
  await expect(dialog.getByRole("heading")).toHaveText(
    "Notabschaltung fehlgeschlagen.",
  );
  await expect(dialog).toContainText("CONTAINMENT: EMPTY");
  await expect(page.locator("[data-anomaly-canvas]")).toHaveAttribute(
    "data-rendering",
    "true",
  );

  if (browserName !== "webkit") {
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  }
});

test("rejects incorrect settings and provides progressive optional hints", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Stromkreis schließen" }).click();
  await expect(page.locator("[data-status]")).toContainText("Relaisfehler");

  await page.getByRole("button", { name: "Hinweis entschlüsseln" }).click();
  await expect(page.locator("[data-hint]")).toContainText("Gefüllte Kreise");
  await page.getByRole("button", { name: "Deutlicherer Hinweis" }).click();
  await expect(page.locator("[data-hint]")).toContainText("R1, R3 und R4");
});

test("persists progress locally across reloads", async ({ page }) => {
  await solvePower(page);
  await page.reload();

  await expect(page.locator('[data-module="power"]')).toHaveClass(/is-solved/);
  await expect(page.locator('[data-module="signal"]')).not.toHaveClass(
    /is-locked/,
  );
  await expect(page.getByRole("button", { name: /R1 EIN/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("routes recovery energy through the machine and reacts to touch", async ({
  page,
}) => {
  await solvePower(page);

  const machine = page.locator("[data-machine]");
  await expect(page.locator("html")).toHaveAttribute("data-stage", "signal");
  await expect(machine).toHaveCSS("--recovery-progress", "0.25");
  const restoredNode = page.locator('[data-bus-node="power"] i');
  await expect(restoredNode).toHaveCSS("background-color", "rgb(99, 255, 190)");

  await machine.dispatchEvent("pointerdown", {
    pointerType: "touch",
    clientX: 120,
    clientY: 240,
  });
  await expect(machine).toHaveCSS("--pointer-x", /%/);
  const pointerX = await machine.evaluate((element) =>
    element.style.getPropertyValue("--pointer-x"),
  );
  expect(pointerX).not.toBe("50%");
});

test("prevents double-tap zoom on rapid controls without disabling page zoom", async ({
  page,
}) => {
  await solvePower(page);
  await solveSignal(page);
  await solveMemory(page);

  for (const control of [
    page.getByRole("button", { name: "Erste Ziffer erhöhen" }),
    page.getByRole("button", { name: "Erste Ziffer verringern" }),
    page.getByRole("button", { name: "Black Box öffnen" }),
  ]) {
    await expect(control).toHaveCSS("touch-action", "manipulation");
  }

  const viewport = await page
    .locator('meta[name="viewport"]')
    .getAttribute("content");
  expect(viewport).not.toContain("user-scalable=no");
  expect(viewport).not.toContain("maximum-scale=1");
});

test("resets only after explicit confirmation", async ({ page }) => {
  await solvePower(page);
  const reset = page.getByRole("button", { name: "Zurücksetzen" });
  await reset.click();
  await expect(
    page.getByRole("button", { name: "Wirklich zurücksetzen?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Wirklich zurücksetzen?" }).click();

  await expect(page.locator('[data-module="power"]')).not.toHaveClass(
    /is-solved/,
  );
  await expect(page.locator('[data-module="signal"]')).toHaveClass(/is-locked/);
});

test("reflows at 320 CSS pixels without horizontal clipping", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.reload();

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    offenders: [...document.querySelectorAll<HTMLElement>("body *")]
      .map((element) => ({
        selector: `${element.tagName.toLowerCase()}.${element.className}`,
        left: Math.round(element.getBoundingClientRect().left),
        right: Math.round(element.getBoundingClientRect().right),
      }))
      .filter(
        ({ left, right }) =>
          left < -1 || right > document.documentElement.clientWidth + 1,
      )
      .slice(0, 10),
  }));
  expect(
    dimensions.scrollWidth,
    JSON.stringify(dimensions.offenders),
  ).toBeLessThanOrEqual(dimensions.clientWidth + 1);

  for (const control of [
    page.getByRole("button", { name: /R1 AUS/ }),
    page.getByRole("button", { name: "Stromkreis schließen" }),
    page.getByRole("button", { name: "Hinweis entschlüsseln" }),
  ]) {
    await control.scrollIntoViewIfNeeded();
    const bounds = await control.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds?.x).toBeGreaterThanOrEqual(0);
    expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(321);
  }
});

test("has no automatically detectable WCAG A/AA violations", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName === "webkit",
    "axe-core is validated in mobile and desktop Chromium.",
  );
  await solvePower(page);
  await solveSignal(page);
  await solveMemory(page);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("honours reduced motion and supports keyboard activation", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName === "webkit",
    "Media emulation is validated in Chromium.",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();

  const animationDuration = await page
    .locator(".state-lamp")
    .evaluate((element) => {
      return getComputedStyle(element).animationDuration;
    });
  expect(Number.parseFloat(animationDuration)).toBeLessThanOrEqual(0.001);

  const relay = page.locator('[data-relay="0"]');
  await relay.focus();
  await page.keyboard.press("Enter");
  await expect(relay).toHaveAttribute("aria-pressed", "true");

  const machine = page.locator("[data-machine]");
  await machine.dispatchEvent("pointermove", {
    pointerType: "mouse",
    clientX: 40,
    clientY: 180,
  });
  await expect(machine).toHaveCSS("--machine-rx", "0deg");
  await expect(machine).toHaveCSS("--machine-ry", "0deg");
});
