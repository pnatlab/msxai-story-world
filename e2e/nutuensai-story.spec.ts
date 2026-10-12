import { test, expect, type Page } from "@playwright/test";
import { FOUNDATIONAL_SESSION_KEY } from "../src/ui/foundationalOpeningModel";
const inspect = (page: Page) => page.evaluate(() => window.__MSXAI_STORY_WORLD__!.inspect());
// Evidence stays outside the repository. Playwright accepts absolute output paths.
const shot = (name: string) => `/private/tmp/nts-slice-a-evidence/${name}.png`;
async function settle(page: Page) { await expect.poll(async () => { const s = await inspect(page); return !("renderLoopActive" in s) || !s.renderLoopActive; }).toBe(true); }
async function arrival(page: Page) { await expect.poll(async () => (await inspect(page)).journeyState.phase).toBe("arrived"); await expect.poll(async () => (await inspect(page)).ntsState.phase, {timeout:15000}).toBe("settled"); await settle(page); }
async function returnNts(page: Page) { if ((await inspect(page)).ntsState.phase !== "closed") { await page.locator('[data-nts="return"]').click(); await expect.poll(async () => (await inspect(page)).ntsState.phase).toBe("closed"); } }
test.beforeEach(async ({ page }) => { await page.addInitScript(key => sessionStorage.setItem(key, "seen"), FOUNDATIONAL_SESSION_KEY); });

test("Home one-click route shows the ecosystem bridge, consumes one request and retains manual selection semantics", async ({ page }) => {
  test.setTimeout(60000); const errors: string[] = [], external: string[] = [];
  page.on("pageerror", e => errors.push(e.message)); page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  page.on("request", r => { if (!r.url().startsWith("http://127.0.0.1:")) external.push(r.url()); });
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto("/"); await settle(page);
  const before = await inspect(page); const cta = page.locator('[data-nutuensai-entry="home"]');
  await expect(cta).toHaveText("NuTuenSai Story"); await expect(cta).toBeVisible();
  await page.screenshot({ path: shot("01-home") }); await cta.focus(); await cta.press("Enter");
  expect(await inspect(page)).toMatchObject({ overviewState: { open: true }, journeyState: { phase: "travelling", leg: "ecosystem", source: "home", visitRequests: 0 } });
  await expect(page.locator(".ecosystem-journey-status")).toBeVisible();
  await page.waitForTimeout(650); await page.screenshot({ path: shot("03-entering-ecosystem") });
  await expect.poll(async () => (await inspect(page)).journeyState.leg).toBe("nutuensai");
  await page.screenshot({ path: shot("04-approaching-node") });
  await arrival(page); const arrived = await inspect(page);
  expect(arrived.storyState).toEqual(before.storyState);
  expect(arrived).toMatchObject({ overviewState: { open: true, selectedNodeId: "nutuensai" }, journeyState: { phase: "arrived", visitRequests: 1 }, ntsVisitRequest: { source: "home", nodeId: "nutuensai", returnContext: { mode: "living-ecosystem", selectedNodeId: "nutuensai" } } });
  expect("livingEcosystem" in arrived && arrived.livingEcosystem.emphasizedRelationshipIds).toEqual(["msxai-concept-nutuensai"]);
  await expect(page.locator("#nts-title")).toHaveText("NTS · A place to listen"); await expect(page.locator("#nts-title")).toBeFocused();
  await expect(page.locator("canvas.story-canvas")).toHaveCount(1);
  await expect(page.locator(".nts-view")).toBeVisible(); await page.screenshot({ path: shot("05-selected-and-truthful-seam") });
  await page.waitForTimeout(500); expect((await inspect(page)).journeyState.visitRequests).toBe(1);
  await returnNts(page); await page.locator('[data-ecosystem="exit"]').click(); await settle(page); await expect(cta).toBeFocused();
  expect((await inspect(page)).storyState).toEqual(before.storyState);
  await page.locator('.entry-card [data-action="living-ecosystem"]').click(); await settle(page);
  await page.locator('.ecosystem-labels [data-ecosystem-node="nutuensai"]').click(); await settle(page);
  expect((await inspect(page)).journeyState.phase).toBe("idle"); expect((await inspect(page)).journeyState.visitRequests).toBe(1);
  await expect(page.locator(".nts-view")).toBeHidden();
  await page.locator('.ecosystem-labels [data-ecosystem-node="mss"]').click(); expect((await inspect(page)).overviewState.selectedNodeId).toBe("mss");
  expect(errors).toEqual([]); expect(external).toEqual([]);
});

test("Guided HUMAN uses the same one-click journey, preserves locale/sound/story and returns to the same CTA", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto("/");
  await page.locator('[data-action="begin"]').click(); await settle(page);
  const human = page.locator('[data-nutuensai-entry="human"]'); await expect(human).toBeVisible();
  await page.screenshot({ path: shot("02-guided-human") });
  await page.locator('[data-locale="th"]').click(); await page.locator('[data-action="sound"]').click();
  await expect(page.locator('[data-action="sound"]')).toHaveAttribute("aria-pressed", "true");
  const before = (await inspect(page)).storyState; await expect(human).toHaveText("เรื่องราว NuTuenSai"); await human.click(); await arrival(page);
  expect((await inspect(page)).storyState).toEqual(before); expect((await inspect(page)).ntsVisitRequest?.source).toBe("human");
  await expect(page.locator("html")).toHaveAttribute("lang", "th"); await expect(page.locator('[data-action="sound"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator('[data-nts="en"]').click(); expect((await inspect(page)).journeyState.visitRequests).toBe(1);
  await returnNts(page); await page.locator('[data-ecosystem="exit"]').click(); await settle(page); await expect(human).toBeFocused();
  await page.locator('[data-action="next"]').click(); await expect(human).toBeHidden();
  expect((await inspect(page)).storyState.beatIndex).toBe(2);
});

test("Escape stops each travel leg at a safe selected ecosystem; Back cancels with no later visit", async ({ page }) => {
  test.setTimeout(60000); await page.setViewportSize({ width: 1440, height: 900 });
  for (const leg of ["early", "focus", "recognition"] as const) {
    await page.goto("/"); await page.locator('[data-nutuensai-entry="home"]').click();
    if (leg === "early") await page.waitForTimeout(150);
    else if (leg === "focus") await expect.poll(async () => (await inspect(page)).journeyState.leg).toBe("nutuensai");
    else await expect.poll(async () => (await inspect(page)).journeyState.phase, { intervals: [25], timeout: 5000 }).toBe("recognition");
    await page.keyboard.press("Escape"); await settle(page); const state = await inspect(page);
    expect(state).toMatchObject({ overviewState: { open: true, selectedNodeId: "nutuensai" }, journeyState: { phase: "cancelled", visitRequests: 0 } });
    expect(state.ntsVisitRequest).toBeUndefined();
    if ("cameraTarget" in state) expect(state.cameraTarget[2]).toBeCloseTo(-14.36, 2);
    await page.waitForTimeout(500); expect((await inspect(page)).journeyState.phase).toBe("cancelled");
    await page.keyboard.press("Escape"); expect((await inspect(page)).overviewState.open).toBe(true); expect((await inspect(page)).overviewState.selectedNodeId).toBeUndefined();
  }
  await page.goto("/"); const before = (await inspect(page)).storyState;
  await page.locator('[data-nutuensai-entry="home"]').click(); await returnNts(page); await page.locator('[data-ecosystem="exit"]').click(); await settle(page);
  await page.waitForTimeout(700); expect((await inspect(page)).overviewState.open).toBe(false); expect((await inspect(page)).journeyState.visitRequests).toBe(0); expect((await inspect(page)).storyState).toEqual(before);
});

test("portrait and reduced motion keep the semantic route, CTA focus and orientation context", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ reducedMotion: "reduce" }); await page.goto("/");
  const cta = page.locator('[data-nutuensai-entry="home"]'); await expect(cta).toBeInViewport({ ratio: 1 });
  expect((await cta.boundingBox())!.height).toBeGreaterThanOrEqual(44); await page.screenshot({ path: shot("08-portrait-home") });
  await cta.click(); await arrival(page); await page.screenshot({ path: shot("07-reduced-motion-seam") });
  expect((await inspect(page)).journeyState.visitRequests).toBe(1);
  await expect(page.locator("#nts-title")).toBeInViewport({ ratio: .95 });
  await page.setViewportSize({ width: 844, height: 390 }); await settle(page); expect((await inspect(page)).overviewState.selectedNodeId).toBe("nutuensai");
  await returnNts(page); await page.locator('[data-ecosystem="exit"]').click(); await expect(cta).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 }); await page.locator('[data-action="begin"]').click(); await settle(page);
  await expect(page.locator('[data-nutuensai-entry="human"]')).toBeInViewport({ ratio: 1 }); await page.screenshot({ path: shot("09-portrait-human") });
  await page.emulateMedia({ reducedMotion: "no-preference" }); await page.locator('[data-nutuensai-entry="human"]').click();
  await page.setViewportSize({ width: 844, height: 390 }); await arrival(page); expect((await inspect(page)).journeyState.visitRequests).toBe(2);
});

test("WebGL fallback offers the same contextual entry and destination without a renderer", async ({ page }) => {
  await page.goto("/?forceNoWebgl=1"); const before = (await inspect(page)).storyState;
  const cta = page.locator('[data-nutuensai-entry="fallback"]'); await expect(cta).toBeVisible(); await cta.click(); await arrival(page);
  expect((await inspect(page)).rendererType).toBe("unavailable"); expect((await inspect(page)).storyState).toEqual(before);
  expect((await inspect(page)).ntsVisitRequest?.source).toBe("home"); await expect(page.locator("#nts-title")).toBeVisible();
  await page.screenshot({ path: shot("10-fallback-seam") });
  await returnNts(page); await page.locator('[data-ecosystem="exit"]').click(); await expect(cta).toBeFocused();
  await page.locator('[data-action="list-human"]').click(); await expect(cta).toBeVisible(); await cta.click(); await arrival(page);
  expect((await inspect(page)).ntsVisitRequest?.source).toBe("human");
});

test("input-layer interruption, mid-travel reduced motion and destruction cannot replay an intent", async ({ page }) => {
  await page.goto("/"); await page.locator('[data-nutuensai-entry="home"]').click();
  await page.locator('[data-action="show-about"]').click();
  expect((await inspect(page)).journeyState.phase).toBe("cancelled");
  await page.keyboard.press("Escape"); expect((await inspect(page)).overviewState.selectedNodeId).toBe("nutuensai");
  await returnNts(page); await page.locator('[data-ecosystem="exit"]').click(); await settle(page);
  await page.locator('[data-nutuensai-entry="home"]').click(); await page.emulateMedia({ reducedMotion: "reduce" }); await arrival(page);
  expect((await inspect(page)).journeyState.visitRequests).toBe(1);
  await returnNts(page); await page.locator('[data-ecosystem="exit"]').click();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.locator('[data-nutuensai-entry="home"]').click();
  await page.evaluate(() => window.__MSXAI_STORY_WORLD__!.destroy());
  await page.waitForTimeout(700);
  expect((await inspect(page)).ntsVisitRequest).toBeUndefined(); expect((await inspect(page)).journeyState.visitRequests).toBe(1);
  await expect(page.locator("canvas.story-canvas")).toHaveCount(0);
});
