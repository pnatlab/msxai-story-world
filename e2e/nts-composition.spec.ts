import { test, expect, type Page } from "@playwright/test";
import { FOUNDATIONAL_SESSION_KEY } from "../src/ui/foundationalOpeningModel";
import { INTRO, MEMORIES } from "../src/nts/content";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(key => sessionStorage.setItem(key, "seen"), FOUNDATIONAL_SESSION_KEY);
});

const inspect = (page: Page) => page.evaluate(() => (() => { const r = window.__MSXAI_STORY_WORLD__!.inspect(); return { state: r.ntsState, scene: "nts" in r ? { ...r, nts: r.nts! } : undefined, ecosystem: r.overviewState, story: r.storyState, locale: document.documentElement.lang, sound: document.querySelector('[data-action="sound"]')?.getAttribute('aria-pressed') === 'true' }; })());
const memoryIds = MEMORIES.map(item => item.id);
const previews = ".nts-memory-nav [data-nts-memory]";
type Box = { x: number; y: number; width: number; height: number; visible?: boolean };

async function settle(page: Page): Promise<void> {
  // Sample idle gaps between the existing field settling and sparse micro-events;
  // retain the same five-second deadline and exact idle assertion.
  await expect.poll(async () => (await inspect(page)).scene?.renderLoopActive ?? false, { intervals: [50], timeout: 5000 }).toBe(false);
}

async function selectNts(page: Page, url = "/"): Promise<void> {
  await page.goto(url);
  const entry = url.includes("forceNoWebgl") ? ".story-list" : ".entry-card";
  await page.locator(`${entry} [data-action="living-ecosystem"]`).click();
  await settle(page);
  if (!url.includes("forceNoWebgl")) {
    await page.locator('.story-header [data-action="story-list"]').click();
  }
  await page.locator('.ecosystem-list [data-ecosystem-node="nutuensai"]').click();
  await expect(page.locator('[data-ecosystem="visit-nts"]')).toBeVisible();
}

async function enter(page: Page): Promise<void> {
  await page.locator('[data-ecosystem="visit-nts"]').click();
  await expect.poll(async () => (await inspect(page)).state.phase).toBe("settled");
  await settle(page);
}

async function expectPreviews(page: Page): Promise<void> {
  await expect(page.locator(previews)).toHaveCount(6);
  for (const item of MEMORIES) {
    const button = page.locator(`${previews}[data-nts-memory="${item.id}"]`);
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
    await expect(button.locator("span")).toContainText(item.title.en);
    await expect(button.locator("img")).toHaveAttribute("src", new RegExp(`/nts/${item.id}-preview\\.jpg$`));
    await expect.poll(() => button.locator("img").evaluate(image => {
      const img = image as HTMLImageElement;
      return img.complete && img.naturalWidth > 0 && img.naturalWidth <= 320 && img.naturalHeight <= 480;
    })).toBe(true);
  }
}

test("authored Presence introduction keeps its card accent without a leader line at responsive sizes", async ({ page }) => {
  test.setTimeout(60000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await selectNts(page); await enter(page);
  for (const viewport of [
    { width: 1366, height: 768 }, { width: 1920, height: 1080 }, { width: 1024, height: 768 },
    { width: 390, height: 844 }, { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport); await settle(page);
    for (const locale of ["en", "th"]) {
      await page.locator(`[data-nts="${locale}"]`).click();
      await page.locator('[data-nts="meet"]').click();
      const card = page.locator(".nts-intro"); await expect(card).toBeVisible();
      await expect(page.locator(".nts-voice-tether")).toHaveCount(0);
      await expect(card.locator("h2")).toHaveText("NuTuenSai");
      const visual = await card.evaluate(element => {
        const style = getComputedStyle(element), rect = element.getBoundingClientRect();
        return { accentWidth: style.borderLeftWidth, accentColor: style.borderLeftColor,
          inViewport: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
          width: rect.width, height: rect.height };
      });
      expect(visual.accentWidth).toBe("2px"); expect(visual.accentColor).toBe("rgb(192, 171, 201)");
      expect(visual.inViewport).toBe(true); expect(visual.width).toBeGreaterThan(200); expect(visual.height).toBeGreaterThan(120);
      await page.screenshot({ path: `/private/tmp/nts-intro-${viewport.width}x${viewport.height}-${locale}.png` });
      // At short-landscape heights the filmstrip can overlap the intro card's
      // close button; Escape is the existing deterministic dismissal path.
      await page.keyboard.press("Escape");
      await expect(card).toBeHidden();
    }
  }
});

function watchImages(page: Page): { full: string[]; preview: string[] } {
  const requests = { full: [] as string[], preview: [] as string[] };
  page.on("request", request => {
    const path = new URL(request.url()).pathname;
    const full = path.match(/\/nts\/(s[1-6])\.jpg$/);
    const preview = path.match(/\/nts\/(s[1-6])-preview\.jpg$/);
    if (full) requests.full.push(full[1]);
    if (preview) requests.preview.push(preview[1]);
  });
  return requests;
}

function horizontalGap(a: Box, b: Box): number {
  return a.x <= b.x ? b.x - (a.x + a.width) : a.x - (b.x + b.width);
}

function rectangleDistance(a: Box, b: Box): number {
  const dx = Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width), 0);
  const dy = Math.max(a.y - (b.y + b.height), b.y - (a.y + a.height), 0);
  return Math.hypot(dx, dy);
}

function overlapArea(a: Box, b: Box): number {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return width * height;
}

test("six projected previews load before any full image and select with click or Enter", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const requests = watchImages(page);
  await selectNts(page);
  await enter(page);
  await expectPreviews(page);
  expect([...new Set(requests.preview)].sort()).toEqual([...memoryIds].sort());
  expect(requests.full).toEqual([]);
  const arrival = await inspect(page);
  expect(arrival.scene!.nts.textureCount).toBe(0);
  expect([...arrival.scene!.nts.visibleTraces].sort()).toEqual([...memoryIds].sort());

  const stage = (await page.locator(".story-stage").boundingBox())!;
  for (const item of MEMORIES) {
    const trace = arrival.scene!.nts.composition.traces[item.id];
    expect(trace.visible).toBe(true);
    const image = (await page.locator(`${previews}[data-nts-memory="${item.id}"] img`).boundingBox())!;
    expect(Math.abs(image.x + image.width / 2 - stage.x - trace.x - trace.width / 2)).toBeLessThanOrEqual(24);
    expect(Math.abs(image.y + image.height / 2 - stage.y - trace.y - trace.height / 2)).toBeLessThanOrEqual(24);
  }

  for (const [index, item] of MEMORIES.entries()) {
    const button = page.locator(`${previews}[data-nts-memory="${item.id}"]`);
    if (index % 2 === 0) await button.click();
    else { await button.focus(); await page.keyboard.press("Enter"); }
    await expect(page.locator("#nts-memory-title")).toHaveText(item.title.en);
    await expect(page.locator(".nts-caption .nts-authored")).toHaveText(item.en);
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect.poll(async () => (await inspect(page)).scene!.nts.textureCount).toBe(1);
    await settle(page);
    const current = await inspect(page);
    expect(current.state.memoryId).toBe(item.id);
    expect(current.scene!.nts.visibleMemories).toEqual([item.id]);
    expect([...current.scene!.nts.visibleTraces].sort()).toEqual([...memoryIds].sort());
    expect([...new Set(requests.full)].sort()).toEqual(memoryIds.slice(0, index + 1).sort());
    await expect(page.locator(".nts-dom-image img")).toBeHidden();
    expect(await page.locator(".nts-dom-image img").getAttribute("src")).toBeNull();

    const projected = current.scene!.nts.composition.image;
    expect(projected.visible).toBe(true);
    const image = { ...projected, x: projected.x + stage.x, y: projected.y + stage.y };
    const caption = (await page.locator(".nts-caption").boundingBox())!;
    expect(horizontalGap(image, caption)).toBeGreaterThanOrEqual(-6);
    expect(horizontalGap(image, caption)).toBeLessThanOrEqual(72);
    const overlap = Math.min(image.y + image.height, caption.y + caption.height) - Math.max(image.y, caption.y);
    expect(overlap / Math.min(image.height, caption.height)).toBeGreaterThanOrEqual(0.3);
    const traceBoxes = await page.locator(previews).evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().toJSON()));
    const controlBoxes = await page.locator('[data-nts="meet"], [data-nts="inspect"]').evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().toJSON()));
    for (const trace of traceBoxes) {
      expect(overlapArea(trace, image), "preview cards must clear the selected image").toBe(0);
      expect(overlapArea(trace, caption), "preview cards must clear the narrative").toBe(0);
      for (const control of controlBoxes) expect(overlapArea(trace, control), "preview cards must clear presence actions").toBe(0);
    }
    if (item.id === "s3") await page.screenshot({ path: "/private/tmp/nts-slice-b-evidence/composition-desktop-pair.png" });
  }

  await page.locator('[data-nts="meet"]').click();
  await expect(page.locator(".nts-intro .nts-authored")).toHaveText(INTRO.en);
  await expect.poll(async () => (await inspect(page)).scene!.nts.loaded).toBe(true);
  await settle(page);
  const composition = (await inspect(page)).scene!.nts.composition;
  const presence = { ...composition.presence, x: composition.presence.x + stage.x, y: composition.presence.y + stage.y };
  const voice = (await page.locator(".nts-intro").boundingBox())!;
  expect(composition.presence.visible).toBe(true);
  expect(rectangleDistance(presence, voice)).toBeLessThanOrEqual(96);
  await expect(page.locator(".nts-voice-tether")).toHaveCount(0);
  const closeIntro = page.locator('.nts-intro [data-nts="close-intro"]');
  await expect(closeIntro).toBeInViewport({ ratio: .95 });
  const closeBox = (await closeIntro.boundingBox())!;
  expect(closeBox.y + closeBox.height).toBeLessThanOrEqual(voice.y + voice.height);
  await page.screenshot({ path: "/private/tmp/nts-slice-b-evidence/composition-desktop-voice.png" });
});

test("compact width and portrait aspect share one DOM image and one reading scroll surface", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 640, height: 480 });
  const requests = watchImages(page);
  await selectNts(page);
  await enter(page);
  await expectPreviews(page);
  expect(requests.full).toEqual([]);
  await page.locator(`${previews}[data-nts-memory="s5"]`).click();
  const verifyReadingClear = async () => {
    // Measure both owners in one layout snapshot. Capturing evidence can flush
    // pending footer/resize updates, so never mix its old and new coordinates.
    const layout = await page.evaluate(selector => ({
      readingBottom: document.querySelector('.nts-reading-pair')!.getBoundingClientRect().bottom,
      traceTop: Math.min(...[...document.querySelectorAll(selector)].map(button => button.getBoundingClientRect().top)),
    }), previews);
    expect(layout.readingBottom, "preview cards must leave the reading surface unobstructed").toBeLessThanOrEqual(layout.traceTop);
  };

  for (const viewport of [{ width: 640, height: 480 }, { width: 390, height: 844 }, { width: 800, height: 1200 }]) {
    await page.setViewportSize(viewport);
    await settle(page);
    const pair = page.locator(".nts-reading-pair");
    await expect(pair).toBeVisible();
    await expect(pair.locator(":scope > .nts-dom-image + .nts-caption")).toHaveCount(1);
    await expect(pair.locator(".nts-dom-image img")).toBeVisible();
    await expect(pair.locator(".nts-caption .nts-authored")).toHaveText(MEMORIES[4].en);
    expect(await page.locator(".nts-memory-nav").evaluate(element => getComputedStyle(element).display)).not.toBe("grid");
    await expect.poll(() => pair.locator("img").evaluate(image => (image as HTMLImageElement).naturalWidth > 0)).toBe(true);
    await expect.poll(async () => (await inspect(page)).scene!.nts.textureCount).toBe(0);
    expect((await inspect(page)).scene!.nts.visibleMemories).toEqual([]);
    expect(await pair.evaluate(element => getComputedStyle(element).overflowY)).toMatch(/auto|scroll/);
    const pairBox = (await pair.boundingBox())!, footer = (await page.locator(".nts-footer").boundingBox())!;
    expect(pairBox.y + pairBox.height).toBeLessThanOrEqual(footer.y + 2);
    expect(pairBox.x).toBeGreaterThanOrEqual(0);
    expect(pairBox.x + pairBox.width).toBeLessThanOrEqual(viewport.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect([...new Set(requests.full)]).toEqual(["s5"]);
    // Flex children can extend above a short ribbon even when the ribbon box clears the pair.
    await verifyReadingClear();
    if (viewport.width === 640) {
      await page.screenshot({ path: "/private/tmp/nts-slice-b-evidence/composition-compact-pair.png" });
      await verifyReadingClear();
    }
    if (viewport.height > viewport.width) {
      const stageBox = (await page.locator(".story-stage").boundingBox())!;
      const presence = (await inspect(page)).scene!.nts.composition.presence;
      expect(presence.visible).toBe(true);
      expect(presence.y + stageBox.y).toBeGreaterThanOrEqual(0);
      expect(presence.x + stageBox.x).toBeGreaterThanOrEqual(0);
      expect(presence.x + presence.width + stageBox.x).toBeLessThanOrEqual(viewport.width);
      expect(presence.y + presence.height * .35 + stageBox.y, "upper presence must remain visible above the reading surface").toBeLessThanOrEqual(pairBox.y);
    }
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect.poll(async () => (await inspect(page)).scene!.nts.textureCount).toBe(1);
  await settle(page);
  await expect(page.locator(".nts-dom-image img")).toBeHidden();
  expect(await page.locator(".nts-dom-image img").getAttribute("src")).toBeNull();
  expect((await inspect(page)).scene!.nts.visibleMemories).toEqual(["s5"]);
  expect([...new Set(requests.full)]).toEqual(["s5"]);
});

test("no-WebGL ribbon retains all preview choices and explicit full-image ownership", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const requests = watchImages(page);
  await selectNts(page, "/?forceNoWebgl=1");
  await enter(page);
  await expectPreviews(page);
  await expect(page.locator("canvas.story-canvas")).toHaveCount(0);
  expect(await page.locator(".nts-memory-nav").evaluate(element => getComputedStyle(element).display)).not.toBe("grid");
  expect(requests.full).toEqual([]);
  const choice = page.locator(`${previews}[data-nts-memory="s4"]`);
  await choice.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".nts-caption .nts-authored")).toHaveText(MEMORIES[3].en);
  await expect(page.locator(".nts-reading-pair > .nts-dom-image + .nts-caption")).toHaveCount(1);
  await expect(page.locator(".nts-dom-image img")).toBeVisible();
  await expect.poll(() => requests.full.length).toBe(1);
  expect(requests.full).toEqual(["s4"]);
  await page.locator('[data-nts="return"]').click();
  await expect.poll(async () => (await inspect(page)).state.phase).toBe("closed");
  await expect(page.locator('[data-ecosystem="visit-nts"]')).toBeFocused();
  expect(await page.locator(".nts-dom-image img").getAttribute("src")).toBeNull();
});

test("keyboard entry while the ecosystem list is open renders NTS and restores that list", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await selectNts(page);
  await page.locator('.story-header [data-action="story-list"]').click();
  await expect(page.locator(".ecosystem-list")).toBeVisible();
  await settle(page);
  const before = await inspect(page);
  expect(before.ecosystem).toMatchObject({ selectedNodeId: "nutuensai", listOpen: true });
  const visit = page.locator('[data-ecosystem="visit-nts"]');
  await expect(visit).toBeVisible();
  await visit.focus();
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await inspect(page)).state.phase).toBe("settled");
  await expectPreviews(page);
  await expect.poll(async () => (await inspect(page)).scene!.renderCount).toBeGreaterThan(before.scene!.renderCount);
  await page.locator(`${previews}[data-nts-memory="s2"]`).click();
  await expect.poll(async () => (await inspect(page)).scene!.nts.textureCount).toBe(1);
  await page.locator('[data-nts="return"]').click();
  await expect.poll(async () => (await inspect(page)).state.phase).toBe("closed");
  const after = await inspect(page);
  expect(after.ecosystem).toEqual(before.ecosystem);
  expect(after.story).toEqual(before.story);
  expect(after.locale).toBe(before.locale);
  expect(after.sound).toBe(before.sound);
  await expect(page.locator(".ecosystem-list")).toBeVisible();
  await expect(visit).toBeFocused();
});
