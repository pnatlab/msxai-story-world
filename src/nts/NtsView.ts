import type { Locale } from "../story/localeState";
import { INTRO, MARK_COPY, SMILE_COPY, MEMORIES, memory, memoryAsset, NTS_COPY, type MemoryId } from "./content";
import type { NtsState } from "./visitState";
import { compactNts, type NtsComposition, type ProjectedBox } from "./composition";
import { APPEARANCE_COPY, MASK_COLORS, OUTFIT_COLORS, type MaskColor, type OutfitColor } from "./appearance";

export class NtsView {
  readonly element = document.createElement("section");
  private locale: Locale = "en";
  private state?: NtsState;
  private avatarFailed = false;
  private readonly failedImages = new Set<string>();
  private imageId?: string;
  private readonly footerObserver: ResizeObserver;
  private readonly appearance: HTMLDetailsElement;
  private readonly motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  private lift?: { id: MemoryId; image: HTMLImageElement; frame: number };
  constructor(private readonly actions: {
    select: (id: MemoryId) => void; inspect: (view: "front" | "left" | "right" | false | number) => void;
    introduce: () => void; closeIntroduction: () => void; closeReading: () => void;
    return: () => void; dom: (dom: boolean) => void; locale: (locale: Locale) => void;
    project?: () => NtsComposition | undefined;
    memoryLift?: (active: boolean) => void;
    outfit: (color: OutfitColor) => void; mask: (color: MaskColor) => void;
    inspectMark: (active: boolean) => void;
    smile: () => void; canSmile: () => boolean;
  }, private readonly fallback: boolean) {
    this.element.className = "nts-view"; this.element.hidden = true;
    this.element.setAttribute("aria-labelledby", "nts-title");
    this.element.innerHTML = `<header class="nts-heading"><p class="nts-eyebrow">NTS • STORY WORLD</p><h1 id="nts-title" tabindex="-1"></h1><p data-nts="note"></p><div class="nts-tools"><button type="button" data-nts="en">EN</button><button type="button" data-nts="th">TH</button><button type="button" data-nts="dom"></button></div></header>
      <div class="nts-arrival" aria-live="polite" hidden></div>
      <figure class="nts-dom-image" hidden><img width="667" height="1000" draggable="false"><figcaption></figcaption></figure>
      <section class="nts-caption" hidden aria-labelledby="nts-memory-title"><p class="nts-eyebrow" data-nts="image"></p><h2 id="nts-memory-title"></h2><p class="nts-authored"></p><p class="nts-setting" hidden></p><button type="button" data-nts="close-reading"></button></section>
      <section class="nts-intro" hidden aria-labelledby="nts-intro-title"><p data-nts="intro-label"></p><h2 id="nts-intro-title" tabindex="-1">NuTuenSai</h2><p class="nts-authored"></p><button type="button" data-nts="close-intro"></button></section>
      <section class="nts-presence-controls"><p data-nts="presence"></p><div><button type="button" data-nts="meet"></button><button type="button" data-nts="inspect"></button><button type="button" data-nts="mark-back" hidden></button></div><div class="nts-angles" hidden><button type="button" data-angle="front"></button><button type="button" data-angle="left"></button><button type="button" data-angle="right"></button><button type="button" data-nts="inspect-mark" hidden></button></div><p class="nts-status" aria-live="polite"></p></section>
      <footer class="nts-footer"><nav class="nts-memory-nav"></nav><p class="nts-closing" hidden></p><div class="nts-return-row"><small data-nts="agency"></small><button type="button" data-nts="return"></button></div><details class="nts-meaning"><summary>Gallery / Presence / Field</summary><p class="nts-presence-meaning"></p><p data-nts="field"></p><p data-nts="progression"></p></details></footer>`;
    this.element.querySelector<HTMLElement>(".nts-caption")!.tabIndex = 0;
    const readingHint = document.createElement("p"); readingHint.className = "nts-reading-hint";
    this.element.querySelector(".nts-caption h2")!.after(readingHint);
    const pair = document.createElement("div"); pair.className = "nts-reading-pair"; pair.tabIndex = 0;
    pair.append(this.element.querySelector("figure")!, this.element.querySelector(".nts-caption")!);
    this.element.insertBefore(pair, this.element.querySelector(".nts-intro"));
    // Discoverable traces are DOM-semantic images anchored to scene coordinates.
    // They use only small private derivatives; the selected WebGL image is separate.
    const path = this.element.querySelector("nav")!; path.className = "nts-memory-nav"; this.element.append(path);
    this.footerObserver = new ResizeObserver(entries => this.element.style.setProperty("--nts-footer-height", `${Math.ceil(entries[0].contentRect.height)}px`));
    this.footerObserver.observe(this.element.querySelector("footer")!);
    const button = (name: string) => this.element.querySelector<HTMLButtonElement>(`[data-nts="${name}"]`)!;
    const smileRow = document.createElement("div"); smileRow.className = "nts-presence-secondary";
    smileRow.innerHTML = '<button type="button" data-nts="smile"></button>';
    this.element.querySelector(".nts-angles")!.before(smileRow);
    button("smile").addEventListener("click", () => { actions.smile(); this.refreshSmile(); });
    button("en").addEventListener("click", () => actions.locale("en"));
    button("th").addEventListener("click", () => actions.locale("th"));
    button("return").addEventListener("click", actions.return);
    button("meet").addEventListener("click", actions.introduce);
    button("close-intro").addEventListener("click", actions.closeIntroduction);
    button("close-reading").addEventListener("click", actions.closeReading);
    button("inspect").addEventListener("click", () => actions.inspect(this.state?.inspection ? false : "front"));
    button("inspect-mark").addEventListener("click", () => actions.inspectMark(true));
    button("mark-back").addEventListener("click", () => actions.inspectMark(false));
    button("dom").addEventListener("click", () => actions.dom(!this.state?.dom));
    const orbit = document.createElement("label"); orbit.className = "nts-orbit";
    orbit.innerHTML = '<span></span><input type="range" min="-90" max="90" step="5" value="0">';
    this.element.querySelector(".nts-angles")!.append(orbit);
    orbit.querySelector("input")!.addEventListener("input", e => actions.inspect(Number((e.target as HTMLInputElement).value)));
    this.element.querySelectorAll<HTMLButtonElement>("[data-angle]").forEach(b => b.addEventListener("click", () => actions.inspect(b.dataset.angle as "front" | "left" | "right")));
    this.appearance = document.createElement("details"); this.appearance.className = "nts-appearance";
    const choices = (kind: string, colors: Record<string, string>) => Object.entries(colors).map(([id, color]) => `<button type="button" data-nts-${kind}="${id}"><span class="nts-swatch" style="background:${color}" aria-hidden="true"></span><span class="nts-color-label"></span><span class="nts-color-check" aria-hidden="true">✓</span></button>`).join("");
    this.appearance.innerHTML = `<summary></summary><div class="nts-appearance-panel" aria-labelledby="nts-appearance-title"><p id="nts-appearance-title"></p><fieldset data-nts-outfit-group><legend></legend><div>${choices("outfit", OUTFIT_COLORS)}</div></fieldset><fieldset data-nts-mask-group><legend></legend><div>${choices("mask", MASK_COLORS)}</div></fieldset></div>`;
    this.element.querySelector('.nts-presence-controls > div')!.append(this.appearance);
    this.appearance.querySelectorAll<HTMLButtonElement>("[data-nts-outfit]").forEach(b => b.addEventListener("click", () => actions.outfit(b.dataset.ntsOutfit as OutfitColor)));
    this.appearance.querySelectorAll<HTMLButtonElement>("[data-nts-mask]").forEach(b => b.addEventListener("click", () => actions.mask(b.dataset.ntsMask as MaskColor)));
    this.appearance.addEventListener("toggle", () => this.refreshAnchors());
    window.addEventListener("keydown", this.onAppearanceEscape, true);
    window.addEventListener("pointerdown", this.onAppearanceOutside, true);
    for (const [index, item] of MEMORIES.entries()) {
      const b = document.createElement("button"); b.type = "button"; b.dataset.ntsMemory = item.id;
      const image = document.createElement("img"); image.width = 160; image.height = 240; image.draggable = false;
      image.addEventListener("error", () => { b.classList.add("preview-unavailable"); });
      b.append(image, document.createElement("span"));
      b.addEventListener("click", () => this.selectMemory(item.id, image)); b.dataset.index = String(index + 1);
      this.element.querySelector("nav")!.append(b);
    }
    this.element.querySelector(".nts-dom-image img")!.addEventListener("error", () => { if (this.state) this.imageFailed(this.state.memoryId); });
    window.addEventListener("resize", this.onResize);
    this.motionPreference.addEventListener("change", this.onMotionPreference);
  }
  private readonly onResize = () => {
    this.cancelLift();
    if (this.appearance.open && this.appearance.contains(document.activeElement)) this.appearance.querySelector<HTMLElement>("summary")!.focus({ preventScroll: true });
    this.appearance.open = false; if (this.state) this.render(this.state);
  };
  private readonly onAppearanceEscape = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !this.appearance.open || this.element.hidden) return;
    event.preventDefault(); event.stopImmediatePropagation(); this.appearance.open = false;
    this.appearance.querySelector<HTMLElement>("summary")!.focus(); this.refreshAnchors();
  };
  private readonly onAppearanceOutside = (event: PointerEvent) => {
    if (this.appearance.open && event.target instanceof Node && !this.appearance.contains(event.target)) { this.appearance.open = false; this.refreshAnchors(); }
  };
  private readonly onMotionPreference = () => { if (this.motionPreference.matches) this.cancelLift(); this.refreshSmile(); };
  private refreshSmile(): void {
    const button = this.element.querySelector<HTMLButtonElement>('[data-nts="smile"]')!;
    if (button.textContent !== SMILE_COPY[this.locale]) button.textContent = SMILE_COPY[this.locale];
    const row = button.parentElement!, primary = this.element.querySelector<HTMLElement>('.nts-presence-controls > div:first-of-type')!;
    // The inspection camera is fixed: keep its existing vertical control footprint.
    const inline = Boolean(this.state?.inspection || window.innerHeight <= 620), focused = document.activeElement === button;
    row.classList.toggle("is-inline", inline);
    if (inline && row.parentElement !== primary) primary.append(row);
    else if (!inline && row.parentElement === primary) primary.after(row);
    if (focused && document.activeElement !== button) button.focus({ preventScroll: true });
    row.hidden = this.fallback || Boolean(this.state?.dom || this.avatarFailed || this.state?.introduction || this.state?.markInspection);
    button.disabled = this.motionPreference.matches || this.state?.phase !== "settled" || !this.actions.project?.()?.mark;
    // Keep keyboard focus on the momentary action during its bounded cycle.
    button.setAttribute("aria-disabled", String(button.disabled || !this.actions.canSmile()));
  }
  private cancelLift(): void {
    if (!this.lift) return;
    cancelAnimationFrame(this.lift.frame); this.lift.image.remove(); this.lift = undefined;
    this.element.classList.remove("is-memory-lifting"); this.actions.memoryLift?.(false);
  }
  private imageBox(image: HTMLImageElement): { x: number; y: number; width: number; height: number } {
    const rect = image.getBoundingClientRect();
    const ratio = image.naturalWidth / image.naturalHeight || 2 / 3;
    const width = Math.min(rect.width, rect.height * ratio), height = width / ratio;
    return { x: rect.x + (rect.width - width) / 2, y: rect.y + (rect.height - height) / 2, width, height };
  }
  private liftDestination(): { x: number; y: number; width: number; height: number } | undefined {
    if (!this.state?.reading || this.state.inspection || this.state.markInspection || this.state.introduction) return;
    if (this.fallback || this.state.dom || compactNts(window.innerWidth, window.innerHeight)) {
      const image = this.element.querySelector<HTMLImageElement>(".nts-dom-image img")!;
      const box = this.imageBox(image);
      return box.width > 0 && box.height > 0 ? box : undefined;
    }
    const box = this.actions.project?.()?.image, stage = this.element.getBoundingClientRect();
    return box?.visible ? { ...box, x: box.x + stage.x, y: box.y + stage.y } : undefined;
  }
  private selectMemory(id: MemoryId, preview: HTMLImageElement): void {
    const alreadyReading = this.state?.memoryId === id && this.state.reading && !this.state.inspection && !this.state.introduction;
    const source = this.imageBox(preview);
    this.cancelLift(); this.actions.select(id);
    if (alreadyReading || this.motionPreference.matches || this.state?.phase !== "settled" || !preview.naturalWidth || this.failedImages.has(id)) return;
    const destination = this.liftDestination(); if (!destination || !source.width) return;
    // A private decorative clone bridges the DOM trace and the existing projected
    // image. Selection/copy remain synchronous; there is only one lift at a time.
    const image = preview.cloneNode(false) as HTMLImageElement;
    image.className = "nts-memory-lift"; image.alt = ""; image.setAttribute("aria-hidden", "true");
    image.removeAttribute("width"); image.removeAttribute("height"); image.draggable = false;
    this.element.append(image); this.element.classList.add("is-memory-lifting");
    this.actions.memoryLift?.(true);
    const lift = { id, image, frame: 0 }; this.lift = lift;
    const started = performance.now(), travel = 620, settle = 100;
    const frame = (now: number) => {
      if (this.lift !== lift) return;
      const target = this.liftDestination();
      if (!target || this.state?.memoryId !== id) { this.cancelLift(); return; }
      const t = Math.min(1, (now - started) / travel), ease = t * t * (3 - 2 * t);
      const x = source.x + (target.x - source.x) * ease;
      const y = source.y + (target.y - source.y) * ease - Math.sin(Math.PI * t) * 14;
      const width = source.width + (target.width - source.width) * ease;
      const height = source.height + (target.height - source.height) * ease;
      image.style.transform = `translate3d(${x}px,${y}px,0)`;
      image.style.width = `${width}px`; image.style.height = `${height}px`;
      image.style.opacity = String(t < 1 ? .8 + .2 * ease : Math.max(0, 1 - (now - started - travel) / settle));
      if (t === 1) { this.element.classList.remove("is-memory-lifting"); this.actions.memoryLift?.(false); }
      if (now - started >= travel + settle) this.cancelLift();
      else lift.frame = requestAnimationFrame(frame);
    };
    frame(started);
  }
  setLocale(locale: Locale): void { this.locale = locale; if (this.state) this.render(this.state); }
  focusHeading(): void { this.element.querySelector<HTMLElement>("h1")!.focus({ preventScroll: true }); }
  imageFailed(id: string): void { this.failedImages.add(id); if (this.lift?.id === id) this.cancelLift(); if (this.state) this.render(this.state); }
  presenceFailed(): void { this.avatarFailed = true; if (this.state) this.render(this.state); }
  render(state: NtsState): void {
    const previous = this.state; this.state = state;
    if (this.lift && (state.phase !== "settled" || state.memoryId !== this.lift.id || !state.reading || state.inspection || state.markInspection || state.introduction || state.dom !== previous?.dom)) this.cancelLift();
    this.element.hidden = state.phase === "closed";
    if (this.element.hidden) {
      this.element.querySelector(".nts-dom-image img")!.removeAttribute("src"); this.imageId = undefined;
      this.element.querySelectorAll(".nts-memory-nav img").forEach(image => image.removeAttribute("src")); return;
    }
    if (previous?.phase === "closed") { this.avatarFailed = false; this.failedImages.clear(); }
    this.element.querySelectorAll<HTMLImageElement>(".nts-memory-nav img").forEach((image, i) => {
      if (!image.hasAttribute("src")) image.src = `${import.meta.env.BASE_URL}nts/${MEMORIES[i].id}-preview.jpg`;
    });
    const c = NTS_COPY[this.locale]; const item = memory(state.memoryId);
    const dom = this.fallback || state.dom;
    const compact = compactNts(window.innerWidth, window.innerHeight);
    const appearanceCopy = APPEARANCE_COPY[this.locale];
    this.appearance.hidden = dom || this.avatarFailed || state.phase !== "settled" || state.introduction || state.markInspection;
    if (this.appearance.hidden) this.appearance.open = false;
    this.appearance.querySelector("summary")!.textContent = appearanceCopy.colors;
    this.appearance.querySelector("#nts-appearance-title")!.textContent = appearanceCopy.title;
    for (const kind of ["outfit", "mask"] as const) {
      this.appearance.querySelector(`[data-nts-${kind}-group] legend`)!.textContent = appearanceCopy[kind];
      this.appearance.querySelectorAll<HTMLButtonElement>(`[data-nts-${kind}]`).forEach(b => {
        const id = (kind === "outfit" ? b.dataset.ntsOutfit : b.dataset.ntsMask) as OutfitColor | MaskColor;
        b.querySelector(".nts-color-label")!.textContent = appearanceCopy[id];
        b.setAttribute("aria-label", appearanceCopy[id]); b.setAttribute("aria-pressed", String(state[kind] === id)); b.disabled = state.phase !== "settled";
      });
    }
    this.element.dataset.layout = compact ? "compact" : "spatial";
    this.element.classList.toggle("is-introduction", state.introduction);
    this.element.classList.toggle("is-dom", dom); this.element.classList.toggle("is-inspection", Boolean(state.inspection));
    this.element.classList.toggle("is-mark-inspection", state.markInspection);
    this.element.classList.toggle("is-reading", state.reading);
    this.element.dataset.phase = state.phase;
    this.element.querySelector("h1")!.textContent = c.title;
    for (const key of ["note", "image", "presence", "agency", "field", "progression"] as const) this.element.querySelector(`[data-nts="${key}"]`)!.textContent = c[key];
    this.element.querySelector(".nts-presence-meaning")!.textContent = c.presence;
    for (const [key, value] of Object.entries({ return: c.return, meet: c.meet, inspect: state.inspection ? c.leaveInspection : c.inspect, dom: dom ? c.spatial : c.dom, "close-intro": c.close, "close-reading": c.hideReading, "intro-label": c.introLabel })) this.element.querySelector(`[data-nts="${key}"]`)!.textContent = value;
    for (const angle of ["front", "left", "right"] as const) { const b = this.element.querySelector<HTMLButtonElement>(`[data-angle="${angle}"]`)!; b.textContent = c[angle]; b.setAttribute("aria-pressed", String(state.inspection === angle)); }
    this.element.querySelector<HTMLElement>(".nts-angles")!.hidden = !state.inspection || state.markInspection;
    const mark = this.element.querySelector<HTMLButtonElement>('[data-nts="inspect-mark"]')!;
    mark.textContent = MARK_COPY[this.locale].inspect; mark.hidden = dom || this.avatarFailed || !state.inspection || state.markInspection || state.introduction;
    mark.disabled = !this.actions.project?.()?.mark || state.phase !== "settled";
    const markBack = this.element.querySelector<HTMLButtonElement>('[data-nts="mark-back"]')!;
    markBack.textContent = MARK_COPY[this.locale].back; markBack.hidden = !state.markInspection;
    for (const name of ["meet", "inspect"]) this.element.querySelector<HTMLButtonElement>(`[data-nts="${name}"]`)!.hidden = state.markInspection;
    const orbit = this.element.querySelector<HTMLInputElement>(".nts-orbit input")!;
    orbit.value = String(typeof state.inspection === "number" ? state.inspection : state.inspection === "left" ? -90 : state.inspection === "right" ? 90 : 0);
    const orbitLabel = this.locale === "th" ? "มุมสำรวจ −90° ถึง +90°" : "Inspection angle −90° to +90°";
    orbit.setAttribute("aria-label", orbitLabel); this.element.querySelector(".nts-orbit span")!.textContent = orbitLabel;
    this.element.querySelector<HTMLButtonElement>('[data-nts="dom"]')!.hidden = this.fallback;
    this.element.querySelector("nav")!.setAttribute("aria-label", c.memories);
    this.element.querySelectorAll<HTMLButtonElement>("[data-nts-memory]").forEach(b => { const trace = memory(b.dataset.ntsMemory as MemoryId); b.querySelector("span")!.textContent = `${b.dataset.index} · ${trace.title[this.locale]}`; b.querySelector("img")!.alt = trace.alt[this.locale]; b.setAttribute("aria-label", `${b.dataset.index} · ${trace.title[this.locale]}`); b.setAttribute("aria-pressed", String(b.dataset.ntsMemory === state.memoryId)); b.disabled = state.phase !== "settled"; });
    const arrival = this.element.querySelector<HTMLElement>(".nts-arrival")!; arrival.hidden = state.phase !== "approaching"; arrival.textContent = c.journey;
    const caption = this.element.querySelector<HTMLElement>(".nts-caption")!; caption.hidden = !state.reading || Boolean(state.inspection) || state.markInspection || state.introduction;
    const pair = this.element.querySelector<HTMLElement>(".nts-reading-pair")!; pair.hidden = caption.hidden;
    if (previous?.memoryId !== state.memoryId) { pair.scrollTop = 0; caption.scrollTop = 0; }
    caption.querySelector("h2")!.textContent = item.title[this.locale]; caption.querySelector(".nts-authored")!.textContent = item[this.locale];
    caption.querySelector(".nts-reading-hint")!.textContent = this.locale === "th" ? "เลื่อนอ่านเรื่องเล่า ↓" : "Scroll to read the story ↓";
    const setting = caption.querySelector<HTMLElement>(".nts-setting")!; setting.hidden = item.id !== "s5"; setting.textContent = c.setting;
    const intro = this.element.querySelector<HTMLElement>(".nts-intro")!; intro.hidden = !state.introduction; intro.querySelector(".nts-authored")!.textContent = INTRO[this.locale];
    const figure = this.element.querySelector<HTMLElement>("figure")!;
    figure.hidden = !(dom || compact) || !state.reading || Boolean(state.inspection) || state.markInspection || state.introduction;
    const image = figure.querySelector<HTMLImageElement>("img")!;
    if (!figure.hidden && this.imageId !== item.id) { this.imageId = item.id; image.src = memoryAsset(item.id); }
    if (figure.hidden) { image.removeAttribute("src"); this.imageId = undefined; }
    image.hidden = this.failedImages.has(item.id); image.alt = item.alt[this.locale];
    figure.querySelector("figcaption")!.textContent = this.failedImages.has(item.id) ? c.missing : c.image;
    this.element.querySelector<HTMLElement>(".nts-status")!.textContent = this.avatarFailed ? c.avatarFailed : this.failedImages.has(item.id) ? c.missing : "";
    const closing = this.element.querySelector<HTMLElement>(".nts-closing")!; closing.hidden = item.id !== "s6" || !state.reading || Boolean(state.inspection) || state.introduction; closing.textContent = `${c.quiet}\n${c.closing}`;
    if (!previous?.introduction && state.introduction) intro.querySelector<HTMLElement>("h2")!.focus({ preventScroll: true });
    else if (!previous?.markInspection && state.markInspection) markBack.focus({ preventScroll: true });
    else if (previous?.markInspection && !state.markInspection && state.phase === "settled" && !mark.hidden) mark.focus({ preventScroll: true });
    else if (previous?.introduction && !state.introduction) this.element.querySelector<HTMLButtonElement>('[data-nts="meet"]')!.focus({ preventScroll: true });
    else if (previous?.inspection && !state.inspection) this.element.querySelector<HTMLButtonElement>('[data-nts="inspect"]')!.focus({ preventScroll: true });
    this.refreshAnchors();
  }
  refreshAnchors(): void {
    if (!this.state || this.element.hidden) return;
    this.refreshSmile();
    const c = this.actions.project?.(); const width = this.element.clientWidth, height = this.element.clientHeight;
    const compact = compactNts(width, height), dom = this.fallback || this.state.dom;
    this.element.querySelector<HTMLButtonElement>('[data-nts="inspect-mark"]')!.disabled = !c?.mark || this.state.phase !== "settled";
    const place = (element: HTMLElement, box: ProjectedBox, readable = false) => {
      const w = readable ? Math.max(250, Math.min(355, box.width)) : box.width;
      const footer = this.element.querySelector("footer")!.getBoundingClientRect().height;
      const h = readable ? Math.max(220, Math.min(box.height, height - 140 - footer - 30)) : box.height;
      const x = Math.max(16, Math.min(width - w - 16, box.x)), y = Math.max(140, Math.min(height - footer - h - 24, box.y));
      element.style.left = `${x}px`; element.style.top = `${y}px`; element.style.width = `${w}px`; element.style.height = `${h}px`;
      return { x, y, width: w, height: h };
    };
    if (c && !compact && !dom && !this.state.inspection && !this.state.markInspection) {
      this.element.querySelectorAll<HTMLButtonElement>("[data-nts-memory]").forEach(b => {
        const box = c.traces[b.dataset.ntsMemory as MemoryId];
        b.style.left = `${box.x}px`; b.style.top = `${Math.min(height - 130, box.y)}px`; b.style.width = `${Math.max(48, box.width)}px`;
      });
      if (this.state.reading && !this.state.introduction) place(this.element.querySelector<HTMLElement>(".nts-caption")!, c.narrative, true);
      const controls = this.element.querySelector<HTMLElement>(".nts-presence-controls")!;
      place(controls, c.controls);
      // The projected anchor owns position, not the dimensions of localized DOM controls.
      const controlsWidth = Math.max(c.controls.width, controls.querySelector<HTMLElement>(":scope > div")!.offsetWidth);
      controls.style.width = `${controlsWidth}px`; controls.style.height = "auto";
      const primary = [...controls.querySelectorAll<HTMLElement>('[data-nts="meet"], [data-nts="inspect"]')].map(button => button.getBoundingClientRect());
      const primaryCenter = (Math.min(...primary.map(box => box.left)) + Math.max(...primary.map(box => box.right))) / 2;
      const primaryOffset = primaryCenter - controls.getBoundingClientRect().left;
      controls.style.left = `${Math.max(16, Math.min(width - controlsWidth - 16, c.controls.x + c.controls.width / 2 - primaryOffset))}px`;
    }
    if (c && !dom && this.state.introduction) {
      const voiceBox = compact ? { ...c.voice, x: c.presence.x + c.presence.width * .82, y: c.presence.y + 20, width: width * .55, height: 320 } : c.voice;
      const intro = this.element.querySelector<HTMLElement>(".nts-intro")!;
      const positioned = place(intro, voiceBox, !compact);
      intro.style.height = "auto"; intro.style.maxHeight = `${Math.max(180, height - positioned.y - 210)}px`;
      if (compact) { const w = Math.min(235, width * .56); intro.style.width = `${w}px`; intro.style.left = `${Math.min(width - w - 16, voiceBox.x)}px`; intro.style.height = "auto"; intro.style.maxHeight = "360px"; }
    }
    this.placeAppearance(compact);
  }
  private placeAppearance(compact: boolean): void {
    this.element.style.setProperty("--nts-controls-lift", "0px");
    if (!this.state?.inspection && !this.state?.markInspection && !this.state?.introduction && !this.state?.dom && !this.fallback) {
      const controls = this.element.querySelector<HTMLElement>(".nts-presence-controls")!.getBoundingClientRect();
      const traceTops = [...this.element.querySelectorAll<HTMLElement>("[data-nts-memory]")]
        .map(button => button.getBoundingClientRect())
        .filter(trace => trace.left < controls.right + 12 && trace.right > controls.left - 12)
        .map(trace => trace.top);
      // Keep the whole flow-owned action group above the existing memory field.
      // Measure on every anchor refresh so resize, locale and wrapping share one rule.
      const lift = Math.min(0, Math.min(...traceTops) - 12 - controls.bottom);
      this.element.style.setProperty("--nts-controls-lift", `${lift}px`);
    }
    const stage = this.element.getBoundingClientRect(), controls = this.element.querySelector<HTMLElement>(".nts-presence-controls")!.getBoundingClientRect();
    let readingTop = Math.max(255, controls.bottom - stage.top + 12);
    if (this.appearance.open && !this.appearance.hidden) {
      const panel = this.appearance.querySelector<HTMLElement>(".nts-appearance-panel")!;
      const short = compact && stage.height <= 620, presence = this.actions.project?.()?.presence;
      // Keep the normal spatial view's upper face clear, including narrow desktops.
      const leftSpace = presence ? presence.x + presence.width * .24 - 28 : 248;
      panel.style.width = `${short ? 128 : Math.min(248, stage.width - 32, compact || this.state?.inspection ? 248 : Math.max(128, leftSpace))}px`;
      const tracesTop = Math.min(...[...this.element.querySelectorAll<HTMLElement>("[data-nts-memory]")].map(b => b.getBoundingClientRect().top));
      const panelHeightLimit = short ? Math.max(88, controls.top - stage.top - 152) : Math.min(260, stage.height * .4);
      panel.style.maxHeight = `${compact ? panelHeightLimit : Math.min(panelHeightLimit, Math.max(44, tracesTop - stage.top - 152))}px`;
      const trigger = this.appearance.getBoundingClientRect(), panelHeight = panel.getBoundingClientRect().height;
      const panelLeft = Math.min(trigger.left - panel.offsetWidth - 12, stage.left + leftSpace - panel.offsetWidth);
      const x = compact ? stage.left + (short ? 16 : stage.width * .05) : Math.max(stage.left + 16, this.state?.inspection ? trigger.left - panel.offsetWidth - 12 : panelLeft);
      const y = short ? stage.top + 140 : compact ? (this.state?.inspection ? Math.max(stage.top + 145, tracesTop - panelHeight - 12) : controls.bottom + 8) : Math.max(stage.top + 140, Math.min(trigger.top - panelHeight - 8, tracesTop - panelHeight - 12));
      panel.style.left = `${x - trigger.left}px`; panel.style.top = `${y - trigger.top}px`;
      if (compact && !this.state?.inspection) readingTop = Math.max(readingTop, y - stage.top + panelHeight + 12);
    }
    this.element.style.setProperty("--nts-reading-top", `${readingTop}px`);
  }
  dispose(): void { this.cancelLift(); this.footerObserver.disconnect(); window.removeEventListener("resize", this.onResize); window.removeEventListener("keydown", this.onAppearanceEscape, true); window.removeEventListener("pointerdown", this.onAppearanceOutside, true); this.motionPreference.removeEventListener("change", this.onMotionPreference); this.element.remove(); }
}
