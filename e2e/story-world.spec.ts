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

test.describe("MSxAI Story World Acts 1 and 2", () => {
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
    expect(new Set(Object.values(opening?.sceneObjectPositions ?? {}).map((position) => position.join(","))).size).toBe(14);
    expect(opening).toMatchObject({
      semanticNodeCount: 14,
      ambientNodeCount: 31,
      semanticConnectionCount: 13,
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

    await page.getByRole("button", { name: "Meet the Ecosystem" }).click();
    await expect(page.locator(".story-copy h1")).toHaveText("THE LIVING ECOSYSTEM");
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: "Story List" }).click();
    await expect(page.getByTestId("story-list").locator('[data-copy="current-beat-title"]')).toHaveText("THE LIVING ECOSYSTEM");
    await page.getByRole("button", { name: "Return to Story View" }).click();

    await page.getByRole("button", { name: "Meet MindHome" }).click();
    await expect(page.locator(".story-copy h1")).toHaveText("MindHome");
    await page.waitForTimeout(1400);
    await page.screenshot({ path: screenshotPath("J-act2-mindhome"), animations: "disabled" });

    await page.getByRole("button", { name: "Meet MSS" }).click();
    await expect(page.locator(".story-copy h1")).toHaveText("MSS");
    await page.waitForTimeout(1400);
    await page.screenshot({ path: screenshotPath("I-act2-mss"), animations: "disabled" });

    await page.getByRole("button", { name: "Meet Mindful Health Balance" }).click();
    await expect(page.locator(".story-copy h1")).toHaveText("Mindful Health Balance");
    await page.getByRole("button", { name: "Meet Wave Glass / Project H" }).click();
    await expect(page.locator(".story-copy h1")).toHaveText("Wave Glass / Project H");
    await page.getByRole("button", { name: "Meet NuTuenSai" }).click();
    await expect(page.locator(".story-copy h1")).toHaveText("NuTuenSai");
    await page.waitForTimeout(1450);
    await page.screenshot({ path: screenshotPath("K-act2-nutuensai-field"), animations: "disabled" });

    await page.getByRole("button", { name: "Meet LLi" }).click();
    await expect(page.locator(".story-copy h1")).toHaveText("LLi");
    await page.waitForTimeout(1300);
    await page.screenshot({ path: screenshotPath("L-act2-lli"), animations: "disabled" });
    await page.screenshot({ path: screenshotPath("H-act2-ecosystem-overview"), animations: "disabled" });

    await page.getByRole("button", { name: "Return the Agency" }).click();
    await expect(page.locator(".story-copy h1")).toHaveText("Return the Agency");
    await page.waitForTimeout(1700);
    await page.screenshot({ path: screenshotPath("M-act2-return-agency"), animations: "disabled" });
    const closing = await inspect(page);
    expect(closing).toMatchObject({ activeStoryBeat: "return-agency", selectedNode: "human" });
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
    await page.locator('.story-list__node[data-node-id="nutuensai"] button').click();
    const ecosystemSelection = await inspect(page);
    expect(ecosystemSelection?.selectedNode).toBe("nutuensai");
    await page.screenshot({ path: screenshotPath("F-story-list"), animations: "disabled" });
    await page.getByRole("button", { name: "Return to Story View" }).click();
    await expect(page.getByTestId("story-list")).toBeHidden();
    await expect(page.locator(".concept-detail")).toContainText("Listening & Interpretation Layer");

    const afterList = await inspect(page);
    expect(afterList?.selectedNode).toBe("nutuensai");
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
    for (let index = 0; index < 4; index += 1) await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByTestId("story-list").locator('[data-copy="current-beat-title"]')).toHaveText("THE LIVING ECOSYSTEM");
    await page.screenshot({ path: screenshotPath("N-mobile-act2-view"), animations: "disabled" });
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
    await expect(page.getByTestId("story-list").getByText("ความสัมพันธ์ในโลกนี้", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "English" }).click();
    await expect(page.getByRole("button", { name: "Story List" })).toBeVisible();
    await expect(page.getByTestId("story-list").getByText("Relationships in this world", { exact: false })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator(".language-switch")).toBeVisible();
    const languageBox = await page.locator(".language-switch").boundingBox();
    const storyListBox = await page.getByRole("button", { name: "Story List" }).boundingBox();
    expect(languageBox && storyListBox).toBeTruthy();
    expect(languageBox!.x).toBeGreaterThanOrEqual(storyListBox!.x + storyListBox!.width - 1);
  });
});
