import { localizedBeat, localizedNode, UI_COPY } from "../i18n";
import type { Locale } from "../story/localeState";
import { relatedNodeIds, type LivingEcosystemState } from "../story/livingEcosystemState";
import type { StoryWorldDefinition } from "../world/world.schema";
import { productIdentity, PRODUCT_COPY } from "../world/productIdentity";

export class LivingEcosystemView {
  readonly element = document.createElement("section");
  private locale: Locale = "en";
  private state: LivingEcosystemState = { open: false, listOpen: false };
  private readonly labels = new Map<string, HTMLButtonElement>();
  private readonly listButtons = new Map<string, HTMLButtonElement>();
  constructor(private readonly world: StoryWorldDefinition, private readonly actions: {
    select: (id?: string) => void; exit: () => void; closeList: () => void;
    project: (id: string) => { x: number; y: number; visible: boolean } | undefined;
  }, private readonly fallback: boolean) {
    this.element.className = "living-ecosystem";
    this.element.hidden = true;
    this.element.setAttribute("aria-labelledby", "ecosystem-title");
    this.element.innerHTML = `<div class="ecosystem-heading"><p class="eyebrow">MSxAI</p><h1 id="ecosystem-title" tabindex="-1"></h1><div class="ecosystem-intro"></div></div>
      <div class="ecosystem-labels"></div>
      <section class="ecosystem-list" hidden><div class="ecosystem-list__top"><h2></h2><button type="button" class="quiet-button" data-ecosystem="close-list"></button></div><div class="ecosystem-list__nodes"></div></section>
      <aside class="ecosystem-detail" aria-live="polite" hidden><div class="ecosystem-detail-heading"><img class="ecosystem-product-mark" alt="" aria-hidden="true" width="42" height="42" hidden><div><p class="ecosystem-product-name" hidden></p><h2></h2><p class="ecosystem-role"></p></div></div><p class="ecosystem-description"></p><details class="ecosystem-product-story" hidden><summary></summary><dl><dt data-product-copy="need-label"></dt><dd data-product-copy="need"></dd><dt data-product-copy="role-label"></dt><dd data-product-copy="role"></dd></dl><p class="ecosystem-product-principle"></p></details><p class="ecosystem-related-title"></p><div class="ecosystem-related"></div></aside>
      <nav class="ecosystem-controls"><button type="button" class="quiet-button" data-ecosystem="exit"></button><button type="button" class="quiet-button" data-ecosystem="clear" hidden></button></nav>`;
    this.world.nodes.forEach((node) => {
      for (const [container, map] of [[".ecosystem-labels", this.labels], [".ecosystem-list__nodes", this.listButtons]] as const) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.ecosystemNode = node.id;
        button.className = "ecosystem-node";
        button.addEventListener("click", () => actions.select(node.id));
        this.element.querySelector(container)!.append(button); map.set(node.id, button);
      }
    });
    this.element.querySelector('[data-ecosystem="exit"]')!.addEventListener("click", actions.exit);
    this.element.querySelector('[data-ecosystem="clear"]')!.addEventListener("click", () => actions.select());
    this.element.querySelector('[data-ecosystem="close-list"]')!.addEventListener("click", actions.closeList);
  }
  setLocale(locale: Locale): void { this.locale = locale; this.render(this.state); }
  focusHeading(): void { this.element.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true }); }
  render(state: LivingEcosystemState): void {
    const previousListOpen = this.state.listOpen;
    const previousSelection = this.state.selectedNodeId;
    const hadFocus = this.element.contains(document.activeElement);
    this.state = state;
    this.element.hidden = !state.open;
    if (!state.open) return;
    const copy = UI_COPY[this.locale];
    const root = localizedBeat(this.world.beats.find((beat) => beat.id === "living-ecosystem")!, this.locale);
    this.element.querySelector("h1")!.textContent = root.title;
    this.element.querySelector(".ecosystem-intro")!.replaceChildren(...root.lines.map((line) => {
      const p = document.createElement("p"); p.textContent = line; return p;
    }));
    const list = this.element.querySelector<HTMLElement>(".ecosystem-list")!;
    list.hidden = !state.listOpen && !this.fallback;
    this.element.classList.toggle("is-list", !list.hidden);
    this.element.classList.toggle("is-fallback", this.fallback);
    list.querySelector("h2")!.textContent = copy.conceptAnchors;
    const close = this.element.querySelector<HTMLButtonElement>('[data-ecosystem="close-list"]')!;
    close.textContent = copy.viewEcosystem; close.hidden = this.fallback;
    this.element.querySelector('[data-ecosystem="exit"]')!.textContent = copy.exitEcosystem;
    const clear = this.element.querySelector<HTMLButtonElement>('[data-ecosystem="clear"]')!;
    clear.textContent = copy.viewEcosystem; clear.hidden = !state.selectedNodeId;
    this.element.querySelector("nav")!.setAttribute("aria-label", copy.livingEcosystem);
    for (const node of this.world.nodes) {
      const content = localizedNode(node, this.locale);
      for (const map of [this.labels, this.listButtons]) {
        const button = map.get(node.id)!;
        button.textContent = node.id === "mhb" && map === this.labels ? "MHB" : content.label;
        button.setAttribute("aria-label", `${content.label} — ${content.summary}`);
        button.setAttribute("aria-pressed", String(node.id === state.selectedNodeId));
        const identity = productIdentity(node.id);
        if (identity) button.style.setProperty("--product-accent", identity.accent);
      }
    }
    const detail = this.element.querySelector<HTMLElement>(".ecosystem-detail")!;
    const node = this.world.nodes.find((node) => node.id === state.selectedNodeId);
    detail.hidden = !node;
    const identity = productIdentity(node?.id);
    detail.classList.toggle("is-product", Boolean(identity));
    detail.tabIndex = identity ? 0 : -1;
    if (identity) { detail.dataset.product = node!.id; detail.style.setProperty("--product-accent", identity.accent); }
    else { delete detail.dataset.product; detail.style.removeProperty("--product-accent"); }
    const mark = detail.querySelector<HTMLImageElement>(".ecosystem-product-mark")!;
    const productName = detail.querySelector<HTMLElement>(".ecosystem-product-name")!;
    const productStory = detail.querySelector<HTMLDetailsElement>(".ecosystem-product-story")!;
    mark.hidden = productName.hidden = productStory.hidden = !identity;
    if (previousSelection !== state.selectedNodeId) { productStory.open = false; detail.scrollTop = 0; }
    if (node) {
      const content = localizedNode(node, this.locale);
      detail.querySelector("h2")!.textContent = content.label;
      detail.querySelector(".ecosystem-role")!.textContent = content.summary;
      detail.querySelector(".ecosystem-description")!.textContent = identity?.copy[this.locale].description ?? content.detail[0] ?? "";
      if (identity) {
        const product = identity.copy[this.locale], labels = PRODUCT_COPY[this.locale];
        mark.src = identity.mark;
        productName.textContent = product.name;
        productName.hidden = content.label.includes(product.name);
        productStory.querySelector("summary")!.textContent = labels.closer;
        productStory.querySelector('[data-product-copy="need-label"]')!.textContent = labels.need;
        productStory.querySelector('[data-product-copy="need"]')!.textContent = product.need;
        productStory.querySelector('[data-product-copy="role-label"]')!.textContent = labels.role;
        productStory.querySelector('[data-product-copy="role"]')!.textContent = product.role;
        productStory.querySelector(".ecosystem-product-principle")!.textContent = product.principle;
      } else mark.removeAttribute("src");
      detail.querySelector(".ecosystem-related-title")!.textContent = copy.relatedConcepts;
      detail.querySelector(".ecosystem-related")!.replaceChildren(...[...relatedNodeIds(this.world, node.id)].map((id) => {
        const neighbor = this.world.nodes.find((candidate) => candidate.id === id)!;
        const button = document.createElement("button"); button.type = "button";
        button.textContent = localizedNode(neighbor, this.locale).label;
        const relation = this.world.relationships.find((r) => r.from === node.id && r.to === id || r.to === node.id && r.from === id)!;
        button.title = this.locale === "th" ? relation.thaiLabel : relation.label;
        button.addEventListener("click", () => this.actions.select(id)); return button;
      }));
    }
    this.refreshLabels();
    if (state.listOpen && !previousListOpen) this.listButtons.values().next().value?.focus({ preventScroll: true });
    else if (hadFocus && (document.activeElement === document.body || (document.activeElement instanceof HTMLElement && document.activeElement.offsetParent === null))) {
      const label = state.selectedNodeId ? this.labels.get(state.selectedNodeId) : undefined;
      if (label && !label.hidden) label.focus({ preventScroll: true });
      else this.focusHeading();
    }
  }
  refreshLabels(): void {
    if (!this.state.open) return;
    const neighbors = relatedNodeIds(this.world, this.state.selectedNodeId);
    this.labels.forEach((button, id) => {
      const projection = this.actions.project(id);
      const principle = this.world.nodes.find((node) => node.id === id)?.kind === "principle";
      button.hidden = this.fallback || this.state.listOpen || !projection?.visible || Boolean(principle && id !== this.state.selectedNodeId);
      if (!projection) return;
      button.style.left = `${projection.x}px`; button.style.top = `${projection.y + 12}px`;
      button.classList.toggle("is-receded", Boolean(this.state.selectedNodeId && id !== this.state.selectedNodeId && !neighbors.has(id)));
    });
  }
}
