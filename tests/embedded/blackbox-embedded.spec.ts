import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("./");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("runs without PWA chrome or service worker from a nested path", async ({
  page,
}) => {
  await expect(page.locator("html")).toHaveAttribute(
    "data-runtime-context",
    "embedded",
  );
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(0);
  await expect(page.locator("[data-install]")).toHaveCount(0);
  await expect(page.locator(".wordmark")).toBeHidden();
  expect(await page.evaluate(() => location.pathname)).toContain(
    "/fixtures/deep/orbit/projects/blackbox/",
  );
  expect(
    await page.evaluate(async () =>
      "serviceWorker" in navigator
        ? Boolean(await navigator.serviceWorker.getRegistration())
        : false,
    ),
  ).toBe(false);
});

test("keeps the document fixed and controls reachable at iPhone heights", async ({
  page,
}) => {
  for (const viewport of [
    { width: 393, height: 852 },
    { width: 320, height: 568 },
    { width: 390, height: 500 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    const start = page.getByRole("button", { name: "Verbindung herstellen" });
    await expect(start).toBeVisible();
    await start.click();

    const dimensions = await page.evaluate(() => ({
      clientHeight: document.documentElement.clientHeight,
      scrollHeight: document.documentElement.scrollHeight,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyOverflow: getComputedStyle(document.body).overflow,
    }));
    expect(dimensions.scrollHeight).toBeLessThanOrEqual(
      dimensions.clientHeight + 1,
    );
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(
      dimensions.clientWidth + 1,
    );
    expect(dimensions.bodyOverflow).toBe("hidden");
    await expect(
      page.getByRole("button", { name: "Stromkreis schließen" }),
    ).toBeInViewport();
  }
});

test("sends only the versioned semantic haptic message to a host", async ({
  page,
}) => {
  await page.setContent(`
    <script>
      window.messages = [];
      window.addEventListener("message", (event) => window.messages.push(event.data));
    </script>
    <iframe title="Blackbox" src="./"></iframe>
  `);
  const frame = page.frameLocator('iframe[title="Blackbox"]');
  await frame.getByRole("button", { name: "Verbindung herstellen" }).click();
  await frame.getByRole("button", { name: /R1 AUS/ }).click();
  await frame.getByRole("button", { name: /R3 AUS/ }).click();
  await frame.getByRole("button", { name: /R4 AUS/ }).click();
  await frame.getByRole("button", { name: "Stromkreis schließen" }).click();

  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as { messages: unknown[] }).messages.at(-1),
      ),
    )
    .toEqual({
      channel: "ki-node.project-bridge",
      type: "haptic",
      protocolVersion: 1,
      project: "blackbox",
      event: "success",
    });
});
