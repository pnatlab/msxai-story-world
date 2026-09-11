import { expect, test, type Page } from "@playwright/test";

async function inspection(page: Page) {
  return page.evaluate(() => window.__MSXAI_STORY_WORLD__!.inspect());
}

async function settle(page: Page) {
  await expect.poll(async () => {
    const state = await inspection(page);
    return "renderLoopActive" in state && !state.renderLoopActive;
  }).toBe(true);
}

const evidence = (name: string) => `artifacts/environmental-depth-v0.1/${name}.png`;

test("environmental depth preserves the story and supplies desktop/portrait review evidence", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  const externalRequests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("request", (request) => {
    if (!request.url().startsWith("http://127.0.0.1:")) externalRequests.push(request.url());
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByTestId("entry-card")).toBeVisible();
  await page.getByRole("button", { name: "Begin the Story" }).click();
  await settle(page);
  await page.screenshot({ path: evidence("A-human-desktop") });
  await page.locator('[data-action="next"]').click();
  await settle(page);
  expect(await inspection(page)).toMatchObject({ activeStoryBeat: "intention", intentionCoherence: 1, transportObjectCount: 0 });
  await page.screenshot({ path: evidence("B-intention-convergence-desktop") });
  await page.locator('[data-action="next"]').click();
  await settle(page);
  await page.screenshot({ path: evidence("C-msxai-constellation-desktop") });
  const wide = await inspection(page);
  console.log("Environmental Depth desktop MSxAI statistics", JSON.stringify(wide));
  expect(wide).toMatchObject({ semanticNodeCount: 14, semanticConnectionCount: 13, ambientNodeCount: 31, transportObjectCount: 0 });
  await page.locator('[data-action="next"]').click();
  await settle(page);
  await page.locator('[data-action="explore"]').click();
  await page.screenshot({ path: evidence("D-uranian-environment-desktop") });
  await page.locator('[data-action="next"]').click();
  await settle(page);
  // Inspect each authored beat; the overview evidence above uses Free Explore.
  for (let beat = 5; beat <= 10; beat += 1) {
    await page.locator('[data-action="next"]').click();
    await settle(page);
  }
  await page.locator('[data-action="next"]').click();
  await settle(page);
  await page.screenshot({ path: evidence("E-return-agency-desktop") });
  expect(await inspection(page)).toMatchObject({ activeStoryBeat: "return-agency", selectedNode: "human" });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-action="human"]').click();
  await settle(page);
  await page.locator('[data-action="next"]').click();
  await settle(page);
  await page.screenshot({ path: evidence("F-intention-mobile") });
  await page.locator('[data-action="next"]').click();
  await settle(page);
  await page.screenshot({ path: evidence("G-msxai-mobile") });
  for (let beat = 4; beat <= 11; beat += 1) {
    await page.locator('[data-action="next"]').click();
    await settle(page);
  }
  await page.getByRole("button", { name: "ภาษาไทย" }).click();
  await settle(page);
  await page.screenshot({ path: evidence("H-return-agency-mobile") });
  const label = page.locator('.node-label[data-node-id="human"]');
  await expect(label).toBeVisible();
  const labelBox = (await label.boundingBox())!;
  const copyBox = (await page.locator(".story-copy").boundingBox())!;
  const controlsBox = (await page.locator(".story-controls").boundingBox())!;
  expect(labelBox.x).toBeGreaterThan(0);
  expect(labelBox.x + labelBox.width).toBeLessThan(390);
  expect(labelBox.y).toBeGreaterThan(copyBox.y + copyBox.height);
  expect(labelBox.y + labelBox.height).toBeLessThan(controlsBox.y);
  const beforeLocale = await inspection(page);
  await page.getByRole("button", { name: "English" }).click();
  expect(await inspection(page)).toMatchObject({ activeStoryBeat: "return-agency", selectedNode: "human" });
  const afterLocale = await inspection(page);
  if ("cameraPosition" in beforeLocale && "cameraPosition" in afterLocale) expect(afterLocale.cameraPosition).toEqual(beforeLocale.cameraPosition);
  await page.getByRole("button", { name: "Story List", exact: true }).click();
  expect(await inspection(page)).toMatchObject({ renderLoopActive: false });
  await page.getByRole("button", { name: "Return to Story View" }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator('[data-action="human"]').click();
  await page.locator('[data-action="next"]').click();
  await settle(page);
  expect(await inspection(page)).toMatchObject({ activeStoryBeat: "intention", intentionCoherence: 1, transportObjectCount: 0 });
  expect(errors).toEqual([]);
  expect(externalRequests).toEqual([]);
});
