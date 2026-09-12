import { expect, test, type Page } from "@playwright/test";

const inspect = (page: Page) => page.evaluate(() => window.__MSXAI_STORY_WORLD__!.inspect());
const evidence = (name: string) => `artifacts/living-ecosystem-v0.1/${name}.png`;
async function settle(page: Page) {
  await expect.poll(async () => {
    const state = await inspect(page);
    return "renderLoopActive" in state && !state.renderLoopActive;
  }).toBe(true);
}
const node = (page: Page, id: string) => page.locator(`.ecosystem-labels [data-ecosystem-node="${id}"]`);

test("non-linear overview preserves story, camera, sound, locale, and canonical relationships", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = []; const external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("request", (request) => { if (!request.url().startsWith("http://127.0.0.1:")) external.push(request.url()); });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Begin the Story" }).click();
  await page.locator('[data-action="next"]').click(); await settle(page);
  const before = await inspect(page);
  await page.screenshot({ path: evidence("A-transition-start-desktop") });
  await page.locator('.story-controls [data-action="living-ecosystem"]').click();
  expect((await inspect(page)).overviewState).toEqual({ open: true, listOpen: false });
  // Midpoint capture is best-effort visual evidence, not a frame-accurate assertion.
  await page.waitForTimeout(550);
  await page.screenshot({ path: evidence("B-transition-luminous-desktop") });
  await settle(page);
  await page.screenshot({ path: evidence("C-overview-desktop") });
  const whole = await inspect(page);
  expect(whole.storyState).toEqual(before.storyState);
  expect(whole).toMatchObject({ transportObjectCount: 0, livingEcosystem: { phase: "open", fieldLight: 1 } });
  console.log("Living Ecosystem settled desktop statistics", JSON.stringify(whole));
  await expect(page.locator('.story-controls [data-action="next"]')).toBeHidden();
  for (const [id, name] of [["human", "D-human-selected-desktop"], ["intention", "E-intention-selected-desktop"], ["msxai", "F-msxai-selected-desktop"], ["mss", "G-system-selected-desktop"]]) {
    await node(page, id).click(); await settle(page);
    expect((await inspect(page)).overviewState.selectedNodeId).toBe(id);
    await expect(page.locator(".ecosystem-detail")).toBeVisible();
    await page.screenshot({ path: evidence(name) });
  }
  expect(await inspect(page)).toMatchObject({ livingEcosystem: { emphasizedRelationshipIds: ["msxai-concept-mss"] } });
  const selectedCamera = await inspect(page);
  await page.getByRole("button", { name: "ภาษาไทย" }).click();
  expect((await inspect(page)).overviewState.selectedNodeId).toBe("mss");
  if ("cameraPosition" in selectedCamera) expect(await inspect(page)).toMatchObject({ cameraPosition: selectedCamera.cameraPosition });
  await page.getByRole("button", { name: "English" }).click();
  await page.getByRole("button", { name: "Turn interaction sound on" }).click();
  await expect(page.locator('[data-action="sound"]')).toHaveAttribute("aria-pressed", "true");
  await node(page, "mss").click();
  expect((await inspect(page)).overviewState.selectedNodeId).toBeUndefined();
  await page.getByRole("button", { name: "Story List", exact: true }).click();
  await expect(page.locator(".ecosystem-list")).toBeVisible();
  await expect(page.locator(".ecosystem-list__nodes button")).toHaveCount(14);
  await page.locator('.ecosystem-list [data-ecosystem-node="principle-return-agency"]').click();
  expect((await inspect(page)).overviewState.selectedNodeId).toBe("principle-return-agency");
  await expect(node(page, "principle-return-agency")).toBeFocused();
  await page.keyboard.press("Escape");
  // Hit the existing semantic raycast target, not its DOM label; empty space clears.
  const humanLabel = (await node(page, "human").boundingBox())!;
  await page.mouse.click(humanLabel.x + humanLabel.width / 2, humanLabel.y - 12);
  expect((await inspect(page)).overviewState.selectedNodeId).toBe("human");
  await page.mouse.click(1000, 750);
  expect((await inspect(page)).overviewState.selectedNodeId).toBeUndefined();
  await page.getByRole("button", { name: "Return to Story World", exact: true }).click(); await settle(page);
  const restored = await inspect(page);
  expect(restored.storyState).toEqual(before.storyState);
  if ("cameraPosition" in restored && "cameraPosition" in before) {
    for (let i = 0; i < 3; i++) expect(restored.cameraPosition[i]).toBeCloseTo(before.cameraPosition[i], 6);
  }
  await expect(page.locator('[data-action="sound"]')).toHaveAttribute("aria-pressed", "true");
  // The same entry also preserves a non-default Free Explore selection.
  await page.locator('[data-action="explore"]').click();
  await page.evaluate(() => window.__MSXAI_STORY_WORLD__!.selectNode("mhb"));
  const free = (await inspect(page)).storyState;
  await page.locator('.story-controls [data-action="living-ecosystem"]').click(); await settle(page);
  await node(page, "lli").click(); await page.keyboard.press("Escape"); await page.keyboard.press("Escape");
  expect((await inspect(page)).storyState).toEqual(free);
  expect(errors).toEqual([]); expect(external).toEqual([]);
});

test("portrait EN/TH remains readable and reduced motion has no entrance flash", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.locator('.entry-card [data-action="living-ecosystem"]').click(); await settle(page);
  expect(await inspect(page)).toMatchObject({ livingEcosystem: { phase: "open", fieldLight: 1 }, overviewState: { open: true } });
  await page.screenshot({ path: evidence("H-overview-mobile") });
  const labels = await page.locator(".ecosystem-labels button:visible").all();
  const heading = (await page.locator(".ecosystem-heading").boundingBox())!;
  const boxes = await Promise.all(labels.map((label) => label.boundingBox()));
  for (const box of boxes) {
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    expect(box!.y).toBeGreaterThan(heading.y + heading.height);
    for (const other of boxes) {
      if (other === box) continue;
      const overlap = Math.min(box!.x + box!.width, other!.x + other!.width) - Math.max(box!.x, other!.x) > 1 &&
        Math.min(box!.y + box!.height, other!.y + other!.height) - Math.max(box!.y, other!.y) > 1;
      expect(overlap).toBe(false);
    }
  }
  await node(page, "human").click(); await settle(page);
  const detail = (await page.locator(".ecosystem-detail").boundingBox())!;
  expect(detail.height).toBeLessThanOrEqual(150);
  expect((await node(page, "human").boundingBox())!.y + (await node(page, "human").boundingBox())!.height).toBeLessThan(detail.y);
  await node(page, "intention").click(); await node(page, "mindhome").click(); await settle(page);
  await page.screenshot({ path: evidence("I-selected-mobile") });
  const beforeLocale = await inspect(page);
  console.log("Living Ecosystem settled portrait statistics", JSON.stringify(beforeLocale));
  await page.getByRole("button", { name: "ภาษาไทย" }).click(); await settle(page);
  await page.screenshot({ path: evidence("J-thai-mobile") });
  expect((await inspect(page)).overviewState).toEqual(beforeLocale.overviewState);
  expect((await inspect(page)).storyState).toEqual(beforeLocale.storyState);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.getByRole("button", { name: "เกี่ยวกับ / ความหมาย" }).click();
  await expect(page.locator(".about-dialog")).toContainText("ไม่ใช่สถาปัตยกรรมการทำงาน");
  await page.keyboard.press("Escape"); await page.keyboard.press("Escape"); await page.keyboard.press("Escape");
  await expect(page.getByTestId("entry-card")).toBeVisible();
  await page.evaluate(() => window.__MSXAI_STORY_WORLD__!.destroy());
  await expect(page.locator("canvas.story-canvas")).toHaveCount(0);
});

test("keyboard entry, orientation changes, and repeated returns remain reversible", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const entry = page.locator('.entry-card [data-action="living-ecosystem"]');
  await entry.focus(); await page.keyboard.press("Enter"); await settle(page);
  await node(page, "mss").focus(); await page.keyboard.press("Enter");
  await page.setViewportSize({ width: 390, height: 844 }); await settle(page);
  expect((await inspect(page)).overviewState.selectedNodeId).toBe("mss");
  await page.keyboard.press("Escape"); await page.keyboard.press("Escape");
  await expect(entry).toBeFocused();
  await entry.press("Enter"); await settle(page);
  const first = await inspect(page);
  await page.keyboard.press("Escape"); await entry.press("Enter"); await settle(page);
  const repeated = await inspect(page);
  if ("geometryCount" in first && "geometryCount" in repeated) expect(repeated.geometryCount).toBe(first.geometryCount);
  expect(repeated).toMatchObject({ livingEcosystem: { phase: "open" }, overviewState: { open: true } });
});

test("without WebGL the same overview has all concepts and canonical detail without story traversal", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type.includes("webgl")) return null;
      return original.apply(this, [type, ...args] as Parameters<typeof original>);
    } as typeof original;
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator('.story-list [data-action="living-ecosystem"]').click();
  await expect(page.locator(".ecosystem-list__nodes button")).toHaveCount(14);
  await page.locator('.ecosystem-list [data-ecosystem-node="mss"]').click();
  await expect(page.locator(".ecosystem-detail")).toContainText("Human–AI Workspace");
  await page.getByRole("button", { name: "ภาษาไทย" }).click();
  await expect(page.locator(".ecosystem-detail")).toContainText("พื้นที่ทำงานร่วม");
  await page.getByRole("button", { name: "กลับสู่โลกเรื่องเล่า", exact: true }).click();
  await expect(page.locator(".story-list")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
});
