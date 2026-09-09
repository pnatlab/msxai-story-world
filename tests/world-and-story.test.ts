import { describe, expect, it } from "vitest";
import { resolveTransitionDuration } from "../src/scene/CameraDirector";
import { AMBIENT_FIELD_V0_1 } from "../src/scene/ambientField";
import { StoryController } from "../src/story/StoryController";
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
      new Set(["holds-intention", "story-progression", "expresses-principle"]),
    );
  });

  it("resolves every story beat camera state", () => {
    const ids = new Set(STORY_WORLD_V0_1.cameraStates.map((camera) => camera.id));
    STORY_WORLD_V0_1.beats.forEach((beat) => expect(ids.has(beat.cameraStateId)).toBe(true));
  });

  it("keeps Guided Story navigation deterministic", () => {
    const controller = new StoryController(STORY_WORLD_V0_1);
    controller.beginStory();
    controller.next();
    controller.next();
    expect(controller.getState().beatIndex).toBe(3);
    controller.next();
    expect(controller.getState().beatIndex).toBe(3);
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
    controller.selectNode("msxai");
    expect(controller.getState()).toMatchObject({ mode: "free", selectedNodeId: "msxai" });
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

  it("contains no MSS or Ollama destination in Slice 1", () => {
    const serialized = JSON.stringify(STORY_WORLD_V0_1).toLowerCase();
    expect(serialized).not.toContain("ollama");
    expect(serialized).not.toContain("mss");
    expect(serialized).not.toContain("destination");
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

  it("places semantic anchors and principles at distinct three-dimensional positions", () => {
    const positions = STORY_WORLD_V0_1.nodes.map((node) => node.position.join(","));
    expect(new Set(positions).size).toBe(STORY_WORLD_V0_1.nodes.length);
    expect(new Set(STORY_WORLD_V0_1.nodes.map((node) => node.position[2])).size).toBeGreaterThanOrEqual(6);
  });
});
