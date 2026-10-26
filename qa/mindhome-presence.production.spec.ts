import { expect, test, type Page } from "@playwright/test";
import { FOUNDATIONAL_SESSION_KEY } from "../src/ui/foundationalOpeningModel";

const root = (page: Page) => page.locator(".mindhome-destination");
const presence = (page: Page) => page.locator(".mindhome-presence");
const phrase = (page: Page) => page.locator(".mindhome-phrase");
const choice = (page: Page, id: string) => page.locator(`[data-mindhome-condition="${id}"]`);
const opacity = (page: Page, selector: string) => page.locator(selector).evaluate(element => Number(getComputedStyle(element).opacity));

test.beforeEach(async ({ page }) => {
  await page.addInitScript(key => sessionStorage.setItem(key, "seen"), FOUNDATIONAL_SESSION_KEY);
});

async function enter(page: Page) {
  await page.goto("./");
  await page.getByRole("button", { name: "MindHome Story", exact: true }).click();
  await expect(root(page)).toHaveClass(/is-webgl/);
  await expect(presence(page)).toHaveAttribute("data-visible", "true");
}
async function shown(page: Page, condition: string) {
  await expect(root(page)).toHaveAttribute("data-displayed-condition", condition);
  await expect.poll(() => opacity(page, ".mindhome-presence")).toBeGreaterThan(.9);
  await expect.poll(() => opacity(page, ".mindhome-phrase")).toBe(1);
  const image = presence(page).locator("img:not([hidden])");
  await expect(image).toHaveAttribute("data-presence-condition", condition);
  await expect(image).toBeVisible();
  expect(await image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBe(941);
  expect(await image.evaluate(element => getComputedStyle(element).maskImage)).toContain("/msxai-story-world/mindhome/presence/");
  await expect(presence(page).locator("img")).toHaveCount(3);
}
async function capture(page: Page, file: string, outputPath: (file: string) => string) {
  await page.screenshot({ path: outputPath(file), fullPage: true });
}

test("production presence follows the real condition handoff, remains authored, and reuses its three images", async ({ page }, info) => {
  test.setTimeout(60000);
  const errors: string[] = [], sources = new Set<string>();
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("request", request => { if (/\/presence\/.*\.png/.test(request.url())) sources.add(request.url()); });
  await page.setViewportSize({ width: 1440, height: 900 }); await enter(page); await shown(page, "cool-air");
  await capture(page, "desktop-cool-air.png", info.outputPath.bind(info));
  for (const id of ["sun-shade", "rain-green", "cool-air"] as const) {
    await choice(page, id).click();
    await expect(root(page)).toHaveAttribute("data-transitioning", "true");
    await expect(presence(page)).toHaveAttribute("aria-hidden", "true");
    // Real rapid pointer activation cannot interrupt the bounded environment handoff.
    const other = (await choice(page, id === "cool-air" ? "rain-green" : "cool-air").boundingBox())!;
    await page.mouse.click(other.x + other.width / 2, other.y + other.height / 2);
    expect(await page.locator("[data-mindhome-condition]:disabled").count()).toBe(3);
    await expect.poll(() => opacity(page, ".mindhome-presence"), { intervals: [30] }).toBe(0);
    await expect(root(page)).toHaveAttribute("data-transitioning", "false");
    await expect(root(page)).toHaveAttribute("data-displayed-condition", id);
    // The place has settled; the incoming presence and sentence are still emerging.
    expect(await opacity(page, ".mindhome-phrase")).toBeLessThan(.8);
    await shown(page, id);
    await capture(page, `desktop-${id}.png`, info.outputPath.bind(info));
  }
  expect(sources.size).toBe(3); expect(errors).toEqual([]);
  await choice(page, "rain-green").click();
  await page.keyboard.press("Escape"); await expect(root(page)).toBeHidden();
  await page.getByRole("button", { name: "MindHome Story", exact: true }).click();
  await shown(page, "cool-air");
  await expect(presence(page)).toHaveAccessibleName(/Authored NuTuenSai.*Cool Air/);
  await choice(page, "sun-shade").click();
  await expect(root(page)).toHaveAttribute("data-transitioning", "false");
  // Leave after the image handoff while the incoming presence is still revealing.
  await root(page).locator('[data-mindhome="return"]').click(); await expect(root(page)).toBeHidden();
  await page.getByRole("button", { name: "MindHome Story", exact: true }).click(); await shown(page, "cool-air");
  await root(page).locator('[data-mindhome="return"]').click(); await expect(root(page)).toBeHidden();
});

test("responsive production composition keeps the place, presence, reflection and touch controls distinct in both locales", async ({ page }, info) => {
  test.setTimeout(60000); await page.emulateMedia({ reducedMotion: "reduce" });
  await enter(page);
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 375, height: 667 }, { width: 430, height: 932 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    for (const locale of ["en", "th"] as const) {
      await root(page).locator(`[data-mindhome-locale="${locale}"]`).click();
      for (const id of ["cool-air", "sun-shade", "rain-green"] as const) {
        await choice(page, id).click(); await shown(page, id);
        await expect(presence(page)).toHaveAccessibleName(locale === "en" ? /Authored NuTuenSai/ : /ภาพ NuTuenSai ที่จัดวางไว้/);
        const bounds = await root(page).evaluate(element => {
          const rect = (selector: string) => {
            const b = element.querySelector(selector)!.getBoundingClientRect();
            return { x: b.x, y: b.y, right: b.right, bottom: b.bottom, width: b.width, height: b.height };
          };
          return { stage: rect(".mindhome-photo-stage"), presence: rect(".mindhome-presence"), phrase: rect(".mindhome-phrase"), controls: rect(".mindhome-conditions"), overflow: document.documentElement.scrollWidth > innerWidth };
        });
        expect(bounds.overflow).toBe(false);
        expect(bounds.presence.right).toBeLessThan(bounds.stage.x + bounds.stage.width * .49);
        for (const region of [bounds.presence, bounds.phrase]) {
          const intersectsControls = region.x < bounds.controls.right && region.right > bounds.controls.x &&
            region.y < bounds.controls.bottom && region.bottom > bounds.controls.y;
          expect(intersectsControls, `${viewport.width}×${viewport.height} ${locale} ${id}: controls remain separate`).toBe(false);
        }
        expect(bounds.phrase.right).toBeLessThanOrEqual(viewport.width);
        expect(bounds.phrase.x).toBeGreaterThanOrEqual(0);
        if (viewport.width <= 700) {
          expect(bounds.phrase.y).toBeGreaterThan(bounds.stage.bottom);
          expect(bounds.phrase.x).toBeGreaterThan(bounds.presence.x + bounds.presence.width * .8);
        }
        for (const button of await root(page).locator("button").all()) {
          const box = (await button.boundingBox())!;
          expect(box.height).toBeGreaterThanOrEqual(44); expect(box.width).toBeGreaterThanOrEqual(44);
          expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
        }
        await capture(page, `${viewport.width}x${viewport.height}-${locale}-${id}.png`, info.outputPath.bind(info));
      }
    }
  }
  // Reduced Motion has no reveal delay and no autonomous pixel changes.
  // Story World's shared Reduced Motion rule uses a 0.01 ms duration so existing
  // transition-end consumers can still settle; this is an immediate reveal.
  expect(await presence(page).evaluate(element => parseFloat(getComputedStyle(element).transitionDuration))).toBeLessThanOrEqual(.001);
  expect(await presence(page).evaluate(element => parseFloat(getComputedStyle(element).transitionDelay))).toBe(0);
  const still = await page.screenshot(); await page.waitForTimeout(600);
  expect((await page.screenshot()).equals(still)).toBe(true);
  await choice(page, "sun-shade").focus(); await choice(page, "sun-shade").press("Enter"); await shown(page, "sun-shade");
  await page.keyboard.press("Escape"); await expect(root(page)).toBeHidden();
});

test("a missing presence asset leaves the real environment, reflection and Return usable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/presence/listening-mirror.png", route => route.abort());
  await enter(page); await shown(page, "cool-air");
  await choice(page, "sun-shade").click();
  await expect(root(page)).toHaveAttribute("data-displayed-condition", "sun-shade");
  await expect(presence(page)).toHaveAttribute("data-visible", "false");
  await expect(phrase(page)).toHaveText("What we see is not always the whole meaning.");
  await expect(phrase(page)).toHaveCSS("opacity", "1");
  await choice(page, "rain-green").click(); await shown(page, "rain-green");
  await root(page).locator('[data-mindhome="return"]').click(); await expect(root(page)).toBeHidden();
});
