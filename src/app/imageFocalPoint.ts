export function imageObjectPositionFromSrc(src?: string | null): string {
  if (!src) return "center top";
  const queryStart = src.indexOf("?");
  if (queryStart < 0) return "center top";

  const params = new URLSearchParams(src.slice(queryStart + 1));
  const focalX = Number(params.get("fx"));
  const focalY = Number(params.get("fy"));
  if (!Number.isFinite(focalX) || !Number.isFinite(focalY)) return "center top";

  const x = Math.min(100, Math.max(0, focalX * 100));
  const y = Math.min(100, Math.max(0, focalY * 100));
  return `${x.toFixed(1)}% ${y.toFixed(1)}%`;
}
