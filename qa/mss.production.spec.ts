import { expect, test, type Page } from "@playwright/test";
import { FOUNDATIONAL_SESSION_KEY } from "../src/ui/foundationalOpeningModel";

const viewports = [
  { width: 1440, height: 900 }, { width: 1280, height: 800 },
  { width: 1024, height: 768 }, { width: 390, height: 844 },
  { width: 375, height: 667 }, { width: 430, height: 932 }, { width: 844, height: 390 },
];
const chapterNames = ["A-pre-dawn", "B-dense-mist", "C-daylight", "D-night"];

async function enterMss(page: Page): Promise<void> {
  await page.addInitScript(key => sessionStorage.setItem(key, "seen"), FOUNDATIONAL_SESSION_KEY);
  await page.goto("./");
  await page.locator('.entry-card [data-action="living-ecosystem"]').click();
  await page.locator('.ecosystem-labels [data-ecosystem-node="mss"]').click();
  await page.getByRole("button", { name: "Visit MSS Story" }).click();
  await expect(page.locator(".mss-destination")).toHaveAttribute("data-renderer", "webgl");
}

test("built MSS renders four chapters with readable controls across seven viewports", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("response", response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await enterMss(page);
  expect(await page.evaluate(() => window.__MSXAI_STORY_WORLD__)).toBeUndefined();
  const root = page.locator(".mss-destination");
  const scroll = root.locator(".mss-scroll");
  let progressBeforeResize = 0;
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await expect.poll(() => scroll.evaluate((element, progress) => {
      return Math.abs(element.scrollTop / (element.scrollHeight - element.clientHeight) - progress);
    }, progressBeforeResize)).toBeLessThan(.005);
    const thai = viewport.width === 375;
    await root.locator(`[data-mss-locale="${thai ? "th" : "en"}"]`).click();
    for (let phase = 0; phase < chapterNames.length; phase++) {
      await root.locator(`[data-mss-phase="${phase}"]`).click();
      await expect(root).toHaveAttribute("data-phase", String(phase));
      await expect(root.locator(".mss-phase:visible")).toHaveCount(1);
      const bounds = await root.evaluate(destination => {
        const frame = destination.querySelector(".mss-frame")!.getBoundingClientRect();
        const editorial = destination.querySelector(".mss-editorial")!.getBoundingClientRect();
        const header = destination.querySelector(".mss-header")!.getBoundingClientRect();
        return {
          overflow: destination.scrollWidth > innerWidth || document.documentElement.scrollWidth > innerWidth,
          editorialFits: editorial.bottom <= frame.bottom + 1 && editorial.top >= header.bottom - 1,
          controlsFit: [...destination.querySelectorAll(".mss-frame button")].every(button => {
            const box = button.getBoundingClientRect();
            return box.top >= frame.top && box.bottom <= frame.bottom + 1 && box.left >= 0 && box.right <= innerWidth && box.height >= 44;
          }),
        };
      });
      expect(bounds, `${viewport.width}×${viewport.height} phase ${phase}`).toEqual({ overflow: false, editorialFits: true, controlsFit: true });
      if (viewport.width === 1440 || viewport.width === 390 || phase === 2) {
        await page.mouse.move(viewport.width / 2, viewport.height / 2);
        await page.screenshot({ path: info.outputPath(`${viewport.width}x${viewport.height}-${thai ? "th" : "en"}-${chapterNames[phase]}.png`) });
      }
    }
    progressBeforeResize = viewport.width === 1440 ? .81 : 1;
    if (viewport.width === 1440) {
      await scroll.evaluate((element, progress) => {
        element.scrollTop = progress * (element.scrollHeight - element.clientHeight);
      }, progressBeforeResize);
      await page.screenshot({ path: info.outputPath("1440x900-en-D-dusk.png") });
    }
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Visit MSS Story" })).toBeFocused();
  expect(errors).toEqual([]);
});

test("record a native-wheel flight across the built landscape", async ({ page }) => {
  await enterMss(page);
  const scroll = page.locator(".mss-scroll");
  const distance = await scroll.evaluate(element => element.scrollHeight - element.clientHeight);
  await scroll.hover();
  for (let step = 0; step < 36; step++) {
    await page.mouse.wheel(0, Math.ceil(distance / 36));
    await page.waitForTimeout(75);
  }
  await expect(page.locator(".mss-destination")).toHaveAttribute("data-phase", "3");
});

test("built mobile MSS accepts native touch swipes and preserves its way out", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    await enterMss(page);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 200, y: 630 }] });
    for (let i = 1; i <= 12; i++) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 200, y: 630 - i * 31 }] });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(() => page.locator(".mss-scroll").evaluate(element => element.scrollTop)).toBeGreaterThan(180);
    await page.getByRole("button", { name: "Return to Living Ecosystem" }).tap();
    await expect(page.getByRole("button", { name: "Visit MSS Story" })).toBeVisible();
  } finally {
    await context.close();
  }
});
