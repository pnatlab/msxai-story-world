export function supportsWebGL(): boolean {
  if (new URLSearchParams(window.location.search).get("forceNoWebgl") === "1") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}
