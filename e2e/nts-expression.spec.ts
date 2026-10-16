import { test, expect, type Page } from "@playwright/test";
import { FOUNDATIONAL_SESSION_KEY } from "../src/ui/foundationalOpeningModel";

const read = (page: Page) => page.evaluate(() => window.__MSXAI_STORY_WORLD__!.inspect());
function spatial(s: Awaited<ReturnType<typeof read>>) { if (!("cameraPosition" in s) || !s.nts) throw Error("Expected NTS renderer"); return { ...s, nts: s.nts }; }
const expression = async (page: Page) => spatial(await read(page)).nts.expression;
const resources = async (page: Page) => { const s = spatial(await read(page)); return { meshes: s.nts.presenceMeshCount, triangles: s.nts.presenceTriangles, geometries: s.geometryCount, materials: s.materialCount, gpu: s.gpu }; };
async function settle(page: Page) { await expect.poll(async () => { const s = await read(page); return "renderLoopActive" in s && s.renderLoopActive; }, { timeout: 15000 }).toBe(false); }
async function loaded(page: Page) { await expect.poll(async () => { const s = await read(page); return "nts" in s && s.nts?.loaded; }, { timeout: 15000 }).toBe(true); await settle(page); }
async function enter(page: Page, path = "/") { await page.goto(path); await page.locator('[data-nutuensai-entry="home"]').click(); await loaded(page); }
test.beforeEach(async ({ page }) => { await page.addInitScript(key => sessionStorage.setItem(key, "seen"), FOUNDATIONAL_SESSION_KEY); });

test("production blink is automatic and sparse; legacy query exposes no review harness; idle rendering stops", async ({ page }) => {
  test.setTimeout(60000); await enter(page, "/?ntsH2=1");
  await expect(page.locator(".nts-h2-review, [data-h2]")).toHaveCount(0);
  expect(await page.evaluate(() => "reviewNtsExpression" in window.__MSXAI_STORY_WORLD__!)).toBe(false);
  await expect(page.getByRole("button", { name: /Play Blink|Auto Blink|Neutral|Eye Smile/ })).toHaveCount(0);
  const canonical = await resources(page); expect(canonical).toMatchObject({ meshes: 28, triangles: 108296 });
  expect(await expression(page)).toMatchObject({ timerPending: true, animating: false, neutralExact: true });
  const before = spatial(await read(page)).renderCount; await page.waitForTimeout(250);
  expect(spatial(await read(page)).renderCount).toBe(before);
  await expect.poll(async () => (await expression(page))?.kind, { timeout: 11000, intervals: [20] }).toBe("blink");
  // Queue exactly one user action without restarting the active, approved blink.
  const queued = await page.evaluate(() => { document.querySelector<HTMLButtonElement>('[data-nts="smile"]')!.click(); return window.__MSXAI_STORY_WORLD__!.inspect(); });
  expect(spatial(queued).nts.expression).toMatchObject({ kind: "blink", smileQueued: true });
  await expect.poll(async () => (await expression(page))?.kind, { intervals: [20] }).toBe("smile");
  await expect.poll(async () => (await expression(page))?.smile, { intervals: [30] }).toBeGreaterThan(.2);
  await expect.poll(async () => (await expression(page))?.neutralExact, { intervals: [30] }).toBe(true); await settle(page);
  expect(await expression(page)).toMatchObject({ timerPending: true, animating: false, blink: 0, smile: 0, smileQueued: false });
  expect(await resources(page)).toEqual(canonical);
  const idle = spatial(await read(page)).renderCount; await page.waitForTimeout(300);
  expect(spatial(await read(page)).renderCount).toBe(idle);
});

test("Gentle Smile uses live EN/TH, keyboard focus and one bounded cycle per activation", async ({ page }) => {
  test.setTimeout(60000); await enter(page);
  const smile = page.locator('[data-nts="smile"]'), counts = await resources(page);
  await expect(smile).toHaveAccessibleName("Gentle Smile");
  await page.locator('[data-nts="th"]').click(); await expect(smile).toHaveText("ยิ้มเบา ๆ"); await expect(smile).toHaveAccessibleName("ยิ้มเบา ๆ");
  await page.locator('[data-nts="en"]').click(); await expect(smile).toHaveText("Gentle Smile");
  for (let cycle = 0; cycle < 3; cycle++) {
    await smile.focus(); await smile.press(cycle % 2 ? "Space" : "Enter");
    await expect(smile).toHaveAttribute("aria-disabled", "true"); await expect(smile).toBeFocused();
    await expect.poll(async () => (await expression(page))?.smile, { intervals: [30] }).toBeGreaterThan(.2);
    await smile.evaluate(button => { for (let i = 0; i < 10; i++) (button as HTMLButtonElement).click(); });
    expect(await expression(page)).toMatchObject({ kind: "smile", smileQueued: false });
    await expect.poll(async () => (await expression(page))?.neutralExact, { intervals: [30] }).toBe(true); await settle(page);
    await expect(smile).toHaveAttribute("aria-disabled", "false"); await expect(smile).toBeFocused();
    expect(await resources(page)).toEqual(counts);
  }
  await page.setViewportSize({ width: 390, height: 844 }); await settle(page);
  await smile.focus(); await page.setViewportSize({ width: 844, height: 390 }); await settle(page);
  await expect(smile).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 }); await settle(page);
  await expect(smile).toBeFocused();
  await page.setViewportSize({ width: 844, height: 390 }); await settle(page);
  await page.locator('[data-nts-memory="s4"]').click(); await settle(page);
  const action = (await smile.boundingBox())!, narrative = (await page.locator('.nts-caption').boundingBox())!;
  const overlap = Math.max(0, Math.min(action.x + action.width, narrative.x + narrative.width) - Math.max(action.x, narrative.x))
    * Math.max(0, Math.min(action.y + action.height, narrative.y + narrative.height) - Math.max(action.y, narrative.y));
  expect(overlap, "the new action must not intrude into the short-landscape narrative").toBe(0);
});

test("Mark, visibility, introduction and reduced motion cancel expressions without changing camera or colors", async ({ page }) => {
  test.setTimeout(60000); await enter(page);
  await page.locator('[data-nts="inspect"]').click(); await page.getByRole("slider").fill("45"); await settle(page);
  await page.locator(".nts-appearance summary").click(); await page.locator('[data-nts-outfit="black"]').click(); await page.locator('[data-nts-mask="white"]').click(); await page.keyboard.press("Escape");
  const prior = spatial(await read(page));
  await page.locator('[data-nts="smile"]').click(); await expect.poll(async () => (await expression(page))?.smile, { intervals: [30] }).toBeGreaterThan(.2);
  await page.locator('[data-nts="inspect-mark"]').click(); await settle(page);
  expect(await expression(page)).toMatchObject({ enabled: false, timerPending: false, animating: false, neutralExact: true });
  await expect(page.locator('[data-nts="smile"]')).toBeHidden();
  await page.keyboard.press("Escape"); await settle(page);
  const restored = spatial(await read(page));
  expect(restored.cameraPosition).toEqual(prior.cameraPosition); expect(restored.cameraTarget).toEqual(prior.cameraTarget);
  expect(restored.ntsState).toMatchObject({ inspection: 45, outfit: "black", mask: "white" });
  await expect(page.locator('[data-nts="inspect-mark"]')).toBeFocused();
  await page.locator('[data-nts="smile"]').click(); await page.emulateMedia({ reducedMotion: "reduce" }); await settle(page);
  expect(await expression(page)).toMatchObject({ enabled: false, neutralExact: true, timerPending: false, animating: false });
  await expect(page.locator('[data-nts="smile"]')).toBeDisabled();
  await page.waitForTimeout(500); expect((await expression(page))?.neutralExact).toBe(true);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.locator('[data-nts="smile"]').click(); await page.locator('[data-nts="meet"]').click(); await settle(page);
  expect(await expression(page)).toMatchObject({ enabled: false, neutralExact: true, timerPending: false });
  await expect(page.locator('[data-nts="smile"]')).toBeHidden(); await page.keyboard.press("Escape");
  await page.locator('[data-nts="inspect"]').click(); await settle(page);
  await page.locator('[data-nts="smile"]').click();
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { value: true, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
  expect(await expression(page)).toMatchObject({ enabled: false, animating: false, neutralExact: true, timerPending: false });
  await page.evaluate(() => { Reflect.deleteProperty(document, "hidden"); document.dispatchEvent(new Event("visibilitychange")); });
  await settle(page); expect(await expression(page)).toMatchObject({ neutralExact: true, timerPending: true });
});

test("repeated visits own one scheduler, preserve resources and reset appearance defaults", async ({ page }) => {
  test.setTimeout(90000); await enter(page);
  const authoredArrival = await resources(page);
  await page.locator('[data-nts="return"]').click(); await expect.poll(async () => (await read(page)).ntsState.phase).toBe("closed");
  await page.locator('[data-ecosystem="visit-nts"]').click(); await loaded(page);
  const counts = await resources(page), returned: object[] = [];
  expect(counts).toMatchObject({ meshes: authoredArrival.meshes, triangles: authoredArrival.triangles, geometries: authoredArrival.geometries, materials: authoredArrival.materials });
  for (let i = 0; i < 3; i++) {
    expect(spatial(await read(page)).ntsState).toMatchObject({ outfit: "blue", mask: "lavender", markInspection: false });
    expect(await resources(page)).toEqual(counts);
    expect(await expression(page)).toMatchObject({ timerPending: true, neutralExact: true });
    await page.locator('[data-nts="inspect"]').click(); await page.getByRole("slider").fill("-90"); await settle(page);
    await page.locator(".nts-appearance summary").click(); await page.locator('[data-nts-outfit="black"]').click(); await page.locator('[data-nts-mask="white"]').click(); await page.keyboard.press("Escape");
    await page.locator('[data-nts="smile"]').click();
    await page.locator('[data-nts="return"]').click(); await expect.poll(async () => (await read(page)).ntsState.phase).toBe("closed");
    const r = await read(page); if (!("gpu" in r)) throw Error("Expected renderer");
    returned.push({ geometries: r.geometryCount, materials: r.materialCount, gpu: r.gpu });
    expect(r.nts).toBeUndefined(); expect(r.overviewState.selectedNodeId).toBe("nutuensai");
    await expect(page.locator('[data-ecosystem="visit-nts"]')).toBeFocused();
    if (i < 2) { await page.locator('[data-ecosystem="visit-nts"]').click(); await loaded(page); }
  }
  expect(returned[1]).toEqual(returned[0]); expect(returned[2]).toEqual(returned[0]);
  console.log("Production expression repeated resources", JSON.stringify({ authoredArrival, counts, returned }));
  await page.emulateMedia({ reducedMotion: "reduce" }); await page.locator('[data-ecosystem="visit-nts"]').click(); await loaded(page);
  expect(await expression(page)).toMatchObject({ enabled: false, timerPending: false, animating: false, neutralExact: true });
  await expect(page.locator('[data-nts="smile"]')).toBeDisabled();
});
