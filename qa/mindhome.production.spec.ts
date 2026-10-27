import { expect, test, type Page } from "@playwright/test";
import { FOUNDATIONAL_SESSION_KEY } from "../src/ui/foundationalOpeningModel";

type Condition = "cool-air" | "sun-shade" | "rain-green";
const root = (page: Page) => page.locator(".mindhome-destination");
const choice = (page: Page, id: Condition) => root(page).locator(`[data-mindhome-condition="${id}"]`);
const visit = (page: Page) => page.locator('[data-ecosystem="visit-mindhome"]');
const phrase = (page: Page) => root(page).locator(".mindhome-phrase");
// The DOM image is hidden once WebGL is ready. Clip the actual photographic
// canvas output so focus rings, labels and other page UI cannot prove an effect.
const photoPixels = (page: Page) => root(page).locator(".mindhome-photo-stage").screenshot();
const phrases = {
  en: { "cool-air": "There can be space before a response.", "sun-shade": "What we see is not always the whole meaning.", "rain-green": "The next choice remains yours." },
  th: { "cool-air": "ก่อนตอบสนอง ยังมีพื้นที่ให้หยุด", "sun-shade": "สิ่งที่เห็น อาจยังไม่ใช่ความหมายทั้งหมด", "rain-green": "การเลือกก้าวต่อไปยังเป็นของคุณ" },
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(key => sessionStorage.setItem(key, "seen"), FOUNDATIONAL_SESSION_KEY);
});

function errors(page: Page) {
  const failures: string[] = [];
  page.on("pageerror", error => failures.push(`page: ${error.message}`));
  page.on("console", message => { if (message.type() === "error") failures.push(`console: ${message.text()}`); });
  page.on("response", response => { if (response.status() >= 400) failures.push(`HTTP ${response.status()}: ${response.url()}`); });
  return failures;
}

async function enter(page: Page): Promise<void> {
  await page.goto("./");
  await expect(page.getByTestId("entry-card")).toBeVisible();
  await expect(page.locator("canvas.story-canvas")).toBeVisible();
  await page.locator('.entry-card [data-action="living-ecosystem"]').click();
  await page.locator('.ecosystem-labels [data-ecosystem-node="mindhome"]').click();
  await expect(visit(page)).toHaveAccessibleName("Visit MindHome");
  const entryTarget = (await visit(page).boundingBox())!;
  console.log("MindHome production Visit target", JSON.stringify({ viewport: page.viewportSize(), width: entryTarget.width, height: entryTarget.height }));
  expect(entryTarget.width, "Visit MindHome touch target width").toBeGreaterThanOrEqual(44);
  expect(entryTarget.height, "Visit MindHome touch target height").toBeGreaterThanOrEqual(44);
  await visit(page).click();
  await expect(root(page)).toBeVisible();
  await expect(root(page)).toHaveClass(/is-webgl/);
  await expect(root(page).locator(".mindhome-photo-stage")).toHaveAttribute("role", "group");
  await expect(root(page).locator(".mindhome-photo-stage")).toHaveAccessibleName(/same MindHome/);
  await expect(root(page).locator(".mindhome-environment-image")).toHaveCSS("visibility", "hidden");
  await expect(choice(page, "cool-air")).toBeEnabled();
  await expect(choice(page, "cool-air")).toHaveAttribute("aria-pressed", "true");
  await expect(phrase(page)).toHaveText(phrases.en["cool-air"]);
}

async function select(page: Page, id: Condition, locale: "en" | "th" = "en", reduced = false): Promise<void> {
  await choice(page, id).click();
  await expect(choice(page, id)).toHaveAttribute("aria-pressed", "true");
  if (!reduced) await expect(root(page)).toHaveAttribute("data-transitioning", "true");
  // Match the real DOM transition boundary closely enough to sample the short
  // finite event; assertion auto-retry backoff can otherwise consume its hold.
  await expect.poll(() => root(page).getAttribute("data-transitioning"), { intervals: [20] }).toBe("false");
  await expect(phrase(page)).toHaveText(phrases[locale][id]);
  await expect(choice(page, id)).toBeEnabled();
}

async function bounds(page: Page) {
  return root(page).evaluate(element => {
    const stage = element.querySelector(".mindhome-photo-stage")!.getBoundingClientRect();
    const image = element.querySelector<HTMLImageElement>(".mindhome-photo-stage img")!;
    const rect = (box: DOMRect) => ({ x: box.x, y: box.y, width: box.width, height: box.height });
    return {
      overflow: document.documentElement.scrollWidth > innerWidth,
      stage: rect(stage), image: rect(image.getBoundingClientRect()), imageLoaded: image.complete && image.naturalWidth === 1672 && image.naturalHeight === 941,
      controls: [...element.querySelectorAll<HTMLButtonElement>("button")].map(button => {
        const box = button.getBoundingClientRect();
        return { text: button.textContent, invitation: button.hasAttribute("data-mindhome-invite"), ...rect(box),
          visible: box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight,
          ownsPointer: button.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)),
          overlapsPhoto: box.left < stage.right && box.right > stage.left && box.top < stage.bottom && box.bottom > stage.top };
      }),
    };
  });
}

test("production boot, canonical base assets and real three-condition journey render without browser or shader errors", async ({ page }, info) => {
  test.setTimeout(90000);
  const failures = errors(page), imageResponses = new Map<string, number>();
  page.on("response", response => { if (/\/mindhome\/[^/]+\.png$/.test(response.url())) imageResponses.set(response.url(), response.status()); });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  const html = await page.request.get("./");
  expect(html.ok()).toBe(true);
  const source = await html.text();
  expect(source).toContain('property="og:title" content="MSxAI Story World"');
  expect(source).toContain('href="https://pnatlab.github.io/msxai-story-world/"');
  expect(source).toMatch(/src="\/msxai-story-world\/assets\/.+\.js"/);
  const cover = await page.request.get("msxai-story-world-og.jpg");
  expect(cover.ok()).toBe(true); expect(cover.headers()["content-type"]).toContain("image/jpeg");
  await enter(page);
  expect(await page.evaluate(() => window.__MSXAI_STORY_WORLD__)).toBeUndefined();
  // The finite arrival veil has ended at 550 ms; this samples only the mist.
  await page.waitForTimeout(700);
  const mistPixels = await photoPixels(page);
  await page.screenshot({ path: info.outputPath("01-cool-air-mist-event.png") });
  await page.waitForTimeout(2100);
  await page.screenshot({ path: info.outputPath("02-cool-air-still.png") });
  const coolPixels = await photoPixels(page);
  expect(mistPixels.equals(coolPixels), "the real production mist event must render different pixels from the same still condition").toBe(false);

  await select(page, "sun-shade");
  await page.waitForTimeout(450);
  const reflectedPixels = await photoPixels(page);
  await page.screenshot({ path: info.outputPath("03-sun-shade-reflected-light-event.png") });
  await page.waitForTimeout(1700);
  await page.screenshot({ path: info.outputPath("04-sun-shade-still.png") });
  const sunPixels = await photoPixels(page);
  expect(sunPixels.equals(coolPixels)).toBe(false);
  expect(reflectedPixels.equals(sunPixels), "the real production reflected-light event must render different pixels from the same still condition").toBe(false);

  await select(page, "rain-green");
  await page.waitForTimeout(550);
  const rainPixels = await photoPixels(page);
  await page.screenshot({ path: info.outputPath("05-rain-green-rain-water-event.png") });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: info.outputPath("06-rain-green-still.png") });
  const rainStillPixels = await photoPixels(page);
  expect(rainStillPixels.equals(coolPixels)).toBe(false);
  expect(rainPixels.equals(rainStillPixels), "the real production rain/water event must render different pixels from the same still condition").toBe(false);
  await root(page).locator('[data-mindhome-locale="th"]').click();
  await expect(phrase(page)).toHaveText(phrases.th["rain-green"]);
  await expect(root(page).locator(".mindhome-photo-stage")).toHaveAccessibleName(/อาคารกระจก MindHome.*ฝนและความเขียว/);
  await expect(choice(page, "rain-green")).toHaveAccessibleName("ฝนและความเขียว");
  await select(page, "sun-shade", "th");
  await expect(root(page).locator(".mindhome-photo-stage")).toHaveAccessibleName(/อาคารกระจก MindHome.*แดดและร่มเงา/);
  await page.waitForTimeout(1800);
  await page.screenshot({ path: info.outputPath("07-thai-sun-shade.png") });
  await root(page).locator('[data-mindhome-locale="en"]').click();
  await expect(root(page).locator(".mindhome-photo-stage")).toHaveAccessibleName(/same MindHome/);
  await select(page, "cool-air");
  await page.waitForTimeout(2200);
  await page.screenshot({ path: info.outputPath("08-cool-air-returned.png") });
  for (const filename of ["cool-air.png", "sun-and-shade.png", "rain-and-green.png"]) {
    const matching = [...imageResponses].filter(([url]) => url.endsWith(`/msxai-story-world/mindhome/${filename}`));
    expect(matching).toHaveLength(1); expect(matching[0][1]).toBe(200);
  }
  await root(page).locator('[data-mindhome="return"]').click();
  await expect(root(page)).toBeHidden(); await expect(visit(page)).toBeFocused();
  await expect(page.locator('.ecosystem-labels [data-ecosystem-node="mindhome"]')).toHaveAttribute("aria-pressed", "true");
  await visit(page).click(); await expect(root(page)).toHaveClass(/is-webgl/);
  await expect(choice(page, "cool-air")).toHaveAttribute("aria-pressed", "true");
  await expect(phrase(page)).toHaveText(phrases.en["cool-air"]);
  await root(page).locator('[data-mindhome="return"]').click(); await expect(root(page)).toBeHidden();
  expect(failures).toEqual([]);
});

test("production registered stage survives active-event resizing at all required sizes with real touch and locale controls", async ({ page }, info) => {
  test.setTimeout(90000);
  const failures = errors(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 }); await enter(page);
  await page.waitForTimeout(2200);
  const viewports = [
    { width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 375, height: 667 },
    { width: 430, height: 932 }, { width: 844, height: 390 },
  ];
  for (let index = 0; index < viewports.length; index++) {
    // Start the same water-registered event, then resize while it is active.
    await select(page, "rain-green");
    await page.setViewportSize(viewports[index]);
    await page.waitForTimeout(400);
    const layout = await bounds(page);
    expect(layout.overflow).toBe(false); expect(layout.imageLoaded).toBe(true);
    expect(layout.stage.x).toBeGreaterThanOrEqual(0);
    expect(layout.stage.x + layout.stage.width).toBeLessThanOrEqual(viewports[index].width);
    expect(layout.image).toEqual(layout.stage);
    for (const button of layout.controls) {
      expect(button.width, button.text ?? "button").toBeGreaterThanOrEqual(44);
      expect(button.height, button.text ?? "button").toBeGreaterThanOrEqual(44);
      expect(button.visible, button.text ?? "button").toBe(true);
      expect(button.ownsPointer, button.text ?? "button").toBe(true);
      // The invitation is intentionally image-registered; all other controls
      // must remain outside the photograph as before.
      expect(button.overlapsPhoto, button.text ?? "button").toBe(button.invitation);
      if (button.invitation) {
        expect(button.x + button.width / 2).toBeCloseTo(layout.stage.x + layout.stage.width * .64, 0);
        expect(button.y + button.height / 2).toBeCloseTo(layout.stage.y + layout.stage.height * .55, 0);
      }
    }
    await page.screenshot({ path: info.outputPath(`responsive-${viewports[index].width}x${viewports[index].height}-active-rain.png`) });
    await page.waitForTimeout(2200);
    await root(page).locator('[data-mindhome-locale="th"]').click();
    await expect(phrase(page)).toHaveText(phrases.th["rain-green"]);
    await page.screenshot({ path: info.outputPath(`responsive-${viewports[index].width}x${viewports[index].height}-thai-still.png`) });
    await root(page).locator('[data-mindhome-locale="en"]').click();
    await select(page, "cool-air"); await page.waitForTimeout(2100);
  }
  await root(page).locator('[data-mindhome="return"]').click(); await expect(root(page)).toBeHidden();
  expect(failures).toEqual([]);
});

test("production Reduced Motion switches static conditions immediately and keeps keyboard Return usable", async ({ page }, info) => {
  const failures = errors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 }); await enter(page);
  await choice(page, "rain-green").focus(); await choice(page, "rain-green").press("Enter");
  await expect(root(page)).toHaveAttribute("data-transitioning", "false");
  await expect(phrase(page)).toHaveText(phrases.en["rain-green"]);
  await expect(choice(page, "rain-green")).toBeFocused();
  await page.waitForTimeout(200);
  const first = await photoPixels(page);
  await page.waitForTimeout(600);
  expect((await photoPixels(page)).equals(first)).toBe(true);
  await page.screenshot({ path: info.outputPath("reduced-motion-rain-static.png") });
  await root(page).locator('[data-mindhome-locale="th"]').click();
  await select(page, "sun-shade", "th", true);
  await expect(root(page).locator(".mindhome-photo-stage")).toHaveAccessibleName(/อาคารกระจก MindHome.*แดดและร่มเงา/);
  await expect(choice(page, "sun-shade")).toHaveAccessibleName("แดดและร่มเงา");
  await page.keyboard.press("Escape"); await expect(root(page)).toBeHidden(); await expect(visit(page)).toBeFocused();
  expect(failures).toEqual([]);
});
