import type { StoryState } from "../story/storyState";
import type { StoryWorldDefinition } from "../world/world.schema";

export function storyListEntries(world: StoryWorldDefinition): readonly { id: string; label: string; summary: string }[] {
  return world.nodes.map(({ id, label, summary }) => ({ id, label, summary }));
}

export function createAccessibleStoryView(
  world: StoryWorldDefinition,
  actions: {
    selectNode: (nodeId: string) => void;
    back: () => void;
    next: () => void;
    returnToHuman: () => void;
    close: () => void;
  },
): { element: HTMLElement; render: (state: StoryState) => void } {
  const element = document.createElement("section");
  element.className = "story-list";
  element.dataset.testid = "story-list";
  element.setAttribute("aria-label", "Accessible Story List");
  element.innerHTML = `
    <div class="story-list__header">
      <div>
        <p class="eyebrow">Accessible concept map</p>
        <h2>Story List</h2>
        <p>Use the same conceptual anchors, relationship, and story order without the spatial scene.</p>
      </div>
      <button class="icon-button" type="button" data-action="close-list" aria-label="Return to Story View">×</button>
    </div>
    <ol class="story-list__beats"></ol>
    <section class="story-list__relationship" aria-label="Declared relationships">
      <p class="eyebrow">Declared relationships</p>
      <ul class="story-list__relationships"></ul>
      <p>Conceptual relationships — not model cognition.</p>
    </section>
    <div class="story-list__actions">
      <button type="button" class="quiet-button" data-action="list-back">Back</button>
      <button type="button" class="primary-button" data-action="list-next">Next</button>
      <button type="button" class="quiet-button" data-action="list-human">Return to Human</button>
    </div>
  `;

  element.querySelector<HTMLButtonElement>('[data-action="close-list"]')?.addEventListener("click", actions.close);
  element.querySelector<HTMLButtonElement>('[data-action="list-back"]')?.addEventListener("click", actions.back);
  element.querySelector<HTMLButtonElement>('[data-action="list-next"]')?.addEventListener("click", actions.next);
  element.querySelector<HTMLButtonElement>('[data-action="list-human"]')?.addEventListener("click", actions.returnToHuman);

  const list = element.querySelector<HTMLOListElement>(".story-list__beats");
  if (!list) throw new Error("Story List markup is incomplete.");
  storyListEntries(world).forEach((node) => {
    const item = document.createElement("li");
    item.className = "story-list__node";
    item.dataset.nodeId = node.id;
    const button = document.createElement("button");
    button.type = "button";
      const sourceNode = world.nodes.find((entry) => entry.id === node.id);
      button.innerHTML = `<span>${node.label}</span><small>${sourceNode?.thaiLabel ?? ""}</small><em>${node.summary}</em>`;
    button.addEventListener("click", () => actions.selectNode(node.id));
    item.append(button);
    list.append(item);
  });

  const relationships = element.querySelector<HTMLUListElement>(".story-list__relationships");
  if (!relationships) throw new Error("Story List relationship region is incomplete.");
  world.relationships.forEach((relationship) => {
    const item = document.createElement("li");
    item.textContent = relationship.label;
    relationships.append(item);
  });

  return {
    element,
    render(state: StoryState): void {
      element.querySelectorAll<HTMLElement>(".story-list__node").forEach((item) => {
        item.classList.toggle("is-selected", item.dataset.nodeId === state.selectedNodeId);
      });
      element.querySelector<HTMLButtonElement>('[data-action="list-back"]')!.disabled = state.beatIndex === 0;
      element.querySelector<HTMLButtonElement>('[data-action="list-next"]')!.disabled = state.beatIndex === world.beats.length - 1;
    },
  };
}
