import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function startMission(page: Page): Promise<void> {
  const start = page.getByRole("button", { name: "Verbindung herstellen" });
  if (await start.isVisible()) await start.click();
}

async function continueStory(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog", {
    name: /KANAL|Das ist|Jahre|gehört|Weg|Stunden/i,
  });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /Weiter zu Level/ }).click();
  await expect(dialog).toBeHidden();
}

async function solvePower(page: Page, continueAfter = true): Promise<void> {
  await page.getByRole("button", { name: /R1 AUS/ }).click();
  await page.getByRole("button", { name: /R3 AUS/ }).click();
  await page.getByRole("button", { name: /R4 AUS/ }).click();
  await page.getByRole("button", { name: "Stromkreis schließen" }).click();
  if (continueAfter) await continueStory(page);
}

async function solveSignal(page: Page): Promise<void> {
  await page.locator('[data-signal="carrier"]').fill("7");
  await page.locator('[data-signal="gain"]').fill("3");
  await page.locator('[data-signal="phase"]').fill("2");
  await page.getByRole("button", { name: "Signal einrasten" }).click();
  await continueStory(page);
}

async function solveMemory(page: Page): Promise<void> {
  for (const label of ["Dreieck", "Raute", "Kreis", "Dreieck", "Quadrat"]) {
    await page.getByRole("button", { name: label, exact: true }).click();
  }
  await continueStory(page);
}

async function solveRoute(page: Page): Promise<void> {
  const turns = [3, 0, 1, 0, 3, 1, 1, 0, 3];
  for (const [index, count] of turns.entries()) {
    for (let turn = 0; turn < count; turn += 1) {
      await page.locator(`[data-route="${index}"]`).click();
    }
  }
  await expect(page.locator("[data-route-status]")).toHaveText(
    "Durchgehende Leitung hergestellt.",
  );
  await page.getByRole("button", { name: "Leitung prüfen" }).click();
  await continueStory(page);
}

async function adjustBalance(
  page: Page,
  cell: number,
  direction: "up" | "down",
  count: number,
): Promise<void> {
  const control = page
    .locator(`[data-balance="${cell}"]`)
    .locator(direction === "up" ? "[data-balance-up]" : "[data-balance-down]");
  for (let press = 0; press < count; press += 1) await control.click();
}

async function solveBalance(page: Page): Promise<void> {
  await adjustBalance(page, 0, "up", 2);
  await adjustBalance(page, 1, "up", 2);
  await adjustBalance(page, 2, "down", 1);
  await adjustBalance(page, 3, "down", 2);
  await expect(page.locator("[data-balance-total]")).toHaveText("12");
  await page.getByRole("button", { name: "Balance verriegeln" }).click();
  await continueStory(page);
}

async function turnWheel(
  page: Page,
  wheel: number,
  direction: "up" | "down",
  count: number,
): Promise<void> {
  const control = page
    .locator(`[data-wheel="${wheel}"]`)
    .locator(direction === "up" ? "[data-wheel-up]" : "[data-wheel-down]");
  for (let press = 0; press < count; press += 1) await control.click();
}

async function solveLock(page: Page): Promise<void> {
  await turnWheel(page, 0, "up", 3);
  await turnWheel(page, 1, "down", 3);
  await turnWheel(page, 2, "up", 5);
  await turnWheel(page, 3, "up", 4);
  await turnWheel(page, 4, "up", 2);
  await page.getByRole("button", { name: "Black Box öffnen" }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto("./");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "23 Jahre still. Jetzt ein Puls.",
  );
  await startMission(page);
});

test("opens the black box only after six distinct levels", async ({ page }) => {
  test.setTimeout(90_000);
  await solvePower(page);
  await expect(page.locator('[data-module="signal"]')).toBeVisible();

  await solveSignal(page);
  await expect(page.locator('[data-module="memory"]')).toBeVisible();

  await solveMemory(page);
  await expect(page.locator('[data-module="route"]')).toBeVisible();

  await solveRoute(page);
  await expect(page.locator('[data-module="balance"]')).toBeVisible();

  await solveBalance(page);
  await expect(page.locator('[data-module="lock"]')).toBeVisible();
  await expect(page.locator("[data-progress-copy]")).toHaveText(
    "5 von 6 Sicherungen gelöst",
  );

  await solveLock(page);
  const finale = page.getByRole("dialog", { name: "Geöffnete Black Box" });
  await expect(finale).toBeVisible();
  await expect(finale.getByRole("heading")).toHaveText("Die Black Box atmet.");
  await expect(page.locator("[data-system-state]")).toHaveText(
    "MISSION COMPLETE",
  );
});

test("lets the player control every story page and ends with a clear answer", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await solvePower(page, false);
  const chapter = page.getByRole("dialog");
  await expect(chapter.getByRole("heading")).toHaveText(
    "Das ist keine Aufzeichnung.",
  );
  await page.waitForTimeout(1_200);
  await expect(chapter.getByRole("heading")).toHaveText(
    "Das ist keine Aufzeichnung.",
  );
  await expect(chapter).toHaveAttribute("open", "");
  await chapter.getByRole("button", { name: "Weiter zu Level 2" }).click();

  await solveSignal(page);
  await solveMemory(page);
  await solveRoute(page);
  await solveBalance(page);
  await solveLock(page);

  const finale = page.getByRole("dialog", { name: "Geöffnete Black Box" });
  await finale.getByRole("button", { name: "Nachricht lesen" }).click();
  await expect(finale.getByRole("heading")).toContainText("23 Jahre");
  await page.waitForTimeout(800);
  await expect(finale.getByRole("heading")).toContainText("23 Jahre");

  await finale.getByRole("button", { name: "Letzten Teil lesen" }).click();
  await expect(finale.getByRole("heading")).toHaveText("Du warst die Antwort.");
  await finale.getByRole("button", { name: "Rettungsroute senden" }).click();
  const reply = finale.getByRole("button", {
    name: "Antwort der Asteria lesen",
  });
  await expect(reply).toBeEnabled({ timeout: 5_000 });
  await reply.click();
  await expect(finale.getByRole("heading")).toHaveText(
    "„Wir sehen eure Lichter.“",
  );
  await expect(finale).toContainText("Sechsunddreißig Menschen leben");
  await expect(finale).toContainText("DU BIST FERTIG");

  await finale.getByRole("button", { name: "Zur Übersicht" }).click();
  await expect(finale).toBeHidden();
  await expect(page.locator("[data-complete-panel]")).toBeVisible();
  await expect(page.locator(".game-actions")).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Finale erneut ansehen" }),
  ).toBeInViewport();
});

test("provides large slider targets, step buttons and immediate feedback", async ({
  page,
}) => {
  await solvePower(page);
  const input = page.locator('[data-signal="carrier"]');
  const bounds = await input.boundingBox();
  expect(bounds?.height).toBeGreaterThanOrEqual(30);

  const increase = page.getByRole("button", { name: "Frequenz erhöhen" });
  await increase.click();
  await expect(page.locator('[data-output="carrier"]')).toHaveText("5");
  await expect(page.locator(".signal-adjuster").first()).toHaveAttribute(
    "data-feedback",
    "adjust",
  );
  await expect(increase).toHaveCSS("touch-action", "manipulation");
});

test("shows visual, audio-ready and supported haptic feedback for controls", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: (pattern: number | number[]) => {
        (
          window as unknown as { vibrationPattern: number | number[] }
        ).vibrationPattern = pattern;
        return true;
      },
    });
  });
  await page.reload();
  await startMission(page);
  const relay = page.locator('[data-relay="0"]');
  await relay.click();
  await expect(relay).toHaveAttribute("data-feedback", "success");
  const pattern = await page.evaluate(
    () =>
      (window as unknown as { vibrationPattern?: number | number[] })
        .vibrationPattern,
  );
  expect(pattern).toBeTruthy();
  await expect(page.getByRole("button", { name: "Ton an" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("explains errors and offers two levels of optional hints", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Stromkreis schließen" }).click();
  await expect(page.locator("[data-status]")).toContainText(
    "stimmen noch nicht überein",
  );

  await page.getByRole("button", { name: "Hinweis" }).click();
  const hint = page.getByRole("dialog", { name: "Hinweis" });
  await expect(hint).toContainText("Gefüllte Kreise");
  await hint.getByRole("button", { name: "Deutlicher" }).click();
  await expect(hint).toContainText("R1, R3 und R4");
});

test("persists the current single-screen level locally", async ({ page }) => {
  await solvePower(page);
  await page.reload();
  await expect(page.locator('[data-module="signal"]')).toBeVisible();
  await expect(page.locator('[data-module="power"]')).toBeHidden();
  await expect(page.locator('[data-progress="power"]')).toHaveClass(
    /is-complete/,
  );
  await expect(page.locator("[data-stage-name]")).toHaveText("Signal");
});

test("uses an app-like single-screen layout without clipped progress labels", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 664 });
  await page.reload();
  await startMission(page);

  const metrics = await page.evaluate(() => ({
    clientHeight: document.documentElement.clientHeight,
    scrollHeight: document.documentElement.scrollHeight,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyOverflow: getComputedStyle(document.body).overflow,
    currentLabel: document.querySelector("[data-stage-name]")?.textContent,
    progressLabels: [
      ...document.querySelectorAll<HTMLElement>(".progress li strong"),
    ].map((label) => ({
      text: label.textContent,
      overflow: getComputedStyle(label).textOverflow,
    })),
  }));
  expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.clientHeight + 1);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.bodyOverflow).toBe("hidden");
  expect(metrics.currentLabel).toBe("Energie");
  expect(
    metrics.progressLabels.every(({ overflow }) => overflow !== "ellipsis"),
  ).toBe(true);

  await expect(page.locator('[data-module="power"]')).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "Stromkreis schließen" }),
  ).toBeInViewport();
});

test("reflows at 320 CSS pixels and keeps active controls reachable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.reload();
  await startMission(page);

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
    page.getByRole("button", { name: "Hinweis" }),
  ]) {
    await expect(control).toBeInViewport();
  }
});

test("prevents rapid-control zoom without disabling page zoom", async ({
  page,
}) => {
  for (const control of [
    page.getByRole("button", { name: /R1 AUS/ }),
    page.getByRole("button", { name: "Stromkreis schließen" }),
    page.getByRole("button", { name: "Hinweis" }),
  ]) {
    await expect(control).toHaveCSS("touch-action", "manipulation");
  }

  const viewport = await page
    .locator('meta[name="viewport"]')
    .getAttribute("content");
  expect(viewport).not.toContain("user-scalable=no");
  expect(viewport).not.toContain("maximum-scale=1");
});

test("provides an installable standalone app experience", async ({
  page,
  request,
}) => {
  const manifestResponse = await request.get("./manifest.webmanifest");
  expect(manifestResponse.ok()).toBe(true);
  const manifest = (await manifestResponse.json()) as {
    display: string;
    icons: Array<{ purpose: string }>;
    start_url: string;
  };
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("./");
  expect(manifest.icons[0]?.purpose).toContain("maskable");

  await expect(page.locator("html")).toHaveAttribute(
    "data-display-mode",
    "browser",
  );
  await expect(page.getByRole("button", { name: /App/ })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(async () =>
        Boolean(await navigator.serviceWorker.getRegistration()),
      ),
    )
    .toBe(true);

  await page.locator("[data-install-dialog]").evaluate((element) => {
    (element as HTMLDialogElement).showModal();
  });
  const dialog = page.getByRole("dialog", {
    name: "BLACK BOX als App nutzen",
  });
  await expect(dialog).toContainText("Zum Home-Bildschirm");
  await dialog.getByRole("button", { name: "Verstanden" }).click();
  await expect(dialog).toBeHidden();
});

test("resets only after explicit confirmation", async ({ page }) => {
  await solvePower(page);
  const reset = page.getByRole("button", { name: "Neustart" });
  await reset.click();
  await expect(page.getByRole("button", { name: "Wirklich?" })).toBeVisible();
  await page.getByRole("button", { name: "Wirklich?" }).click();
  await expect(
    page.getByRole("button", { name: "Verbindung herstellen" }),
  ).toBeVisible();
});

test("has no automatically detectable WCAG A/AA violations", async ({
  page,
  browserName,
}) => {
  if (browserName === "webkit") test.skip();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);

  await solvePower(page, false);
  const dialogResults = await new AxeBuilder({ page })
    .include("[data-story-dialog]")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(dialogResults.violations).toEqual([]);
});

test("honours reduced motion and keyboard activation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const relay = page.locator('[data-relay="0"]');
  await relay.focus();
  await page.keyboard.press("Enter");
  await expect(relay).toHaveAttribute("aria-pressed", "true");

  const animation = await page
    .locator(".atmosphere__beam")
    .evaluate((element) => getComputedStyle(element).animationName);
  expect(animation).toBe("none");
});
