import { expect, test, type Page } from "@playwright/test";
import { FOUNDATIONAL_SESSION_KEY } from "../src/ui/foundationalOpeningModel";

const story = (page: Page) => page.locator(".mss-destination");
const orb = (page: Page) => story(page).locator("[data-mss-orb]");
const dialog = (page: Page) => story(page).locator("dialog.mss-workspace");
const close = (page: Page) => dialog(page).locator("[data-mss-close-workspace]");
const returnFromPreview = (page: Page) => dialog(page).locator("[data-mss-return-workspace]");

async function enter(page: Page): Promise<void> {
  await page.addInitScript(key => sessionStorage.setItem(key, "seen"), FOUNDATIONAL_SESSION_KEY);
  await page.goto("./");
  await page.locator('.entry-card [data-action="living-ecosystem"]').click();
  await page.locator('.ecosystem-labels [data-ecosystem-node="mss"]').click();
  await page.getByRole("button", { name: "Visit MSS Story" }).click();
  await expect(story(page)).toHaveAttribute("data-renderer", "webgl");
}

test("record the production orb invitation, welcome preview, and return at the same frame", async ({ page, baseURL }, info) => {
  const attempts: string[] = [];
  const errors: string[] = [];
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.origin !== new URL(baseURL!).origin || ["xhr", "fetch", "websocket"].includes(request.resourceType())) attempts.push(url.href);
  });
  page.on("websocket", socket => { attempts.push(socket.url()); });
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await enter(page);
  await expect(dialog(page)).toBeHidden();
  await expect(story(page)).toHaveAttribute("data-workspace", "idle");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: info.outputPath("01-orb-idle.png") });

  await story(page).locator("[data-mss-phase='2']").click();
  await expect(story(page)).toHaveAttribute("data-phase", "2");
  await page.mouse.move(10, 140);
  await story(page).locator('[data-mss="return"]').focus();
  await page.keyboard.press("Tab");
  await expect(orb(page)).toBeFocused();
  expect(await orb(page).evaluate(element => element.matches(":focus-visible"))).toBe(true);
  await page.screenshot({ path: info.outputPath("02-orb-focus.png") });

  const scroller = story(page).locator(".mss-scroll");
  const scrollTop = await scroller.evaluate(element => element.scrollTop);
  // Sample a genuine production frame without relying on screenshot latency.
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T00:00:01Z"));
  await orb(page).press("Enter");
  await expect(story(page)).toHaveAttribute("data-workspace", "revealing");
  await page.clock.runFor(330);
  await page.screenshot({ path: info.outputPath("03-reveal.png") });
  await expect(story(page)).toHaveAttribute("data-workspace", "revealing");
  await page.clock.resume();
  await expect(dialog(page)).toBeVisible();
  await expect(close(page)).toBeFocused();
  await expect(dialog(page).getByText("Human–AI Workspace by MSxAI")).toBeVisible();
  await expect(dialog(page).getByRole("textbox")).toBeDisabled();
  await page.screenshot({ path: info.outputPath("04-workspace-desktop.png") });

  await close(page).click();
  await expect(orb(page)).toBeFocused();
  await expect(dialog(page)).toBeHidden();
  expect(await scroller.evaluate(element => element.scrollTop)).toBe(scrollTop);
  await page.screenshot({ path: info.outputPath("06-dismiss-return-to-story.png") });
  await expect(story(page)).toHaveAttribute("data-phase", "2");
  expect(attempts).toEqual([]);
  expect(errors).toEqual([]);
});

test("production preview stays readable on portrait and landscape with pinned exits", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enter(page);
  const viewports = [[1440, 900], [1280, 800], [390, 844], [375, 667], [430, 932], [844, 390]];
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    const locale = width === 375 ? "th" : "en";
    await story(page).locator(`[data-mss-locale="${locale}"]`).click();
    await orb(page).click();
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page)).toHaveAttribute("lang", locale);
    await expect(close(page)).toBeInViewport({ ratio: 1 });
    await expect(returnFromPreview(page)).toBeInViewport({ ratio: 1 });
    await expect(dialog(page).getByRole("textbox")).toBeDisabled();
    expect(await dialog(page).locator(".mss-workspace-body").evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`05-workspace-${width}x${height}-${locale}.png`) });
    if (width === 844) {
      await returnFromPreview(page).click();
      await expect(story(page)).toBeHidden();
      await expect(page.getByRole("button", { name: "Visit MSS Story" })).toBeFocused();
    } else await close(page).click();
  }
});
