import { expect, test, type Page } from "@playwright/test";
import { FOUNDATIONAL_SESSION_KEY } from "../src/ui/foundationalOpeningModel";

const root = (page: Page) => page.locator(".mindhome-destination");
const invitation = (page: Page) => root(page).locator("[data-mindhome-invite]");
const condition = (page: Page, id: string) => root(page).locator(`[data-mindhome-condition="${id}"]`);

function contrastRatio(foreground: string, background: string): number {
  const luminance = (color: string) => {
    const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => {
      const channel = value / 255;
      return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
    });
    return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
  };
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + .05) / (darker + .05);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(key => sessionStorage.setItem(key, "seen"), FOUNDATIONAL_SESSION_KEY);
});

async function enter(page: Page, reduced = true): Promise<void> {
  await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
  await page.goto("/");
  await page.locator('.entry-card [data-action="mindhome-story"]').click();
  await expect(root(page)).toBeVisible();
  await expect(root(page)).toHaveClass(/is-webgl/, { timeout: 20000 });
  await expect(invitation(page)).toBeEnabled({ timeout: 20000 });
  await expect(root(page)).toHaveAttribute("data-invitation-state", "quiet");
}

test("Human can invite, retain and dismiss the presence by keyboard without carrying it to the next visit", async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  const action = invitation(page);
  const cue = root(page).locator(".mindhome-invitation-cue");
  await expect(action).toHaveAccessibleName("Invite MSxAI");
  await expect(cue).toHaveText("Invite MSxAI");
  const quietColors = await cue.evaluate(element => ({
    background: getComputedStyle(element).backgroundColor,
    color: getComputedStyle(element).color,
  }));
  expect(quietColors).toEqual({ background: "rgb(156, 231, 246)", color: "rgb(21, 59, 81)" });
  expect(contrastRatio(quietColors.color, quietColors.background)).toBeGreaterThanOrEqual(4.5);
  await action.evaluate(element => element.blur());
  for (let attempt = 0; attempt < 16 && !(await action.evaluate(element => element.matches(":focus-visible"))); attempt++) {
    await page.keyboard.press("Tab");
  }
  await expect(action).toBeFocused();
  await expect(cue).toHaveCSS("opacity", "1");
  await expect(action).toHaveCSS("outline-style", "solid");
  await page.screenshot({ path: test.info().outputPath("mindhome-msxai-invite-focus-390x844.png") });
  await action.press("Enter");
  await expect(root(page)).toHaveAttribute("data-invitation-state", "active");
  await expect(action).toHaveAccessibleName("Dismiss MSxAI");
  await expect(cue).toHaveText("Dismiss MSxAI");
  const activeColors = await cue.evaluate(element => ({
    background: getComputedStyle(element).backgroundColor,
    color: getComputedStyle(element).color,
  }));
  expect(activeColors.background).toBe("rgb(117, 210, 227)");
  expect(contrastRatio(activeColors.color, activeColors.background)).toBeGreaterThanOrEqual(4.5);
  await action.hover();
  await page.screenshot({ path: test.info().outputPath("mindhome-msxai-dismiss-active-390x844.png") });

  for (const id of ["sun-shade", "rain-green", "cool-air"]) {
    await condition(page, id).click();
    await expect(condition(page, id)).toHaveAttribute("aria-pressed", "true");
    await expect(root(page)).toHaveAttribute("data-invitation-state", "active");
  }

  await root(page).locator('[data-mindhome-locale="th"]').click();
  await expect(action).toHaveAccessibleName("ปิด MSxAI Hologram");
  await action.hover();
  await page.screenshot({ path: test.info().outputPath("mindhome-msxai-dismiss-th-390x844.png") });
  await page.keyboard.press("Escape");
  await expect(root(page)).toBeVisible();
  await expect(root(page)).toHaveAttribute("data-invitation-state", "quiet");
  await expect(action).toHaveAccessibleName("เชิญ MSxAI เข้ามา");
  await action.focus(); await action.press("Space");
  await expect(root(page)).toHaveAttribute("data-invitation-state", "active");
  await root(page).locator('[data-mindhome="return"]').click();
  await expect(root(page)).toBeHidden();

  await page.locator('.entry-card [data-action="mindhome-story"]').click();
  await expect(root(page)).toBeVisible();
  await expect(invitation(page)).toBeEnabled({ timeout: 20000 });
  await expect(root(page)).toHaveAttribute("data-invitation-state", "quiet");
  await expect(condition(page, "cool-air")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(root(page)).toBeHidden();
});

test("invitation stays registered inside the photograph at desktop, portrait and short landscape sizes", async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await enter(page);
  for (const viewport of [
    { width: 1440, height: 900 }, { width: 390, height: 844 },
    { width: 375, height: 667 }, { width: 430, height: 932 }, { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    for (const locale of ["en", "th"]) {
      await root(page).locator(`[data-mindhome-locale="${locale}"]`).click();
      const boxes = await page.evaluate(() => {
        const rect = (selector: string) => {
          const r = document.querySelector<HTMLElement>(selector)!.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
        };
        return { stage: rect(".mindhome-photo-stage"), action: rect("[data-mindhome-invite]"),
          overflow: document.documentElement.scrollWidth > innerWidth };
      });
      expect(boxes.overflow, `${viewport.width} × ${viewport.height} ${locale}`).toBe(false);
      expect(boxes.action.width).toBeGreaterThan(0); expect(boxes.action.height).toBeGreaterThan(0);
      expect(boxes.action.left).toBeGreaterThanOrEqual(boxes.stage.left - 1);
      expect(boxes.action.right).toBeLessThanOrEqual(boxes.stage.right + 1);
      expect(boxes.action.top).toBeGreaterThanOrEqual(boxes.stage.top - 1);
      expect(boxes.action.bottom).toBeLessThanOrEqual(boxes.stage.bottom + 1);
      await expect(invitation(page)).toHaveAccessibleName(locale === "en" ? "Invite MSxAI" : "เชิญ MSxAI เข้ามา");
    }
  }
  await invitation(page).click();
  await expect(root(page)).toHaveAttribute("data-invitation-state", "active");
  const heights: number[] = [];
  for (const viewport of [
    { width: 1440, height: 900 }, { width: 390, height: 844 },
    { width: 375, height: 667 }, { width: 430, height: 932 }, { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await expect.poll(async () => {
      const stage = await root(page).locator(".mindhome-photo-stage").boundingBox();
      const state = await page.evaluate(() => window.__MSXAI_STORY_WORLD__!.inspect());
      if (!("mindhome" in state) || !state.mindhome || !stage) return Infinity;
      const expected = .21 + .03 * Math.max(0, Math.min(1, (stage.height - 220) / 400));
      return Math.abs(state.mindhome.invitation.display.height - expected);
    }).toBeLessThan(.0001);
    const state = await page.evaluate(() => window.__MSXAI_STORY_WORLD__!.inspect());
    if (!("mindhome" in state) || !state.mindhome) throw new Error("Expected the MindHome scene");
    const display = state.mindhome.invitation.display;
    const stage = (await root(page).locator(".mindhome-photo-stage").boundingBox())!;
    const cue = (await root(page).locator(".mindhome-invitation-cue").boundingBox())!;
    const phrase = (await root(page).locator(".mindhome-phrase").boundingBox())!;
    const graph = { left: stage.x + (display.x - display.width / 2) * stage.width,
      right: stage.x + (display.x + display.width / 2) * stage.width,
      top: stage.y + (display.y - display.height / 2) * stage.height,
      bottom: stage.y + (display.y + display.height / 2) * stage.height };
    expect(cue.x).toBeGreaterThanOrEqual(graph.right);
    expect(cue.x + cue.width).toBeLessThanOrEqual(stage.x + stage.width);
    expect(graph.bottom).toBeLessThanOrEqual(phrase.y);
    await invitation(page).hover();
    await expect(root(page).locator(".mindhome-invitation-cue")).toBeVisible();
    await page.screenshot({ path: test.info().outputPath(`mindhome-msxai-active-${viewport.width}x${viewport.height}-th.png`) });
    heights.push(display.height);
  }
  expect(heights[1]).toBeLessThan(heights[0]);
});

test("normal motion serializes the weather and sparse pulse, then returns to idle", async ({ page }) => {
  test.setTimeout(80000);
  await enter(page, false);
  const inspection = async () => {
    const state = await page.evaluate(() => window.__MSXAI_STORY_WORLD__!.inspect());
    if (!("mindhome" in state) || !state.mindhome) throw new Error("Expected the MindHome scene");
    return state;
  };
  await invitation(page).click();
  await expect(root(page)).toHaveAttribute("data-invitation-state", "active", { timeout: 20000 });
  await expect.poll(async () => (await inspection()).mindhome!.invitation.pulse?.timerPending).toBe(true);
  await condition(page, "rain-green").click();
  await expect.poll(async () => (await inspection()).mindhome!.transitionActive).toBe(true);
  expect((await inspection()).mindhome!.invitation.pulse?.eligible).toBe(false);
  await expect.poll(async () => {
    const state = (await inspection()).mindhome!;
    return !state.transitionActive && !state.effectActive && state.invitation.pulse?.timerPending;
  }, { timeout: 15000 }).toBe(true);
  await expect(root(page)).toHaveAttribute("data-invitation-state", "active");
  await expect.poll(async () => (await inspection()).mindhome!.invitation.pulse?.animating, { timeout: 24000, intervals: [100] }).toBe(true);
  await expect.poll(async () => {
    const state = await inspection();
    return !state.renderLoopActive && !state.mindhome!.invitation.pulse?.animating && state.mindhome!.invitation.pulse?.baselineExact;
  }, { timeout: 8000, intervals: [100] }).toBe(true);
  await page.keyboard.press("Escape");
  await expect(root(page)).toHaveAttribute("data-invitation-state", "quiet", { timeout: 10000 });
  expect((await inspection()).mindhome!.invitation.pulse?.timerPending).toBe(false);
  await page.keyboard.press("Escape"); await expect(root(page)).toBeHidden();
});

test("touch users can dismiss by tapping the visible cue without covering the graph", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.addInitScript(key => sessionStorage.setItem(key, "seen"), FOUNDATIONAL_SESSION_KEY);
  await enter(page);
  await invitation(page).tap();
  await expect(root(page)).toHaveAttribute("data-invitation-state", "active", { timeout: 20000 });
  await expect(root(page).locator(".mindhome-invitation-light")).toHaveCSS("opacity", "0");
  await root(page).locator(".mindhome-invitation-cue").tap();
  await expect(root(page)).toHaveAttribute("data-invitation-state", "quiet");
  await expect(root(page).locator(".mindhome-invitation-light")).toHaveCSS("opacity", "1");
  await context.close();
});

test("repeated invitations reuse the graph and return to an idle renderer", async ({ page }) => {
  test.setTimeout(60000);
  await enter(page);
  const inspect = async () => {
    const state = await page.evaluate(() => window.__MSXAI_STORY_WORLD__!.inspect());
    if (!("renderLoopActive" in state)) throw new Error("Expected the WebGL scene inspection to be available");
    return state;
  };
  let baseline: { geometries: number; materials: number; textures: number } | undefined;
  for (let cycle = 0; cycle < 3; cycle++) {
    await invitation(page).click();
    await expect(root(page)).toHaveAttribute("data-invitation-state", "active");
    const state = await inspect();
    if (!("mindhome" in state) || !state.mindhome?.invitation.graph) throw new Error("Expected the invited graph to be available");
    const { graph, pulse } = state.mindhome.invitation;
    expect(graph).toMatchObject({ nodeCount: 2780, connectionCount: 6661, structuralSegments: 1288 });
    expect(pulse).toMatchObject({ eligible: false, animating: false, timerPending: false });
    const current = { geometries: graph.geometryCount, materials: graph.materialCount, textures: graph.textureCount };
    if (baseline) expect(current).toEqual(baseline); else baseline = current;
    await invitation(page).click();
    await expect(root(page)).toHaveAttribute("data-invitation-state", "quiet");
    await expect.poll(async () => (await inspect()).renderLoopActive).toBe(false);
    const before = await inspect();
    await page.waitForTimeout(300);
    expect((await inspect()).renderCount).toBe(before.renderCount);
  }
  await root(page).locator('[data-mindhome="return"]').click();
  await expect(root(page)).toBeHidden();
  expect((await inspect()).mindhome).toBeUndefined();
});

test("return during an invitation clears the transition and a new visit starts quiet", async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await enter(page, false);
  await invitation(page).click();
  await expect(root(page)).toHaveAttribute("data-invitation-state", "inviting");
  await root(page).locator('[data-mindhome="return"]').click();
  await expect(root(page)).toBeHidden();
  await page.locator('.entry-card [data-action="mindhome-story"]').click();
  await expect(root(page)).toBeVisible();
  await expect(invitation(page)).toBeEnabled({ timeout: 20000 });
  await expect(root(page)).toHaveAttribute("data-invitation-state", "quiet");
});

test("a missing canonical asset leaves the room quiet, reports the failure in both languages, and allows a retry", async ({ page }) => {
  test.setTimeout(60000);
  await page.route("**/presence-study.bin", route => route.fulfill({ status: 404, body: "Not found" }));
  await enter(page);
  await invitation(page).click();
  await expect(root(page).locator(".mindhome-status")).toHaveText("MSxAI hologram is unavailable. Please try again.");
  await expect(root(page)).toHaveAttribute("data-invitation-state", "quiet");
  await expect(invitation(page)).toHaveAccessibleName("Invite MSxAI");
  await expect(invitation(page)).toBeEnabled();
  const failed = await page.evaluate(() => window.__MSXAI_STORY_WORLD__!.inspect());
  if (!("mindhome" in failed) || !failed.mindhome) throw new Error("Expected the MindHome scene");
  expect(failed.mindhome.invitation).toMatchObject({ phase: "quiet", failed: true, loading: false });
  expect(failed.mindhome.invitation.graph).toBeUndefined();

  await root(page).locator('[data-mindhome-locale="th"]').click();
  await expect(root(page).locator(".mindhome-status")).toHaveText("MSxAI Hologram ยังไม่พร้อมใช้งาน โปรดลองอีกครั้ง");
  await expect(invitation(page)).toHaveAccessibleName("เชิญ MSxAI เข้ามา");
  await page.unroute("**/presence-study.bin");
  await invitation(page).click();
  await expect(root(page)).toHaveAttribute("data-invitation-state", "active", { timeout: 20000 });
  await expect(root(page).locator(".mindhome-status")).toHaveText("");
  await expect(invitation(page)).toHaveAccessibleName("ปิด MSxAI Hologram");
});

test("without WebGL the invitation is hidden while the still place and Return remain usable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?forceNoWebgl=1");
  await page.locator('.story-list [data-action="living-ecosystem"]').click();
  await page.locator('.ecosystem-list [data-ecosystem-node="mindhome"]').click();
  await page.locator('[data-ecosystem="visit-mindhome"]').click();
  await expect(root(page)).toBeVisible();
  await expect(invitation(page)).toBeHidden();
  await expect(root(page)).toHaveAttribute("data-invitation-state", "quiet");
  await expect(root(page).locator(".mindhome-environment-image")).toBeVisible();
  await condition(page, "rain-green").click();
  await expect(condition(page, "rain-green")).toHaveAttribute("aria-pressed", "true");
  await root(page).locator('[data-mindhome="return"]').click();
  await expect(root(page)).toBeHidden();
});
