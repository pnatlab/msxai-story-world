import { test, expect, type Page } from "@playwright/test";
import { FOUNDATIONAL_SESSION_KEY } from "../src/ui/foundationalOpeningModel";

const toggle = (page: Page) => page.locator('[data-nts="hologram"]');

// Observe the already loaded presentation without a public review API. All
// presentation changes and expressions below originate from real DOM controls.
async function enter(page: Page, reduced = true): Promise<void> {
  await page.addInitScript(key => sessionStorage.setItem(key, "seen"), FOUNDATIONAL_SESSION_KEY);
  await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  const modules: string[] = [];
  page.on("request", request => {
    if (/\/(?:src\/nts\/NtsPresentation\.ts|assets\/NtsPresentation-[^/]+\.js)(?:\?|$)/.test(request.url())) modules.push(request.url());
  });
  await page.goto("./"); await page.locator('[data-nutuensai-entry="home"]').click();
  await expect(toggle(page)).toBeVisible({ timeout: 20000 });
  await expect(toggle(page)).toBeEnabled({ timeout: 20000 });
  expect(modules.length).toBeGreaterThan(0);
  await page.evaluate(async url => {
    const { NtsPresentation } = await import(url), original = NtsPresentation.prototype.frame;
    const qa: { presentation?: any; frames: number; history: any[] } = (window as any).__NTS_HOLOGRAM_QA__ = { frames: 0, history: [] };
    NtsPresentation.prototype.frame = function (this: any, now: number) {
      const result = original.call(this, now); qa.presentation = this; qa.frames++;
      qa.history.push({ time: now, ...this.expression?.inspection, mode: this.inspection.energyGraph?.mode });
      if (qa.history.length > 600) qa.history.shift();
      return result;
    };
  }, modules.at(-1)!);
  // A real material action supplies the first observed frame even after a
  // reduced-motion arrival has settled before the observer was installed.
  await colors(page, "white", "lavender"); await colors(page, "blue", "lavender"); await settled(page);
}

async function colors(page: Page, outfit: "blue" | "white" | "black", mask: "lavender" | "white"): Promise<void> {
  const panel = page.locator(".nts-appearance");
  if (await panel.getAttribute("open") === null) await panel.locator("summary").click();
  await page.locator(`[data-nts-outfit="${outfit}"]`).click(); await page.locator(`[data-nts-mask="${mask}"]`).click();
  await page.keyboard.press("Escape");
}

async function settled(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => {
    const p = (window as any).__NTS_HOLOGRAM_QA__?.presentation;
    return Boolean(p?.inspection.loaded && !p.needsMotion && !p.director.isTransitioning);
  }), { intervals: [30], timeout: 15000 }).toBe(true);
}

const expression = (page: Page) => page.evaluate(() => (window as any).__NTS_HOLOGRAM_QA__.presentation.expression?.inspection);
const snapshot = (page: Page) => page.evaluate(() => {
  const p = (window as any).__NTS_HOLOGRAM_QA__.presentation;
  const pose = (mesh: any) => ({ position: mesh.position.toArray(), quaternion: mesh.quaternion.toArray(), scale: mesh.scale.toArray() });
  const graph = p.hologram, graphObjects: any[] = [];
  graph.group.traverse((object: any) => {
    if (object.geometry) graphObjects.push({ id: object.uuid, type: object.type, geometry: object.geometry.uuid,
      vertexCount: object.geometry.getAttribute("position").count,
      material: (Array.isArray(object.material) ? object.material : [object.material]).map((material: any) => material.uuid) });
  });
  return {
    state: { ...p.state }, mode: p.inspection.energyGraph,
    camera: { position: p.director.camera.position.toArray(), target: p.director.target.toArray(), fov: p.director.camera.fov },
    parent: pose(p.presence), poses: Object.fromEntries(p.presence.children.map((mesh: any) => [mesh.name, pose(mesh)])),
    layers: p.presence.children.map((mesh: any) => ({ name: mesh.name, mask: mesh.layers.mask })),
    graph: { group: pose(graph.group), head: pose(graph.head), objects: graphObjects,
      geometryIds: [...graph.geometries].map((geometry: any) => geometry.uuid), materialIds: [...graph.materials].map((material: any) => material.uuid) },
    colors: p.inspection.presentationColors,
    materialState: p.presence.children.map((mesh: any) => ({ name: mesh.name, geometry: mesh.geometry.uuid,
      materials: (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((material: any) => ({
        id: material.uuid, color: material.color?.getHexString(), emissive: material.emissive?.getHexString(),
        emissiveIntensity: material.emissiveIntensity, opacity: material.opacity, transparent: material.transparent,
        depthWrite: material.depthWrite, vertexColors: material.vertexColors, renderOrder: mesh.renderOrder,
      })) })),
    resources: { meshes: p.inspection.presenceMeshCount, triangles: p.inspection.presenceTriangles,
      geometries: p.geometries.size, materials: p.materials.size, textures: p.textures.size,
      graphGeometries: graph.geometries.size, graphMaterials: graph.materials.size,
      graphTextures: p.inspection.energyGraph.textureCount, graphDrawObjects: graphObjects.length },
  };
});

async function neutral(page: Page): Promise<void> {
  await expect.poll(() => expression(page), { intervals: [25] }).toMatchObject({ animating: false, neutralExact: true, headNeutralExact: true, tiltDegrees: 0 });
}

test("one accessible presentation toggle reversibly suppresses solids and retains selected Normal materials, camera and graph resources", async ({ page }) => {
  test.setTimeout(90000); await enter(page);
  await expect(toggle(page)).toHaveAccessibleName("Hologram"); await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
  const defaultNormal = await snapshot(page);
  expect(defaultNormal.mode).toMatchObject({ mode: "normal", visible: false, canonicalHidden: false, normalMaterialCount: 12,
    geometryCount: 7, materialCount: 4, textureCount: 0, drawObjects: 7 });
  expect(defaultNormal.mode.nodeCount).toBeGreaterThan(0); expect(defaultNormal.mode.connectionCount).toBeGreaterThan(0);
  expect(defaultNormal.mode.structuralSegments).toBeGreaterThan(0);
  expect(defaultNormal.resources).toMatchObject({ meshes: 28, triangles: 108296, graphGeometries: 7, graphMaterials: 4, graphTextures: 0, graphDrawObjects: 7 });
  expect(defaultNormal.graph.group).toEqual(defaultNormal.parent);
  expect(defaultNormal.graph.geometryIds).toHaveLength(7); expect(defaultNormal.graph.materialIds).toHaveLength(4);
  await toggle(page).focus(); await toggle(page).press("Space"); await settled(page);
  await expect(toggle(page)).toBeFocused(); await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
  expect((await snapshot(page)).camera).toEqual(defaultNormal.camera);
  await page.locator('[data-nts="th"]').click(); await expect(toggle(page)).toHaveAccessibleName("โฮโลแกรม");
  await toggle(page).focus(); await toggle(page).press("Enter"); await settled(page);
  await expect(toggle(page)).toBeFocused(); expect(await snapshot(page)).toEqual(defaultNormal);
  await page.locator('[data-nts="en"]').click(); await expect(toggle(page)).toHaveAccessibleName("Hologram");
  await colors(page, "black", "white");
  await page.locator('[data-nts="inspect"]').click(); await page.getByRole("slider").fill("45"); await settled(page);
  const selectedNormal = await snapshot(page);
  for (let repeat = 0; repeat < 6; repeat++) {
    await toggle(page).click(); await settled(page); const hologram = await snapshot(page);
    expect(hologram.mode).toMatchObject({ mode: "hologram", visible: true, canonicalHidden: true });
    expect(hologram.layers.every((mesh: any) => mesh.mask === 0)).toBe(true);
    expect(hologram.materialState).toEqual(selectedNormal.materialState); expect(hologram.graph).toEqual(selectedNormal.graph);
    expect(hologram.camera).toEqual(selectedNormal.camera); expect(hologram.poses).toEqual(selectedNormal.poses);
    expect(hologram.parent).toEqual(selectedNormal.parent); expect(hologram.resources).toEqual(selectedNormal.resources);
    expect(hologram.colors).toEqual(selectedNormal.colors); await expect(page.getByRole("slider")).toHaveValue("45");
    await toggle(page).click(); await settled(page); expect(await snapshot(page)).toEqual(selectedNormal);
  }
  await toggle(page).click(); await colors(page, "white", "lavender"); await settled(page);
  expect((await snapshot(page)).mode.mode).toBe("hologram");
  await toggle(page).click(); await settled(page);
  const updatedNormal = await snapshot(page);
  expect(updatedNormal.colors).toEqual({ outfit: "dce5e6", mask: "c9c3d8" });
  expect(updatedNormal.camera).toEqual(selectedNormal.camera); expect(updatedNormal.resources).toEqual(selectedNormal.resources);
  expect(updatedNormal.materialState.map((mesh: any) => mesh.materials.map((m: any) => m.id)))
    .toEqual(selectedNormal.materialState.map((mesh: any) => mesh.materials.map((m: any) => m.id)));
  expect(updatedNormal.layers).toEqual(defaultNormal.layers);
  // Rotating while the graph is active uses the canonical inspection camera.
  await toggle(page).click(); await page.getByRole("slider").fill("-45"); await settled(page);
  const rotatedGraph = await snapshot(page);
  await toggle(page).click(); await settled(page);
  expect((await snapshot(page)).camera).toEqual(rotatedGraph.camera); await expect(page.getByRole("slider")).toHaveValue("-45");
  await toggle(page).click(); await page.locator('[data-nts="dom"]').click(); await settled(page);
  expect((await snapshot(page)).mode).toMatchObject({ mode: "hologram", visible: false });
  await page.locator('[data-nts="dom"]').click(); await settled(page);
  expect((await snapshot(page)).mode).toMatchObject({ mode: "hologram", visible: true, canonicalHidden: true });
});

test("graph Hologram stays still and reuses the approved Smile tilt while preserving Mark, Return and fresh-entry contracts", async ({ page }, info) => {
  test.setTimeout(90000); await enter(page, false); await toggle(page).click(); await settled(page);
  const baseline = await snapshot(page);
  expect(await expression(page)).toMatchObject({ enabled: true, timerPending: false, animating: false, blink: 0, smile: 0 });
  await page.locator('[data-nts="smile"]').click();
  await expect.poll(() => expression(page), { intervals: [20] }).toMatchObject({ kind: "smile", blink: 0, smile: 0, tiltDegrees: -3 });
  const peak = await snapshot(page);
  expect(peak.graph.head).not.toEqual(baseline.graph.head); expect(peak.graph.objects).toEqual(baseline.graph.objects);
  expect(peak.camera).toEqual(baseline.camera); expect(peak.resources).toEqual(baseline.resources);
  await page.screenshot({ path: info.outputPath("hologram-gentle-smile.png") });
  await neutral(page); await settled(page); expect(await snapshot(page)).toEqual(baseline);
  expect(await expression(page)).toMatchObject({ timerPending: false, blink: 0, smile: 0 });
  await page.locator('[data-nts="smile"]').click();
  await expect.poll(() => expression(page), { intervals: [20] }).toMatchObject({ kind: "smile", smile: 0, tiltDegrees: -3 });
  await toggle(page).click(); await neutral(page); await settled(page);
  const normal = await snapshot(page); expect(normal.mode.mode).toBe("normal");
  expect(normal.poses).toEqual(baseline.poses); expect(normal.graph).toEqual(baseline.graph); expect(normal.resources).toEqual(baseline.resources);
  expect(await expression(page)).toMatchObject({ timerPending: true, blink: 0, smile: 0 });
  // The reverse switch must also clear facial buffers that were animated in
  // Normal before the graph becomes visible; both modes share one controller.
  await page.locator('[data-nts="smile"]').click();
  await expect.poll(() => expression(page), { intervals: [20] }).toMatchObject({ kind: "smile", smile: 1, tiltDegrees: -3 });
  await toggle(page).click(); await neutral(page); await settled(page);
  const restoredGraph = await snapshot(page);
  expect(restoredGraph.mode).toMatchObject({ mode: "hologram", visible: true, canonicalHidden: true });
  expect(restoredGraph.poses).toEqual(baseline.poses); expect(restoredGraph.graph.head).toEqual(baseline.graph.head);
  expect(restoredGraph.resources).toEqual(baseline.resources);
  expect(await expression(page)).toMatchObject({ timerPending: false, blink: 0, smile: 0, neutralExact: true, headNeutralExact: true });
  await page.locator('[data-nts="inspect"]').click();
  await page.getByRole("slider").fill("45"); await colors(page, "black", "white"); await settled(page);
  const priorMark = await snapshot(page);
  await page.locator('[data-nts="inspect-mark"]').click(); await settled(page);
  expect((await snapshot(page)).mode.mode).toBe("hologram");
  expect(await expression(page)).toMatchObject({ enabled: false, neutralExact: true, timerPending: false });
  await page.locator('[data-nts="mark-back"]').click(); await settled(page);
  expect(await snapshot(page)).toEqual(priorMark);
  await page.locator('[data-nts="return"]').click(); await expect(page.locator(".nts-view")).toBeHidden();
  await expect(page.locator('[data-ecosystem="visit-nts"]')).toBeFocused();
  await page.locator('[data-ecosystem="visit-nts"]').click();
  await expect(toggle(page)).toBeEnabled({ timeout: 20000 }); await settled(page);
  const fresh = await snapshot(page);
  expect(fresh.mode.mode).toBe("normal"); expect(fresh.state).toMatchObject({ presentation: "normal", outfit: "blue", mask: "lavender", inspection: false, markInspection: false });
  expect(fresh.resources).toEqual(baseline.resources); expect(fresh.poses).toEqual(baseline.poses);
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
});

test("static Reduced Motion Hologram and responsive localized controls stay clear of memories and reading content", async ({ page }, info) => {
  test.setTimeout(90000); await enter(page); await toggle(page).click(); await settled(page);
  expect(await expression(page)).toMatchObject({ enabled: false, timerPending: false, animating: false, neutralExact: true });
  await expect(page.locator('[data-nts="smile"]')).toBeDisabled();
  // Let the two already requested browser paint boundaries drain before
  // measuring idle work; these ticks do not request an application render.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const idle = await page.evaluate(() => (window as any).__NTS_HOLOGRAM_QA__.frames);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as any).__NTS_HOLOGRAM_QA__.frames)).toBe(idle);
  // Active memory textures legitimately change when selecting gallery traces.
  const { textures: _textures, ...resources } = (await snapshot(page)).resources;
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport); await settled(page);
    for (const locale of ["en", "th"] as const) {
      await page.locator(`[data-nts="${locale}"]`).click();
      await expect(toggle(page)).toHaveAccessibleName(locale === "en" ? "Hologram" : "โฮโลแกรม");
      for (const memory of ["s2", "s4"]) {
        await page.locator(`[data-nts-memory="${memory}"]`).click(); await settled(page);
        const layout = await toggle(page).evaluate(button => {
          const box = button.getBoundingClientRect(), targets = [...document.querySelectorAll('[data-nts-memory], .nts-caption:not([hidden])')];
          return { width: box.width, height: box.height, inViewport: box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight,
            minimumDistance: Math.min(...targets.map(element => {
              const other = element.getBoundingClientRect();
              return Math.hypot(Math.max(box.left - other.right, other.left - box.right, 0), Math.max(box.top - other.bottom, other.top - box.bottom, 0));
            })), ownsPointer: document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2) === button };
        });
        expect(layout.width).toBeGreaterThanOrEqual(44); expect(layout.height).toBeGreaterThanOrEqual(44);
        expect(layout.inViewport).toBe(true); expect(layout.minimumDistance).toBeGreaterThanOrEqual(11); expect(layout.ownsPointer).toBe(true);
        const { textures: _currentTextures, ...currentResources } = (await snapshot(page)).resources;
        expect(currentResources).toEqual(resources);
      }
    }
    if (viewport.width === 390) await page.screenshot({ path: info.outputPath("hologram-portrait-th.png") });
  }
  await page.goto("./?forceNoWebgl=1"); await page.locator('[data-nutuensai-entry="fallback"]').click();
  await expect(toggle(page)).toBeHidden();
});

test("sparse structural pulse wakes only for a bounded event, restores exact buffers and cancels for real Presence interactions", async ({ page }) => {
  test.setTimeout(120000); await enter(page, false); await toggle(page).click(); await settled(page);
  const pulse = () => page.evaluate(() => (window as any).__NTS_HOLOGRAM_QA__.presentation.hologram.pulse.inspection);
  const buffers = () => page.evaluate(() => {
    const graph = (window as any).__NTS_HOLOGRAM_QA__.presentation.hologram;
    return [...graph.geometries].map((geometry: any) => Object.fromEntries(Object.entries(geometry.attributes)
      .map(([name, attribute]: [string, any]) => [name, Array.from(attribute.array)])));
  });
  const idle = async () => {
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const before = await page.evaluate(() => (window as any).__NTS_HOLOGRAM_QA__.frames);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => (window as any).__NTS_HOLOGRAM_QA__.frames)).toBe(before);
  };
  const waitPulse = () => expect.poll(pulse, { intervals: [35], timeout: 25000 }).toMatchObject({ animating: true, timerPending: false, baselineExact: false });
  const baseline = await buffers(), initial = await snapshot(page);
  expect(initial.mode).toMatchObject({ nodeCount: 2780, connectionCount: 6661, structuralSegments: 1288, geometryCount: 7, materialCount: 4, textureCount: 0 });
  expect(await pulse()).toMatchObject({ eligible: true, timerPending: true, animating: false, pathCount: 3, baselineExact: true });
  await idle(); await waitPulse();
  const active = await buffers(); expect(active).not.toEqual(baseline);
  for (let i = 0; i < baseline.length; i++) for (const key of Object.keys(baseline[i])) if (key !== "color") expect(active[i][key]).toEqual(baseline[i][key]);
  expect(await snapshot(page)).toEqual(initial);
  await expect.poll(pulse, { intervals: [30], timeout: 5000 }).toMatchObject({ animating: false, timerPending: true, baselineExact: true });
  expect(await buffers()).toEqual(baseline); await idle();

  await waitPulse(); await page.locator('[data-nts="smile"]').click();
  expect(await pulse()).toMatchObject({ eligible: false, animating: false, timerPending: false, baselineExact: true });
  expect(await buffers()).toEqual(baseline);
  await expect.poll(() => expression(page), { intervals: [25] }).toMatchObject({ kind: "smile", smile: 0, tiltDegrees: -3 });
  await neutral(page); await settled(page);
  expect(await pulse()).toMatchObject({ eligible: true, animating: false, timerPending: true, baselineExact: true });
  expect(await snapshot(page)).toEqual(initial);

  await waitPulse(); await page.locator('[data-nts="inspect"]').click(); await settled(page);
  expect(await pulse()).toMatchObject({ eligible: false, animating: false, timerPending: false, baselineExact: true });
  expect(await buffers()).toEqual(baseline);
  await page.locator('[data-nts="inspect-mark"]').click(); await settled(page);
  expect(await pulse()).toMatchObject({ eligible: false, animating: false, timerPending: false });
  await page.locator('[data-nts="mark-back"]').click(); await settled(page);
  await page.locator('[data-nts="inspect"]').click(); await settled(page);
  expect(await pulse()).toMatchObject({ eligible: true, timerPending: true });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(pulse).toMatchObject({ eligible: false, animating: false, timerPending: false, baselineExact: true });
  await settled(page); await idle(); expect(await buffers()).toEqual(baseline);
  expect((await snapshot(page)).resources).toEqual(initial.resources);
  // Return disposes the visit's presentation. Observe its retired pulse owner
  // directly rather than dereferencing a deliberately cleared hologram field.
  await page.evaluate(() => {
    const qa = (window as any).__NTS_HOLOGRAM_QA__; qa.retiredPulse = qa.presentation.hologram.pulse;
  });
  await page.locator('[data-nts="return"]').click(); await expect(page.locator(".nts-view")).toBeHidden();
  expect(await page.evaluate(() => (window as any).__NTS_HOLOGRAM_QA__.retiredPulse.inspection))
    .toMatchObject({ eligible: false, animating: false, timerPending: false, baselineExact: true });
  await page.locator('[data-ecosystem="visit-nts"]').click(); await expect(toggle(page)).toBeEnabled({ timeout: 20000 }); await settled(page);
  expect((await snapshot(page)).mode.mode).toBe("normal");
  expect((await snapshot(page)).resources).toEqual(initial.resources);
  expect(await pulse()).toMatchObject({ eligible: false, animating: false, timerPending: false, baselineExact: true });
});
