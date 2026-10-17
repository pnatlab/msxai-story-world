import { test, expect, type Page } from "@playwright/test";
import { FOUNDATIONAL_SESSION_KEY } from "../src/ui/foundationalOpeningModel";
import { MASK_COLORS, OUTFIT_COLORS } from "../src/nts/appearance";

const snapshot = (page: Page) => page.evaluate(() => window.__MSXAI_STORY_WORLD__!.inspect());
async function settled(page: Page) {
  await expect.poll(async () => (await snapshot(page)).ntsState.phase, { timeout: 15000 }).toBe("settled");
  await expect.poll(async () => { const r = await snapshot(page); return "nts" in r && r.nts?.loaded; }).toBe(true);
  await expect.poll(async () => { const r = await snapshot(page); return "renderLoopActive" in r && r.renderLoopActive; }, { timeout: 10000 }).toBe(false);
}
const open = async (page: Page) => {
  const details = page.locator(".nts-appearance");
  if (await details.getAttribute("open") === null) await details.locator("summary").click();
  await expect(details).toHaveAttribute("open", "");
  // Native <details> dispatches `toggle` asynchronously; wait for its measured
  // placement before asserting bounds or capturing a review frame.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect.poll(() => details.locator(".nts-appearance-panel").evaluate(element => (element as HTMLElement).style.width)).not.toBe("");
};

test("Presence Colors and its open panel clear the memory field across responsive layouts and locales", async ({ page }) => {
  test.setTimeout(90000);
  await page.locator('[data-nutuensai-entry="home"]').click(); await settled(page);
  const viewports = [
    { width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 },
    { width: 1280, height: 720 }, { width: 1024, height: 768 }, { width: 800, height: 600 },
    { width: 390, height: 844 }, { width: 640, height: 480 }, { width: 844, height: 390 },
  ];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport); await settled(page);
    for (const locale of ["en", "th"]) {
      await page.locator(`[data-nts="${locale}"]`).click();
      // Check both the arrival field and active Image ↔ Narrative composition.
      for (const memory of [null, "s1", "s4"]) {
        if (memory) await page.locator(`[data-nts-memory="${memory}"]`).click();
        else if (await page.locator('[data-nts="close-reading"]').isVisible()) await page.locator('[data-nts="close-reading"]').click();
        for (const expanded of [false, true]) {
          if (expanded) await open(page);
          const targets = page.locator(expanded
            ? '.nts-appearance summary, .nts-appearance-panel, [data-nts="meet"], [data-nts="inspect"], [data-nts="smile"], [data-nts="hologram"]'
            : '.nts-appearance summary, [data-nts="meet"], [data-nts="inspect"], [data-nts="smile"], [data-nts="hologram"]');
          await expect.poll(async () => targets.evaluateAll(elements => {
            const traces = [...document.querySelectorAll('[data-nts-memory]')].map(trace => trace.getBoundingClientRect());
            return Math.min(...elements.flatMap(element => {
              const box = element.getBoundingClientRect();
              return traces.map(trace => Math.hypot(Math.max(box.left - trace.right, trace.left - box.right, 0), Math.max(box.top - trace.bottom, trace.top - box.bottom, 0)));
            }));
          }), `${viewport.width}×${viewport.height} ${locale}: Presence controls must be separate from images AND labels`).toBeGreaterThanOrEqual(11);
        }
        await page.keyboard.press("Escape");
        await expect(page.locator('.nts-appearance summary')).toBeFocused();
      }
    }
  }
});

test("open mobile Appearance panel does not obscure the rendered Presence preview", async ({ page }, testInfo) => {
  test.setTimeout(60000);
  const viewports = [
    { width: 390, height: 844 },
    { width: 375, height: 667 },
    { width: 430, height: 932 },
    { width: 844, height: 390 },
    { width: 1440, height: 900 },
  ];
  await page.locator('[data-nutuensai-entry="home"]').click(); await settled(page);

  for (const viewport of viewports) {
    await page.setViewportSize(viewport); await settled(page);
    await open(page);
    const bounds = await page.evaluate(() => {
      const panel = document.querySelector<HTMLElement>(".nts-appearance-panel")!.getBoundingClientRect();
      const presence = window.__MSXAI_STORY_WORLD__!.inspect();
      const box = "nts" in presence ? presence.nts?.composition.presence : undefined;
      const silhouette = box ? { left: box.x - 24, right: box.x + box.width + 24, top: box.y, bottom: box.y + box.height } : undefined;
      const overlaps = silhouette ? panel.left < silhouette.right && panel.right > silhouette.left && panel.top < silhouette.bottom && panel.bottom > silhouette.top : true;
      const memories = [...document.querySelectorAll<HTMLElement>("[data-nts-memory]")].map(element => {
        const rect = element.getBoundingClientRect();
        return panel.left < rect.right && panel.right > rect.left && panel.top < rect.bottom && panel.bottom > rect.top;
      });
      const buttons = [...document.querySelectorAll<HTMLElement>('[data-nts="meet"], [data-nts="inspect"], [data-nts="smile"], [data-nts="hologram"], [data-nts="return"]')].map(element => {
        const rect = element.getBoundingClientRect();
        return { name: element.dataset.nts, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, overlaps: panel.left < rect.right && panel.right > rect.left && panel.top < rect.bottom && panel.bottom > rect.top };
      });
      return { viewport: { innerWidth, innerHeight }, panel: { x: panel.x, y: panel.y, width: panel.width, height: panel.height }, presence: box, conservativeSilhouette: silhouette, overlaps, overlapsMemory: memories.some(Boolean), overlappingControls: buttons.filter(button => button.overlaps), horizontalOverflow: document.documentElement.scrollWidth > innerWidth };
    });
    await page.screenshot({ path: testInfo.outputPath(`appearance-open-${viewport.width}x${viewport.height}.png`), fullPage: false });
    expect(bounds.overlaps, `${viewport.width}×${viewport.height}: Appearance must not cover the projected Presence preview (${JSON.stringify(bounds)})`).toBe(false);
    expect(bounds.overlapsMemory, `${viewport.width}×${viewport.height}: Appearance must not cover Gallery memories`).toBe(false);
    expect(bounds.overlappingControls, `${viewport.width}×${viewport.height}: Appearance must not cover navigation or Return controls (${JSON.stringify(bounds.overlappingControls)})`).toEqual([]);
    expect(bounds.horizontalOverflow, `${viewport.width}×${viewport.height}: no horizontal page overflow`).toBe(false);
    await page.locator('[data-nts-outfit="white"]').click();
    await page.locator('[data-nts-mask="white"]').click();
    await expect(page.locator('[data-nts-outfit="white"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[data-nts-mask="white"]')).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape");
    await expect(page.locator(".nts-appearance")).not.toHaveAttribute("open", "");
    await open(page);
    await page.keyboard.press("Escape");
  }
});
test.beforeEach(async ({ page }) => {
  await page.addInitScript(key => sessionStorage.setItem(key, "seen"), FOUNDATIONAL_SESSION_KEY);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto("/");
});

test("curated material colors are independent, resource-stable and reset at fresh entry", async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = [], external: string[] = [], presenceRequests: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("request", r => { if (!r.url().startsWith("http://127.0.0.1:")) external.push(r.url()); if (r.url().endsWith("/presence-study.bin")) presenceRequests.push(r.url()); });
  await page.locator('[data-nutuensai-entry="home"]').click(); await settled(page);
  expect((await snapshot(page)).ntsState).toMatchObject({ outfit: "blue", mask: "lavender" });
  await page.locator('[data-nts-memory="s4"]').click(); await settled(page);
  await open(page);
  await expect(page.getByRole("group", { name: "Outfit", exact: true }).getByRole("button")).toHaveCount(3);
  await expect(page.getByRole("group", { name: "Mask", exact: true }).getByRole("button")).toHaveCount(2);
  await expect(page.locator('[data-nts-outfit="blue"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-nts-mask="lavender"]')).toHaveAttribute("aria-pressed", "true");
  const before = await snapshot(page);
  const resources = (r: Awaited<ReturnType<typeof snapshot>>) => "nts" in r ? { meshes: r.nts?.presenceMeshCount, geometries: r.geometryCount, materials: r.materialCount, gpu: r.gpu, textures: r.nts?.textureCount } : undefined;
  for (let repeat = 0; repeat < 3; repeat++) for (const [outfit, outfitHex] of Object.entries(OUTFIT_COLORS)) for (const [mask, maskHex] of Object.entries(MASK_COLORS)) {
    const oldMask = (await snapshot(page)).ntsState.mask;
    await page.locator(`[data-nts-outfit="${outfit}"]`).click();
    expect((await snapshot(page)).ntsState.mask).toBe(oldMask);
    await page.locator(`[data-nts-mask="${mask}"]`).click();
    const r = await snapshot(page);
    expect(r.ntsState).toEqual({ ...before.ntsState, outfit, mask });
    expect("nts" in r && r.nts?.presentationColors).toEqual({ outfit: outfitHex.slice(1), mask: maskHex.slice(1) });
    expect(resources(r)).toEqual(resources(before));
    expect(r.storyState).toEqual(before.storyState); expect(r.overviewState).toEqual(before.overviewState);
    if ("cameraPosition" in r && "cameraPosition" in before) { expect(r.cameraPosition).toEqual(before.cameraPosition); expect(r.cameraTarget).toEqual(before.cameraTarget); }
  }
  expect(presenceRequests).toHaveLength(1);
  console.log("D.4 stable color-switch resources", JSON.stringify(resources(await snapshot(page))));
  await page.keyboard.press("Escape");
  expect((await snapshot(page)).ntsState).toMatchObject({ phase: "settled", reading: true, memoryId: "s4" });
  await expect(page.locator(".nts-appearance > summary")).toBeFocused();
  await page.locator('[data-nts="return"]').click();
  await expect.poll(async () => (await snapshot(page)).ntsState.phase).toBe("closed");
  await expect(page.locator('[data-ecosystem="visit-nts"]')).toBeFocused();
  expect((await snapshot(page)).overviewState.selectedNodeId).toBe("nutuensai");
  await page.locator('[data-ecosystem="visit-nts"]').click(); await settled(page);
  expect((await snapshot(page)).ntsState).toMatchObject({ outfit: "blue", mask: "lavender", memoryId: "s1" });
  expect(errors).toEqual([]); expect(external).toEqual([]);
});

test("keyboard, localized groups, portrait targets and Escape preserve inspection and choices", async ({ page }) => {
  test.setTimeout(60000);
  await page.locator('[data-nutuensai-entry="home"]').click(); await settled(page);
  await page.locator('[data-nts="inspect"]').click(); await settled(page);
  const summary = page.locator(".nts-appearance > summary");
  await summary.focus(); await summary.press("Enter");
  await summary.press("Tab"); await expect(page.locator('[data-nts-outfit="blue"]')).toBeFocused();
  await page.keyboard.press("Tab"); await page.keyboard.press("Space");
  expect((await snapshot(page)).ntsState).toMatchObject({ outfit: "white", mask: "lavender", inspection: "front" });
  await page.keyboard.press("Tab"); await page.keyboard.press("Enter");
  expect((await snapshot(page)).ntsState.outfit).toBe("black");
  await page.keyboard.press("Escape");
  expect((await snapshot(page)).ntsState.inspection).toBe("front"); await expect(summary).toBeFocused();
  await page.locator('[data-nts="th"]').click(); await open(page);
  await expect(summary).toHaveText("สี");
  await expect(page.getByRole("group", { name: "ชุด", exact: true }).getByRole("button")).toHaveText(["ฟ้า✓", "ขาว✓", "ดำ✓"]);
  await expect(page.getByRole("group", { name: "หน้ากาก", exact: true }).getByRole("button")).toHaveText(["ม่วงอ่อน✓", "ขาว✓"]);
  expect((await snapshot(page)).ntsState.outfit).toBe("black");
  await page.locator('[data-nts-mask="lavender"]').focus();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.nts-view')).toHaveAttribute('data-layout', 'compact');
  await expect(page.locator('.nts-appearance')).not.toHaveAttribute('open', '');
  await expect(summary).toBeFocused();
  await open(page);
  for (const target of await page.locator('.nts-appearance summary, .nts-appearance button').all()) {
    const b = (await target.boundingBox())!;
    expect(b.width).toBeGreaterThanOrEqual(44); expect(b.height).toBeGreaterThanOrEqual(44);
    expect(b.x).toBeGreaterThanOrEqual(0); expect(b.x + b.width).toBeLessThanOrEqual(390);
    expect(b.y).toBeGreaterThanOrEqual(0); expect(b.y + b.height).toBeLessThanOrEqual(844);
  }
  await page.locator('[data-nts-mask="white"]').click();
  await expect(page.locator('[data-nts-mask="white"]')).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await page.getByRole("slider").press("End"); expect((await snapshot(page)).ntsState.inspection).toBe(90);
  await page.locator('[data-nts="en"]').click(); await open(page);
  await expect(page.getByRole("group", { name: "Outfit", exact: true }).getByRole("button")).toHaveText(["Blue✓", "White✓", "Black✓"]);
  expect((await snapshot(page)).ntsState).toMatchObject({ outfit: "black", mask: "white", inspection: 90 });
});

test("DOM fallback remains meaningful without non-functional color controls", async ({ page }) => {
  await page.goto('/?forceNoWebgl=1');
  await page.locator('[data-nutuensai-entry="fallback"]').click();
  await expect(page.locator('.nts-view[data-phase="settled"]')).toBeVisible();
  await expect(page.locator('.nts-appearance')).toBeHidden();
  await page.locator('[data-nts-memory="s2"]').click(); await expect(page.locator('.nts-caption')).toContainText("Room for Lightness");
  await page.locator('[data-nts="return"]').click();
  await expect(page.locator('[data-ecosystem="visit-nts"]')).toBeFocused();
});

test("choices made while Presence loads apply to the same model when ready", async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/nts/presence-study.bin', async route => { await held; await route.continue(); });
  await page.locator('[data-nutuensai-entry="home"]').click();
  await expect(page.locator('.nts-view[data-phase="settled"]')).toBeVisible();
  await open(page); await page.locator('[data-nts-outfit="black"]').click(); await page.locator('[data-nts-mask="white"]').click();
  release(); await settled(page);
  const r = await snapshot(page);
  expect("nts" in r && r.nts?.presentationColors).toEqual({ outfit: "252b30", mask: "eaf2f4" });
  expect("nts" in r && r.nts?.presenceMeshCount).toBe(28);
});
