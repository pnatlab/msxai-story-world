import { expect, test, type Page } from "@playwright/test";
import { FOUNDATIONAL_QUOTE, FOUNDATIONAL_SESSION_KEY } from "../src/ui/foundationalOpeningModel";

const inspect = (page: Page) => page.evaluate(() => window.__MSXAI_STORY_WORLD__!.inspect());

async function returningVisit(page: Page) {
  await page.addInitScript((key) => sessionStorage.setItem(key, "seen"), FOUNDATIONAL_SESSION_KEY);
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.goto("/");
  await expect(page.getByTestId("foundational-opening")).toHaveCount(0);
}

async function replayFromAbout(page: Page, aboutLabel = "About / Meaning", replayLabel = "Replay Opening") {
  await page.getByRole("button", { name: aboutLabel }).click();
  const note = page.locator(".foundational-note");
  if (!(await note.evaluate((element) => (element as HTMLDetailsElement).open))) await note.locator("summary").click();
  const trigger = page.getByRole("button", { name: replayLabel });
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.getByTestId("foundational-opening")).toBeVisible();
  await expect(page.locator(".story-overlay")).toHaveAttribute("inert", "");
  await expect(page.locator(".about-dialog")).toBeHidden();
  return trigger;
}

async function expectReturned(page: Page, trigger: ReturnType<Page["getByRole"]>) {
  await expect(page.getByTestId("foundational-opening")).toHaveCount(0);
  await expect(page.locator(".story-overlay")).not.toHaveAttribute("inert");
  await expect(page.locator(".story-overlay")).not.toHaveClass(/is-opening-covered/);
  await expect(page.locator(".story-overlay")).not.toHaveCSS("opacity", "0");
  await expect(page.locator(".about-dialog")).toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(page.locator(".foundational-opening__accessible blockquote")).toHaveCount(0);
  expect(await page.evaluate((key) => sessionStorage.getItem(key), FOUNDATIONAL_SESSION_KEY)).toBe("seen");
}

test("replay from the entry view completes in place and keeps the session seen", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await returningVisit(page);
  await expect(page.locator('[data-action="sound"]')).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Turn interaction sound on" }).click();
  await expect(page.locator('[data-action="sound"]')).toHaveAttribute("aria-pressed", "true");
  const trigger = await replayFromAbout(page);
  const before = await inspect(page);
  await expect(page.getByTestId("foundational-opening")).toHaveAttribute("data-phase", "white");
  await expect(page.locator(".foundational-opening__accessible blockquote")).toHaveText(FOUNDATIONAL_QUOTE);
  await page.clock.runFor(6200);
  await expectReturned(page, trigger);
  const after = await inspect(page);
  expect(after.storyState).toEqual(before.storyState);
  expect(after.overviewState).toEqual(before.overviewState);
  await expect(page.locator('[data-action="sound"]')).toHaveAttribute("aria-pressed", "true");
  if ("cameraPosition" in before && "cameraPosition" in after) expect(after.cameraPosition).toEqual(before.cameraPosition);
  await page.reload();
  await expect(page.getByTestId("foundational-opening")).toHaveCount(0);
});

test("guided and free states survive Skip and Escape, including repeated replay", async ({ page }) => {
  await returningVisit(page);
  await page.getByRole("button", { name: "Begin the Story", exact: true }).click();
  await page.locator('.story-controls [data-action="next"]').click();
  let trigger = await replayFromAbout(page);
  let before = await inspect(page);
  await page.getByRole("button", { name: "Skip opening" }).click();
  await expectReturned(page, trigger);
  expect((await inspect(page)).storyState).toEqual(before.storyState);
  await page.getByRole("button", { name: "Close About" }).click();
  await page.locator('.story-controls [data-action="explore"]').click();
  await page.evaluate(() => window.__MSXAI_STORY_WORLD__!.selectNode("mhb"));
  trigger = await replayFromAbout(page);
  before = await inspect(page);
  await page.keyboard.press("Escape");
  await expectReturned(page, trigger);
  const after = await inspect(page);
  expect(after.storyState).toEqual(before.storyState);
  expect(after.overviewState).toEqual(before.overviewState);
  await expect(page.getByTestId("foundational-opening")).toHaveCount(0);
});

test("Living Ecosystem selection and camera return after replay", async ({ page }) => {
  await returningVisit(page);
  await page.locator('.entry-card [data-action="living-ecosystem"]').click();
  await page.evaluate(() => window.__MSXAI_STORY_WORLD__!.selectNode("mss"));
  await page.clock.runFor(5000);
  await expect.poll(async () => {
    const state = await inspect(page);
    return "renderLoopActive" in state && !state.renderLoopActive;
  }).toBe(true);
  const trigger = await replayFromAbout(page);
  const before = await inspect(page);
  await page.getByRole("button", { name: "Skip opening" }).click();
  await expectReturned(page, trigger);
  const after = await inspect(page);
  expect(after.storyState).toEqual(before.storyState);
  expect(after.overviewState).toEqual(before.overviewState);
  if ("cameraPosition" in before && "cameraPosition" in after) expect(after.cameraPosition).toEqual(before.cameraPosition);
});

test("portrait Thai replay uses canonical reduced motion and survives denied storage", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => { Object.defineProperty(window, "sessionStorage", { get() { throw new DOMException("denied", "SecurityError"); } }); });
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.goto("/");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "ภาษาไทย" }).click();
  await page.getByRole("button", { name: "เกี่ยวกับ / ความหมาย" }).click();
  await page.locator(".foundational-note summary").click();
  const trigger = page.getByRole("button", { name: "ดูช่วงเปิดอีกครั้ง" });
  await expect(trigger).toBeVisible();
  const bounds = (await trigger.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
  await page.screenshot({ path: "artifacts/foundational-opening-v0.1.1/replay-about-mobile.png" });
  await trigger.click();
  const before = await inspect(page);
  await expect(page.getByTestId("foundational-opening")).toHaveAttribute("data-phase", "quote");
  await expect(page.locator(".foundational-opening__accessible blockquote")).toHaveText(FOUNDATIONAL_QUOTE);
  await page.clock.runFor(2200);
  await expect(page.getByTestId("foundational-opening")).toHaveCount(0);
  await expect(page.locator(".about-dialog")).toBeVisible();
  await expect(trigger).toBeFocused();
  expect(await page.locator("html").getAttribute("lang")).toBe("th");
  expect((await inspect(page)).storyState).toEqual(before.storyState);
  expect((await inspect(page)).overviewState).toEqual(before.overviewState);
});
