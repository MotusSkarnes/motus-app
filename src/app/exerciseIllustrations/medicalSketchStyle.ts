/** Felles palett for medisinsk skisse / lærebok-stil (øvelsesillustrasjoner). */
export const MEDICAL_SKETCH = {
  background: "#ffffff",
  outline: "#334155",
  outlineLight: "#64748b",
  skin: "#f5f2ed",
  skinShadow: "#e8e4de",
  muscle: "#c4a0a0",
  muscleStroke: "#8b7070",
  band: "#64748b",
  equipment: "#94a3b8",
  wall: "#cbd5e1",
  floor: "#e2e8f0",
  accentRehab: "#9333ea",
} as const;

export function medicalSketchSvg(inner: string, viewBox = "0 0 96 96"): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none" role="img" aria-hidden="true">
  <rect width="96" height="96" rx="12" fill="${MEDICAL_SKETCH.background}"/>
  ${inner}
</svg>`;
}

export function toSketchDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
