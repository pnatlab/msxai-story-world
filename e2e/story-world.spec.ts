import { expect, test } from "@playwright/test";

const screenshotPath = (name: string) => `artifacts/screenshots/${name}.png`;
type Inspection = {
  rendererType?: string;
  cameraType?: string;
  usesRaycasting?: boolean;
  sceneObjectPositions?: Record<string, readonly number[]>;
  activeStoryBeat?: string;
  cameraPosition?: readonly number[];
  selectedNode?: string;
  renderLoopActive?: boolean;
  renderCount?: number;
  semanticNodeCount?: number;
  ambientNodeCount?: number;
  semanticConnectionCount?: number;
  ambientConnectionCount?: number;
};

async function inspect(page: import("@playwright/test").Page): Promise<Inspection> {
  return page.evaluate(() => window.__MSXAI_STORY_WORLD__?.inspect()) as Promise<Inspection>;
}

test.describe("MSxAI Story World Slice 1", () => {
  test("runs a real spatial guided story without operational network activity", async ({ page }) => {
    const operationalRequests: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (url.includes("11434") || /\/api\/(chat|tags)/.test(url) || url.includes("app.py")) operationalRequests.push(url);
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.getByTestId("entry-card")).toBeVisible();
    await expect(page.locator("canvas.story-canvas")).toHaveCount(1);
    await page.screenshot({ path: screenshotPath("A-opening"), animations: "disabled" });

    const opening = await inspect(page);
    expect(opening).toMatchObject({ rendererType: "WebGLRenderer", cameraType: "PerspectiveCamera", usesRaycasting: true });
    expect(new Set(Object.values(opening?.sceneObjectPositions ?? {}).map((position) => position.join(","))).size).toBe(8);
    expect(opening).toMatchObject({
      semanticNodeCount: 8,
      ambientNodeCount: 31,
      semanticConnectionCount: 7,
      ambientConnectionCount: 6,
    });

    await page.getByRole("button", { name: "Begin the Story" }).click();
    await expect(page.locator(".story-copy h1")).toHaveText("HUMAN");
    await page.waitForTimeout(1100);
    await page.screenshot({ path: screenshotPath("B-human"), animations: "disabled" });

    const human = await inspect(page);
    await page.getByRole("button", { name: "Reveal Intention" }).click();
    await expect(page.locator(".story-copy h1")).toHaveText("INTENTION");
    await page.waitForTimeout(1500);
    await page.screenshot({ path: screenshotPath("C-intention"), animations: "disabled" });
    const intention = await inspect(page);
    expect(intention?.activeStoryBeat).toBe("intention");
    expect(intention?.cameraPosition).not.toEqual(human?.cameraPosition);

    await page.getByRole("button", { name: "Reveal MSxAI" }).click();
    await expect(page.locator(".story-copy h1")).toHaveText("MSxAI");
    await page.waitForTimeout(1700);
    await page.screenshot({ path: screenshotPath("D-msxai"), animations: "disabled" });
    const msxai = await inspect(page);
    expect(msxai?.activeStoryBeat).toBe("msxai");
    expect(msxai?.cameraPosition).not.toEqual(intention?.cameraPosition);
    expect(operationalRequests).toEqual([]);
  });

  test("supports Free Explore, shared selection, Story List, and clean teardown", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.getByRole("button", { name: "Explore Freely", exact: true }).first().click();
    await expect(page.locator(".free-mode-cue")).toHaveText("Free Explore");
    await page.locator('.node-label[data-node-id="msxai"]').click();
    const freeSelection = await inspect(page);
    expect(freeSelection?.selectedNode).toBe("msxai");
    await page.screenshot({ path: screenshotPath("E-free-explore"), animations: "disabled" });

    await page.getByRole("button", { name: "Story List" }).click();
    await expect(page.getByTestId("story-list")).toBeVisible();
    const listInspection = await inspect(page);
    expect(listInspection.renderLoopActive).toBe(false);
    await expect(page.getByText("Human holds Intention", { exact: false })).toBeVisible();
    await page.screenshot({ path: screenshotPath("F-story-list"), animations: "disabled" });
    await page.getByRole("button", { name: "Return to Story View" }).click();
    await expect(page.getByTestId("story-list")).toBeHidden();

    const afterList = await inspect(page);
    expect(afterList?.selectedNode).toBe("msxai");
    expect(afterList.renderCount).toBeGreaterThan(0);
    await page.evaluate(() => window.__MSXAI_STORY_WORLD__?.destroy());
    expect(await page.locator("canvas.story-canvas").count()).toBe(0);
  });

  test("falls back to Story List and supports reduced motion on a mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/?forceNoWebgl=1");
    await expect(page.locator("canvas.story-canvas")).toHaveCount(0);
    await expect(page.getByTestId("story-list")).toBeVisible();
    await expect(page.getByText("3D Story View is unavailable", { exact: false })).toBeVisible();
    await page.screenshot({ path: screenshotPath("G-mobile-list-fallback"), animations: "disabled" });
  });

  test("switches EN and TH presentation without changing story state", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.locator('[data-locale="en"]')).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Begin the Story" }).click();
    await page.waitForTimeout(1100);
    const before = await inspect(page);
    await expect(page.locator(".story-copy h1")).toHaveText("HUMAN");

    await page.getByRole("button", { name: "ภาษาไทย" }).click();
    await expect(page.locator('[data-locale="th"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".story-copy h1")).toHaveText("ผู้ถือเจตนา");
    await expect(page.getByRole("button", { name: "รายการเรื่องเล่า" })).toBeVisible();
    const afterThai = await inspect(page);
    expect(afterThai).toMatchObject({ activeStoryBeat: before?.activeStoryBeat, selectedNode: before?.selectedNode });
    expect(afterThai?.cameraPosition).toEqual(before?.cameraPosition);

    await page.getByRole("button", { name: "เกี่ยวกับ / ความหมาย" }).click();
    const meaning = page.getByRole("dialog");
    await expect(meaning.locator("h2")).toHaveText("โลกเชิงแนวคิดที่สามารถสำรวจได้");
    await expect(meaning).toContainText("ไม่ได้เปลี่ยนแปลง MSS");
    await meaning.getByRole("button", { name: "ปิดเกี่ยวกับ" }).click();
    await page.locator('[data-action="explore"]').click();
    await page.locator('.node-label[data-node-id="msxai"]').click();
    await expect(page.locator(".concept-detail")).toContainText("เจตนามาก่อน");

    await page.getByRole("button", { name: "รายการเรื่องเล่า" }).click();
    await expect(page.getByTestId("story-list")).toBeVisible();
    await expect(page.getByTestId("story-list").getByText("ความสัมพันธ์เชิงแนวคิด", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "English" }).click();
    await expect(page.getByRole("button", { name: "Story List" })).toBeVisible();
    await expect(page.getByTestId("story-list").getByText("Conceptual relationships", { exact: false })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator(".language-switch")).toBeVisible();
    const languageBox = await page.locator(".language-switch").boundingBox();
    const storyListBox = await page.getByRole("button", { name: "Story List" }).boundingBox();
    expect(languageBox && storyListBox).toBeTruthy();
    expect(languageBox!.x).toBeGreaterThanOrEqual(storyListBox!.x + storyListBox!.width - 1);
  });
});
