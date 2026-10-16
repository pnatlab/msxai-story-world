import { test, expect, type Page } from "@playwright/test";
import { FOUNDATIONAL_SESSION_KEY } from "../src/ui/foundationalOpeningModel";

async function observe(page: Page): Promise<void> {
  await page.addInitScript(key => sessionStorage.setItem(key, "seen"), FOUNDATIONAL_SESSION_KEY);
  const modules: string[] = [];
  page.on("request", r => { if (/\/(?:src\/nts\/NtsPresentation\.ts|assets\/NtsPresentation-[^/]+\.js)(?:\?|$)/.test(r.url())) modules.push(r.url()); });
  await page.goto("./"); await page.locator('[data-nutuensai-entry="home"]').click();
  await expect(page.locator('[data-nts="smile"]')).toHaveAttribute("aria-disabled", "false", { timeout: 20000 });
  await page.evaluate(async url => {
    const { NtsPresentation } = await import(url), frame = NtsPresentation.prototype.frame;
    const q: { history: any[]; armed: boolean; presentation?: any; last?: any }
      = (window as any).__NTS_TILT_QA__ = { history: [], armed: false };
    NtsPresentation.prototype.frame = function (this: any, now: number) {
      const result = frame.call(this, now); q.presentation = this; q.last = this.expression?.inspection;
      if (q.armed) { q.history.push({ time: now, ...q.last }); if (q.history.length > 300) q.history.shift(); }
      return result;
    };
  }, modules.at(-1)!);
  // Real material action supplies the first observed render, not a test animation API.
  await page.locator(".nts-appearance summary").click(); await page.locator('[data-nts-outfit="black"]').click();
  await page.locator('[data-nts-mask="white"]').click(); await page.keyboard.press("Escape"); await settle(page);
}
const state = (page: Page) => page.evaluate(() => (window as any).__NTS_TILT_QA__.last);
async function settle(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const p = (window as any).__NTS_TILT_QA__?.presentation;
    return Boolean(p && !p.needsMotion && !p.director.isTransitioning);
  }), { intervals: [30], timeout: 15000 }).toBe(true);
}
const snapshot = (page: Page) => page.evaluate(() => {
  const p = (window as any).__NTS_TILT_QA__.presentation;
  const pose = (m: any) => ({ position: m.position.toArray(), quaternion: m.quaternion.toArray(), scale: m.scale.toArray() });
  return { camera: { position: p.director.camera.position.toArray(), target: p.director.target.toArray(), fov: p.director.camera.fov },
    parent: pose(p.presence), poses: Object.fromEntries(p.presence.children.map((m: any) => [m.name, pose(m)])),
    body: p.presence.children.filter((m: any) => ["NTS_2J_Neck_Continuous", "NTS_2J_Outfit_Continuous_Knit"].includes(m.name)).map(pose),
    colors: p.inspection.presentationColors, resources: { meshes: p.inspection.presenceMeshCount, triangles: p.inspection.presenceTriangles,
      geometries: p.geometries.size, materials: p.materials.size, textures: p.textures.size } };
});
async function peak(page: Page) {
  await expect.poll(() => state(page), { intervals: [20] }).toMatchObject({ kind: "smile", smile: 1, tiltDegrees: -3 });
}
async function neutral(page: Page) {
  await expect.poll(() => state(page), { intervals: [25] }).toMatchObject({ animating: false, neutralExact: true, headNeutralExact: true, tiltDegrees: 0 });
}

test("one real Gentle Smile leads with head-only tilt and restores normal/rotated orientation exactly", async ({ page }, info) => {
  test.setTimeout(60000); await observe(page);
  for (const view of ["normal", "rotated", "repeat"] as const) {
    if (view === "rotated") { await page.locator('[data-nts="inspect"]').click(); await page.getByRole("slider").fill("45"); await settle(page); }
    const before = await snapshot(page);
    await page.evaluate(() => { const q = (window as any).__NTS_TILT_QA__; q.history = []; q.armed = true; });
    await page.locator('[data-nts="smile"]').click(); await peak(page);
    const during = await snapshot(page);
    expect(during.camera).toEqual(before.camera); expect(during.parent).toEqual(before.parent);
    expect(during.body).toEqual(before.body); expect(during.colors).toEqual(before.colors); expect(during.resources).toEqual(before.resources);
    expect(during.poses.NTS_2C_Head_OriginalStylized).not.toEqual(before.poses.NTS_2C_Head_OriginalStylized);
    if (view !== "repeat") await page.screenshot({ path: info.outputPath(`${view}-tilt-peak.png`) });
    // Native repeated activations are ignored rather than adding roll offsets.
    if (view === "repeat") await page.mouse.click(...await page.locator('[data-nts="smile"]').evaluate(button => {
      const r = button.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2] as [number, number];
    }));
    await neutral(page); await settle(page);
    expect(await snapshot(page)).toEqual(before);
    if (view !== "normal") await expect(page.getByRole("slider")).toHaveValue("45");
    const phases = await page.evaluate(() => {
      const h = (window as any).__NTS_TILT_QA__.history.filter((s: any) => s.kind === "smile");
      const eyes = h.filter((s: any) => s.smile > 0), first = eyes[0].time, last = eyes.at(-1).time;
      return { lead: h.some((s: any) => s.time < first && s.smile === 0 && Math.abs(s.tiltDegrees) > 0),
        tail: h.some((s: any) => s.time > last && s.smile === 0 && Math.abs(s.tiltDegrees) > 0),
        max: Math.max(...h.map((s: any) => Math.abs(s.tiltDegrees))), blink: h.some((s: any) => s.blink !== 0) };
    });
    expect(phases).toEqual({ lead: true, tail: true, max: 3, blink: false });
  }
});

test("inspection, yaw, Mark, Return and reduced motion cancel tilt without corrupting camera or fresh visits", async ({ page }) => {
  test.setTimeout(90000); await observe(page);
  const base = await snapshot(page);
  await page.locator('[data-nts="smile"]').click(); await peak(page);
  await page.locator('[data-nts="inspect"]').click(); await settle(page); await neutral(page);
  expect((await snapshot(page)).poses).toEqual(base.poses);
  await page.getByRole("slider").fill("45"); await settle(page); const rotated = await snapshot(page);
  await page.locator('[data-nts="smile"]').click(); await peak(page);
  await page.locator('[data-nts="inspect-mark"]').click(); await settle(page); await neutral(page);
  expect((await snapshot(page)).poses).toEqual(base.poses);
  await page.keyboard.press("Escape"); await settle(page);
  expect(await snapshot(page)).toEqual(rotated); await expect(page.getByRole("slider")).toHaveValue("45");
  await page.locator('[data-nts="smile"]').click(); await peak(page);
  await page.getByRole("slider").fill("-45"); await settle(page); await neutral(page);
  expect((await snapshot(page)).poses).toEqual(base.poses); await expect(page.getByRole("slider")).toHaveValue("-45");
  await page.locator('[data-nts="smile"]').click(); await peak(page);
  await page.emulateMedia({ reducedMotion: "reduce" }); await settle(page); await neutral(page);
  await expect(page.locator('[data-nts="smile"]')).toBeDisabled();
  await page.waitForTimeout(400); expect((await snapshot(page)).poses).toEqual(base.poses);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.locator('[data-nts="smile"]').click(); await peak(page);
  await page.locator('[data-nts="return"]').click(); await expect(page.locator(".nts-view")).toBeHidden();
  expect((await snapshot(page)).poses).toEqual(base.poses);
  await page.locator('[data-ecosystem="visit-nts"]').click();
  await expect(page.locator('[data-nts="smile"]')).toHaveAttribute("aria-disabled", "false", { timeout: 15000 });
  await settle(page); await neutral(page);
  const fresh = await snapshot(page); expect(fresh.resources).toEqual(base.resources); expect(fresh.poses).toEqual(base.poses);
  expect(fresh.colors).toEqual({ outfit: "8ea7ad", mask: "c9c3d8" });
});
