import { expect, test, type Page } from "@playwright/test";
import { FOUNDATIONAL_SESSION_KEY } from "../src/ui/foundationalOpeningModel";

interface ResourceCounts {
  geometries: number;
  materials: number;
  textures: number;
}

interface MssInspection {
  progress: number;
  phase: number;
  cameraPosition: readonly number[];
  resources: ResourceCounts;
}

interface SceneInspection {
  mss?: MssInspection;
  cameraPosition: readonly number[];
  cameraTarget: readonly number[];
  drawCalls: number;
  geometryCount: number;
  materialCount: number;
  gpu: { geometries: number; textures: number };
  renderCount: number;
  renderLoopActive: boolean;
  overviewState: unknown;
  storyState: unknown;
}

const root = (page: Page) => page.locator(".mss-destination");
const scroller = (page: Page) => root(page).locator(".mss-scroll");
const visit = (page: Page) => page.locator('[data-ecosystem="visit-mss"]');
const returnButton = (page: Page) => root(page).locator('[data-mss="return"]');
const canvas = (page: Page) => page.locator("canvas.story-canvas");
const phaseLetters = ["a", "b", "c", "d"] as const;
const phaseArticle = (page: Page, index: number) => root(page).locator(`#mss-phase-${phaseLetters[index]}`);
const phaseButton = (page: Page, index: number) => root(page).locator(`[data-mss-phase="${index}"]`);
const inspect = (page: Page) => page.evaluate(() => window.__MSXAI_STORY_WORLD__!.inspect()) as unknown as Promise<SceneInspection>;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(key => sessionStorage.setItem(key, "seen"), FOUNDATIONAL_SESSION_KEY);
});

async function selectMss(page: Page, fallback = false): Promise<void> {
  await page.goto(fallback ? "/?forceNoWebgl=1" : "/");
  const entry = fallback ? ".story-list" : ".entry-card";
  const nodes = fallback ? ".ecosystem-list" : ".ecosystem-labels";
  await page.locator(`${entry} [data-action="living-ecosystem"]`).click();
  await expect(visit(page)).toBeHidden();
  await page.locator(`${nodes} [data-ecosystem-node="mss"]`).click();
  await expect(visit(page)).toHaveAccessibleName("Visit MSS Story");
}

async function enter(page: Page, renderer = "webgl"): Promise<void> {
  await visit(page).focus();
  await visit(page).press("Enter");
  await expect(root(page)).toBeVisible();
  await expect(root(page)).toHaveAttribute("data-renderer", renderer, { timeout: 15000 });
  await expect(root(page).getByRole("heading", { level: 1 })).toBeFocused();
  await expectPhase(page, 0);
}

async function expectPhase(page: Page, phase: number): Promise<void> {
  await expect(root(page)).toHaveAttribute("data-phase", String(phase));
  await expect(phaseArticle(page, phase)).toBeVisible();
  await expect(root(page).locator(".mss-phase:visible")).toHaveCount(1);
  await expect(phaseButton(page, phase)).toHaveAttribute("aria-current", "step");
}

async function scrollTo(page: Page, progress: number): Promise<void> {
  await scroller(page).evaluate((element, p) => {
    element.scrollTo({ top: Math.round((element.scrollHeight - element.clientHeight) * p), behavior: "instant" });
  }, progress);
}

async function renderedFrame(page: Page, progress: number): Promise<MssInspection> {
  await expect.poll(async () => Math.abs(((await inspect(page)).mss?.progress ?? -1) - progress)).toBeLessThan(.005);
  await expect.poll(async () => (await inspect(page)).renderLoopActive).toBe(false);
  return (await inspect(page)).mss!;
}

test("native scroll drives a reversible camera and four phases with a shared renderer and bounded resources", async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  const externalRequests: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.protocol.startsWith("http") && url.hostname !== "127.0.0.1") externalRequests.push(url.href);
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await selectMss(page);
  await expect.poll(async () => (await inspect(page)).renderLoopActive, { timeout: 12000 }).toBe(false);
  const before = await inspect(page);
  await enter(page);
  await expect(canvas(page)).toHaveCount(1);
  await expect(phaseArticle(page, 0)).toContainText("Every system begins with an intention.");
  const start = await renderedFrame(page, 0);
  expect(start.resources.geometries).toBeGreaterThan(0);
  expect(start.resources.materials).toBeGreaterThan(0);

  await scroller(page).hover({ position: { x: 30, y: 150 } });
  const distance = await scroller(page).evaluate(element => element.scrollHeight - element.clientHeight);
  expect(distance).toBeGreaterThan(0);
  await page.mouse.wheel(0, Math.round(distance * .36));
  await expectPhase(page, 1);
  const firstPass = await renderedFrame(page, .36);
  expect(firstPass.cameraPosition).not.toEqual(start.cameraPosition);
  await expect(phaseArticle(page, 1)).toContainText("Understanding begins before the answer.");

  await scrollTo(page, .63);
  await expectPhase(page, 2);
  const daylight = await renderedFrame(page, .63);
  expect(daylight.cameraPosition).not.toEqual(firstPass.cameraPosition);
  await expect(phaseArticle(page, 2)).toContainText("Intelligence can assist. Human intention leads.");
  await scrollTo(page, .88);
  await expectPhase(page, 3);
  const dusk = await renderedFrame(page, .88);
  expect(dusk.cameraPosition).not.toEqual(daylight.cameraPosition);
  await expect(phaseArticle(page, 3)).toContainText("Human in control · Replaceable intelligence, replaceable hands.");

  await scrollTo(page, .36);
  await expectPhase(page, 1);
  const secondPass = await renderedFrame(page, .36);
  secondPass.cameraPosition.forEach((component, i) => expect(component).toBeCloseTo(firstPass.cameraPosition[i], 4));
  expect(secondPass.resources).toEqual(start.resources);
  const atRestCount = (await inspect(page)).renderCount;
  await page.waitForTimeout(350);
  expect((await inspect(page)).renderCount).toBe(atRestCount);
  const active = await inspect(page);
  expect(active.drawCalls).toBeGreaterThan(0);
  expect(active.gpu.geometries).toBeGreaterThan(before.gpu.geometries);

  await returnButton(page).click();
  await expect(root(page)).toBeHidden();
  await expect(visit(page)).toBeFocused();
  await expect.poll(async () => (await inspect(page)).renderLoopActive, { timeout: 12000 }).toBe(false);
  const after = await inspect(page);
  expect(after.mss).toBeUndefined();
  expect(after.overviewState).toEqual(before.overviewState);
  expect(after.storyState).toEqual(before.storyState);
  expect(after.cameraPosition).toEqual(before.cameraPosition);
  expect(after.cameraTarget).toEqual(before.cameraTarget);
  expect(after.geometryCount).toBe(before.geometryCount);
  expect(after.materialCount).toBe(before.materialCount);
  expect(after.gpu).toEqual(before.gpu);
  await page.waitForTimeout(350);
  expect((await inspect(page)).renderCount).toBe(after.renderCount);
  expect(errors).toEqual([]);
  expect(externalRequests).toEqual([]);
  console.log("MSS renderer before, active, after", JSON.stringify({
    before: before.gpu,
    active: { gpu: active.gpu, scene: active.mss?.resources, drawCalls: active.drawCalls },
    after: after.gpu,
  }));
});

test("reduced motion preserves keyboard access, language, responsive framing and re-entry", async ({ page }) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await selectMss(page);
  await enter(page);
  await scroller(page).focus();
  await page.keyboard.press("End");
  await expectPhase(page, 3);
  await root(page).locator('[data-mss-locale="th"]').click();
  await expect(root(page)).toHaveAttribute("lang", "th");
  await expect(phaseArticle(page, 3)).toContainText("มนุษย์ยังคงกำกับทิศทาง · เปลี่ยนได้ทั้งปัญญาที่ใช้และผู้ช่วยลงมือทำ");
  await expectPhase(page, 3);

  await scrollTo(page, .67);
  const firstStill = await renderedFrame(page, .67);
  await scrollTo(page, .62);
  const secondStill = await renderedFrame(page, .62);
  expect(secondStill.cameraPosition).toEqual(firstStill.cameraPosition);

  for (const viewport of [
    { width: 1440, height: 900 }, { width: 1280, height: 800 }, { width: 1024, height: 768 },
    { width: 390, height: 844 }, { width: 375, height: 667 }, { width: 430, height: 932 }, { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await expectPhase(page, 2);
    await renderedFrame(page, .62);
    await expect(phaseArticle(page, 2)).toBeInViewport({ ratio: .8 });
    await expect(returnButton(page)).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
    const dimensions = await scroller(page).evaluate(element => ({
      width: element.clientWidth,
      scrollWidth: element.scrollWidth,
      progress: element.scrollTop / (element.scrollHeight - element.clientHeight),
    }));
    expect(dimensions.scrollWidth).toBe(dimensions.width);
    expect(dimensions.progress).toBeCloseTo(.62, 2);
  }
  await expect(phaseArticle(page, 2)).toContainText("ปัญญาประดิษฐ์ช่วยได้ แต่เจตนาของมนุษย์ยังเป็นผู้นำทาง");
  await root(page).locator('[data-mss-locale="en"]').click();
  await expect(root(page)).toHaveAttribute("lang", "en");
  await expect(phaseArticle(page, 2)).toContainText("Intelligence can assist. Human intention leads.");
  await page.keyboard.press("Escape");
  await expect(root(page)).toBeHidden();
  await expect(visit(page)).toBeFocused();
  await enter(page);
  await renderedFrame(page, 0);
});

test("without WebGL the static visual, all narrative phases and Return remain available", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await selectMss(page, true);
  await enter(page, "fallback");
  await expect(root(page).locator("[data-mss-fallback]")).toBeVisible();
  await expect(canvas(page)).toHaveCount(0);
  for (const phase of [1, 2, 3, 0]) {
    await phaseButton(page, phase).focus();
    await page.keyboard.press("Enter");
    await expectPhase(page, phase);
  }
  await returnButton(page).click();
  await expect(root(page)).toBeHidden();
  await expect(visit(page)).toBeFocused();
  await expect(page.locator(".ecosystem-list")).toBeVisible();
});

test("WebGL context loss keeps the current chapter readable and restore resumes the same scroll position", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await selectMss(page);
  await enter(page);
  await scrollTo(page, .62);
  await expectPhase(page, 2);
  const before = await renderedFrame(page, .62);
  const supportsContextLoss = await canvas(page).evaluate(element => {
    const extension = (element as HTMLCanvasElement).getContext("webgl2")?.getExtension("WEBGL_lose_context");
    if (!extension) return false;
    element.addEventListener("mss-test-restore-context", () => extension.restoreContext(), { once: true });
    extension.loseContext();
    return true;
  });
  test.skip(!supportsContextLoss, "Browser does not expose WEBGL_lose_context");
  await expect(root(page)).toHaveAttribute("data-renderer", "fallback");
  await expect(root(page).locator("[data-mss-fallback]")).toBeVisible();
  await expectPhase(page, 2);
  await canvas(page).dispatchEvent("mss-test-restore-context");
  await expect(root(page)).toHaveAttribute("data-renderer", "webgl");
  const after = await renderedFrame(page, .62);
  expect(after.cameraPosition).toEqual(before.cameraPosition);
  await expectPhase(page, 2);
  await page.keyboard.press("Escape");
  await expect(visit(page)).toBeFocused();
});
