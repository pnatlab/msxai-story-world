import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { LivingEcosystemController, relatedNodeIds } from "../src/story/livingEcosystemState";
import { LivingEcosystemPresentation, ecosystemCamera } from "../src/scene/LivingEcosystemPresentation";
import { StoryController } from "../src/story/StoryController";
import { LocaleController } from "../src/story/localeState";
import { STORY_WORLD_V0_1 as world } from "../src/world/world.v0.1";
import { localizedBeat, localizedNode, UI_COPY } from "../src/i18n";

function presentationHarness() {
  const visuals = new Map(world.nodes.map((node) => {
    const group = new THREE.Group(); group.position.set(...node.position);
    const focusShell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4), new THREE.MeshBasicMaterial({ opacity: .7 }));
    group.add(focusShell); focusShell.visible = false;
    return [node.id, { group, focusShell }] as const;
  }));
  return { visuals, presentation: new LivingEcosystemPresentation(world, visuals) };
}

describe("Living Ecosystem is an independent canonical perspective", () => {
  it("enters without selection, accepts non-linear canonical selection, deselects and exits", () => {
    const state = new LivingEcosystemController(world);
    expect(state.getState()).toEqual({ open: false, listOpen: false });
    expect(state.select("human")).toBe(false);
    expect(state.enter()).toBe(true); expect(state.enter()).toBe(false);
    expect(state.getState().selectedNodeId).toBeUndefined();
    expect(state.select("invalid")).toBe(false);
    for (const id of ["lli", "human", "mss", "intention"]) {
      expect(state.select(id)).toBe(true); expect(state.getState().selectedNodeId).toBe(id);
    }
    expect(state.select("intention")).toBe(true);
    expect(state.getState().selectedNodeId).toBeUndefined();
    expect(state.select()).toBe(false);
    state.setListOpen(true); state.select("mhb"); expect(state.getState().listOpen).toBe(false);
    expect(state.exit()).toBe(true); expect(state.exit()).toBe(false);
  });
  it("does not mutate narrative, locale, canonical IDs, order or relationship data", () => {
    const canonical = JSON.stringify(world);
    const story = new StoryController(world); story.beginStory(); story.next(); story.exploreFreely(); story.selectNode("mss");
    const before = story.getState();
    const locale = new LocaleController();
    const state = new LivingEcosystemController(world);
    state.enter(); state.select("nutuensai"); locale.setLocale("th");
    expect(state.getState().selectedNodeId).toBe("nutuensai");
    state.exit();
    expect(story.getState()).toBe(before);
    expect(JSON.stringify(world)).toBe(canonical);
  });
  it("derives only supported neighbors and has local EN/TH root and concept copy", () => {
    expect([...relatedNodeIds(world, "human")]).toEqual(["intention"]);
    expect([...relatedNodeIds(world, "mss")]).toEqual(["msxai"]);
    expect([...relatedNodeIds(world, "missing")]).toEqual([]);
    for (const locale of ["en", "th"] as const) {
      expect(localizedBeat(world.beats.find((b) => b.id === "living-ecosystem")!, locale).lines).toHaveLength(2);
      expect(UI_COPY[locale].viewEcosystem).toBeTruthy();
      for (const node of world.nodes) expect(localizedNode(node, locale).summary.length).toBeGreaterThan(0);
    }
  });
  it("unsubscribes listeners and emits nothing for rejected actions", () => {
    const controller = new LivingEcosystemController(world); const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);
    controller.exit(); expect(listener).toHaveBeenCalledTimes(1);
    controller.enter(); expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe(); controller.exit(); expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe("Reversible lightweight spatial presentation", () => {
  it("dissolves into a fixed layout, creates only canonical line fragments, restores original objects", () => {
    const { visuals, presentation } = presentationHarness();
    presentation.enter(false, false, 0);
    expect(presentation.inspection.phase).toBe("entering");
    // Nothing physically travels towards a central node.
    expect(visuals.get("human")!.group.position.toArray()).toEqual(world.nodes[0].position);
    presentation.update(650, false);
    expect(presentation.inspection.fieldLight).toBeCloseTo(.5);
    presentation.update(1300, false);
    expect(presentation.inspection.phase).toBe("open");
    const lines: THREE.LineSegments[] = [];
    presentation.group.traverse((object) => { if ((object as THREE.LineSegments).isLineSegments) lines.push(object as THREE.LineSegments); });
    expect(lines).toHaveLength(world.relationships.length);
    expect(new Set(lines.map((line) => line.material)).size).toBe(1);
    presentation.select("human");
    expect(presentation.inspection.emphasizedRelationshipIds).toEqual(["human-holds-intention"]);
    expect(visuals.get("human")!.focusShell.visible).toBe(true);
    expect(visuals.get("mss")!.focusShell.material.opacity).toBeLessThan(.7);
    presentation.leave(false, 1500); presentation.update(2150, false);
    expect(presentation.inspection.phase).toBe("closed");
    for (const node of world.nodes) {
      expect(visuals.get(node.id)!.group.position.toArray()).toEqual(node.position);
      expect(visuals.get(node.id)!.focusShell.material.opacity).toBe(.7);
    }
    presentation.dispose();
  });
  it("settles immediately without a luminous veil for reduced motion, even mid-transition", () => {
    const { presentation } = presentationHarness();
    presentation.enter(false, false, 0); presentation.update(50, true);
    expect(presentation.inspection.phase).toBe("open");
    expect(presentation.group.getObjectByName("presentation:luminous-synthesis")!.visible).toBe(false);
    presentation.leave(true, 100); expect(presentation.inspection.phase).toBe("closed");
    presentation.dispose();
  });
  it("frames every semantic anchor in portrait and keeps selection during resize", () => {
    const { visuals, presentation } = presentationHarness();
    presentation.enter(false, true, 0); presentation.select("mhb"); presentation.resize(true);
    const pose = ecosystemCamera(true);
    const camera = new THREE.PerspectiveCamera(pose.fov, 390 / 844, .1, 220);
    camera.position.set(...pose.position); camera.lookAt(new THREE.Vector3(...pose.target));
    camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    for (const { group } of visuals.values()) {
      const point = group.position.clone().project(camera);
      expect(Math.abs(point.x)).toBeLessThan(.8);
      expect(Math.abs(point.y)).toBeLessThan(.8);
    }
    expect(presentation.inspection.selectedNodeId).toBe("mhb");
    presentation.dispose();
  });
});
