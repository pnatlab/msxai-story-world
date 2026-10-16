import { test, expect } from "@playwright/test";
import { FOUNDATIONAL_SESSION_KEY } from "../src/ui/foundationalOpeningModel";

// Observe the actual default-framebuffer pixels before the browser discards its
// drawing buffer. This does not trigger expressions, request frames, or change
// the renderer. An internal expression value alone cannot satisfy this test.
function observeRenderedEyes(): void {
  const qa: { draws: number; samples: any[]; armed: boolean; gl?: WebGLRenderingContext | WebGL2RenderingContext;
    roi?: { x: number; y: number; width: number; height: number }; expression?: Record<string, unknown> }
    = (window as any).__NTS_SMILE_PIXELS__ = { draws: 0, samples: [], armed: false };
  for (const Type of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!Type) continue;
    const prototype = Type.prototype as any;
    for (const method of ["drawElements", "drawArrays"]) {
      const original = prototype[method];
      prototype[method] = function (...args: any[]) {
        const result = original.apply(this, args);
        qa.gl = this; qa.draws++;
        return result;
      };
    }
  }
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = callback => raf(now => {
    const before = qa.draws;
    callback(now);
    const gl = qa.gl, roi = qa.roi;
    if (!qa.armed || !roi || !gl || before === qa.draws || gl.getParameter(gl.FRAMEBUFFER_BINDING)) return;
    const pixels = new Uint8Array(roi.width * roi.height * 4);
    gl.readPixels(roi.x, roi.y, roi.width, roi.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    qa.samples.push({ ...qa.expression, pixels: Array.from(pixels), draws: qa.draws, time: now });
    if (qa.samples.length > 300) qa.samples.shift();
  });
}

test("trusted Gentle Smile clicks render the approved eye accent and restore neutral, including Colors outside-dismiss", async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(key => sessionStorage.setItem(key, "seen"), FOUNDATIONAL_SESSION_KEY);
  await page.addInitScript(observeRenderedEyes);
  const presentationModules: string[] = [];
  page.on("request", request => {
    if (/\/(?:src\/nts\/NtsPresentation\.ts|assets\/NtsPresentation-[^/]+\.js)(?:\?|$)/.test(request.url())) presentationModules.push(request.url());
  });
  await page.goto("./");
  await page.locator('[data-nutuensai-entry="home"]').click();
  const smile = page.getByRole("button", { name: "Gentle Smile", exact: true });
  await expect(smile).toHaveAttribute("aria-disabled", "false", { timeout: 20000 });
  expect(presentationModules.length).toBeGreaterThan(0);
  // Read-only observation of the already-loaded class works with both Vite's
  // source module and the production chunk. No public diagnostic API is needed.
  await page.evaluate(async url => {
    const { NtsPresentation } = await import(url);
    const original = NtsPresentation.prototype.frame;
    NtsPresentation.prototype.frame = function (this: any, now: number) {
      const result = original.call(this, now), qa = (window as any).__NTS_SMILE_PIXELS__;
      qa.presentation = this;
      qa.expression = this.expression?.inspection;
      qa.settled = !this.needsMotion && !this.director.isTransitioning;
      return result;
    };
  }, presentationModules.at(-1)!);
  await page.locator(".nts-appearance summary").click();
  await page.locator('[data-nts-outfit="white"]').click();
  await expect.poll(() => page.evaluate(() => (window as any).__NTS_SMILE_PIXELS__.settled), { intervals: [30] }).toBe(true);
  // Derive a fixed, tight eye ROI from actual neutral geometry/camera, not an
  // arbitrary screenshot coordinate. Keep it fixed throughout both cycles.
  await page.evaluate(() => {
    const qa = (window as any).__NTS_SMILE_PIXELS__, p = qa.presentation, gl = qa.gl;
    const xs: number[] = [], ys: number[] = [];
    for (const eye of p.presence.children.filter((mesh: any) => /^NTS_2C_Eye_[RL]$/.test(mesh.name))) {
      const positions = eye.geometry.getAttribute("position");
      for (let index = 0; index < positions.count; index++) {
        const point = p.presence.position.clone().fromBufferAttribute(positions, index);
        eye.localToWorld(point); point.project(p.director.camera);
        xs.push((point.x + 1) * gl.drawingBufferWidth / 2);
        ys.push((point.y + 1) * gl.drawingBufferHeight / 2);
      }
    }
    if (!xs.length) throw Error("Expected canonical eye geometry for rendered-pixel ROI");
    const x = Math.max(0, Math.floor(Math.min(...xs)) - 2), y = Math.max(0, Math.floor(Math.min(...ys)) - 2);
    qa.roi = { x, y, width: Math.min(gl.drawingBufferWidth, Math.ceil(Math.max(...xs)) + 2) - x,
      height: Math.min(gl.drawingBufferHeight, Math.ceil(Math.max(...ys)) + 2) - y };
    qa.armed = true;
  });
  // A real appearance action provides an actual neutral rendered frame. The
  // eye-only ROI excludes the garment whose color changes here.
  await page.locator('[data-nts-outfit="blue"]').click();
  await expect.poll(() => page.evaluate(() => (window as any).__NTS_SMILE_PIXELS__.samples.length)).toBeGreaterThan(0);
  const baseline = await page.evaluate(() => {
    const qa = (window as any).__NTS_SMILE_PIXELS__, sample = qa.samples.at(-1);
    if (!sample.neutralExact) throw Error("Expected neutral before native pointer activation");
    qa.baseline = sample.pixels;
    const p = qa.presentation;
    return { roi: qa.roi, nonempty: sample.pixels.some((value: number, index: number) => index % 4 !== 3 && value > 0),
      resources: { meshes: p.inspection.presenceMeshCount, triangles: p.inspection.presenceTriangles,
        geometries: p.geometries.size, materials: p.materials.size, textures: p.textures.size } };
  });
  expect(baseline.nonempty, "a discarded/blank framebuffer must not pass the visual assertion").toBe(true);
  await page.keyboard.press("Escape");
  for (const colorsOpen of [false, true]) {
    if (colorsOpen) await page.locator(".nts-appearance summary").click();
    await page.evaluate(() => { (window as any).__NTS_SMILE_PIXELS__.samples = []; });
    const hit = await smile.evaluate(button => {
      const rect = button.getBoundingClientRect();
      return document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) === button;
    });
    expect(hit, "the visible action must own its pointer hit-area").toBe(true);
    // Playwright dispatches trusted browser pointer events, unlike element.click().
    await smile.click();
    await expect.poll(() => page.evaluate(() => (window as any).__NTS_SMILE_PIXELS__.samples.some((sample: any) =>
      sample.kind === "smile" && sample.smile === 1 && sample.pixels.some((value: number, index: number) => value !== (window as any).__NTS_SMILE_PIXELS__.baseline[index]))),
    { timeout: 5000, intervals: [25] }).toBe(true);
    await expect.poll(() => page.evaluate(() => {
      const qa = (window as any).__NTS_SMILE_PIXELS__, sample = qa.samples.at(-1);
      return Boolean(sample?.neutralExact && !sample.animating && sample.pixels.every((value: number, index: number) => value === qa.baseline[index]));
    }), { timeout: 5000, intervals: [25] }).toBe(true);
    const hold = await page.evaluate(() => {
      const qa = (window as any).__NTS_SMILE_PIXELS__;
      const peak = qa.samples.filter((sample: any) => sample.kind === "smile" && sample.smile === 1 &&
        sample.pixels.some((value: number, index: number) => value !== qa.baseline[index]));
      return { span: peak.at(-1).time - peak[0].time, count: peak.length, blink: peak.some((sample: any) => sample.blink !== 0) };
    });
    // Allow two frame boundaries within the authored 800 ms hold, not an
    // instantaneous/internal-only peak. Normal-composition pixels must persist.
    expect(hold.span).toBeGreaterThanOrEqual(700);
    expect(hold.span).toBeLessThanOrEqual(800);
    expect(hold.count).toBeGreaterThan(2);
    expect(hold.blink).toBe(false);
    console.log("Rendered Gentle Smile hold", { colorsOpen, ...hold });
    await expect(page.locator(".nts-appearance")).not.toHaveAttribute("open", "");
    await expect(smile).toHaveAttribute("aria-disabled", "false");
  }
  const resources = await page.evaluate(() => {
    const p = (window as any).__NTS_SMILE_PIXELS__.presentation;
    return { meshes: p.inspection.presenceMeshCount, triangles: p.inspection.presenceTriangles,
      geometries: p.geometries.size, materials: p.materials.size, textures: p.textures.size };
  });
  expect(resources).toEqual(baseline.resources);
  expect(resources).toMatchObject({ meshes: 28, triangles: 108296 });
  await page.waitForTimeout(100); // Drain the existing final neutral invalidation.
  const draws = await page.evaluate(() => (window as any).__NTS_SMILE_PIXELS__.draws);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as any).__NTS_SMILE_PIXELS__.draws)).toBe(draws);
});
