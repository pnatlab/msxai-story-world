import { describe, expect, it } from "vitest";
import { resolveTransitionDuration } from "../src/scene/CameraDirector";
import { AMBIENT_FIELD_V0_1 } from "../src/scene/ambientField";
import { localizedBeat, localizedNode, localizedTruthfulnessNotice, MEANING_COPY, UI_COPY } from "../src/i18n";
import { StoryController } from "../src/story/StoryController";
import { DEFAULT_LOCALE, LocaleController } from "../src/story/localeState";
import { storyListEntries } from "../src/ui/AccessibleStoryView";
import { STORY_WORLD_V0_1 } from "../src/world/world.v0.1";
import { validateWorldDefinition } from "../src/world/world.schema";

describe("MSxAI Story World v0.1", () => {
  it("validates the declared world schema", () => {
    expect(() => validateWorldDefinition(STORY_WORLD_V0_1)).not.toThrow();
  });

  it("has unique node IDs", () => {
    const ids = STORY_WORLD_V0_1.nodes.map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("resolves every relationship reference", () => {
    const ids = new Set(STORY_WORLD_V0_1.nodes.map((node) => node.id));
    STORY_WORLD_V0_1.relationships.forEach((relationship) => {
      expect(ids.has(relationship.from)).toBe(true);
      expect(ids.has(relationship.to)).toBe(true);
    });
  });

  it("uses the bounded Slice 1 relationship vocabulary", () => {
    expect(new Set(STORY_WORLD_V0_1.relationships.map((relationship) => relationship.kind))).toEqual(
      new Set(["holds-intention", "story-progression", "expresses-principle", "conceptual-connection"]),
    );
  });

  it("keeps Act 1 intact before Act 2 begins", () => {
    expect(STORY_WORLD_V0_1.beats.slice(0, 4).map((beat) => beat.id)).toEqual(["opening", "human", "intention", "msxai"]);
    expect(STORY_WORLD_V0_1.nodes.slice(0, 3).map((node) => node.id)).toEqual(["human", "intention", "msxai"]);
    expect(STORY_WORLD_V0_1.nodes.find((node) => node.id === "human")?.position).toEqual([0, 1.15, 1.2]);
  });

  it("starts Act 2 after MSxAI and ends with Human emphasis", () => {
    expect(STORY_WORLD_V0_1.beats[4]).toMatchObject({ id: "living-ecosystem", focusNodeId: "msxai" });
    expect(STORY_WORLD_V0_1.beats.at(-1)).toMatchObject({ id: "return-agency", focusNodeId: "human" });
  });

  it("declares the six language-neutral Act 2 conceptual anchors", () => {
    const ecosystemIds = ["mss", "mindhome", "mhb", "wave-glass-project-h", "nutuensai", "lli"];
    expect(STORY_WORLD_V0_1.nodes.filter((node) => ecosystemIds.includes(node.id)).map((node) => node.id).sort()).toEqual(ecosystemIds.sort());
    expect(STORY_WORLD_V0_1.nodes.find((node) => node.id === "nutuensai")?.kind).toBe("listening-layer");
    expect(STORY_WORLD_V0_1.nodes.find((node) => node.id === "lli")?.kind).toBe("language-signal");
  });

  it("provides deterministic EN and TH content for every Act 2 anchor", () => {
    const ecosystemIds = new Set(["mss", "mindhome", "mhb", "wave-glass-project-h", "nutuensai", "lli"]);
    STORY_WORLD_V0_1.nodes.filter((node) => ecosystemIds.has(node.id)).forEach((node) => {
      const english = localizedNode(node, "en");
      const thai = localizedNode(node, "th");
      expect(english.label).not.toHaveLength(0);
      expect(english.summary).not.toHaveLength(0);
      expect(english.detail.length).toBeGreaterThan(0);
      expect(thai.label).not.toHaveLength(0);
      expect(thai.summary).not.toHaveLength(0);
      expect(thai.detail.length).toBeGreaterThan(0);
    });
  });

  it("reveals the Act 2 anchors in the authored calm sequence", () => {
    expect(STORY_WORLD_V0_1.beats.slice(5, 11).map((beat) => beat.focusNodeId)).toEqual([
      "mindhome",
      "mss",
      "mhb",
      "wave-glass-project-h",
      "nutuensai",
      "lli",
    ]);
  });

  it("resolves every story beat camera state", () => {
    const ids = new Set(STORY_WORLD_V0_1.cameraStates.map((camera) => camera.id));
    STORY_WORLD_V0_1.beats.forEach((beat) => expect(ids.has(beat.cameraStateId)).toBe(true));
  });

  it("keeps Guided Story navigation deterministic", () => {
    const controller = new StoryController(STORY_WORLD_V0_1);
    controller.beginStory();
    for (let index = 0; index < STORY_WORLD_V0_1.beats.length; index += 1) controller.next();
    expect(controller.getState().beatIndex).toBe(STORY_WORLD_V0_1.beats.length - 1);
    expect(controller.getState().selectedNodeId).toBe("human");
  });

  it("supports Back through the authored story", () => {
    const controller = new StoryController(STORY_WORLD_V0_1);
    controller.beginStory();
    controller.next();
    controller.back();
    expect(controller.getState()).toMatchObject({ beatIndex: 1, selectedNodeId: "human" });
  });

  it("uses shared selection state in Free Explore", () => {
    const controller = new StoryController(STORY_WORLD_V0_1);
    controller.exploreFreely();
    controller.selectNode("mss");
    expect(controller.getState()).toMatchObject({ mode: "free", selectedNodeId: "mss" });
  });

  it("returns to Human without creating another state model", () => {
    const controller = new StoryController(STORY_WORLD_V0_1);
    controller.exploreFreely();
    controller.selectNode("msxai");
    controller.returnToHuman();
    expect(controller.getState()).toMatchObject({ mode: "guided", beatIndex: 1, selectedNodeId: "human" });
  });

  it("cuts camera travel for reduced motion", () => {
    expect(resolveTransitionDuration(STORY_WORLD_V0_1.cameraStates[1], true, false)).toBe(0);
    expect(resolveTransitionDuration(STORY_WORLD_V0_1.cameraStates[1], false, false)).toBeGreaterThan(0);
  });

  it("contains conceptual relationships without operational integration details", () => {
    const serialized = JSON.stringify(STORY_WORLD_V0_1).toLowerCase();
    expect(serialized).not.toContain("ollama");
    expect(serialized).not.toContain("localhost");
    expect(serialized).not.toContain("http");
    expect(serialized).not.toContain("/api/");
    expect(STORY_WORLD_V0_1.relationships.filter((relationship) => relationship.kind === "conceptual-connection")).toHaveLength(6);
  });

  it("derives Story List entries from the shared world definition", () => {
    expect(storyListEntries(STORY_WORLD_V0_1)).toEqual(
      STORY_WORLD_V0_1.nodes.map(({ id, label, summary }) => ({ id, label, summary })),
    );
  });

  it("keeps ambient nodes separate from semantic world data", () => {
    const semanticPositions = new Set(STORY_WORLD_V0_1.nodes.map((node) => node.position.join(",")));
    const ambientNodes = AMBIENT_FIELD_V0_1.layers.flatMap((layer) => layer.nodes);
    expect(ambientNodes.length).toBeGreaterThan(0);
    ambientNodes.forEach((node) => {
      expect(Object.hasOwn(node, "label")).toBe(false);
      expect(Object.hasOwn(node, "id")).toBe(false);
      expect(semanticPositions.has(node.position.join(","))).toBe(false);
    });
  });

  it("never exposes ambient decorative nodes in Story List", () => {
    const entries = storyListEntries(STORY_WORLD_V0_1);
    expect(entries).toHaveLength(STORY_WORLD_V0_1.nodes.length);
    expect(entries.every((entry) => STORY_WORLD_V0_1.nodes.some((node) => node.id === entry.id))).toBe(true);
  });

  it("exposes Act 2 anchors through the shared Story List entries", () => {
    const entries = storyListEntries(STORY_WORLD_V0_1);
    expect(entries.map((entry) => entry.id)).toEqual(expect.arrayContaining(["mss", "mindhome", "mhb", "wave-glass-project-h", "nutuensai", "lli"]));
    expect(storyListEntries(STORY_WORLD_V0_1, "th").find((entry) => entry.id === "mss")?.summary).toBe("พื้นที่ทำงานร่วมระหว่างมนุษย์กับ AI");
  });

  it("places semantic anchors and principles at distinct three-dimensional positions", () => {
    const positions = STORY_WORLD_V0_1.nodes.map((node) => node.position.join(","));
    expect(new Set(positions).size).toBe(STORY_WORLD_V0_1.nodes.length);
    expect(new Set(STORY_WORLD_V0_1.nodes.map((node) => node.position[2])).size).toBeGreaterThanOrEqual(6);
  });

  it("defaults to English and switches deterministic visible copy", () => {
    const locale = new LocaleController();
    expect(locale.getLocale()).toBe(DEFAULT_LOCALE);
    expect(UI_COPY[locale.getLocale()].storyList).toBe("Story List");
    expect(STORY_WORLD_V0_1.nodes.slice(0, 3).map((node) => node.id)).toEqual(["human", "intention", "msxai"]);
    expect(localizedBeat(STORY_WORLD_V0_1.beats[1], locale.getLocale()).title).toBe("HUMAN");

    locale.setLocale("th");
    expect(UI_COPY[locale.getLocale()].storyList).toBe("รายการเรื่องเล่า");
    expect(localizedBeat(STORY_WORLD_V0_1.beats[1], locale.getLocale()).lines[0]).toBe("มนุษย์ยังคงเป็นผู้ถือเจตนา");
    expect(localizedNode(STORY_WORLD_V0_1.nodes[2], locale.getLocale()).detail[0]).toBe("เจตนามาก่อน");

    locale.setLocale("en");
    expect(localizedBeat(STORY_WORLD_V0_1.beats[1], locale.getLocale()).lines[0]).toBe("The human remains the intention holder.");
  });

  it("keeps story step, mode, and selected concept unchanged while switching locale", () => {
    const controller = new StoryController(STORY_WORLD_V0_1);
    const locale = new LocaleController();
    controller.beginStory();
    controller.next();
    const guidedBefore = controller.getState();
    locale.setLocale("th");
    expect(controller.getState()).toEqual(guidedBefore);

    controller.exploreFreely();
    controller.selectNode("msxai");
    const freeBefore = controller.getState();
    locale.setLocale("en");
    expect(controller.getState()).toEqual(freeBefore);
  });

  it("keeps the truthfulness boundary in both locales", () => {
    expect(localizedTruthfulnessNotice(STORY_WORLD_V0_1, "en")).toContain("hidden AI cognition");
    expect(localizedTruthfulnessNotice(STORY_WORLD_V0_1, "th")).toContain("กระบวนการรับรู้ภายในที่ซ่อนอยู่ของ AI");
    expect(MEANING_COPY.en.editorialParagraph).toContain("does not perform work");
    expect(MEANING_COPY.th.editorialParagraph).toContain("ไม่ได้เปลี่ยนแปลง MSS");
  });
});
