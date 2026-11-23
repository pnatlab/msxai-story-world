import { expect, test, type Page } from "@playwright/test";
import { FOUNDATIONAL_SESSION_KEY } from "../src/ui/foundationalOpeningModel";

const story = (page: Page) => page.locator(".mss-destination");
const scroll = (page: Page) => story(page).locator(".mss-scroll");
const orb = (page: Page) => page.locator("[data-mss-orb]");
const preview = (page: Page) => page.locator("dialog.mss-workspace");
const dismiss = (page: Page) => preview(page).locator("[data-mss-close-workspace]");
const visit = (page: Page) => page.locator('[data-ecosystem="visit-mss"]');
const storyReturn = (page: Page) => story(page).locator('[data-mss="return"]');

async function selectMss(page: Page, baseURL: string, fallback = false): Promise<void> {
  await page.addInitScript(key => sessionStorage.setItem(key, "seen"), FOUNDATIONAL_SESSION_KEY);
  await page.goto(new URL(fallback ? "?forceNoWebgl=1" : "./", baseURL).href);
  const entry = fallback ? ".story-list" : ".entry-card";
  const nodes = fallback ? ".ecosystem-list" : ".ecosystem-labels";
  await page.locator(`${entry} [data-action="living-ecosystem"]`).click();
  await page.locator(`${nodes} [data-ecosystem-node="mss"]`).click();
  await expect(visit(page)).toBeVisible();
}

async function enterMss(page: Page, fallback = false): Promise<void> {
  await visit(page).click();
  await expect(story(page)).toHaveAttribute("data-renderer", fallback ? "fallback" : "webgl", { timeout: 15_000 });
  await expect(story(page)).toHaveAttribute("data-workspace", "idle");
  await expect(preview(page)).toBeHidden();
}

async function setProgress(page: Page, progress: number): Promise<void> {
  await scroll(page).evaluate((element, fraction) => {
    element.scrollTop = Math.round((element.scrollHeight - element.clientHeight) * fraction);
  }, progress);
  await expect(story(page)).toHaveAttribute("data-phase", String(Math.min(3, Math.floor(progress * 4))));
}

async function settle(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => {
    const state = window.__MSXAI_STORY_WORLD__!.inspect();
    return "renderLoopActive" in state && state.renderLoopActive;
  }), { timeout: 12_000 }).toBe(false);
}

const rendered = (page: Page) => page.evaluate(() => {
  const state = window.__MSXAI_STORY_WORLD__!.inspect();
  if (!("renderCount" in state)) throw new Error("Expected a shared WebGL renderer");
  return { scene: state.mss, gpu: state.gpu, frames: state.renderCount, calls: state.drawCalls };
});

async function expectModal(page: Page): Promise<void> {
  await expect(story(page)).toHaveAttribute("data-workspace", "open");
  await expect(preview(page)).toBeVisible();
  await expect(preview(page)).toBeInViewport();
  expect(await preview(page).evaluate(dialog => dialog.matches(":modal"))).toBe(true);
  await expect(dismiss(page)).toBeFocused();
}

test("click invites a finite workspace reveal and dismiss restores scroll, camera and focus", async ({ page, baseURL }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const unexpected: string[] = [];
  const errors: string[] = [];
  const host = new URL(baseURL!).origin;
  page.on("request", request => {
    const url = new URL(request.url());
    if (!["http:", "https:"].includes(url.protocol)) return;
    if (url.origin !== host || !["GET", "HEAD"].includes(request.method()) ||
        ["fetch", "xhr", "eventsource"].includes(request.resourceType())) {
      unexpected.push(`${request.method()} ${request.url()}`);
    }
  });
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });

  await selectMss(page, baseURL!);
  await settle(page);
  const beforeVisit = await rendered(page);
  await enterMss(page);
  await setProgress(page, .62);
  await settle(page);
  await expect(orb(page)).toHaveAccessibleName("Open MSS workspace preview");
  const initialTop = await scroll(page).evaluate(element => element.scrollTop);
  const before = await rendered(page);
  const anchor = before.scene?.orb;
  expect(anchor).toBeDefined();
  const target = await orb(page).boundingBox();
  const canvas = await page.locator("canvas.story-canvas").boundingBox();
  expect(Math.abs(target!.x + target!.width / 2 - (canvas!.x + anchor!.x * canvas!.width))).toBeLessThan(12);
  expect(Math.abs(target!.y + target!.height / 2 - (canvas!.y + anchor!.y * canvas!.height))).toBeLessThan(12);

  await story(page).evaluate(element => {
    const states: string[] = [];
    const observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.oldValue) states.push(record.oldValue);
      }
      states.push((element as HTMLElement).dataset.workspace ?? "");
    });
    observer.observe(element, { attributes: true, attributeFilter: ["data-workspace"], attributeOldValue: true });
    (element as HTMLElement & { workspaceTest?: string[] }).workspaceTest = states;
  });
  await orb(page).click();
  await expectModal(page);
  const states = await story(page).evaluate(element => (element as HTMLElement & { workspaceTest?: string[] }).workspaceTest);
  expect(states).toContain("revealing");
  await expect(preview(page)).toContainText("Mindful System Studio");
  await expect(preview(page)).toContainText("Human–AI Workspace by MSxAI");
  await expect(preview(page)).toContainText("NuTuenSai");
  await expect(preview(page).locator("[data-mss-preview-label]")).toHaveText("Preview");
  await expect(preview(page).locator("[data-mss-workspace-note]")).toHaveText("Read-only demonstration. No messages are sent.");
  await expect(preview(page).getByRole("textbox", { name: "Message" })).toBeDisabled();
  for (const label of ["Send message", "Add", "Manage Context"]) {
    await expect(preview(page).getByRole("button", { name: label, exact: true })).toBeDisabled();
  }

  for (let index = 0; index < 3; index++) {
    await page.keyboard.press("Tab");
    expect(await preview(page).evaluate(element => {
      const focus = document.activeElement;
      return focus === document.body || element.contains(focus);
    })).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(preview(page)).toBeHidden();
  await expect(story(page)).toHaveAttribute("data-workspace", "idle");
  await expect(orb(page)).toBeFocused();
  await expect(story(page)).toHaveAttribute("data-phase", "2");
  expect(await scroll(page).evaluate(element => element.scrollTop)).toBe(initialTop);
  await settle(page);
  const restored = await rendered(page);
  expect(restored.scene?.progress).toBe(before.scene?.progress);
  expect(restored.scene?.cameraPosition).toEqual(before.scene?.cameraPosition);
  const revealedGpu = restored.gpu;

  await orb(page).press("Enter");
  await expectModal(page);
  await dismiss(page).click();
  await expect(preview(page)).toBeHidden();
  await expect(orb(page)).toBeFocused();
  await settle(page);
  const idle = await rendered(page);
  expect(idle.gpu).toEqual(revealedGpu);
  await page.waitForTimeout(250);
  expect((await rendered(page)).frames).toBe(idle.frames);

  await storyReturn(page).click();
  await expect(preview(page)).toBeHidden();
  await expect(story(page)).toBeHidden();
  await expect(visit(page)).toBeFocused();
  await settle(page);
  const afterVisit = await rendered(page);
  expect(afterVisit.scene).toBeUndefined();
  expect(afterVisit.gpu).toEqual(beforeVisit.gpu);
  expect(unexpected).toEqual([]);
  expect(errors).toEqual([]);
  console.log("MSS workspace shared renderer", JSON.stringify({
    before: beforeVisit.gpu,
    inStory: { gpu: before.gpu, scene: before.scene?.resources, drawCalls: before.calls },
    after: afterVisit.gpu,
  }));
});

test("Reduced Motion and Thai preserve the complete preview at all supported sizes", async ({ page, baseURL }) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await selectMss(page, baseURL!);
  await enterMss(page);
  await setProgress(page, .62);
  await story(page).locator('[data-mss-locale="th"]').click();
  await expect(orb(page)).toHaveAccessibleName("เปิดตัวอย่างพื้นที่ทำงาน MSS");

  // The synchronous start state distinguishes a skipped transition from a fast fade.
  const synchronousState = await orb(page).evaluate((button: HTMLButtonElement) => {
    button.click();
    return (button.closest(".mss-destination") as HTMLElement).dataset.workspace;
  });
  expect(synchronousState).toBe("open");
  await expectModal(page);
  await expect(preview(page)).toHaveAttribute("lang", "th");
  await expect(preview(page).locator("[data-mss-workspace-note]")).toHaveText("ตัวอย่างแบบอ่านอย่างเดียว ไม่มีการส่งข้อความ");

  for (const viewport of [
    { width: 1440, height: 900 }, { width: 1280, height: 800 }, { width: 390, height: 844 },
    { width: 375, height: 667 }, { width: 430, height: 932 }, { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(dismiss(page)).toBeInViewport({ ratio: 1 });
    const bounds = await preview(page).evaluate(element => ({
      document: document.documentElement.scrollWidth,
      width: element.clientWidth,
      content: element.scrollWidth,
    }));
    expect(bounds.document).toBe(viewport.width);
    expect(bounds.content).toBeLessThanOrEqual(bounds.width + 1);
  }
  await dismiss(page).click();
  await expect(story(page)).toHaveAttribute("data-phase", "2");
  await expect(orb(page)).toBeFocused();
  await expect(storyReturn(page)).toBeInViewport();
});

test("touch opens and dismisses the spatial invitation with a reachable tap target", async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  try {
    const page = await context.newPage();
    await selectMss(page, baseURL!);
    await enterMss(page);
    await setProgress(page, .62);
    const bounds = await orb(page).boundingBox();
    expect(bounds!.width).toBeGreaterThanOrEqual(44);
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    await orb(page).tap();
    await expectModal(page);
    await dismiss(page).tap();
    await expect(preview(page)).toBeHidden();
    await expect(storyReturn(page)).toBeInViewport();
  } finally {
    await context.close();
  }
});

test("DOM fallback keeps the workspace preview available without WebGL", async ({ page, baseURL }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 375, height: 667 });
  await selectMss(page, baseURL!, true);
  await enterMss(page, true);
  await expect(page.locator("canvas.story-canvas")).toHaveCount(0);
  await setProgress(page, .62);
  await expect(orb(page)).toBeVisible();
  await orb(page).press("Enter");
  await expectModal(page);
  await dismiss(page).click();
  await expect(preview(page)).toBeHidden();
  await expect(story(page).locator("[data-mss-fallback]")).toBeVisible();
  await storyReturn(page).click();
  await expect(visit(page)).toBeFocused();
});
