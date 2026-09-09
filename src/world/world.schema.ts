export type NodeKind = "human" | "intention" | "framework" | "principle";
export type RelationshipKind = "holds-intention" | "story-progression" | "expresses-principle";
export type StoryMode = "guided" | "free";

export type Vec3Tuple = readonly [number, number, number];

export interface WorldNode {
  readonly id: string;
  readonly label: string;
  readonly thaiLabel: string;
  readonly kind: NodeKind;
  readonly position: Vec3Tuple;
  readonly summary: string;
  readonly thaiSummary: string;
  readonly detail: readonly string[];
}

export interface Relationship {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly kind: RelationshipKind;
  readonly label: string;
}

export interface CameraState {
  readonly id: string;
  readonly position: Vec3Tuple;
  readonly target: Vec3Tuple;
  readonly fov: number;
  readonly durationMs: number;
  readonly allowManualControl: boolean;
}

export interface StoryBeat {
  readonly id: string;
  readonly order: number;
  readonly title: string;
  readonly thaiTitle: string;
  readonly lines: readonly string[];
  readonly thaiLine?: string;
  readonly cameraStateId: string;
  readonly focusNodeId?: string;
  readonly revealNodeIds: readonly string[];
  readonly revealRelationshipIds: readonly string[];
  readonly nextLabel?: string;
}

export interface StoryWorldDefinition {
  readonly version: "0.1";
  readonly title: string;
  readonly truthfulnessNotice: string;
  readonly nodes: readonly WorldNode[];
  readonly relationships: readonly Relationship[];
  readonly cameraStates: readonly CameraState[];
  readonly beats: readonly StoryBeat[];
}

const RELATIONSHIP_KINDS = new Set<RelationshipKind>([
  "holds-intention",
  "story-progression",
  "expresses-principle",
]);

export function validateWorldDefinition(world: StoryWorldDefinition): void {
  const nodeIds = new Set<string>();
  const cameraIds = new Set<string>();
  const relationshipIds = new Set<string>();
  const beatIds = new Set<string>();

  for (const node of world.nodes) {
    assertNewId(node.id, nodeIds, "node");
    assertPosition(node.position, `node ${node.id}`);
  }

  for (const camera of world.cameraStates) {
    assertNewId(camera.id, cameraIds, "camera state");
    assertPosition(camera.position, `camera state ${camera.id}`);
    assertPosition(camera.target, `camera state ${camera.id}`);
    if (!Number.isFinite(camera.fov) || camera.fov <= 0 || camera.fov >= 180) {
      throw new Error(`Camera state ${camera.id} has an invalid field of view.`);
    }
  }

  for (const relationship of world.relationships) {
    assertNewId(relationship.id, relationshipIds, "relationship");
    if (!nodeIds.has(relationship.from) || !nodeIds.has(relationship.to)) {
      throw new Error(`Relationship ${relationship.id} references a missing node.`);
    }
    if (!RELATIONSHIP_KINDS.has(relationship.kind)) {
      throw new Error(`Relationship ${relationship.id} has an invalid kind.`);
    }
  }

  let expectedOrder = 0;
  for (const beat of world.beats) {
    assertNewId(beat.id, beatIds, "story beat");
    if (beat.order !== expectedOrder) {
      throw new Error(`Story beat ${beat.id} is out of deterministic order.`);
    }
    expectedOrder += 1;
    if (!cameraIds.has(beat.cameraStateId)) {
      throw new Error(`Story beat ${beat.id} references a missing camera state.`);
    }
    if (beat.focusNodeId && !nodeIds.has(beat.focusNodeId)) {
      throw new Error(`Story beat ${beat.id} references a missing focus node.`);
    }
    for (const id of beat.revealNodeIds) {
      if (!nodeIds.has(id)) throw new Error(`Story beat ${beat.id} reveals a missing node.`);
    }
    for (const id of beat.revealRelationshipIds) {
      if (!relationshipIds.has(id)) {
        throw new Error(`Story beat ${beat.id} reveals a missing relationship.`);
      }
    }
  }

  if (world.beats.length === 0) throw new Error("A story world needs at least one beat.");
}

function assertNewId(id: string, ids: Set<string>, type: string): void {
  if (!id || ids.has(id)) throw new Error(`Duplicate or empty ${type} ID: ${id || "(empty)"}.`);
  ids.add(id);
}

function assertPosition(position: Vec3Tuple, label: string): void {
  if (position.length !== 3 || position.some((value) => !Number.isFinite(value))) {
    throw new Error(`${label} has an invalid spatial position.`);
  }
}
