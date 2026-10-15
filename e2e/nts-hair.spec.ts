import { test, expect, type Page } from "@playwright/test";
import { FOUNDATIONAL_SESSION_KEY } from "../src/ui/foundationalOpeningModel";

const snapshot = (page: Page) => page.evaluate(() => window.__MSXAI_STORY_WORLD__!.inspect());
async function settled(page: Page) {
  await expect.poll(async () => (await snapshot(page)).ntsState.phase).toBe("settled");
  await expect.poll(async () => { const s = await snapshot(page); return "nts" in s && s.nts?.loaded; }).toBe(true);
  await expect.poll(async () => { const s = await snapshot(page); return "renderLoopActive" in s && s.renderLoopActive; }).toBe(false);
}
function spatial(s: Awaited<ReturnType<typeof snapshot>>) {
  if (!("cameraPosition" in s) || !s.nts) throw Error("Expected loaded NTS");
  return { ...s, nts: s.nts };
}
function resources(s: Awaited<ReturnType<typeof snapshot>>) {
  const r = spatial(s);
  return { meshes: r.nts.presenceMeshCount, triangles: r.nts.presenceTriangles,
    geometries: r.geometryCount, materials: r.materialCount, gpu: r.gpu };
}

test("canonical Soft Bun survives color, camera and Visit/Return lifecycles", async ({ page }) => {
  test.setTimeout(60000);
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await page.addInitScript(key => sessionStorage.setItem(key, "seen"), FOUNDATIONAL_SESSION_KEY);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/"); await page.locator('[data-nutuensai-entry="home"]').click(); await settled(page);
  const canonical = resources(await snapshot(page));
  expect(canonical).toMatchObject({ meshes: 28, triangles: 108296 });
  const returned: object[] = [];
  for (let visit = 0; visit < 3; visit++) {
    expect((await snapshot(page)).ntsState).toMatchObject({ outfit: "blue", mask: "lavender", inspection: false, markInspection: false });
    expect(resources(await snapshot(page))).toEqual(canonical);
    await page.locator('[data-nts="inspect"]').click();
    for (const angle of [-90, -45, 45, 90]) { await page.getByRole("slider").fill(String(angle)); await settled(page); }
    await page.locator(".nts-appearance summary").click();
    await page.locator('[data-nts-outfit="black"]').click(); await page.locator('[data-nts-mask="white"]').click();
    await page.keyboard.press("Escape"); await settled(page);
    const before = spatial(await snapshot(page));
    await page.locator('[data-nts="inspect-mark"]').click(); await settled(page);
    expect((await snapshot(page)).ntsState.markInspection).toBe(true);
    expect(spatial(await snapshot(page)).nts.composition.mark?.visible).toBe(true);
    await page.keyboard.press("Escape"); await settled(page);
    const after = spatial(await snapshot(page));
    expect(after.cameraPosition).toEqual(before.cameraPosition); expect(after.cameraTarget).toEqual(before.cameraTarget);
    expect(after.ntsState).toMatchObject({ inspection: 90, outfit: "black", mask: "white", markInspection: false });
    expect(resources(after)).toEqual(resources(before));
    await page.locator('[data-nts="return"]').click();
    await expect.poll(async () => (await snapshot(page)).ntsState.phase).toBe("closed");
    const closed = await snapshot(page);
    if (!("gpu" in closed)) throw Error("Expected renderer after Return");
    expect(closed.nts).toBeUndefined(); expect(closed.overviewState.selectedNodeId).toBe("nutuensai");
    returned.push({ geometry: closed.geometryCount, materials: closed.materialCount, gpu: closed.gpu });
    if (visit < 2) { await page.locator('[data-ecosystem="visit-nts"]').click(); await settled(page); }
  }
  expect(returned[1]).toEqual(returned[0]); expect(returned[2]).toEqual(returned[0]);
  console.log("Canonical Soft Bun resources", JSON.stringify({ canonical, returned }));
  expect(errors).toEqual([]);
});
