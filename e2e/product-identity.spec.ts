import { expect, test, type Page } from "@playwright/test";
import { FOUNDATIONAL_SESSION_KEY } from "../src/ui/foundationalOpeningModel";

const products = ["mss", "mindhome", "mhb", "wave-glass-project-h"];
const inspect = (page: Page) => page.evaluate(() => window.__MSXAI_STORY_WORLD__!.inspect());
const node = (page: Page, id: string) => page.locator(`.ecosystem-labels [data-ecosystem-node="${id}"]`);
const evidence = (name: string) => `artifacts/product-identity-v0.1/${name}.png`;
async function settle(page: Page) {
  await expect.poll(async () => { const s = await inspect(page); return "renderLoopActive" in s && !s.renderLoopActive; }).toBe(true);
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => sessionStorage.setItem(key, "seen"), FOUNDATIONAL_SESSION_KEY);
});

test("four focused identities preserve the shared world and return to a calm overview", async ({ page }) => {
  const errors: string[] = [], external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("request", (request) => { if (!request.url().startsWith("http://127.0.0.1:")) external.push(request.url()); });
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto("/");
  await page.locator('.entry-card [data-action="living-ecosystem"]').click(); await settle(page);
  const before = await inspect(page);
  await page.screenshot({ path: evidence("A-default-ecosystem") });
  for (const [index, id] of products.entries()) {
    await node(page, id).click(); await settle(page);
    const detail = page.locator(".ecosystem-detail");
    await expect(detail).toHaveAttribute("data-product", id);
    await expect(detail.locator(".ecosystem-product-mark")).toBeVisible();
    expect(await detail.locator("img").evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await detail.locator("summary").click();
    await expect(detail.locator("dd")).toHaveCount(2);
    await expect(detail.locator(".ecosystem-product-principle")).toBeVisible();
    const after = await inspect(page);
    expect(after.storyState).toEqual(before.storyState);
    if ("cameraPosition" in before && "cameraPosition" in after) {
      expect(after.cameraPosition).toEqual(before.cameraPosition);
      expect(after.livingEcosystem.productIdentityId).toBe(id);
      expect(after.drawCalls).toBeLessThanOrEqual(before.drawCalls + 8);
    }
    await page.screenshot({ path: evidence(`${String.fromCharCode(66 + index)}-${id}`) });
  }
  await page.getByRole("button", { name: "View whole ecosystem", exact: true }).click(); await settle(page);
  await expect(page.locator(".ecosystem-detail")).toBeHidden();
  const restored = await inspect(page);
  if ("livingEcosystem" in restored) expect(restored.livingEcosystem.productIdentityId).toBeUndefined();
  for (const id of ["human", "intention", "msxai", "nutuensai", "lli"]) {
    await node(page, id).click();
    await expect(page.locator(".ecosystem-product-story")).toBeHidden();
    await expect(page.locator(".ecosystem-product-mark")).toBeHidden();
  }
  expect(errors).toEqual([]); expect(external).toEqual([]);
});

test("portrait EN/TH, reduced motion, and progressive reading keep the selected product in view", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ reducedMotion: "reduce" }); await page.goto("/");
  await page.locator('.entry-card [data-action="living-ecosystem"]').click(); await settle(page);
  for (const id of products) {
    await node(page, id).click(); await settle(page);
    const detail = page.locator(".ecosystem-detail");
    const box = (await detail.boundingBox())!, anchor = (await node(page, id).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(anchor.y + anchor.height).toBeLessThan(box.y);
    await detail.locator("summary").focus(); await page.keyboard.press("Enter");
    await expect(detail.locator("details")).toHaveAttribute("open", "");
    const before = await inspect(page);
    await page.getByRole("button", { name: "ภาษาไทย" }).click();
    expect((await inspect(page)).overviewState).toEqual(before.overviewState);
    await expect(detail.locator("summary")).toHaveText("บทบาทใน MSxAI");
    await expect(detail.locator("details")).toHaveAttribute("open", "");
    if (id === "mhb") await page.screenshot({ path: evidence("F-portrait-mhb-thai") });
    await page.getByRole("button", { name: "English" }).click();
  }
});

test("the same product explanations are available without WebGL", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/?forceNoWebgl=1");
  await page.locator('.story-list [data-action="living-ecosystem"]').click();
  for (const id of products) {
    await page.locator(`.ecosystem-list [data-ecosystem-node="${id}"]`).click();
    await expect(page.locator(".ecosystem-detail")).toHaveAttribute("data-product", id);
    await page.locator(".ecosystem-product-story summary").click();
    await expect(page.locator('[data-product-copy="role"]')).toBeVisible();
  }
  await expect(page.locator("canvas")).toHaveCount(0);
});
