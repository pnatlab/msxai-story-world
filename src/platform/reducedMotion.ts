export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function observeReducedMotion(callback: (reduced: boolean) => void): () => void {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  const listener = () => callback(query.matches);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}
