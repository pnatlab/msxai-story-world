import { test, expect, type Page } from "@playwright/test";
import { FOUNDATIONAL_SESSION_KEY } from "../src/ui/foundationalOpeningModel";
import { MEMORIES } from "../src/nts/content";
const state = (page: Page) => page.evaluate(() => window.__MSXAI_STORY_WORLD__!.inspect());
async function settled(page: Page) {
  await expect.poll(async () => (await state(page)).ntsState.phase, {timeout:15000}).toBe("settled");
  await expect.poll(async () => { const s = await state(page); return "nts" in s && s.nts?.loaded; }).toBe(true);
  await expect.poll(async () => { const s = await state(page); return "renderLoopActive" in s && !s.renderLoopActive; }, {timeout:10000}).toBe(true);
}
test.beforeEach(async ({ page }) => { await page.addInitScript(key => sessionStorage.setItem(key, "seen"), FOUNDATIONAL_SESSION_KEY); });
test("one-click production destination preserves reviewed composition and returns to selected ecosystem", async ({ page }) => {
  test.setTimeout(60000);
  const errors: string[] = [], external: string[] = [], assetRequests: string[] = [];
  page.on("pageerror", e => errors.push(e.message)); page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  page.on("request", r => { if (!r.url().startsWith("http://127.0.0.1:")) external.push(r.url()); if (/\/nts\/(?:s[1-6](?:-preview)?\.jpg|presence-study\.(?:bin|json))$/.test(new URL(r.url()).pathname)) assetRequests.push(r.url()); });
  await page.setViewportSize({width:1440,height:900}); await page.goto("/");
  expect(assetRequests).toEqual([]);
  const before = (await state(page)).storyState;
  await page.locator('[data-nutuensai-entry="home"]').click(); await settled(page);
  await expect(page.locator('.nts-heading .nts-eyebrow')).toHaveText('NTS • STORY WORLD');
  await expect(page.locator('#nts-title')).toHaveText("NTS · A place to listen");
  await page.locator('.nts-meaning summary').click();
  await expect(page.locator('[data-nts="progression"]')).toHaveText('Thematic progression · not a historical timeline');
  await page.locator('[data-nts="th"]').click();
  await expect(page.locator('.nts-heading .nts-eyebrow')).toHaveText('NTS • STORY WORLD');
  await expect(page.locator('[data-nts="progression"]')).toHaveText('ลำดับเชิงธีม · ไม่ใช่เส้นเวลาประวัติศาสตร์');
  await expect(page.locator('.nts-view')).not.toContainText(/private prototype/i);
  await page.locator('[data-nts="en"]').click();
  await page.locator('.nts-meaning summary').click();
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.screenshot({path:"/private/tmp/nts-slice-b-evidence/01-overview.png"});
  await page.locator('[data-nts-memory="s1"]').click(); await page.waitForTimeout(1000);
  await page.screenshot({path:"/private/tmp/nts-slice-b-evidence/02-reading.png"});
  await page.locator('[data-nts="return"]').click();
  await expect.poll(async () => (await state(page)).ntsState.phase).toBe("closed");
  expect((await state(page)).overviewState).toMatchObject({open:true,selectedNodeId:"nutuensai"});
  expect((await state(page)).storyState).toEqual(before);
  await expect(page.locator('[data-ecosystem="visit-nts"]')).toBeFocused();
  const after = await state(page); expect("nts" in after && after.nts).toBeUndefined();
  await page.waitForTimeout(700); expect((await state(page)).ntsState.phase).toBe("closed");
  expect(errors).toEqual([]); expect(external).toEqual([]);
});

test("manual Visit/Return repeats without stale resources, preserves list context and remains opt-in", async ({page}) => {
  test.setTimeout(90000); await page.emulateMedia({reducedMotion:"reduce"}); await page.goto("/");
  await page.locator('.entry-card [data-action="living-ecosystem"]').click();
  await page.evaluate(() => window.__MSXAI_STORY_WORLD__!.selectNode("nutuensai"));
  const visit = page.locator('[data-ecosystem="visit-nts"]'); await expect(visit).toBeVisible();
  expect((await state(page)).ntsState.phase).toBe("closed"); expect((await state(page)).journeyState.visitRequests).toBe(0);
  await page.locator('[data-action="story-list"]').click();
  const before = await state(page); const afters = [];
  for (let i=0;i<3;i++) {
    await visit.focus(); await visit.press("Enter"); await settled(page);
    await page.locator('[data-nts-memory="s4"]').click();
    await expect.poll(async()=>{const r=await state(page);return "nts" in r && r.nts?.textureCount;}).toBe(1);
    await page.locator('[data-nts="inspect"]').click();
    await page.getByRole('slider').press('End'); expect((await state(page)).ntsState.inspection).toBe(90);
    await page.locator('[data-nts="return"]').click(); await expect.poll(async()=>(await state(page)).ntsState.phase).toBe("closed");
    await expect(visit).toBeFocused(); await expect(page.locator('.ecosystem-list')).toBeVisible();
    const after=await state(page); afters.push(after);
    expect(after.overviewState).toEqual(before.overviewState); expect(after.storyState).toEqual(before.storyState);
    expect(after.journeyState.visitRequests).toBe(0); expect("nts" in after && after.nts).toBeUndefined();
    if ("geometryCount" in after && "geometryCount" in before) { expect(after.geometryCount).toBe(before.geometryCount); expect(after.materialCount).toBe(before.materialCount); }
    await page.waitForTimeout(400); expect((await state(page)).ntsState.phase).toBe("closed");
  }
  console.log("NTS repeated Return resources",JSON.stringify(afters.map(r=>"gpu" in r?{gpu:r.gpu,geometries:r.geometryCount,materials:r.materialCount}:r)));
  await page.screenshot({path:"/private/tmp/nts-slice-b-evidence/03-return-manual.png"});
});

test("missing presence and image keep narrative, navigation and Return meaningful", async ({page}) => {
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.route('**/nts/presence-study.bin', route=>route.abort());
  await page.route('**/nts/s2.jpg', route=>route.abort());
  await page.goto("/"); await page.locator('[data-nutuensai-entry="home"]').click();
  await expect.poll(async()=>(await state(page)).ntsState.phase).toBe("settled");
  await expect(page.locator('.nts-status')).toContainText('Presence unavailable');
  await page.locator('[data-nts-memory="s2"]').click();
  await expect(page.locator('.nts-caption .nts-authored')).toHaveText(MEMORIES[1].en);
  await page.locator('[data-nts-memory="s6"]').click();
  await expect(page.locator('.nts-closing')).toContainText('The path stays open.');
  await page.locator('[data-nts="return"]').click(); await expect.poll(async()=>(await state(page)).ntsState.phase).toBe("closed");
  expect((await state(page)).overviewState.selectedNodeId).toBe("nutuensai");
});

test("Escape during NTS approach consumes only the destination and returns without replay", async ({page}) => {
  await page.goto("/"); await page.locator('[data-nutuensai-entry="home"]').click();
  await expect.poll(async()=>(await state(page)).ntsState.phase,{intervals:[25]}).toBe("approaching");
  await page.keyboard.press("Escape"); await expect.poll(async()=>(await state(page)).ntsState.phase).toBe("closed");
  expect((await state(page)).overviewState).toMatchObject({open:true,selectedNodeId:"nutuensai"});
  await page.waitForTimeout(1700); expect((await state(page)).ntsState.phase).toBe("closed");
  expect((await state(page)).journeyState.visitRequests).toBe(1);
});
