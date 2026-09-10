import type { StoryState } from "../story/storyState";
import type { Locale } from "../story/localeState";
import { localizedBeat, localizedNode, UI_COPY } from "../i18n";
import type { StoryWorldDefinition } from "../world/world.schema";

export function storyListEntries(world: StoryWorldDefinition, locale: Locale = "en"): readonly { id: string; label: string; summary: string }[] {
  return world.nodes.map((node) => {
    const localized = localizedNode(node, locale);
    return { id: node.id, label: localized.label, summary: localized.summary };
  });
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
): { element: HTMLElement; render: (state: StoryState, locale: Locale) => void } {
  const element = document.createElement("section");
  element.className = "story-list";
  element.dataset.testid = "story-list";
  element.setAttribute("aria-label", UI_COPY.en.storyList);
  element.innerHTML = `
    <div class="story-list__header">
      <div>
        <p class="eyebrow" data-copy="list-eyebrow"></p>
        <h2 data-copy="list-title"></h2>
        <p data-copy="list-description"></p>
      </div>
      <button class="icon-button" type="button" data-action="close-list">×</button>
    </div>
    <section class="story-list__current" aria-live="polite">
      <p class="eyebrow" data-copy="current-beat-label"></p>
      <h3 data-copy="current-beat-title"></h3>
      <div data-copy="current-beat-lines"></div>
    </section>
    <ol class="story-list__beats"></ol>
    <section class="story-list__relationship">
      <p class="eyebrow" data-copy="relationship-title"></p>
      <ul class="story-list__relationships"></ul>
      <p data-copy="relationship-note"></p>
    </section>
    <div class="story-list__actions">
      <button type="button" class="quiet-button" data-action="list-back"></button>
      <button type="button" class="primary-button" data-action="list-next"></button>
      <button type="button" class="quiet-button" data-action="list-human"></button>
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
    button.innerHTML = `<span></span><small></small><em></em>`;
    button.addEventListener("click", () => actions.selectNode(node.id));
    item.append(button);
    list.append(item);
  });

  const relationships = element.querySelector<HTMLUListElement>(".story-list__relationships");
  if (!relationships) throw new Error("Story List relationship region is incomplete.");
  world.relationships.forEach((relationship) => {
    const item = document.createElement("li");
    item.dataset.relationshipId = relationship.id;
    relationships.append(item);
  });

  return {
    element,
    render(state: StoryState, locale: Locale): void {
      const copy = UI_COPY[locale];
      element.setAttribute("aria-label", copy.storyList);
      element.querySelector<HTMLElement>('[data-copy="list-eyebrow"]')!.textContent = copy.accessibleConceptMap;
      element.querySelector<HTMLElement>('[data-copy="list-title"]')!.textContent = copy.storyList;
      element.querySelector<HTMLElement>('[data-copy="list-description"]')!.textContent = copy.useSameConceptualMap;
      element.querySelector<HTMLElement>('[data-copy="relationship-title"]')!.textContent = copy.declaredRelationships;
      element.querySelector<HTMLElement>('[data-copy="relationship-note"]')!.textContent = copy.conceptualRelationships;
      const beat = localizedBeat(world.beats[state.beatIndex], locale);
      element.querySelector<HTMLElement>('[data-copy="current-beat-label"]')!.textContent = copy.currentStoryBeat;
      element.querySelector<HTMLElement>('[data-copy="current-beat-title"]')!.textContent = beat.title;
      const beatLines = element.querySelector<HTMLElement>('[data-copy="current-beat-lines"]')!;
      beatLines.replaceChildren(...beat.lines.map((line) => {
        const paragraph = document.createElement("p");
        paragraph.textContent = line;
        return paragraph;
      }));
      element.querySelector<HTMLButtonElement>('[data-action="close-list"]')!.setAttribute("aria-label", copy.returnToStoryView);
      element.querySelector<HTMLButtonElement>('[data-action="list-back"]')!.textContent = copy.back;
      element.querySelector<HTMLButtonElement>('[data-action="list-next"]')!.textContent = copy.next;
      element.querySelector<HTMLButtonElement>('[data-action="list-human"]')!.textContent = copy.returnToHuman;
      storyListEntries(world, locale).forEach((node) => {
        const button = element.querySelector<HTMLButtonElement>(`.story-list__node[data-node-id="${node.id}"] button`);
        if (!button) return;
        button.querySelector("span")!.textContent = node.label;
        button.querySelector("small")!.textContent = "";
        button.querySelector("em")!.textContent = node.summary;
      });
      world.relationships.forEach((relationship) => {
        const item = element.querySelector<HTMLElement>(`.story-list__relationships [data-relationship-id="${relationship.id}"]`);
        if (item) item.textContent = locale === "en" ? relationship.label : relationship.thaiLabel;
      });
      element.querySelectorAll<HTMLElement>(".story-list__node").forEach((item) => {
        item.classList.toggle("is-selected", item.dataset.nodeId === state.selectedNodeId);
      });
      element.querySelector<HTMLButtonElement>('[data-action="list-back"]')!.disabled = state.beatIndex === 0;
      element.querySelector<HTMLButtonElement>('[data-action="list-next"]')!.disabled = state.beatIndex === world.beats.length - 1;
    },
  };
}
