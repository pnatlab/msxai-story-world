import { test, expect, type Page } from "@playwright/test";
import { FOUNDATIONAL_SESSION_KEY } from "../src/ui/foundationalOpeningModel";

const snapshot = (page: Page) => page.evaluate(() => window.__MSXAI_STORY_WORLD__!.inspect());
type Snapshot = Awaited<ReturnType<typeof snapshot>>;
function spatial(r: Snapshot) {
  if (!("cameraPosition" in r) || !r.nts) throw Error("Expected loaded NTS renderer inspection");
  return { ...r, nts: r.nts };
}
async function settled(page: Page) {
  await expect.poll(async () => (await snapshot(page)).ntsState.phase, { timeout: 15000 }).toBe("settled");
  await expect.poll(async () => { const r = await snapshot(page); return "nts" in r && r.nts?.loaded; }).toBe(true);
  await expect.poll(async () => { const r = await snapshot(page); return "renderLoopActive" in r && r.renderLoopActive; }, { timeout: 15000 }).toBe(false);
}
async function enter(page: Page) {
  await page.locator('[data-nutuensai-entry="home"]').click(); await settled(page);
}
async function colors(page: Page, outfit: "blue" | "white" | "black", mask: "lavender" | "white") {
  const appearance = page.locator(".nts-appearance");
  if (await appearance.getAttribute("open") === null) await appearance.locator("summary").click();
  await page.locator(`[data-nts-outfit="${outfit}"]`).click();
  await page.locator(`[data-nts-mask="${mask}"]`).click();
  await page.keyboard.press("Escape");
}
const mark = (page: Page) => page.locator('[data-nts="inspect-mark"]');
const back = (page: Page) => page.locator('[data-nts="mark-back"]');
const resources = (r: Snapshot) => {
  const s = spatial(r);
  return { meshes: s.nts.presenceMeshCount, triangles: s.nts.presenceTriangles, geometries: s.geometryCount, materials: s.materialCount, gpu: s.gpu, memoryTextures: s.nts.textureCount };
};
const pose = (r: Snapshot) => { const s = spatial(r); return { position: s.cameraPosition, target: s.cameraTarget }; };

test.beforeEach(async ({ page }) => {
  await page.addInitScript(key => sessionStorage.setItem(key, "seen"), FOUNDATIONAL_SESSION_KEY);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto("/");
});

test("mouse signature replaces textual mark; repeated authored close-ups preserve exact yaw, colors and resources", async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = [], external: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("request", r => { if (!r.url().startsWith("http://127.0.0.1:")) external.push(r.url()); });
  await enter(page);
  expect(spatial(await snapshot(page)).nts.signature).toMatchObject({ name: "NTS_Mask_MouseSignature", textualMarkPresent: false });
  await expect(mark(page)).toBeHidden();
  await page.locator('[data-nts-memory="s4"]').click();
  await page.locator('[data-nts="inspect"]').click(); await settled(page);
  const initialResources = resources(await snapshot(page));
  for (let repeat = 0; repeat < 2; repeat++) for (const yaw of [45, -90, 90]) {
    await page.getByRole("slider").fill(String(yaw)); await settled(page);
    await colors(page, repeat ? "white" : "black", repeat ? "lavender" : "white");
    const before = await snapshot(page);
    await expect(mark(page)).toHaveText("Inspect 🐭 Mark");
    await expect(mark(page)).toBeEnabled(); await mark(page).click(); await settled(page);
    const during = spatial(await snapshot(page));
    expect(during.ntsState).toEqual({ ...before.ntsState, markInspection: true });
    expect(during.nts.markReturnExact).toBe(true);
    expect(pose(during)).not.toEqual(pose(before));
    expect(during.nts.presentationColors).toEqual(spatial(before).nts.presentationColors);
    await expect(page.locator(".nts-appearance")).toBeHidden();
    await expect(back(page)).toBeFocused();
    await expect(page.locator("canvas")).toHaveCount(1);
    await back(page).click(); await settled(page);
    const after = await snapshot(page);
    expect(after.ntsState).toEqual(before.ntsState);
    expect(pose(after)).toEqual(pose(before));
    expect(after.storyState).toEqual(before.storyState); expect(after.overviewState).toEqual(before.overviewState);
    expect(resources(after)).toEqual(initialResources);
    expect(spatial(after).nts.markReturnExact).toBeUndefined();
    await expect(mark(page)).toBeFocused();
  }
  console.log("D.5 repeated mark-inspection resources", JSON.stringify(resources(await snapshot(page))));
  expect(errors).toEqual([]); expect(external).toEqual([]);
});

test("localized keyboard inspection consumes one Escape layer and fresh re-entry keeps D.4 defaults", async ({ page }) => {
  test.setTimeout(60000); await enter(page);
  expect((await snapshot(page)).ntsState).toMatchObject({ outfit: "blue", mask: "lavender", markInspection: false });
  await page.locator('[data-nts="inspect"]').click(); await settled(page);
  await colors(page, "black", "white");
  await mark(page).focus(); await mark(page).press("Enter"); await settled(page);
  await expect(back(page)).toHaveText("Back to Presence"); await expect(back(page)).toBeFocused();
  await page.keyboard.press("Escape"); await settled(page);
  expect((await snapshot(page)).ntsState).toMatchObject({ markInspection: false, inspection: "front", outfit: "black", mask: "white", phase: "settled" });
  await expect(mark(page)).toBeFocused();
  await page.locator('[data-nts="meet"]').click();
  await expect(mark(page)).toBeHidden();
  await page.keyboard.press("Escape"); await settled(page);
  await expect(mark(page)).toBeVisible();
  await page.locator('[data-nts="th"]').click(); await expect(mark(page)).toHaveText("ดูสัญลักษณ์ 🐭");
  await mark(page).focus(); await mark(page).press("Space"); await settled(page);
  await expect(back(page)).toHaveText("กลับสู่ Presence"); await expect(back(page)).toBeFocused();
  await back(page).press("Enter"); await settled(page); await expect(mark(page)).toBeFocused();
  await page.locator('[data-nts="return"]').click();
  await expect.poll(async () => (await snapshot(page)).ntsState.phase).toBe("closed");
  await expect(page.locator('[data-ecosystem="visit-nts"]')).toBeFocused();
  expect((await snapshot(page)).overviewState.selectedNodeId).toBe("nutuensai");
  await page.locator('[data-ecosystem="visit-nts"]').click(); await settled(page);
  expect((await snapshot(page)).ntsState).toMatchObject({ outfit: "blue", mask: "lavender", markInspection: false, inspection: false });
  expect(await page.locator("html").getAttribute("lang")).toBe("th");
  await expect(back(page)).toBeHidden(); await expect(mark(page)).toBeHidden();
});

test("portrait and short-landscape close-ups keep mark in-frame and restore semantic yaw after resize", async ({ page }) => {
  test.setTimeout(60000); await enter(page);
  await page.locator('[data-nts="inspect"]').click(); await page.getByRole("slider").fill("45"); await settled(page);
  await colors(page, "white", "white");
  for (const viewport of [{ width: 390, height: 844 }, { width: 640, height: 480 }]) {
    await mark(page).click(); await settled(page);
    await page.setViewportSize(viewport);
    await expect.poll(async () => spatial(await snapshot(page)).nts.markReturnExact).toBe(false);
    await settled(page);
    const during = spatial(await snapshot(page));
    expect(during.ntsState).toMatchObject({ markInspection: true, inspection: 45, outfit: "white", mask: "white" });
    expect(during.nts.markReturnExact).toBe(false);
    const box = during.nts.composition.mark;
    expect(box?.visible).toBe(true); expect(box!.width).toBeGreaterThan(0); expect(box!.height).toBeGreaterThan(0);
    expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    const exit = (await back(page).boundingBox())!;
    expect(exit.height).toBeGreaterThanOrEqual(44); expect(exit.x).toBeGreaterThanOrEqual(0);
    expect(exit.x + exit.width).toBeLessThanOrEqual(viewport.width);
    expect(exit.y + exit.height).toBeLessThanOrEqual(viewport.height);
    await back(page).click(); await settled(page);
    const after = spatial(await snapshot(page));
    expect(after.ntsState).toMatchObject({ markInspection: false, inspection: 45, outfit: "white", mask: "white" });
    // Existing authored inspection radius/yaw is retained, not the old viewport's pixel framing.
    expect(after.cameraPosition[0] - after.cameraTarget[0]).toBeCloseTo(Math.sin(Math.PI / 4) * 8, 6);
    expect(after.cameraPosition[2] - after.cameraTarget[2]).toBeCloseTo(Math.cos(Math.PI / 4) * 8, 6);
    await expect(mark(page)).toBeFocused();
  }
});

test("normal-motion close-up can be exited during camera travel without losing prior Presence state", async ({ page }) => {
  test.setTimeout(60000); await page.emulateMedia({ reducedMotion: "no-preference" }); await enter(page);
  await page.locator('[data-nts="inspect"]').click(); await settled(page);
  await page.getByRole("slider").fill("45"); await settled(page);
  const before = await snapshot(page);
  await mark(page).click();
  expect((await snapshot(page)).ntsState.markInspection).toBe(true);
  expect(spatial(await snapshot(page)).renderLoopActive).toBe(true);
  await page.keyboard.press("Escape"); await settled(page);
  expect((await snapshot(page)).ntsState).toEqual(before.ntsState);
  const returned = pose(await snapshot(page)), prior = pose(before);
  for (const key of ["position", "target"] as const) for (let i = 0; i < 3; i++) expect(returned[key][i]).toBeCloseTo(prior[key][i], 9);
  await expect(mark(page)).toBeFocused();
  // If the prior orbit is still travelling, return to its requested semantic yaw, not a half pose.
  // Dispatch both existing UI handlers in one task: actionability waits between
  // separate commands can otherwise let the requested orbit finish first.
  const travelling = await page.getByRole("slider").evaluate(slider => {
    (slider as HTMLInputElement).value = "90";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector<HTMLButtonElement>('[data-nts="inspect-mark"]')!.click();
    return window.__MSXAI_STORY_WORLD__!.inspect();
  });
  expect(spatial(travelling).nts.markReturnExact).toBe(false);
  await page.keyboard.press("Escape"); await settled(page);
  const completed = spatial(await snapshot(page));
  expect(completed.ntsState).toMatchObject({ inspection: 90, markInspection: false });
  expect(completed.cameraPosition[0] - completed.cameraTarget[0]).toBeCloseTo(8, 6);
  expect(completed.cameraPosition[2] - completed.cameraTarget[2]).toBeCloseTo(0, 6);
});

test("DOM fallback and missing Presence do not expose a non-functional mark camera", async ({ page }) => {
  test.setTimeout(60000);
  await page.goto("/?forceNoWebgl=1"); await page.locator('[data-nutuensai-entry="fallback"]').click();
  await expect(page.locator('.nts-view[data-phase="settled"]')).toBeVisible();
  await expect(mark(page)).toBeHidden(); await expect(back(page)).toBeHidden();
  await page.locator('[data-nts-memory="s2"]').click(); await expect(page.locator(".nts-caption")).toContainText("Room for Lightness");
  await page.locator('[data-nts="return"]').click();
  await expect(page.locator('[data-ecosystem="visit-nts"]')).toBeFocused();
  await page.route("**/nts/presence-study.bin", route => route.abort());
  await page.goto("/"); await page.locator('[data-nutuensai-entry="home"]').click();
  await expect(page.locator(".nts-status")).toContainText("Presence unavailable");
  await page.locator('[data-nts="inspect"]').click();
  await expect(mark(page)).toBeHidden(); await expect(back(page)).toBeHidden();
  expect((await snapshot(page)).ntsState.markInspection).toBe(false);
  await page.locator('[data-nts="return"]').click();
  await expect(page.locator('[data-ecosystem="visit-nts"]')).toBeFocused();
});
