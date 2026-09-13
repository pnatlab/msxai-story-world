import { expect, test, type Page } from "@playwright/test";
import { FOUNDATIONAL_ATTRIBUTION, FOUNDATIONAL_QUOTE, FOUNDATIONAL_SESSION_KEY } from "../src/ui/foundationalOpeningModel";

const inspect = (page: Page) => page.evaluate(() => window.__MSXAI_STORY_WORLD__!.inspect());
const evidence = (name: string) => `artifacts/foundational-opening-v0.1/${name}.png`;
async function frozenClock(page: Page) {
  const time = new Date("2026-01-01T00:00:00Z");
  await page.clock.install({ time });
  await page.clock.pauseAt(time);
}
async function cleanHandoff(page: Page) {
  await expect(page.getByTestId("foundational-opening")).toHaveCount(0);
  await expect(page.locator(".story-overlay")).not.toHaveAttribute("inert");
  await expect(page.locator(".story-overlay")).not.toHaveClass(/is-opening-covered/);
  expect(await page.locator(".story-overlay").evaluate((element) => (element as HTMLElement).style.getPropertyValue("--opening-ui-opacity"))).toBe("");
}

test("the timed prelude forms the exact quote, distills into MSxAI, and leaves the canonical opening unchanged", async ({ page }) => {
  const errors: string[] = []; const external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("request", (request) => { if (!request.url().startsWith("http://127.0.0.1:")) external.push(request.url()); });
  await page.setViewportSize({ width: 1440, height: 900 });
  await frozenClock(page); await page.goto("/");
  const opening = page.getByTestId("foundational-opening");
  const before = await inspect(page);
  await expect(opening).toHaveAttribute("data-phase", "white");
  await expect(page.locator(".story-overlay")).toHaveAttribute("inert", "");
  await expect(page.locator(".foundational-opening__accessible blockquote")).toHaveText(FOUNDATIONAL_QUOTE);
  await expect(page.locator(".foundational-opening__quote blockquote")).toHaveText(FOUNDATIONAL_QUOTE);
  await page.clock.runFor(100);
  await page.screenshot({ path: evidence("A-white-desktop") });
  await page.clock.runFor(750);
  await expect(opening).toHaveAttribute("data-phase", "language");
  await page.screenshot({ path: evidence("B-language-desktop") });
  await page.clock.runFor(1700);
  await expect(opening).toHaveAttribute("data-phase", "quote");
  await expect(page.locator(".foundational-opening__quote figcaption")).toHaveText(FOUNDATIONAL_ATTRIBUTION);
  expect(await page.locator(".foundational-opening__quote figcaption").evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  await page.screenshot({ path: evidence("C-quote-desktop") });
  await page.clock.runFor(1600);
  await expect(opening).toHaveAttribute("data-phase", "distillation");
  await page.screenshot({ path: evidence("D-distillation-desktop") });
  await page.clock.runFor(900);
  await expect(opening).toHaveAttribute("data-phase", "identity");
  await expect(page.locator(".foundational-opening__identity")).toHaveText("MSxAI");
  await page.screenshot({ path: evidence("E-identity-field-desktop") });
  await page.clock.runFor(1050);
  await cleanHandoff(page);
  await expect(page.getByRole("button", { name: "Begin the Story", exact: true })).toBeFocused();
  await page.screenshot({ path: evidence("F-handoff-desktop") });
  const after = await inspect(page);
  expect(after.storyState).toEqual(before.storyState);
  expect(after.overviewState).toEqual(before.overviewState);
  if ("cameraPosition" in before && "cameraPosition" in after) {
    expect(after.cameraPosition).toEqual(before.cameraPosition);
    expect(after.geometryCount).toBe(before.geometryCount);
    expect(after.materialCount).toBe(before.materialCount);
    expect(after.renderLoopActive).toBe(false);
  }
  await expect(page.locator("canvas.story-canvas")).toHaveCount(1);
  await expect(page.locator('[data-action="sound"]')).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate((key) => sessionStorage.getItem(key), FOUNDATIONAL_SESSION_KEY)).toBe("seen");
  await page.reload(); await expect(opening).toHaveCount(0);
  await page.getByRole("button", { name: "Begin the Story", exact: true }).click();
  expect((await inspect(page)).storyState.beatIndex).toBe(1);
  expect(errors).toEqual([]); expect(external).toEqual([]);
});

test("portrait supports unhurried reading, keyboard skip, session return and the English source in Thai UI", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await frozenClock(page); await page.goto("/");
  const before = await inspect(page);
  await page.getByRole("button", { name: "Pause to read" }).click();
  await expect(page.getByTestId("foundational-opening")).toHaveAttribute("data-paused", "true");
  await page.clock.runFor(10000);
  await expect(page.getByTestId("foundational-opening")).toHaveAttribute("data-phase", "quote");
  const quote = (await page.locator(".foundational-opening__quote").boundingBox())!;
  const controls = (await page.locator(".foundational-opening__controls").boundingBox())!;
  expect(quote.x).toBeGreaterThan(20); expect(quote.x + quote.width).toBeLessThan(370);
  expect(quote.y).toBeGreaterThan(40); expect(quote.y + quote.height).toBeLessThan(controls.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({ path: evidence("G-quote-mobile") });
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Skip opening" })).toBeFocused();
  await page.keyboard.press("Enter"); await cleanHandoff(page);
  expect((await inspect(page)).storyState).toEqual(before.storyState);
  expect((await inspect(page)).overviewState).toEqual(before.overviewState);
  await page.clock.runFor(2000);
  await page.screenshot({ path: evidence("H-handoff-mobile") });
  await page.getByRole("button", { name: "ภาษาไทย" }).click();
  await page.getByRole("button", { name: "เกี่ยวกับ / ความหมาย" }).click();
  await page.locator(".foundational-note summary").click();
  await expect(page.locator(".foundational-note blockquote")).toHaveText(FOUNDATIONAL_QUOTE);
  await expect(page.locator(".foundational-note figure")).toHaveAttribute("lang", "en");
  await page.keyboard.press("Escape");
  await page.locator('.entry-card [data-action="living-ecosystem"]').click();
  expect((await inspect(page)).overviewState.open).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("foundational-opening")).toHaveCount(0);
  await page.reload(); await expect(page.getByTestId("foundational-opening")).toHaveCount(0);
});

test("paused reading resumes through a clean handoff without changing either world state", async ({ page }) => {
  await frozenClock(page); await page.goto("/");
  const before = await inspect(page);
  await page.getByRole("button", { name: "Pause to read" }).click();
  await page.clock.runFor(10000);
  await expect(page.getByTestId("foundational-opening")).toHaveAttribute("data-paused", "true");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.clock.runFor(4000);
  await cleanHandoff(page);
  await expect(page.getByRole("button", { name: "Begin the Story", exact: true })).toBeFocused();
  const after = await inspect(page);
  expect(after.storyState).toEqual(before.storyState);
  expect(after.overviewState).toEqual(before.overviewState);
});

test("reduced motion is static, abbreviated, and works without WebGL", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await frozenClock(page); await page.goto("/?forceNoWebgl=1");
  await expect(page.getByTestId("foundational-opening")).toHaveAttribute("data-phase", "quote");
  expect(await page.locator(".foundational-opening__quote span").evaluateAll((spans) => spans.map((el) => getComputedStyle(el).opacity))).toEqual(["1", "1", "1", "1", "1", "1"]);
  await page.screenshot({ path: evidence("I-reduced-motion-mobile") });
  await page.clock.runFor(1900);
  await expect(page.getByTestId("foundational-opening")).toHaveAttribute("data-phase", "identity");
  await page.clock.runFor(250); await cleanHandoff(page);
  await expect(page.getByTestId("story-list")).toBeVisible();
  await expect(page.locator("canvas.story-canvas")).toHaveCount(0);
  await page.locator('.story-list [data-action="living-ecosystem"]').click();
  await expect(page.locator(".ecosystem-list__nodes button")).toHaveCount(14);
});

test("Escape skips even with storage denied; teardown removes the prelude and its lock", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, "sessionStorage", { get() { throw new DOMException("denied", "SecurityError"); } }); });
  await frozenClock(page); await page.goto("/");
  await page.keyboard.press("Escape"); await cleanHandoff(page);
  await page.getByRole("button", { name: "Explore Freely", exact: true }).click();
  expect((await inspect(page)).storyState.mode).toBe("free");
  await page.reload(); // Storage denial can only remember within one loaded page.
  await expect(page.getByTestId("foundational-opening")).toBeVisible();
  await page.evaluate(() => window.__MSXAI_STORY_WORLD__!.destroy());
  await page.clock.runFor(10000); await cleanHandoff(page);
  await expect(page.locator("canvas.story-canvas")).toHaveCount(0);
});
