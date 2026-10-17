import { test, expect, type Page } from "@playwright/test";
import { FOUNDATIONAL_SESSION_KEY } from "../src/ui/foundationalOpeningModel";

const toggle = (page: Page) => page.locator('[data-nts="hologram"]');
async function enter(page: Page, reduced = false) {
  await page.addInitScript(key => sessionStorage.setItem(key, "seen"), FOUNDATIONAL_SESSION_KEY);
  await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  const modules: string[] = [];
  page.on("request", r => { if (/\/(?:src\/nts\/NtsPresentation\.ts|assets\/NtsPresentation-[^/]+\.js)(?:\?|$)/.test(r.url())) modules.push(r.url()); });
  await page.goto("./"); await page.locator('[data-nutuensai-entry="home"]').click();
  await expect(toggle(page)).toBeVisible({ timeout: 20000 });
  await expect(toggle(page)).toBeEnabled({ timeout: 20000 });
  expect(modules.length).toBeGreaterThan(0);
  await page.evaluate(async url => {
    const { NtsPresentation } = await import(url), original = NtsPresentation.prototype.frame;
    const qa = (window as any).__NTS_PROJECTION_QA__ = { presentation: undefined, frames: 0 };
    NtsPresentation.prototype.frame = function (this: any, now: number) { const result = original.call(this, now); qa.presentation = this; qa.frames++; return result; };
  }, modules.at(-1)!);
  await colors(page, "white", "lavender"); await colors(page, "blue", "lavender"); await settled(page);
}
async function colors(page: Page, outfit: string, mask: string) {
  const summary = page.locator(".nts-appearance summary");
  if (await page.locator(".nts-appearance").getAttribute("open") === null) await summary.click();
  await page.locator(`[data-nts-outfit="${outfit}"]`).click(); await page.locator(`[data-nts-mask="${mask}"]`).click(); await page.keyboard.press("Escape");
}
const read = (page: Page) => page.evaluate(() => {
  const qa = (window as any).__NTS_PROJECTION_QA__, p = qa.presentation;
  return { state: p.state, projection: p.inspection.projection, graph: p.inspection.energyGraph,
    pulse: p.hologram.pulse.inspection, expression: p.expression.inspection,
    colors: p.inspection.presentationColors, needsMotion: p.needsMotion, frames: qa.frames,
    camera: { position: p.director.camera.position.toArray(), target: p.director.target.toArray(), fov: p.director.camera.fov },
    materials: p.presence.children.map((mesh: any) => ({ id: mesh.material.uuid, opacity: mesh.material.opacity, transparent: mesh.material.transparent, depthWrite: mesh.material.depthWrite, color: mesh.material.color?.getHexString() })),
    resources: { objects: p.group.children.length, meshes: p.inspection.presenceMeshCount, triangles: p.inspection.presenceTriangles,
      geometries: p.geometries.size, materials: p.materials.size, textures: p.textures.size, projection: p.inspection.projection.geometryCount,
      projectionMaterials: p.inspection.projection.materialCount, graph: p.inspection.energyGraph.geometryCount },
  };
});
async function settled(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const p = (window as any).__NTS_PROJECTION_QA__?.presentation;
    return Boolean(p?.loaded && !p.needsMotion && !p.director.isTransitioning);
  }), { intervals: [30], timeout: 15000 }).toBe(true);
}
async function middle(page: Page) { await expect.poll(async () => (await read(page)).projection, { intervals: [25] }).toMatchObject({ active: true, visible: true }); await expect.poll(async () => (await read(page)).projection.elapsed, { intervals: [25] }).toBeGreaterThanOrEqual(1650); }
async function idle(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const frames = (await read(page)).frames; await page.waitForTimeout(250); expect((await read(page)).frames).toBe(frames);
}

test("real presentation toggle has a bounded readable Projection beat in both directions and restores canonical state", async ({ page }, info) => {
  test.setTimeout(60000); const errors: string[] = []; page.on("pageerror", e => errors.push(e.message)); await enter(page);
  const normal = await read(page);
  console.log("Projection cached resources", JSON.stringify({ canonical: normal.resources, projection: normal.projection, graph: normal.graph }));
  expect(normal.graph).toMatchObject({ mode: "normal", nodeCount: 2780, connectionCount: 6661, structuralSegments: 1288 });
  expect(normal.projection).toMatchObject({ active: false, visible: false, geometryCount: 5, materialCount: 4, textureCount: 0 });
  const normalPixels = await page.locator("canvas.story-canvas").screenshot();
  await page.screenshot({ path: info.outputPath("01-normal.png") });
  await toggle(page).click(); await expect(toggle(page)).toBeDisabled();
  await expect.poll(async () => (await read(page)).projection.elapsed, { intervals: [25] }).toBeGreaterThanOrEqual(500);
  await page.screenshot({ path: info.outputPath("01b-projection-forming.png") });
  await middle(page); const field = await read(page);
  expect(field.state.presentation).toBe("hologram"); expect(field.projection.elapsed).toBeLessThan(2800);
  expect(field.graph).toMatchObject({ visible: false, canonicalHidden: true });
  expect(field.pulse).toMatchObject({ eligible: false, animating: false, timerPending: false, baselineExact: true });
  expect(field.expression).toMatchObject({ enabled: false, animating: false, neutralExact: true, headNeutralExact: true });
  expect(field.camera).toEqual(normal.camera); expect(field.resources).toEqual(normal.resources);
  expect(field.frames).toBeGreaterThan(normal.frames + 10);
  expect((await page.locator("canvas.story-canvas").screenshot()).equals(normalPixels)).toBe(false);
  await page.screenshot({ path: info.outputPath("02-projection-middle.png") });
  await expect.poll(async () => (await read(page)).projection.elapsed, { intervals: [25] }).toBeGreaterThanOrEqual(3300);
  await page.screenshot({ path: info.outputPath("03-projection-resolving.png") });
  await settled(page); await expect(toggle(page)).toBeEnabled(); const hologram = await read(page);
  expect(hologram.projection).toMatchObject({ active: false, visible: false });
  expect(hologram.graph).toMatchObject({ mode: "hologram", visible: true, canonicalHidden: true });
  expect(hologram.pulse).toMatchObject({ eligible: true, timerPending: true, baselineExact: true });
  expect(hologram.materials).toEqual(normal.materials); expect(hologram.camera).toEqual(normal.camera);
  await page.screenshot({ path: info.outputPath("04-hologram.png") }); await idle(page);
  await toggle(page).click(); await middle(page); await page.screenshot({ path: info.outputPath("05-reverse-projection.png") }); await settled(page);
  const restored = await read(page);
  expect(restored.state.presentation).toBe("normal"); expect(restored.materials).toEqual(normal.materials); expect(restored.colors).toEqual(normal.colors);
  expect(restored.camera).toEqual(normal.camera); expect(restored.resources).toEqual(normal.resources); expect(restored.expression).toMatchObject({ timerPending: true, neutralExact: true, headNeutralExact: true });
  await page.screenshot({ path: info.outputPath("06-normal-restored.png") }); await idle(page); expect(errors).toEqual([]);
});

test("Projection cycles, inspection cancellation, colors, re-entry and Reduced Motion retain one presentation lifecycle", async ({ page }) => {
  test.setTimeout(90000); await enter(page); await colors(page, "black", "white");
  await page.locator('[data-nts="inspect"]').click(); await page.getByRole("slider").fill("45"); await settled(page);
  const baseline = await read(page);
  for (let cycle = 0; cycle < 3; cycle++) {
    await toggle(page).click(); await expect(toggle(page)).toBeDisabled(); await settled(page);
    await toggle(page).click(); await settled(page);
    const current = await read(page); expect(current.materials).toEqual(baseline.materials); expect(current.resources).toEqual(baseline.resources); expect(current.camera).toEqual(baseline.camera);
    expect(current.expression).toMatchObject({ neutralExact: true, headNeutralExact: true });
  }
  await toggle(page).click(); await middle(page); await page.locator('[data-nts="inspect-mark"]').click(); await settled(page);
  expect((await read(page)).projection).toMatchObject({ active: false, visible: false });
  await page.locator('[data-nts="mark-back"]').click(); await settled(page); expect((await read(page)).camera).toEqual(baseline.camera);
  await page.emulateMedia({ reducedMotion: "reduce" }); await toggle(page).click(); await settled(page);
  expect((await read(page)).projection).toMatchObject({ active: false, visible: false }); expect((await read(page)).state.presentation).toBe("normal"); await idle(page);
  await page.emulateMedia({ reducedMotion: "no-preference" }); await toggle(page).click(); await middle(page);
  await page.evaluate(() => { const qa = (window as any).__NTS_PROJECTION_QA__; qa.retired = qa.presentation.projectionTransition; qa.pulse = qa.presentation.hologram.pulse; });
  await page.locator('[data-nts="return"]').click(); await expect(page.locator(".nts-view")).toBeHidden();
  expect(await page.evaluate(() => (window as any).__NTS_PROJECTION_QA__.retired.inspection)).toMatchObject({ active: false, visible: false });
  expect(await page.evaluate(() => (window as any).__NTS_PROJECTION_QA__.pulse.inspection)).toMatchObject({ animating: false, timerPending: false, eligible: false });
  await page.locator('[data-ecosystem="visit-nts"]').click(); await expect(toggle(page)).toBeEnabled({ timeout: 20000 }); await settled(page);
  const fresh = await read(page); expect(fresh.state).toMatchObject({ presentation: "normal", outfit: "blue", mask: "lavender", inspection: false }); expect(fresh.resources).toEqual(baseline.resources);
});

test("Projection footprint and identity stay within the Presence composition across mobile and desktop", async ({ page }, info) => {
  test.setTimeout(90000); await enter(page, true);
  for (const viewport of [{ width: 390, height: 844 }, { width: 375, height: 667 }, { width: 430, height: 932 }, { width: 844, height: 390 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport); await settled(page);
    await page.emulateMedia({ reducedMotion: "no-preference" }); await toggle(page).click(); await middle(page);
    const layout = await page.evaluate(() => {
      const p = (window as any).__NTS_PROJECTION_QA__.presentation, projection = p.projectionTransition.projection;
      const corners = [-1, 1].flatMap(x => [0, 1].map(y => {
        const v = projection.group.position.clone().set(x * projection.width / 2, y * projection.height, 0);
        projection.field.localToWorld(v); v.project(p.director.camera); return { x: (v.x + 1) * innerWidth / 2, y: (1 - v.y) * innerHeight / 2 };
      }));
      const box = { left: Math.min(...corners.map(v => v.x)), right: Math.max(...corners.map(v => v.x)), top: Math.min(...corners.map(v => v.y)), bottom: Math.max(...corners.map(v => v.y)) };
      const gallery = [...document.querySelectorAll("[data-nts-memory]")].map(element => element.getBoundingClientRect());
      const label = projection.group.getObjectByName("Projection-identity-NuTuenSai-blue-heart"), b = label.geometry.boundingBox;
      const textCorners = [b.min.x, b.max.x].flatMap(x => [b.min.y, b.max.y].map(y => {
        const v = label.position.clone().set(x, y, 0); label.localToWorld(v); v.project(p.director.camera);
        return { x: (v.x + 1) * innerWidth / 2, y: (1 - v.y) * innerHeight / 2 };
      }));
      const text = { left: Math.min(...textCorners.map(v => v.x)), right: Math.max(...textCorners.map(v => v.x)), top: Math.min(...textCorners.map(v => v.y)), bottom: Math.max(...textCorners.map(v => v.y)) };
      const controls = [...document.querySelectorAll('.nts-presence-controls button, .nts-appearance summary')].filter(element => element.getBoundingClientRect().width > 0);
      return { box, identityGap: Math.min(...controls.map(element => {
        const other = element.getBoundingClientRect();
        return Math.hypot(Math.max(text.left - other.right, other.left - text.right, 0), Math.max(text.top - other.bottom, other.top - text.bottom, 0));
      })), horizontalOverflow: document.documentElement.scrollWidth > innerWidth, galleryOverlap: gallery.some(rect => box.left < rect.right && box.right > rect.left && box.top < rect.bottom && box.bottom > rect.top) };
    });
    expect(layout.box.left).toBeGreaterThanOrEqual(0); expect(layout.box.right).toBeLessThanOrEqual(viewport.width);
    expect(layout.box.top).toBeGreaterThanOrEqual(100); expect(layout.box.bottom).toBeLessThan(viewport.height - 100); expect(layout.galleryOverlap).toBe(false); expect(layout.horizontalOverflow).toBe(false);
    expect(layout.identityGap, "the vector identity must remain clear of the existing Presence controls").toBeGreaterThanOrEqual(4);
    await page.screenshot({ path: info.outputPath(`projection-${viewport.width}x${viewport.height}.png`) }); await settled(page);
    await page.emulateMedia({ reducedMotion: "reduce" }); await toggle(page).click(); await settled(page);
    expect((await read(page)).state.presentation).toBe("normal"); expect((await read(page)).projection.active).toBe(false);
  }
});
