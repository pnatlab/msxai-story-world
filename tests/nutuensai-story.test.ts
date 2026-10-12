import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { NutuensaiStoryJourney } from "../src/story/nutuensaiStoryJourney";
import { LivingEcosystemController } from "../src/story/livingEcosystemState";
import { StoryController } from "../src/story/StoryController";
import { STORY_WORLD_V0_1 as world } from "../src/world/world.v0.1";
import { LivingEcosystemPresentation } from "../src/scene/LivingEcosystemPresentation";
describe("NuTuenSai Story explicit authored intent", () => {
  it("requires the ecosystem and focus stages, then emits one consumed visit request", () => {
    const journey = new NutuensaiStoryJourney();
    expect(journey.consumeVisit()).toBeUndefined();
    expect(journey.request("home")).toBe(true); expect(journey.request("human")).toBe(false);
    journey.recognize(); expect(journey.getState().phase).toBe("requested");
    journey.travel(); expect(journey.getState().leg).toBe("ecosystem");
    journey.recognize(); expect(journey.getState().phase).toBe("travelling");
    journey.focus(); journey.recognize();
    const request = journey.consumeVisit();
    expect(request).toEqual({ requestId: 1, source: "home", nodeId: "nutuensai", returnContext: { mode: "living-ecosystem", selectedNodeId: "nutuensai" } });
    expect(journey.active).toBe(false); expect(journey.consumeVisit()).toBeUndefined();
    expect(journey.getState().visitRequests).toBe(1);
    journey.travel(); journey.focus(); journey.recognize(); expect(journey.consumeVisit()).toBeUndefined();
  });
  it("manual selection cannot create an intent or mutate story; HUMAN uses the same route", () => {
    const journey = new NutuensaiStoryJourney(), ecosystem = new LivingEcosystemController(world), story = new StoryController(world);
    story.beginStory(); const before = story.getState(); ecosystem.enter(); ecosystem.select("nutuensai");
    expect(journey.getState().phase).toBe("idle"); expect(journey.consumeVisit()).toBeUndefined();
    journey.request("human"); journey.travel(); journey.focus(); journey.recognize();
    expect(journey.consumeVisit()?.source).toBe("human");
    expect(story.getState()).toBe(before); expect(ecosystem.getState().selectedNodeId).toBe("nutuensai");
  });
  it("cancel at any travelling stage consumes no request; a new explicit choice is independent", () => {
    for (const stage of ["requested", "ecosystem", "focus", "recognition"]) {
      const journey = new NutuensaiStoryJourney(); journey.request("home");
      if (stage !== "requested") journey.travel();
      if (["focus", "recognition"].includes(stage)) journey.focus();
      if (stage === "recognition") journey.recognize();
      journey.cancel(); expect(journey.active).toBe(false); expect(journey.consumeVisit()).toBeUndefined();
      expect(journey.getState().visitRequests).toBe(0); journey.reset();
      journey.request("human"); expect(journey.getState()).toMatchObject({ phase: "requested", requestId: 2, source: "human" });
    }
  });
  it("frames the same canonical node/connection in both presentation layouts", () => {
    const visuals = new Map(world.nodes.map(node => {
      const group = new THREE.Group(); group.position.set(...node.position);
      const focusShell = new THREE.Mesh(new THREE.IcosahedronGeometry(.4), new THREE.MeshBasicMaterial()); group.add(focusShell);
      return [node.id, { group, focusShell }] as const;
    }));
    const presentation = new LivingEcosystemPresentation(world, visuals);
    for (const portrait of [false, true]) {
      presentation.enter(portrait, true, 0); presentation.select("nutuensai");
      const pose = presentation.journeyCamera(); const camera = new THREE.PerspectiveCamera(pose.fov, portrait ? 390/844 : 1440/900, .1, 220);
      camera.position.set(...pose.position); camera.lookAt(new THREE.Vector3(...pose.target)); camera.updateMatrixWorld();
      for (const id of ["nutuensai", "msxai"]) {
        const projected = visuals.get(id)!.group.position.clone().project(camera);
        expect(Math.abs(projected.x)).toBeLessThan(1); expect(Math.abs(projected.y)).toBeLessThan(1);
      }
      expect(presentation.inspection.emphasizedRelationshipIds).toEqual(["msxai-concept-nutuensai"]);
      expect(presentation.inspection.relationshipIds).toEqual(world.relationships.map(r=>r.id));
      presentation.leave(true, 1);
    }
    presentation.dispose();
  });
});
