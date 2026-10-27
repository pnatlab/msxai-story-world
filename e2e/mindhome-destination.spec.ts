import { expect, test, type Page } from "@playwright/test";
import { FOUNDATIONAL_SESSION_KEY } from "../src/ui/foundationalOpeningModel";

type Condition = "cool-air" | "sun-shade" | "rain-green";
type MindHomeInspection = {
  mindhomeState: { active: boolean; condition: Condition; phase: "loading" | "ready" | "closed" };
  mindhome?: {
    ready: boolean;
    currentCondition: Condition;
    requestedCondition: Condition;
    transitionActive: boolean;
    transitionDurationMs: number;
    eventDurationMs: number;
    effectActive: boolean;
    effectKind: string | null;
    resources: { geometries: number; materials: number; textures: number };
    disposed: boolean;
  };
  overviewState: { open: boolean; selectedNodeId?: string; listOpen: boolean };
  storyState: unknown;
  renderCount?: number;
  renderLoopActive?: boolean;
  geometryCount?: number;
  materialCount?: number;
  cameraPosition?: readonly number[];
  cameraTarget?: readonly number[];
};

const root = (page: Page) => page.locator(".mindhome-destination");
const visit = (page: Page) => page.locator('[data-ecosystem="visit-mindhome"]');
const condition = (page: Page, id: Condition) => page.locator(`[data-mindhome-condition="${id}"]`);
const inspect = (page: Page) => page.evaluate(() => window.__MSXAI_STORY_WORLD__!.inspect()) as unknown as Promise<MindHomeInspection>;
const phrases = {
  en: {
    "cool-air": "There can be space before a response.",
    "sun-shade": "What we see is not always the whole meaning.",
    "rain-green": "The next choice remains yours.",
  },
  th: {
    "cool-air": "ก่อนตอบสนอง ยังมีพื้นที่ให้หยุด",
    "sun-shade": "สิ่งที่เห็น อาจยังไม่ใช่ความหมายทั้งหมด",
    "rain-green": "การเลือกก้าวต่อไปยังเป็นของคุณ",
  },
} as const;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(key => sessionStorage.setItem(key, "seen"), FOUNDATIONAL_SESSION_KEY);
});

test("landing shortcuts open MindHome directly and Return restores the landing focus context", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const ntsShortcut = page.locator('.entry-card [data-nutuensai-entry="home"]');
  const mindhomeShortcut = page.locator('.entry-card [data-action="mindhome-story"]');
  await expect(ntsShortcut).toHaveText("NuTuenSai Story");
  await expect(mindhomeShortcut).toHaveText("MindHome Story");
  const [ntsBox, mindhomeBox] = await Promise.all([ntsShortcut.boundingBox(), mindhomeShortcut.boundingBox()]);
  expect(ntsBox).not.toBeNull(); expect(mindhomeBox).not.toBeNull();
  expect(Math.abs(ntsBox!.y - mindhomeBox!.y)).toBeLessThan(2);
  expect(ntsBox!.x + ntsBox!.width).toBeLessThanOrEqual(mindhomeBox!.x);

  const before = await inspect(page);
  await mindhomeShortcut.click();
  await expect(root(page)).toBeVisible(); await settled(page, "cool-air");
  expect((await inspect(page)).mindhomeState.condition).toBe("cool-air");
  expect((await inspect(page)).overviewState).toMatchObject({ open: true, selectedNodeId: "mindhome" });
  expect((await inspect(page)).storyState).toEqual(before.storyState);
  await root(page).locator('[data-mindhome="return"]').click();
  await expect(root(page)).toBeHidden();
  await expect(mindhomeShortcut).toBeFocused();
  expect((await inspect(page)).overviewState.open).toBe(false);
});

test("MindHome header pairs its wordmark with a decorative bundled MSxAI symbol across responsive sizes", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await selectMindHome(page, true);
  await visit(page).click(); await settled(page);
  const brand = page.locator(".mindhome-brand");
  const symbol = brand.locator(".mindhome-brand-symbol");
  const wordmark = brand.getByRole("heading", { name: "MindHome", exact: true });
  await expect(symbol).toBeVisible();
  await expect(symbol).toHaveAttribute("alt", "");
  await expect(symbol).toHaveAttribute("aria-hidden", "true");
  const symbolSource = await symbol.getAttribute("src");
  expect(symbolSource).toContain("data:image/svg+xml,");
  expect(decodeURIComponent(symbolSource!)).toContain("MindHome by MSxAI Symbol");
  await expect(wordmark).toBeVisible();

  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 375, height: 667 }, { width: 430, height: 932 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    const bounds = await page.evaluate(() => {
      const box = (selector: string) => {
        const { x, y, right, bottom, width, height } = document.querySelector(selector)!.getBoundingClientRect();
        return { x, y, right, bottom, width, height };
      };
      return { brand: box(".mindhome-brand"), symbol: box(".mindhome-brand-symbol"), wordmark: box(".mindhome-brand h1"), actions: box(".mindhome-header-actions"), header: box(".mindhome-header"), stage: box(".mindhome-photo-stage"), overflow: document.documentElement.scrollWidth > innerWidth };
    });
    expect(bounds.overflow).toBe(false);
    expect(bounds.symbol.width).toBeGreaterThanOrEqual(viewport.height <= 520 ? 25 : viewport.width <= 700 ? 27 : 33);
    expect(bounds.symbol.right).toBeLessThanOrEqual(bounds.wordmark.x);
    expect(bounds.brand.right).toBeLessThanOrEqual(bounds.actions.x);
    expect(bounds.header.bottom).toBeLessThan(bounds.stage.y);
  }
  await expect(page.locator(".mindhome-destination")).toHaveAccessibleName("MindHome");
});

test("Thai landing shortcut fits mobile, opens in the shared locale, and Escape returns under Reduced Motion", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.locator('[data-locale="th"]').click();
  const ntsShortcut = page.locator('.entry-card [data-nutuensai-entry="home"]');
  const mindhomeShortcut = page.locator('.entry-card [data-action="mindhome-story"]');
  await expect(ntsShortcut).toHaveText("เรื่องราว NuTuenSai");
  await expect(mindhomeShortcut).toHaveText("เรื่องราว MindHome");
  const boxes = await Promise.all([ntsShortcut.boundingBox(), mindhomeShortcut.boundingBox()]);
  expect(boxes.every(Boolean)).toBe(true);
  for (const box of boxes as NonNullable<(typeof boxes)[number]>[]) {
    expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    expect(box!.y).toBeGreaterThanOrEqual(0); expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  }
  const [ntsBox, mindhomeBox] = boxes as [NonNullable<(typeof boxes)[number]>, NonNullable<(typeof boxes)[number]>];
  expect(ntsBox.x + ntsBox.width <= mindhomeBox.x || mindhomeBox.x + mindhomeBox.width <= ntsBox.x ||
    ntsBox.y + ntsBox.height <= mindhomeBox.y || mindhomeBox.y + mindhomeBox.height <= ntsBox.y).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);

  await mindhomeShortcut.focus(); await mindhomeShortcut.press("Enter");
  await expect(root(page)).toBeVisible(); await settled(page, "cool-air");
  await expect(page.locator(".mindhome-phrase")).toHaveText(phrases.th["cool-air"]);
  expect((await inspect(page)).mindhome).toMatchObject({ transitionActive: false, effectActive: false });
  await page.keyboard.press("Escape");
  await expect(root(page)).toBeHidden(); await expect(mindhomeShortcut).toBeFocused();
  await expect(page.locator('[data-locale="th"]')).toHaveClass(/is-active/);
});

async function selectMindHome(page: Page, reduced = false): Promise<void> {
  await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
  await page.goto("/");
  await page.locator('.entry-card [data-action="living-ecosystem"]').click();
  await page.locator('.ecosystem-labels [data-ecosystem-node="mindhome"]').click();
  await expect(visit(page)).toBeVisible();
  expect((await inspect(page)).mindhomeState).toMatchObject({ active: false, phase: "closed" });
}

async function settled(page: Page, id: Condition = "cool-air"): Promise<void> {
  await expect.poll(async () => {
    const state = await inspect(page);
    return state.mindhomeState.phase === "ready" && state.mindhome?.ready &&
      state.mindhome.currentCondition === id && !state.mindhome.transitionActive &&
      !state.mindhome.effectActive && state.renderLoopActive === false;
  }, { timeout: 15000, intervals: [40, 80, 150] }).toBe(true);
  await expect(condition(page, id)).toHaveAttribute("aria-pressed", "true");
}

async function choose(page: Page, id: Condition, locale: "en" | "th" = "en"): Promise<void> {
  await condition(page, id).click();
  await settled(page, id);
  await expect(page.locator(".mindhome-phrase")).toHaveText(phrases[locale][id]);
}

async function idle(page: Page): Promise<void> {
  // Drain the already requested paint boundaries without requesting an app render.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const before = await inspect(page);
  await page.waitForTimeout(500);
  const after = await inspect(page);
  expect(after.renderLoopActive).toBe(false);
  expect(after.renderCount).toBe(before.renderCount);
}

function resources(state: MindHomeInspection) {
  return {
    geometries: state.mindhome?.resources.geometries,
    materials: state.mindhome?.resources.materials,
    textures: state.mindhome?.resources.textures,
    sceneGeometries: state.geometryCount,
    sceneMaterials: state.materialCount,
  };
}

test("explicit ecosystem Visit opens one place with three freely selectable conditions and reversible Return", async ({ page }, info) => {
  test.setTimeout(90000);
  const errors: string[] = [], external: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("request", request => {
    if (!request.url().startsWith("http://127.0.0.1:")) external.push(request.url());
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await selectMindHome(page);
  const before = await inspect(page);
  await visit(page).click();
  await expect(root(page)).toBeVisible();
  await expect(root(page).locator('[data-mindhome="return"]')).toBeEnabled();
  await settled(page);
  await expect(page.locator(".mindhome-phrase")).toHaveText(phrases.en["cool-air"]);
  await expect(page.locator(".mindhome-phrase")).toBeVisible();
  await expect.poll(async () => (await inspect(page)).mindhome?.transitionDurationMs).toBe(2500);
  await expect(page.locator("[data-mindhome-condition]")).toHaveCount(3);
  await expect(root(page)).not.toContainText(/\b(?:Pause|Reflect|Regain Agency|completed|unlock)\b/i);
  await page.screenshot({ path: info.outputPath("mindhome-cool-air-desktop.png") });

  // A visitor can skip, go backward and remain: the ordering is editorial only.
  await choose(page, "rain-green");
  await choose(page, "sun-shade");
  await choose(page, "cool-air");
  await choose(page, "sun-shade");
  await page.screenshot({ path: info.outputPath("mindhome-sun-shade-desktop.png") });
  await choose(page, "rain-green");
  await page.screenshot({ path: info.outputPath("mindhome-rain-green-desktop.png") });
  await idle(page);
  expect((await inspect(page)).mindhomeState.condition).toBe("rain-green");
  expect((await inspect(page)).storyState).toEqual(before.storyState);

  await root(page).locator('[data-mindhome="return"]').click();
  await expect(root(page)).toBeHidden();
  await expect.poll(async () => (await inspect(page)).mindhomeState.phase).toBe("closed");
  await expect(visit(page)).toBeFocused();
  expect((await inspect(page)).overviewState).toEqual(before.overviewState);
  expect((await inspect(page)).storyState).toEqual(before.storyState);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test("keyboard and live EN/TH use the shared locale while Reduced Motion stays still", async ({ page }) => {
  test.setTimeout(45000);
  await selectMindHome(page, true);
  await visit(page).focus(); await visit(page).press("Enter");
  await settled(page);
  expect((await inspect(page)).mindhome).toMatchObject({ transitionActive: false, effectActive: false });
  await condition(page, "rain-green").focus(); await condition(page, "rain-green").press("Space");
  await settled(page, "rain-green");
  await expect(page.locator(".mindhome-phrase")).toHaveText(phrases.en["rain-green"]);
  await root(page).locator('[data-mindhome-locale="th"]').click();
  await expect(page.locator(".mindhome-phrase")).toHaveText(phrases.th["rain-green"]);
  await choose(page, "sun-shade", "th");
  await choose(page, "cool-air", "th");
  await root(page).locator('[data-mindhome-locale="en"]').click();
  await expect(page.locator(".mindhome-phrase")).toHaveText(phrases.en["cool-air"]);
  await idle(page);
  await page.keyboard.press("Escape");
  await expect(root(page)).toBeHidden(); await expect(visit(page)).toBeFocused();
});

test("narrative fades with the image transition and finite events settle at the authored durations", async ({ page }) => {
  test.setTimeout(60000);
  await selectMindHome(page); await visit(page).click(); await settled(page);
  const phrase = page.locator(".mindhome-phrase");
  for (const [id, duration] of [["sun-shade", 3500], ["rain-green", 4600], ["cool-air", 4200]] as const) {
    const oldText = await phrase.textContent();
    await condition(page, id).click();
    await expect(root(page).locator(".mindhome-photo-stage")).toHaveAttribute("data-transitioning", "true");
    await expect(phrase).toHaveText(oldText!);
    await expect.poll(() => phrase.evaluate(element => Number.parseFloat(getComputedStyle(element).opacity)), { intervals: [30] }).toBeLessThan(.4);
    await expect.poll(async () => (await inspect(page)).mindhome?.eventDurationMs).toBe(duration);
    await settled(page, id);
    await expect(phrase).toHaveText(phrases.en[id]);
    await expect.poll(() => phrase.evaluate(element => Number.parseFloat(getComputedStyle(element).opacity))).toBe(1);
    await idle(page);
  }
});

test("finite registered events return idle and repeated visits dispose resources, including interrupted transitions", async ({ page }) => {
  test.setTimeout(90000);
  await selectMindHome(page);
  const closed = await inspect(page);
  await visit(page).click(); await settled(page);
  const firstResources = resources(await inspect(page));
  for (const id of ["sun-shade", "rain-green", "cool-air"] as const) {
    await condition(page, id).click();
    await expect.poll(async () => (await inspect(page)).mindhome?.effectActive, { timeout: 6000, intervals: [25] }).toBe(true);
    await settled(page, id);
    expect(resources(await inspect(page))).toEqual(firstResources);
    await idle(page);
  }
  await condition(page, "rain-green").click();
  await expect.poll(async () => (await inspect(page)).mindhome?.transitionActive, { intervals: [20] }).toBe(true);
  await expect(root(page).locator('[data-mindhome="return"]')).toBeEnabled();
  await root(page).locator('[data-mindhome="return"]').click();
  await expect(root(page)).toBeHidden();
  await expect.poll(async () => (await inspect(page)).mindhomeState.phase).toBe("closed");
  const afterCancel = await inspect(page);
  expect(afterCancel.mindhome).toBeUndefined();
  expect(afterCancel.geometryCount).toBe(closed.geometryCount);
  expect(afterCancel.materialCount).toBe(closed.materialCount);
  await page.waitForTimeout(400);
  expect((await inspect(page)).mindhomeState.phase).toBe("closed");

  await page.emulateMedia({ reducedMotion: "reduce" });
  for (let cycle = 0; cycle < 3; cycle++) {
    await visit(page).click(); await settled(page);
    expect(resources(await inspect(page))).toEqual(firstResources);
    await choose(page, "rain-green");
    await root(page).locator('[data-mindhome="return"]').click();
    await expect(root(page)).toBeHidden();
    const returned = await inspect(page);
    expect(returned.mindhome).toBeUndefined();
    expect(returned.geometryCount).toBe(closed.geometryCount);
    expect(returned.materialCount).toBe(closed.materialCount);
    await expect(visit(page)).toBeFocused();
  }
});

test("one photograph framing keeps controls separate across desktop, portrait, short landscape and both locales", async ({ page }, info) => {
  test.setTimeout(90000);
  await selectMindHome(page, true); await visit(page).click(); await settled(page);
  for (const viewport of [
    { width: 1440, height: 900 }, { width: 390, height: 844 },
    { width: 375, height: 667 }, { width: 430, height: 932 }, { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport); await settled(page, (await inspect(page)).mindhomeState.condition);
    for (const locale of ["en", "th"] as const) {
      await root(page).locator(`[data-mindhome-locale="${locale}"]`).click();
      await choose(page, "sun-shade", locale);
      const layout = await root(page).evaluate(element => {
        const stage = element.querySelector(".mindhome-photo-stage")!.getBoundingClientRect();
        const image = element.querySelector<HTMLImageElement>(".mindhome-photo-stage img")!;
        const phrase = element.querySelector<HTMLElement>(".mindhome-phrase")!.getBoundingClientRect();
        const presence = element.querySelector<HTMLElement>(".mindhome-presence")!.getBoundingClientRect();
        const footer = element.querySelector<HTMLElement>(".mindhome-footer")!.getBoundingClientRect();
        const targets = [...element.querySelectorAll<HTMLButtonElement>("button")].filter(button => !button.hidden);
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          stage: { left: stage.left, right: stage.right, top: stage.top, bottom: stage.bottom, width: stage.width, height: stage.height },
          phrase: { left: phrase.left, right: phrase.right, top: phrase.top, bottom: phrase.bottom, width: phrase.width, height: phrase.height },
          presence: { left: presence.left, right: presence.right, top: presence.top, bottom: presence.bottom, width: presence.width },
          footerTop: footer.top,
          imageReady: image.complete && image.naturalWidth > 0,
          targets: targets.map(button => {
            const box = button.getBoundingClientRect();
            return { text: button.textContent, width: box.width, height: box.height,
              invitation: button.hasAttribute("data-mindhome-invite"),
              imageX: (box.x + box.width / 2 - stage.left) / stage.width,
              imageY: (box.y + box.height / 2 - stage.top) / stage.height,
              visible: box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight,
              ownsPointer: button.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)),
              overlapsPhoto: box.left < stage.right && box.right > stage.left && box.top < stage.bottom && box.bottom > stage.top };
          }),
        };
      });
      expect(layout.overflow, `${viewport.width}×${viewport.height} ${locale}`).toBe(false);
      expect(layout.imageReady).toBe(true);
      expect(layout.stage.left).toBeGreaterThanOrEqual(0); expect(layout.stage.right).toBeLessThanOrEqual(viewport.width);
      expect(layout.stage.width).toBeGreaterThan(200); expect(layout.stage.height).toBeGreaterThan(100);
      expect(layout.phrase.left, `${viewport.width}×${viewport.height} ${locale} phrase left`).toBeGreaterThanOrEqual(layout.stage.left);
      expect(layout.phrase.right, `${viewport.width}×${viewport.height} ${locale} phrase right`).toBeLessThanOrEqual(layout.stage.right);
      expect(layout.phrase.top, `${viewport.width}×${viewport.height} ${locale} phrase top`).toBeGreaterThan(layout.stage.top);
      if (viewport.width <= 700) {
        // Portrait keeps the complete place above a shared foreground composition;
        // the sentence has its own space beside the figure, before the controls.
        expect(layout.phrase.top).toBeGreaterThanOrEqual(layout.stage.bottom);
        expect(layout.phrase.bottom).toBeLessThan(layout.footerTop + 128);
        expect(layout.presence.bottom).toBeLessThan(layout.footerTop + 128);
      } else {
        expect(layout.phrase.bottom, `${viewport.width}×${viewport.height} ${locale} phrase bottom`).toBeLessThan(layout.stage.bottom);
      }
      expect(layout.presence.right).toBeLessThan(layout.stage.left + layout.stage.width * .49);
      expect(layout.presence.width).toBeLessThanOrEqual(layout.stage.width * .48 + 1);
      expect(layout.phrase.width, `${viewport.width}×${viewport.height} ${locale} phrase width`).toBeLessThan(layout.stage.width);
      await expect(page.locator(".mindhome-phrase")).toHaveText(phrases[locale]["sun-shade"]);
      for (const target of layout.targets) {
        expect(target.width, `${viewport.width}×${viewport.height}: ${target.text}`).toBeGreaterThanOrEqual(44);
        expect(target.height, `${viewport.width}×${viewport.height}: ${target.text}`).toBeGreaterThanOrEqual(44);
        expect(target.visible, `${viewport.width}×${viewport.height}: ${target.text}`).toBe(true);
        expect(target.ownsPointer, `${viewport.width}×${viewport.height}: ${target.text}`).toBe(true);
        if (target.invitation) {
          // The invitation is intentionally registered to the pavilion in the photograph.
          expect(target.overlapsPhoto).toBe(true);
          expect(target.imageX).toBeCloseTo(.64, 2);
          expect(target.imageY).toBeCloseTo(.55, 2);
        } else {
          expect(target.overlapsPhoto, `${viewport.width}×${viewport.height}: ${target.text}`).toBe(false);
        }
      }
      await page.screenshot({ path: info.outputPath(`mindhome-${viewport.width}x${viewport.height}-${locale}.png`) });
      await choose(page, "rain-green", locale);
    }
  }
});

test("Return after a destination aspect change restores the same ecosystem arrangement as normal target-aspect viewing", async ({ page }) => {
  test.setTimeout(45000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await selectMindHome(page, true);
  const ecosystemSettled = async () => {
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect.poll(async () => (await inspect(page)).renderLoopActive).toBe(false);
  };
  const positions = () => page.locator(".ecosystem-labels [data-ecosystem-node]").evaluateAll(buttons =>
    Object.fromEntries(buttons.map(element => {
      const button = element as HTMLButtonElement;
      return [button.dataset.ecosystemNode!, { x: parseFloat(button.style.left), y: parseFloat(button.style.top), hidden: button.hidden }];
    })));
  for (const [origin, target] of [
    [{ width: 1440, height: 900 }, { width: 390, height: 844 }],
    [{ width: 390, height: 844 }, { width: 1440, height: 900 }],
  ] as const) {
    // Establish the actual normal ecosystem projection at the target aspect.
    await page.setViewportSize(target); await ecosystemSettled();
    const expectedPositions = await positions(), expectedCamera = await inspect(page);
    await page.setViewportSize(origin); await ecosystemSettled();
    await visit(page).click(); await settled(page);
    await page.setViewportSize(target); await settled(page);
    await root(page).locator('[data-mindhome="return"]').click();
    await expect(root(page)).toBeHidden(); await ecosystemSettled();
    await expect(visit(page)).toBeFocused();
    const actualPositions = await positions(), actualCamera = await inspect(page);
    expect(actualCamera.overviewState.selectedNodeId).toBe("mindhome");
    for (const [id, expected] of Object.entries(expectedPositions)) {
      expect(actualPositions[id].hidden, id).toBe(expected.hidden);
      expect(actualPositions[id].x, `${id}: horizontal target-aspect projection`).toBeCloseTo(expected.x, 4);
      expect(actualPositions[id].y, `${id}: vertical target-aspect projection`).toBeCloseTo(expected.y, 4);
    }
    for (const key of ["cameraPosition", "cameraTarget"] as const) for (let axis = 0; axis < 3; axis++) {
      expect(actualCamera[key]![axis], `${key}[${axis}]`).toBeCloseTo(expectedCamera[key]![axis], 6);
    }
  }
});

test("without WebGL the same still place, free condition choices and Return remain available", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?forceNoWebgl=1");
  await page.locator('.story-list [data-action="living-ecosystem"]').click();
  await page.locator('.ecosystem-list [data-ecosystem-node="mindhome"]').click();
  await visit(page).click();
  await expect(root(page)).toBeVisible();
  await expect(root(page).locator(".mindhome-photo-stage img").first()).toBeVisible();
  await expect(page.locator(".mindhome-phrase")).toHaveText(phrases.en["cool-air"]);
  for (const id of ["rain-green", "sun-shade", "cool-air"] as const) {
    await condition(page, id).click();
    await expect(condition(page, id)).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".mindhome-phrase")).toHaveText(phrases.en[id]);
  }
  await root(page).locator('[data-mindhome="return"]').click();
  await expect(root(page)).toBeHidden(); await expect(visit(page)).toBeFocused();
  await expect(page.locator("canvas")).toHaveCount(0);
});

test("Return during source loading cannot revive a retired destination and a fresh Visit still succeeds", async ({ page }) => {
  test.setTimeout(45000);
  await selectMindHome(page, true);
  const before = await inspect(page);
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let requests = 0;
  await page.route("**/mindhome/*.png", async route => {
    requests++;
    await held;
    await route.continue();
  });
  await visit(page).click();
  await expect(root(page)).toBeVisible();
  await expect.poll(() => requests).toBeGreaterThan(0);
  await expect(root(page).locator('[data-mindhome="return"]')).toBeEnabled();
  await root(page).locator('[data-mindhome="return"]').click();
  await expect(root(page)).toBeHidden();
  release();
  // Drain in-flight route handlers before removing interception; plain unroute
  // can auto-handle a held request while its continue() is resuming.
  await page.unrouteAll({ behavior: "wait" });
  await page.waitForTimeout(500);
  const returned = await inspect(page);
  expect(returned.mindhomeState).toMatchObject({ active: false, phase: "closed" });
  expect(returned.mindhome).toBeUndefined();
  expect(returned.geometryCount).toBe(before.geometryCount);
  expect(returned.materialCount).toBe(before.materialCount);
  await expect(visit(page)).toBeFocused();
  await visit(page).click(); await settled(page);
  await expect(page.locator(".mindhome-phrase")).toHaveText(phrases.en["cool-air"]);
  await root(page).locator('[data-mindhome="return"]').click();
  await expect(root(page)).toBeHidden();
});

test("a missing condition texture leaves available still images, authored language and Return usable", async ({ page }) => {
  test.setTimeout(30000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  // The one deliberately aborted image request is expected; WebGL shader and
  // every other console error remain failures, including fallback rendering.
  page.on("console", message => {
    if (message.type() !== "error") return;
    const expectedAbort = /sun-and-shade\.png/.test(message.location().url) && /(?:ERR_FAILED|ERR_ABORTED|Failed to load resource)/.test(message.text());
    if (!expectedAbort) errors.push(message.text());
  });
  await page.route("**/mindhome/sun-and-shade.png", route => route.abort());
  await selectMindHome(page, true);
  await visit(page).click();
  await expect(root(page)).toBeVisible();
  const image = root(page).locator(".mindhome-photo-stage img").first();
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).complete && (element as HTMLImageElement).naturalWidth > 0)).toBe(true);
  await expect(page.locator(".mindhome-phrase")).toHaveText(phrases.en["cool-air"]);
  await condition(page, "rain-green").click();
  await expect(condition(page, "rain-green")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".mindhome-phrase")).toHaveText(phrases.en["rain-green"]);
  await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).complete && (element as HTMLImageElement).naturalWidth > 0)).toBe(true);
  await root(page).locator('[data-mindhome="return"]').click();
  await expect(root(page)).toBeHidden(); await expect(visit(page)).toBeFocused();
  expect(errors).toEqual([]);
});
