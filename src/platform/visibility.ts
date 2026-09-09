export function observeDocumentVisibility(callback: (visible: boolean) => void): () => void {
  const listener = () => callback(!document.hidden);
  document.addEventListener("visibilitychange", listener);
  return () => document.removeEventListener("visibilitychange", listener);
}
