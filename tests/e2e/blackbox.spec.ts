import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function solvePower(page: Page): Promise<void> {
  await page.getByRole("button", { name: /R1 AUS/ }).click();
  await page.getByRole("button", { name: /R3 AUS/ }).click();
  await page.getByRole("button", { name: /R4 AUS/ }).click();
  await page.getByRole("button", { name: "Stromkreis schließen" }).click();
}

async function solveSignal(page: Page): Promise<void> {
  await page.getByLabel(/Carrier/).fill("7");
  await page.getByLabel(/Gain/).fill("3");
  await page.getByLabel(/Phase/).fill("2");
  await page.getByRole("button", { name: "Signal koppeln" }).click();
}

async function solveMemory(page: Page): Promise<void> {
  for (const label of ["Dreieck", "Raute", "Kreis", "Dreieck", "Quadrat"]) {
    await page.getByRole("button", { name: label }).click();
  }
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

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading")).toHaveText("Die Box war nie leer.");
  await expect(dialog).toContainText("Das Signal kam aus dem Inneren");
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
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(
    dimensions.clientWidth + 1,
  );

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

  const relay = page.getByRole("button", { name: /R1 AUS/ });
  await relay.focus();
  await page.keyboard.press("Enter");
  await expect(relay).toHaveAttribute("aria-pressed", "true");
});
